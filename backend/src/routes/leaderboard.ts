import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ok } from "../lib/http.js";
import { resolveStoredMediaUrl } from "../lib/storedMediaUrl.js";
import { levelFromXp } from "../lib/levels.js";
import { attachPublicIds } from "../lib/userPublicId.js";
import { getCachedLeaderboard, setCachedLeaderboard } from "../lib/cache.js";

export const leaderboardRouter = Router();

type LeaderboardAggRow = {
  id: string;
  createdAt: Date;
  nickname: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  frameKey: string | null;
  level: number;
  xp: number;
  achievementCount: number;
  totalPoints: number;
};

leaderboardRouter.get("/", requireAuth, async (_req, res) => {
  const cached = getCachedLeaderboard<ReturnType<typeof attachPublicIds>>();
  if (cached) {
    res.setHeader("Cache-Control", "private, max-age=20");
    return ok(res, cached);
  }

  const rows = await prisma.$queryRaw<LeaderboardAggRow[]>`
    SELECT
      u.id,
      u."createdAt",
      u.nickname,
      u."avatarPath",
      u."avatarUrl",
      u."frameKey",
      u.level,
      u.xp,
      COUNT(ua."achievementId")::int AS "achievementCount",
      COALESCE(SUM(a.points), 0)::int AS "totalPoints"
    FROM "User" u
    LEFT JOIN "UserAchievement" ua ON ua."userId" = u.id
    LEFT JOIN "Achievement" a ON a.id = ua."achievementId"
    GROUP BY u.id, u."createdAt", u.nickname, u."avatarPath", u."avatarUrl", u."frameKey", u.level, u.xp
    ORDER BY "totalPoints" DESC, u.xp DESC
    LIMIT 100
  `;

  const normalized = rows.map((r) => ({
    ...r,
    achievementCount: Number(r.achievementCount),
    totalPoints: Number(r.totalPoints),
  }));

  const mapped = attachPublicIds(normalized).map((u) => {
    const lv = levelFromXp(u.xp);
    return {
      id: u.id,
      publicId: u.publicId,
      nickname: u.nickname,
      avatarUrl: resolveStoredMediaUrl(u.avatarUrl, u.avatarPath),
      frameKey: u.frameKey,
      totalPoints: u.totalPoints,
      achievementCount: u.achievementCount,
      level: lv.level,
      xp: u.xp,
      xpIntoLevel: lv.xpIntoLevel,
      xpForNext: lv.xpForNext,
    };
  });

  setCachedLeaderboard(mapped);
  res.setHeader("Cache-Control", "private, max-age=20");
  return ok(res, mapped);
});
