import { Router } from "express";
import { z } from "zod";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { avatarUpload, bannerUpload } from "../middleware/uploads.js";
import { env } from "../lib/env.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { resolveStoredMediaUrl } from "../lib/storedMediaUrl.js";
import { levelFromXp } from "../lib/levels.js";
import { computeUserPublicId } from "../lib/userPublicId.js";
import { invalidateLeaderboardCache, invalidateUserProfileCache, getCachedUserProfile, setCachedUserProfile } from "../lib/cache.js";
import {
  ADMIN_BADGE_KEYS,
  canUseFrameKey,
  canUseStatusEmoji,
  parseJsonStringArray,
} from "../lib/cosmeticsAccess.js";

export const usersRouter = Router();

function toRelUploadPath(absPath: string) {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const rel = path.relative(process.cwd(), absPath);
  // Ensure it always starts with uploads/
  if (rel.startsWith(env.UPLOAD_DIR)) return rel.replaceAll("\\", "/");
  return path.relative(process.cwd(), path.join(uploadRoot, path.basename(absPath))).replaceAll("\\", "/");
}

const UpdateProfileSchema = z.object({
  nickname: z.string().min(2).max(24).optional(),
  frameKey: z.string().min(1).max(64).nullable().optional(),
  badges: z.array(z.string().min(1).max(64)).max(24).optional(),
  statusEmoji: z.string().min(1).max(8).nullable().optional(),
});

// Self profile editable settings (frame/badges/nickname)
usersRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const purchases = await prisma.shopPurchase.findMany({
    where: { userId: req.user!.id },
    select: { item: { select: { type: true, key: true } } },
    take: 500,
  });
  const ownedKeys = new Set(purchases.map((row) => row.item.key));

  const self = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { unlockedFramesJson: true, unlockedStatusesJson: true },
  });
  const unlockedFrames = new Set(parseJsonStringArray(self?.unlockedFramesJson));
  const unlockedStatuses = new Set(parseJsonStringArray(self?.unlockedStatusesJson));

  if (parsed.data.frameKey !== undefined && parsed.data.frameKey !== null) {
    if (
      !canUseFrameKey({
        role: req.user!.role,
        unlockedFrames,
        frameKey: parsed.data.frameKey,
      })
    ) {
      return fail(res, 403, "Frame is not unlocked");
    }
  }

  if (parsed.data.badges) {
    const invalidBadge = parsed.data.badges.find(
      (key) => !ownedKeys.has(key) && req.user!.role !== "ADMIN" && req.user!.role !== "CREATOR",
    );
    if (invalidBadge) return fail(res, 403, "Badge is not unlocked");
  }

  if (parsed.data.statusEmoji !== undefined && parsed.data.statusEmoji !== null) {
    if (
      !canUseStatusEmoji({
        role: req.user!.role,
        unlockedStatuses,
        emoji: parsed.data.statusEmoji,
      })
    ) {
      return fail(res, 403, "Status emoji is not unlocked");
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      nickname: parsed.data.nickname,
      frameKey: parsed.data.frameKey ?? undefined,
      badgesJson: parsed.data.badges ? parsed.data.badges : undefined,
      statusEmoji: parsed.data.statusEmoji ?? undefined,
    },
    select: {
      id: true,
      nickname: true,
      frameKey: true,
      badgesJson: true,
      statusEmoji: true,
      unlockedFramesJson: true,
      unlockedStatusesJson: true,
    },
  });
  invalidateUserProfileCache(req.user!.id);
  invalidateLeaderboardCache();
  return ok(res, {
    ...user,
    unlockedFrames: parseJsonStringArray(user.unlockedFramesJson),
    unlockedStatuses: parseJsonStringArray(user.unlockedStatusesJson),
  });
});

