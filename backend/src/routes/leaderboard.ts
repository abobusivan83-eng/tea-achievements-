import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ok } from "../lib/http.js";
import { resolveStoredMediaUrl } from "../lib/storedMediaUrl.js";
import { levelFromXp } from "../lib/levels.js";
import { attachPublicIds } from "../lib/userPublicId.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", requireAuth, async (_req, res) => {
  // Aggregate points per user
  const rows = await prisma.user.findMany({
    select: {
      id: true,
      createdAt: true,
      nickname: true,
      avatarPath: true,
      avatarUrl: true,
      frameKey: true,
      level: true,
      xp: true,
      achievements: {
        select: { achievement: { select: { points: true } } },
      },
    },
  });

  const mapped = attachPublicIds(rows)
    .map((u) => {
      const points = u.achievements.reduce((sum, x) => sum + x.achievement.points, 0);
      const count = u.achievements.length;
      const lv = levelFromXp(u.xp);
      return {
        id: u.id,
        publicId: u.publicId,
        nickname: u.nickname,
        avatarUrl: resolveStoredMediaUrl(u.avatarUrl, u.avatarPath),
        frameKey: u.frameKey,
        totalPoints: points,
        achievementCount: count,
        level: lv.level,
        xp: u.xp,
        xpIntoLevel: lv.xpIntoLevel,
        xpForNext: lv.xpForNext,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return ok(res, mapped.slice(0, 100));
});

