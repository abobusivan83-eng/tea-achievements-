import { createHash } from "crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getCachedAchievementCatalog, setCachedAchievementCatalog } from "../lib/cache.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { achievementCatalogWhereForUser } from "../lib/achievementVisibility.js";

export const achievementsRouter = Router();

// List achievements visible to current user (public + private granted to them).
// Includes "earned" flag for UI.
achievementsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  /* SECRET не используется в фильтре каталога на клиенте */
  const RarityEnum = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "EXCLUSIVE"]);
  const QuerySchema = z.object({
    rarity: RarityEnum.optional(),
    q: z.string().min(1).max(64).optional(),
    only: z.enum(["all", "earned", "locked"]).default("all"),
    sort: z.enum(["new", "rarity", "points"]).default("new"),
  });

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return fail(res, 400, "Invalid query");
  const { rarity, q, only, sort } = parsed.data;

  const userId = req.user!.id;
  const now = new Date();
  /** Несколько слов через пробел — все должны встречаться в названии или описании (удобно для русского текста). */
  const searchTokens = q?.trim() ? q.trim().split(/\s+/).filter((t) => t.length > 0).slice(0, 8) : [];

  const catalogHash = createHash("sha1")
    .update(`${userId}\n${rarity ?? ""}\n${only}\n${sort}\n${searchTokens.join("\u241f")}`)
    .digest("hex");
  const catalogHit = getCachedAchievementCatalog<unknown[]>(userId, catalogHash);
  if (catalogHit !== undefined) {
    res.setHeader("Cache-Control", "private, max-age=35");
    return ok(res, catalogHit);
  }
  const searchWhere: Prisma.AchievementWhereInput | null =
    searchTokens.length > 0
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { title: { contains: token, mode: "insensitive" } },
              { description: { contains: token, mode: "insensitive" } },
            ],
          })),
        }
      : null;

  const achievements = await prisma.achievement.findMany({
    where: {
      AND: [achievementCatalogWhereForUser(userId), ...(searchWhere ? [searchWhere] : [])],
      ...(rarity ? { rarity: rarity as import("@prisma/client").Rarity } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      rarity: true,
      points: true,
      iconPath: true,
      frameKey: true,
      isPublic: true,
      createdAt: true,
      task: { select: { conditions: true, startsAt: true, endsAt: true, isActive: true } },
    },
  });

  const awards = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: achievements.map((a) => a.id) } },
    select: { achievementId: true, awardedAt: true },
  });
  const awardsMap = new Map(awards.map((a) => [a.achievementId, a.awardedAt]));

  const mapped = achievements.map((a) => {
    const award = awardsMap.get(a.id) ?? null;
    const earned = Boolean(award);
    const task = a.task;
    const taskConditions = task?.conditions?.trim() ? task.conditions.trim() : null;
    let scheduleLocked = false;
    let eventEnded = false;
    if (!earned && a.isPublic && task && task.isActive !== false) {
      if (task.endsAt && task.endsAt < now) eventEnded = true;
      else if (task.startsAt && task.startsAt > now) scheduleLocked = true;
    }
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      rarity: a.rarity,
      points: a.points,
      iconUrl: toPublicFileUrl(a.iconPath),
      frameKey: a.frameKey,
      isPublic: a.isPublic,
      createdAt: a.createdAt,
      earned,
      awardedAt: award ?? null,
      taskConditions,
      taskStartsAt: task?.startsAt?.toISOString() ?? null,
      taskEndsAt: task?.endsAt?.toISOString() ?? null,
      scheduleLocked,
      eventEnded,
    };
  });

  const filtered =
    only === "earned" ? mapped.filter((a) => a.earned) : only === "locked" ? mapped.filter((a) => !a.earned) : mapped;

  const rarityRank: Record<string, number> = {
    COMMON: 1,
    RARE: 2,
    EPIC: 3,
    LEGENDARY: 4,
    SECRET: 5,
    EXCLUSIVE: 6,
  };

  const sorted = filtered.sort((a, b) => {
    if (sort === "points") return b.points - a.points;
    if (sort === "rarity") return (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0);
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  setCachedAchievementCatalog(userId, catalogHash, sorted);
  res.setHeader("Cache-Control", "private, max-age=35");
  return ok(res, sorted);
});