// Upload avatar
usersRouter.post(
  "/me/avatar",
  requireAuth,
  avatarUpload,
  async (req: AuthedRequest, res) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, "No file");

    const relPath = toRelUploadPath(file.path);
    const publicUrl = toPublicFileUrl(relPath);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarPath: relPath, avatarUrl: publicUrl },
      select: { id: true, avatarUrl: true, avatarPath: true },
    });
    invalidateUserProfileCache(req.user!.id);
    return ok(res, { avatarUrl: resolveStoredMediaUrl(user.avatarUrl, user.avatarPath) });
  },
);

// Upload banner
usersRouter.post(
  "/me/banner",
  requireAuth,
  bannerUpload,
  async (req: AuthedRequest, res) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, "No file");

    const relPath = toRelUploadPath(file.path);
    const publicUrl = toPublicFileUrl(relPath);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { bannerPath: relPath, bannerUrl: publicUrl },
      select: { id: true, bannerUrl: true, bannerPath: true },
    });
    invalidateUserProfileCache(req.user!.id);
    return ok(res, { bannerUrl: resolveStoredMediaUrl(user.bannerUrl, user.bannerPath) });
  },
);

// Public profile (Steam-like card with achievements)
usersRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) return fail(res, 400, "Invalid user id");

  const targetId = idParsed.data;
  const viewerId = req.user!.id;
  const canBypassBlocked = viewerId === targetId || req.user!.role === "ADMIN";
  const cached = getCachedUserProfile<{
    user: { blocked: boolean };
    achievements: unknown;
  }>(targetId);
  if (cached) {
    if (cached.user.blocked && !canBypassBlocked) return fail(res, 403, "User blocked");
    return ok(res, cached);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      nickname: true,
      role: true,
      blocked: true,
      level: true,
      xp: true,
      avatarUrl: true,
      bannerUrl: true,
      avatarPath: true,
      bannerPath: true,
      frameKey: true,
      badgesJson: true,
      statusEmoji: true,
      createdAt: true,
    },
  });
  if (!target) return fail(res, 404, "User not found");
  if (target.blocked && !canBypassBlocked) return fail(res, 403, "User blocked");

  // Determine which achievements are visible to the viewer for this target user.
  // Public achievements are visible to everyone. Private achievements are visible only if access exists for that target user.
  const [visibleAchievements, totalUsers, publicId] = await Promise.all([
    prisma.achievement.findMany({
      where: {
        OR: [
          { isPublic: true },
          { isPublic: false, accessGrants: { some: { userId: targetId } } },
        ],
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
        awards: { where: { userId: targetId }, select: { awardedAt: true } },
      },
      orderBy: [{ rarity: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.count(),
    computeUserPublicId(prisma as any, target.id),
  ]);

  const earned = visibleAchievements
    .filter((a) => a.awards.length > 0)
    .map((a) => ({
      ...a,
      iconUrl: toPublicFileUrl(a.iconPath),
      awardedAt: a.awards[0]!.awardedAt,
    }));

  const earnedIds = earned.map((x) => x.id);
  const usageRows = earnedIds.length
    ? await prisma.userAchievement.groupBy({
        by: ["achievementId"],
        where: { achievementId: { in: earnedIds } },
        _count: { achievementId: true },
      })
    : [];
  const usageMap = new Map(usageRows.map((x) => [x.achievementId, x._count.achievementId]));
  const earnedWithShare = earned.map((x) => ({
    ...x,
    ownerPct: totalUsers > 0 ? Math.round(((usageMap.get(x.id) ?? 0) / totalUsers) * 1000) / 10 : 0,
  }));

  const locked = visibleAchievements
    .filter((a) => a.awards.length === 0)
    .map((a) => ({ ...a, iconUrl: toPublicFileUrl(a.iconPath) }));

  const payload = {
    user: {
      ...target,
      publicId,
      level: levelFromXp(target.xp).level,
      avatarUrl: resolveStoredMediaUrl(target.avatarUrl, target.avatarPath),
      bannerUrl: resolveStoredMediaUrl(target.bannerUrl, target.bannerPath),
      badges: (target.badgesJson as unknown as string[] | null) ?? [],
    },
    achievements: { earned: earnedWithShare, locked },
  };
  setCachedUserProfile(targetId, payload);
  return ok(res, payload);
});

