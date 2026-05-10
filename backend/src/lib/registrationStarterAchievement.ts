import type { PrismaClient } from "@prisma/client";
import { awardAchievementToUser } from "./achievementAwards.js";
import {
  invalidateAchievementCatalogForUser,
  invalidateLeaderboardCache,
  invalidateTasksListCache,
  invalidateUserProfileCache,
} from "./cache.js";
import { logger } from "./logger.js";

/** Приоритет: актуальное имя в проде, затем заголовок из старого сида. */
const STARTER_ACHIEVEMENT_TITLE_CANDIDATES = ["Новый лист", "Добро пожаловать в клан"] as const;

export async function tryAwardStarterAchievementAfterRegistration(db: PrismaClient, userId: string): Promise<void> {
  let achievementId: string | null = null;
  for (const title of STARTER_ACHIEVEMENT_TITLE_CANDIDATES) {
    const row = await db.achievement.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
      select: { id: true },
    });
    if (row) {
      achievementId = row.id;
      break;
    }
  }
  if (!achievementId) {
    logger.warn(
      "[auth] Starter achievement not found in DB (expected title «Новый лист» or «Добро пожаловать в клан»). Skipping auto-award.",
    );
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      await awardAchievementToUser(tx, { achievementId, userId });
    });
    invalidateUserProfileCache(userId);
    invalidateTasksListCache(userId);
    invalidateAchievementCatalogForUser(userId);
    invalidateLeaderboardCache();
  } catch (err) {
    logger.error("[auth] Failed to award starter achievement after registration", {
      userId,
      achievementId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
