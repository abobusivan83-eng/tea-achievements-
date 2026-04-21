import type { Prisma } from "@prisma/client";
import { levelFromXp } from "./levels.js";

type AwardDb = Pick<
  Prisma.TransactionClient,
  "achievement" | "userAchievement" | "achievementAccess" | "user"
>;

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

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

export async function awardAchievementToUsers(
  db: AwardDb,
  params: { achievementId: string; userIds: string[] },
): Promise<{ awardedUserIds: string[]; alreadyUserIds: string[] }> {
  const userIds = uniqueIds(params.userIds);
  if (!userIds.length) return { awardedUserIds: [], alreadyUserIds: [] };

  const ach = await db.achievement.findUnique({
    where: { id: params.achievementId },
    select: { id: true, points: true, isPublic: true },
  });
  if (!ach) throw new Error("Achievement not found");

  const [existingAwards, users] = await Promise.all([
    db.userAchievement.findMany({
      where: { achievementId: params.achievementId, userId: { in: userIds } },
      select: { userId: true },
    }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, xp: true },
    }),
  ]);

  const existingUserIds = new Set(existingAwards.map((row) => row.userId));
  const eligibleUsers = users.filter((user) => !existingUserIds.has(user.id));
  if (!eligibleUsers.length) {
    return { awardedUserIds: [], alreadyUserIds: [...existingUserIds] };
  }

  await db.userAchievement.createMany({
    data: eligibleUsers.map((user) => ({
      userId: user.id,
      achievementId: params.achievementId,
    })),
    skipDuplicates: true,
  });

  if (!ach.isPublic) {
    await db.achievementAccess.createMany({
      data: eligibleUsers.map((user) => ({
        achievementId: params.achievementId,
        userId: user.id,
      })),
      skipDuplicates: true,
    });
  }

  await Promise.all(
    eligibleUsers.map((user) => {
      const nextXp = Math.max(0, user.xp + ach.points);
      return db.user.update({
        where: { id: user.id },
        data: { xp: nextXp, level: levelFromXp(nextXp).level },
        select: { id: true },
      });
    }),
  );

  return {
    awardedUserIds: eligibleUsers.map((user) => user.id),
    alreadyUserIds: [...existingUserIds],
  };
}

export async function revokeAchievementFromUsers(
  db: AwardDb,
  params: { achievementId: string; userIds: string[] },
): Promise<{ revokedUserIds: string[]; missingUserIds: string[] }> {
  const userIds = uniqueIds(params.userIds);
  if (!userIds.length) return { revokedUserIds: [], missingUserIds: [] };

  const ach = await db.achievement.findUnique({
    where: { id: params.achievementId },
    select: { id: true, points: true },
  });
  if (!ach) throw new Error("Achievement not found");

  const [existingAwards, users] = await Promise.all([
    db.userAchievement.findMany({
      where: { achievementId: params.achievementId, userId: { in: userIds } },
      select: { userId: true },
    }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, xp: true },
    }),
  ]);

  const existingUserIds = new Set(existingAwards.map((row) => row.userId));
  const affectedUsers = users.filter((user) => existingUserIds.has(user.id));
  if (!affectedUsers.length) {
    return { revokedUserIds: [], missingUserIds: userIds };
  }

  await db.userAchievement.deleteMany({
    where: { achievementId: params.achievementId, userId: { in: affectedUsers.map((user) => user.id) } },
  });

  await Promise.all(
    affectedUsers.map((user) => {
      const nextXp = Math.max(0, user.xp - ach.points);
      return db.user.update({
        where: { id: user.id },
        data: { xp: nextXp, level: levelFromXp(nextXp).level },
        select: { id: true },
      });
    }),
  );

  return {
    revokedUserIds: affectedUsers.map((user) => user.id),
    missingUserIds: userIds.filter((userId) => !existingUserIds.has(userId)),
  };
}

export async function revokeAchievementsFromUser(
  db: AwardDb,
  params: { achievementIds: string[]; userId: string },
): Promise<{ revokedAchievementIds: string[]; missingAchievementIds: string[] }> {
  const achievementIds = uniqueIds(params.achievementIds);
  if (!achievementIds.length) return { revokedAchievementIds: [], missingAchievementIds: [] };

  const [achievements, existingAwards, user] = await Promise.all([
    db.achievement.findMany({
      where: { id: { in: achievementIds } },
      select: { id: true, points: true },
    }),
    db.userAchievement.findMany({
      where: { userId: params.userId, achievementId: { in: achievementIds } },
      select: { achievementId: true },
    }),
    db.user.findUnique({
      where: { id: params.userId },
      select: { id: true, xp: true },
    }),
  ]);

  if (!user) return { revokedAchievementIds: [], missingAchievementIds: achievementIds };

  const pointsByAchievementId = new Map(achievements.map((achievement) => [achievement.id, achievement.points]));
  const existingAchievementIds = existingAwards
    .map((award) => award.achievementId)
    .filter((achievementId) => pointsByAchievementId.has(achievementId));

  if (!existingAchievementIds.length) {
    return { revokedAchievementIds: [], missingAchievementIds: achievementIds };
  }

  await db.userAchievement.deleteMany({
    where: { userId: params.userId, achievementId: { in: existingAchievementIds } },
  });

  const totalPointsToRemove = existingAchievementIds.reduce(
    (sum, achievementId) => sum + (pointsByAchievementId.get(achievementId) ?? 0),
    0,
  );
  const nextXp = Math.max(0, user.xp - totalPointsToRemove);
  await db.user.update({
    where: { id: params.userId },
    data: { xp: nextXp, level: levelFromXp(nextXp).level },
    select: { id: true },
  });

  return {
    revokedAchievementIds: existingAchievementIds,
    missingAchievementIds: achievementIds.filter((achievementId) => !existingAchievementIds.includes(achievementId)),
  };
}
