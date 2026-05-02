import { prisma } from "./prisma.js";
import { AchievementProgramKey } from "./achievementProgramKeys.js";
import { grantAchievementByProgramKey } from "./grantAchievement.js";
import {
  invalidateLeaderboardCache,
  invalidateSupportUnreadCountCache,
  invalidateTasksListCache,
  invalidateUserProfileCache,
} from "./cache.js";

/**
 * Выдаёт достижения за уровни (10 / 30 / 60 / 100). Идемпотентно: уже имеющиеся не дублируются.
 * После выдачи коллекционные триггеры работают через grantAchievement (если не передать skipCollector).
 */
export async function applyLevelMilestoneAchievements(userId: string, depth = 0): Promise<void> {
  if (depth > 8) return;

  const userBefore = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true },
  });
  if (!userBefore) return;

  const milestones: Array<{ minLevel: number; key: string }> = [
    { minLevel: 10, key: AchievementProgramKey.LEVEL_10 },
    { minLevel: 30, key: AchievementProgramKey.LEVEL_30 },
    { minLevel: 60, key: AchievementProgramKey.LEVEL_60 },
    { minLevel: 100, key: AchievementProgramKey.LEVEL_100 },
  ];

  let newAchievementUnlocked = false;

  await prisma.$transaction(async (tx) => {
    for (const m of milestones) {
      if (userBefore.level < m.minLevel) continue;
      const r = await grantAchievementByProgramKey(tx, { userId, programKey: m.key }, {});
      if (r.granted && !r.already) newAchievementUnlocked = true;
    }
  });

  if (newAchievementUnlocked) {
    invalidateSupportUnreadCountCache(userId);
    invalidateUserProfileCache(userId);
    invalidateTasksListCache(userId);
    invalidateLeaderboardCache();
  }

  const userAfter = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true },
  });
  if (userAfter && userAfter.level !== userBefore.level) {
    await applyLevelMilestoneAchievements(userId, depth + 1);
  }
}
