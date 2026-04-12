import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";

export const achievementsRouter = Router();

// List achievements visible to current user (public + private granted to them).
// Includes "earned" flag for UI.
achievementsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const RarityEnum = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "SECRET", "EXCLUSIVE"]);
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
  const searchWhere =
    q?.trim()
      ? {
          OR: [
            { title: { contains: q.trim() } },
            { description: { contains: q.trim() } },
          ],
        }
      : null;

  const achievements = await prisma.achievement.findMany({
    where: {
      AND: [{ isPublic: true }, ...(searchWhere ? [searchWhere] : [])],
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
    },
  });

  const awards = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: achievements.map((a) => a.id) } },
    select: { achievementId: true, awardedAt: true },
  });
  const awardsMap = new Map(awards.map((a) => [a.achievementId, a.awardedAt]));

  const mapped = achievements.map((a) => {
    const award = awardsMap.get(a.id) ?? null;
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
      earned: Boolean(award),
      awardedAt: award ?? null,
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

  return ok(res, sorted);
});

