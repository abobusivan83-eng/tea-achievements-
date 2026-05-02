import type { Prisma } from "@prisma/client";
import { awardAchievementToUser } from "./achievementAwards.js";
import { AchievementProgramKey } from "./achievementProgramKeys.js";

export type GrantAchievementDb = Pick<
  Prisma.TransactionClient,
  "achievement" | "userAchievement" | "achievementAccess" | "user" | "notification"
>;

export async function grantAchievementByProgramKey(
  tx: GrantAchievementDb,
  params: { userId: string; programKey: string },
  options?: { skipCollectorMilestones?: boolean; skipNotification?: boolean },
): Promise<{ granted: boolean; already: boolean }> {
  const ach = await tx.achievement.findUnique({
    where: { programKey: params.programKey },
    select: { id: true, title: true },
  });
  if (!ach) {
    console.warn(`[grantAchievement] No Achievement.programKey=${params.programKey}`);
    return { granted: false, already: false };
  }
  return grantAchievementById(
    tx,
    { userId: params.userId, achievementId: ach.id, title: ach.title },
    options,
  );
}

export async function grantAchievementById(
  tx: GrantAchievementDb,
  params: { userId: string; achievementId: string; title: string },
  options?: { skipCollectorMilestones?: boolean; skipNotification?: boolean },
): Promise<{ granted: boolean; already: boolean }> {
  const awarded = await awardAchievementToUser(tx, {
    achievementId: params.achievementId,
    userId: params.userId,
  });

  if (awarded.already) {
    return { granted: true, already: true };
  }

  if (!options?.skipNotification) {
    await tx.notification.create({
      data: {
        type: "ACH",
        userId: params.userId,
        adminName: null,
        isRead: false,
        text: `Поздравляем! Вы получили новое достижение: ${params.title}`,
      },
    });
  }

  if (!options?.skipCollectorMilestones) {
    await applyCollectorMilestones(tx, params.userId);
  }

  return { granted: true, already: false };
}

async function applyCollectorMilestones(tx: GrantAchievementDb, userId: string) {
  const count = await tx.userAchievement.count({ where: { userId } });
  const milestones: Array<{ n: number; key: string }> = [
    { n: 5, key: AchievementProgramKey.COLLECTOR_5 },
    { n: 12, key: AchievementProgramKey.COLLECTOR_12 },
    { n: 25, key: AchievementProgramKey.COLLECTOR_25 },
  ];

  for (const m of milestones) {
    if (count !== m.n) continue;
    const ach = await tx.achievement.findUnique({
      where: { programKey: m.key },
      select: { id: true, title: true },
    });
    if (!ach) continue;
    await grantAchievementById(
      tx,
      { userId, achievementId: ach.id, title: ach.title },
      { skipCollectorMilestones: true, skipNotification: false },
    );
    break;
  }
}
