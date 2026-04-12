import type { Prisma } from "@prisma/client";
import { levelFromXp } from "./levels.js";

type AwardDb = Pick<
  Prisma.TransactionClient,
  "achievement" | "userAchievement" | "achievementAccess" | "user"
>;

export async function awardAchievementToUser(
  db: AwardDb,
  params: { achievementId: string; userId: string },
): Promise<{ awarded: true; already: boolean }> {
  const ach = await db.achievement.findUnique({
    where: { id: params.achievementId },
    select: { id: true, points: true, isPublic: true },
  });
  if (!ach) throw new Error("Achievement not found");

  const already = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId: params.userId, achievementId: params.achievementId } },
  });
  if (already) return { awarded: true, already: true };

  await db.userAchievement.create({
    data: { userId: params.userId, achievementId: params.achievementId },
  });

  if (!ach.isPublic) {
    await db.achievementAccess.upsert({
      where: { achievementId_userId: { achievementId: params.achievementId, userId: params.userId } },
      create: { achievementId: params.achievementId, userId: params.userId },
      update: {},
    });
  }

  const current = await db.user.findUnique({
    where: { id: params.userId },
    select: { xp: true },
  });
  if (!current) return { awarded: true, already: false };

  const nextXp = Math.max(0, current.xp + ach.points);
  await db.user.update({
    where: { id: params.userId },
    data: { xp: nextXp, level: levelFromXp(nextXp).level },
  });
  return { awarded: true, already: false };
}

export async function revokeAchievementFromUser(
  db: AwardDb,
  params: { achievementId: string; userId: string },
): Promise<{ revoked: true; existed: boolean }> {
  const ach = await db.achievement.findUnique({
    where: { id: params.achievementId },
    select: { id: true, points: true },
  });
  if (!ach) throw new Error("Achievement not found");

  const existed = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId: params.userId, achievementId: params.achievementId } },
  });
  if (!existed) return { revoked: true, existed: false };

  await db.userAchievement.delete({
    where: { userId_achievementId: { userId: params.userId, achievementId: params.achievementId } },
  });

  const current = await db.user.findUnique({
    where: { id: params.userId },
    select: { xp: true },
  });
  if (!current) return { revoked: true, existed: true };

  const nextXp = Math.max(0, current.xp - ach.points);
  await db.user.update({
    where: { id: params.userId },
    data: { xp: nextXp, level: levelFromXp(nextXp).level },
  });
  return { revoked: true, existed: true };
}
