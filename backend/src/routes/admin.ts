import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, requireStaff, type AuthedRequest } from "../middleware/auth.js";
import type { Response } from "express";
import { upload } from "../middleware/uploads.js";
import { env } from "../lib/env.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { MAX_LEVEL, levelFromXp, xpForLevel } from "../lib/levels.js";
import { attachPublicIds } from "../lib/userPublicId.js";
import { awardAchievementToUser, revokeAchievementFromUser } from "../lib/achievementAwards.js";
import { getAdminDisplayName, logAdminAction } from "../lib/adminAudit.js";
import { invalidateShopItemsCache, invalidateSupportUnreadCountCache } from "../lib/cache.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireStaff);

function adminOnly(req: AuthedRequest, res: Response): boolean {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "CREATOR") {
    fail(res, 403, "Только администратор");
    return false;
  }
  return true;
}

function assertExclusiveForCreator(req: AuthedRequest, res: Response, rarity: string): boolean {
  if (rarity === "EXCLUSIVE" && req.user?.role !== "CREATOR") {
    fail(res, 403, "Редкость «Эксклюзив (создатель)» может задать только роль создателя клана");
    return false;
  }
  return true;
}

const ATTACHMENTS_MARKER = "\n[[attachments:";
function parseRichDescription(value: string): { text: string; images: string[] } {
  const idx = value.indexOf(ATTACHMENTS_MARKER);
  if (idx < 0) return { text: value, images: [] };
  const text = value.slice(0, idx).trimEnd();
  const tail = value.slice(idx + ATTACHMENTS_MARKER.length).trim();
  if (!tail.endsWith("]]")) return { text: value, images: [] };
  const raw = tail.slice(0, -2);
  try {
    const parsed = JSON.parse(raw);
    return { text, images: Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [] };
  } catch {
    return { text: value, images: [] };
  }
}

const SupportStatusSchema = z.enum(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"]);

function supportStatusLabel(status: z.infer<typeof SupportStatusSchema>) {
  switch (status) {
    case "REVIEWED":
      return "Рассмотрено";
    case "RESOLVED":
      return "Решено";
    case "REJECTED":
      return "Отклонено";
    default:
      return "Ожидает";
  }
}

function reportReasonRu(reason: string) {
  switch (reason) {
    case "spam":
      return "Спам";
    case "insult":
      return "Оскорбления / токсичность";
    case "cheat":
      return "Нечестная игра / читы";
    case "other":
      return "Другое";
    default:
      return reason;
  }
}

async function createSupportNotification(params: {
  userId: string;
  adminDisplayName: string;
  kind: "suggestion" | "report";
  suggestionTitle?: string;
  reportReason?: string;
  reportedUserNickname?: string | null;
  status?: z.infer<typeof SupportStatusSchema>;
  adminResponse?: string | null;
}) {
  const parts: string[] = [];
  if (params.kind === "suggestion") {
    parts.push("Ответ администрации по вашему предложению");
    if (params.suggestionTitle) parts.push(`Тема: ${params.suggestionTitle}`);
  } else {
    parts.push("Ответ администрации по вашей жалобе");
    parts.push(`Причина обращения: ${reportReasonRu(params.reportReason ?? "")}`);
    if (params.reportedUserNickname) parts.push(`Жалоба на пользователя: ${params.reportedUserNickname}`);
  }
  parts.push(`Администратор: ${params.adminDisplayName}`);
  if (params.status) parts.push(`Статус: ${supportStatusLabel(params.status)}`);
  if (params.adminResponse?.trim()) parts.push(`Ответ: ${params.adminResponse.trim()}`);

  await prisma.notification.create({
    data: {
      type: "SUPPORT",
      userId: params.userId,
      adminName: params.adminDisplayName,
      text: parts.join("\n"),
    },
  });
  invalidateSupportUnreadCountCache(params.userId);
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toRelUploadPath(absPath: string) {
  const rel = path.relative(process.cwd(), absPath);
  return rel.replaceAll("\\", "/");
}

const CreateAchievementSchema = z.object({
  title: z.string().min(2).max(64),
  description: z.string().min(2).max(256),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "EXCLUSIVE"]),
  points: z.coerce.number().int().min(1).max(10000).optional(),
  isPublic: z.coerce.boolean().default(true),
  awardUserIds: z.array(z.string().uuid()).max(200).optional(),
});

adminRouter.get("/achievements", async (_req, res) => {
  const items = await prisma.achievement.findMany({
    orderBy: { createdAt: "desc" },
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
      updatedAt: true,
    },
    take: 500,
  });

  return ok(
    res,
    items.map((a) => ({
      ...a,
      iconUrl: toPublicFileUrl(a.iconPath),
    })),
  );
});

adminRouter.post("/achievements", async (req: AuthedRequest, res) => {
  const parsed = CreateAchievementSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  if (!assertExclusiveForCreator(req, res, parsed.data.rarity)) return;

  const defaultPointsByRarity: Record<string, number> = {
    COMMON: 10,
    RARE: 30,
    EPIC: 70,
    LEGENDARY: 150,
    EXCLUSIVE: 320,
  };

  const uniqueAwardUserIds = [...new Set(parsed.data.awardUserIds ?? [])];

  const a = await prisma.$transaction(async (tx) => {
    const created = await tx.achievement.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        rarity: parsed.data.rarity as import("@prisma/client").Rarity,
        points: parsed.data.points ?? defaultPointsByRarity[parsed.data.rarity],
        isPublic: parsed.data.isPublic,
        createdById: req.user!.id,
      },
      select: { id: true, title: true, rarity: true, points: true, isPublic: true },
    });

    for (const userId of uniqueAwardUserIds) {
      await awardAchievementToUser(tx, { achievementId: created.id, userId });
    }

    return created;
  });

  return ok(res, { ...a, awardedUserIds: uniqueAwardUserIds });
});

const UpdateAchievementSchema = z.object({
  title: z.string().min(2).max(64).optional(),
  description: z.string().min(2).max(256).optional(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "EXCLUSIVE"]).optional(),
  points: z.coerce.number().int().min(1).max(10000).optional(),
  isPublic: z.coerce.boolean().optional(),
});

const CreateShopItemSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.enum(["FRAME", "BADGE"]),
  key: z.string().min(1).max(64),
  price: z.coerce.number().int().min(1).max(1_000_000),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]),
  description: z.string().max(300).nullable().optional(),
  icon: z.string().max(32).nullable().optional(),
});

const UpdateShopItemSchema = CreateShopItemSchema.partial();

adminRouter.patch("/achievements/:id", async (req: AuthedRequest, res) => {
  const parsed = UpdateAchievementSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");
  if (parsed.data.rarity && !assertExclusiveForCreator(req, res, parsed.data.rarity)) return;

  const updated = await prisma.achievement.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      rarity: parsed.data.rarity as import("@prisma/client").Rarity | undefined,
      points: parsed.data.points,
      isPublic: typeof parsed.data.isPublic === "boolean" ? parsed.data.isPublic : undefined,
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
      updatedAt: true,
    },
  });

  return ok(res, { ...updated, iconUrl: toPublicFileUrl(updated.iconPath) });
});

adminRouter.delete("/achievements/:id", async (req, res) => {
  const achievementId = req.params.id;
  const exists = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!exists) return fail(res, 404, "Achievement not found");

  await prisma.achievement.delete({ where: { id: achievementId } });
  return ok(res, { deleted: true });
});

// Upload achievement icon (image)
adminRouter.post("/achievements/:id/icon", upload.single("file"), async (req, res) => {
  const achievementId = req.params.id;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return fail(res, 400, "No file");

  // Move file into achievements folder for tidier storage
  const destDir = path.resolve(process.cwd(), env.UPLOAD_DIR, "achievements");
  ensureDir(destDir);

  const destPath = path.join(destDir, path.basename(file.path));
  fs.renameSync(file.path, destPath);

  const relPath = toRelUploadPath(destPath);
  const updated = await prisma.achievement.update({
    where: { id: achievementId },
    data: { iconPath: relPath },
    select: { id: true, iconPath: true },
  });

  return ok(res, { iconUrl: toPublicFileUrl(updated.iconPath) });
});

const AwardSchema = z.object({
  userId: z.string().uuid(),
});

const RevokeManySchema = z.object({
  achievementIds: z.array(z.string().uuid()).min(1).max(200),
});

adminRouter.post("/achievements/:id/award", async (req: AuthedRequest, res) => {
  const achievementId = req.params.id;
  const parsed = AwardSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  // Ensure access exists for private achievements.
  const ach = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!ach) return fail(res, 404, "Achievement not found");

  if (!ach.isPublic) {
    await prisma.achievementAccess.upsert({
      where: { achievementId_userId: { achievementId, userId: parsed.data.userId } },
      create: { achievementId, userId: parsed.data.userId },
      update: {},
    });
  }

  await prisma.$transaction(async (tx) => {
    await awardAchievementToUser(tx, { achievementId, userId: parsed.data.userId });
  });

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { nickname: true },
  });
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "achievement.award",
      summary: `Выдано достижение «${ach.title}» пользователю «${target?.nickname ?? "?"}»`,
      targetUserId: parsed.data.userId,
      targetNickname: target?.nickname ?? null,
      meta: { achievementId, achievementTitle: ach.title },
    });
  }

  return ok(res, { awarded: true });
});

adminRouter.post("/achievements/:id/revoke", async (req: AuthedRequest, res) => {
  const achievementId = req.params.id;
  const parsed = AwardSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const ach = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!ach) return fail(res, 404, "Achievement not found");

  await prisma.$transaction(async (tx) => {
    await revokeAchievementFromUser(tx, { achievementId, userId: parsed.data.userId });
  });

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { nickname: true },
  });
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "achievement.revoke",
      summary: `Отозвано достижение «${ach.title}» у пользователя «${target?.nickname ?? "?"}»`,
      targetUserId: parsed.data.userId,
      targetNickname: target?.nickname ?? null,
      meta: { achievementId, achievementTitle: ach.title },
    });
  }

  return ok(res, { revoked: true });
});

adminRouter.get("/users/:id/achievements", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, nickname: true },
  });
  if (!user) return fail(res, 404, "User not found");

  const rows = await prisma.userAchievement.findMany({
    where: { userId: req.params.id },
    orderBy: { awardedAt: "desc" },
    select: {
      achievement: {
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
      },
      awardedAt: true,
    },
    take: 500,
  });

  return ok(
    res,
    rows.map((row) => ({
      ...row.achievement,
      iconUrl: toPublicFileUrl(row.achievement.iconPath),
      awardedAt: row.awardedAt.toISOString(),
      earned: true,
    })),
  );
});

adminRouter.post("/users/:id/revoke-achievements", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = RevokeManySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, nickname: true },
  });
  if (!target) return fail(res, 404, "User not found");

  const achievements = await prisma.achievement.findMany({
    where: { id: { in: parsed.data.achievementIds } },
    select: { id: true, title: true },
    take: 500,
  });
  if (!achievements.length) return fail(res, 404, "Achievements not found");

  await prisma.$transaction(async (tx) => {
    for (const achievement of achievements) {
      await revokeAchievementFromUser(tx, { achievementId: achievement.id, userId: target.id });
    }
  });

  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "achievement.revoke_many",
      summary: `Забрано достижений у «${target.nickname}»: ${achievements.map((a) => `«${a.title}»`).join(", ")}`,
      targetUserId: target.id,
      targetNickname: target.nickname,
      meta: { achievementIds: achievements.map((a) => a.id) },
    });
  }

  return ok(res, { revoked: true, count: achievements.length });
});

adminRouter.get("/shop/items", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const items = await prisma.shopItem.findMany({
    orderBy: [{ type: "asc" }, { price: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      name: true,
      type: true,
      key: true,
      price: true,
      rarity: true,
      description: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok(res, items);
});

adminRouter.post("/shop/items", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = CreateShopItemSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  const created = await prisma.shopItem.create({
    data: parsed.data as Prisma.ShopItemCreateInput,
  });
  invalidateShopItemsCache();
  return ok(res, created);
});

adminRouter.patch("/shop/items/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateShopItemSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  const updated = await prisma.shopItem.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  invalidateShopItemsCache();
  return ok(res, updated);
});

adminRouter.delete("/shop/items/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const exists = await prisma.shopItem.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!exists) return fail(res, 404, "Item not found");
  await prisma.shopItem.delete({ where: { id: req.params.id } });
  invalidateShopItemsCache();
  return ok(res, { deleted: true });
});

const GrantAccessSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(200),
});

adminRouter.post("/achievements/:id/grant", async (req: AuthedRequest, res) => {
  const achievementId = req.params.id;
  const parsed = GrantAccessSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const ach = await prisma.achievement.findUnique({
    where: { id: achievementId },
    select: { title: true },
  });
  if (!ach) return fail(res, 404, "Achievement not found");

  await prisma.achievementAccess.createMany({
    data: parsed.data.userIds.map((userId) => ({ achievementId, userId })),
  });

  if (req.user?.id) {
    const users = await prisma.user.findMany({
      where: { id: { in: parsed.data.userIds } },
      select: { nickname: true },
    });
    const names = users.map((u) => u.nickname).join(", ");
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "achievement.grant_access",
      summary: `Доступ к «${ach.title}»: ${names || `${parsed.data.userIds.length} пользователей`}`,
      meta: { achievementId, userIds: parsed.data.userIds },
    });
  }

  return ok(res, { granted: true });
});

adminRouter.get("/users", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      email: true,
      role: true,
      blocked: true,
      level: true,
      xp: true,
      frameKey: true,
      badgesJson: true,
      statusEmoji: true,
      adminNotes: true,
      adminTags: true,
      createdAt: true,
    },
    take: 200,
  });
  return ok(
    res,
    attachPublicIds(users).map((u) => ({
      ...u,
      publicId: u.publicId,
      level: levelFromXp(u.xp).level,
      adminTags: (u.adminTags as unknown as string[] | null) ?? [],
      badges: (u.badgesJson as unknown as string[] | null) ?? [],
      xpIntoLevel: levelFromXp(u.xp).xpIntoLevel,
      xpForNext: levelFromXp(u.xp).xpForNext,
    })),
  );
});

const UpdateUserSchema = z.object({
  role: z.enum(["USER", "ADMIN", "CREATOR"]).optional(),
  nickname: z.string().min(2).max(24).optional(),
  adminNotes: z.string().max(2000).nullable().optional(),
  adminTags: z.array(z.string().min(1).max(32)).max(32).optional(),
  frameKey: z.string().min(1).max(64).nullable().optional(),
  badges: z.array(z.string().min(1).max(64)).max(24).optional(),
  statusEmoji: z.string().min(1).max(8).nullable().optional(),
  level: z.coerce.number().int().min(1).max(MAX_LEVEL).optional(),
  xp: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
});

const AdjustCoinsSchema = z.object({
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000),
});

adminRouter.patch("/users/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");
  const current = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { xp: true, level: true, nickname: true, role: true },
  });
  if (!current) return fail(res, 404, "User not found");
  if (parsed.data.role === "CREATOR") return fail(res, 403, "Роль создателя нельзя выдать через админ-панель");
  if (current.role === "CREATOR" && parsed.data.role !== undefined) {
    return fail(res, 403, "Роль создателя защищена и не может быть изменена через админ-панель");
  }

  const xpInput = parsed.data.xp;
  const levelInput = parsed.data.level;
  const nextXp = typeof xpInput === "number" ? xpInput : typeof levelInput === "number" ? xpForLevel(levelInput) : current.xp;
  const nextLevel = typeof levelInput === "number" ? levelInput : levelFromXp(nextXp).level;

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      role: parsed.data.role,
      nickname: parsed.data.nickname,
      adminNotes: parsed.data.adminNotes ?? undefined,
      adminTags: parsed.data.adminTags ? parsed.data.adminTags : undefined,
      frameKey: parsed.data.frameKey ?? undefined,
      badgesJson: parsed.data.badges ? parsed.data.badges : undefined,
      statusEmoji: parsed.data.statusEmoji ?? undefined,
      level: nextLevel,
      xp: nextXp,
    },
    select: { id: true, nickname: true, email: true, role: true, blocked: true, adminNotes: true, adminTags: true, frameKey: true, badgesJson: true, statusEmoji: true, level: true, xp: true },
  });

  const changes: string[] = [];
  if (parsed.data.role !== undefined && parsed.data.role !== current.role) changes.push(`роль → ${parsed.data.role}`);
  if (parsed.data.nickname !== undefined && parsed.data.nickname !== current.nickname) changes.push(`ник → ${parsed.data.nickname}`);
  if (typeof xpInput === "number" && xpInput !== current.xp) changes.push(`опыт → ${xpInput}`);
  if (typeof levelInput === "number" && levelInput !== current.level) changes.push(`уровень → ${levelInput}`);
  if (parsed.data.adminNotes !== undefined) changes.push("заметки админа обновлены");
  if (parsed.data.adminTags !== undefined) changes.push("теги обновлены");
  if (parsed.data.frameKey !== undefined) changes.push("рамка профиля");
  if (parsed.data.badges !== undefined) changes.push("значки");
  if (parsed.data.statusEmoji !== undefined) changes.push("статус");

  if (req.user?.id && changes.length) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "user.patch",
      summary: `Пользователь «${updated.nickname}»: ${changes.join("; ")}`,
      targetUserId: updated.id,
      targetNickname: updated.nickname,
    });
  }

  return ok(res, { ...updated, adminTags: (updated.adminTags as unknown as string[] | null) ?? [], badges: (updated.badgesJson as unknown as string[] | null) ?? [] });
});

adminRouter.delete("/users/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const id = req.params.id;
  if (id === req.user!.id) return fail(res, 400, "Нельзя удалить свой аккаунт");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true, role: true, email: true },
  });
  if (!target) return fail(res, 404, "User not found");
  if (target.role === "CREATOR") return fail(res, 403, "Нельзя удалить учётную запись создателя");

  await prisma.user.delete({ where: { id: target.id } });

  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "user.delete",
      summary: `Удалён пользователь «${target.nickname}» (${target.email})`,
      targetUserId: target.id,
      targetNickname: target.nickname,
    });
  }

  return ok(res, { deleted: true });
});

adminRouter.post("/users/:id/coins", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = AdjustCoinsSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");
  if (parsed.data.delta === 0) return ok(res, { updated: true, delta: 0 });

  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, nickname: true },
  });
  if (!target) return fail(res, 404, "User not found");

  const adminDisplayName = await getAdminDisplayName(req);
  const deltaStr = parsed.data.delta > 0 ? `+${parsed.data.delta}` : String(parsed.data.delta);
  await prisma.notification.create({
    data: {
      type: "SHOP",
      userId: target.id,
      adminName: adminDisplayName,
      text: `Администратор ${adminDisplayName} изменил баланс монет: ${deltaStr}\n[COIN_BONUS]:${parsed.data.delta}`,
    },
  });
  invalidateSupportUnreadCountCache(target.id);
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "user.coins",
      summary: `Монеты пользователю «${target.nickname}»: ${deltaStr}`,
      targetUserId: target.id,
      targetNickname: target.nickname,
      meta: { delta: parsed.data.delta },
    });
  }
  return ok(res, { updated: true, delta: parsed.data.delta });
});

// ===== Support: suggestions / reports / notifications (Steam-like "logs") =====
adminRouter.get("/notifications", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const take = Math.min(200, Math.max(1, Number(req.query.take ?? 50)));
  const items = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, text: true, adminName: true, userId: true, isRead: true, createdAt: true },
  });
  return ok(res, items);
});

adminRouter.get("/audit-logs", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const take = Math.min(500, Math.max(1, Number(req.query.take ?? 150)));
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      adminId: true,
      adminNickname: true,
      action: true,
      summary: true,
      targetUserId: true,
      targetNickname: true,
      meta: true,
      createdAt: true,
    },
  });
  return ok(
    res,
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

adminRouter.get("/support/suggestions", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const status = SupportStatusSchema.optional().safeParse(req.query.status);
  const where = status.success && status.data ? { status: status.data } : undefined;
  const items = await prisma.suggestion.findMany({
    where,
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, nickname: true, email: true } },
    },
  });
  return ok(
    res,
    items.map((x) => {
      const parsed = parseRichDescription(x.description);
      return { ...x, description: parsed.text, images: parsed.images };
    }),
  );
});

const UpdateSuggestionSchema = z.object({
  status: SupportStatusSchema.optional(),
  adminResponse: z.string().max(2000).nullable().optional(),
  isRead: z.boolean().optional(),
});

adminRouter.patch("/support/suggestions/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateSuggestionSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const existing = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, authorId: true, status: true, adminResponse: true },
  });
  if (!existing) return fail(res, 404, "Suggestion not found");

  const updated = await prisma.suggestion.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      adminResponse: parsed.data.adminResponse ?? undefined,
      isRead: parsed.data.isRead,
    },
    select: { id: true, status: true, adminResponse: true, isRead: true, updatedAt: true },
  });

  const nextStatus = parsed.data.status ?? existing.status;
  const nextResponse =
    parsed.data.adminResponse !== undefined ? parsed.data.adminResponse : existing.adminResponse;
  const shouldNotify =
    (parsed.data.status !== undefined && parsed.data.status !== existing.status) ||
    (parsed.data.adminResponse !== undefined && parsed.data.adminResponse !== existing.adminResponse);

  if (shouldNotify) {
    const adminDisplayName = await getAdminDisplayName(req);
    await createSupportNotification({
      userId: existing.authorId,
      adminDisplayName,
      kind: "suggestion",
      suggestionTitle: existing.title,
      status: nextStatus,
      adminResponse: nextResponse,
    });
  }
  if (req.user?.id && shouldNotify) {
    const target = await prisma.user.findUnique({
      where: { id: existing.authorId },
      select: { nickname: true },
    });
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "support.suggestion",
      summary: `Предложение «${existing.title}» → ${supportStatusLabel(nextStatus)}`,
      targetUserId: existing.authorId,
      targetNickname: target?.nickname ?? null,
      meta: { suggestionId: existing.id, status: nextStatus },
    });
  }

  return ok(res, updated);
});

adminRouter.get("/support/reports", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const status = SupportStatusSchema.optional().safeParse(req.query.status);
  const where = status.success && status.data ? { status: status.data } : undefined;
  const items = await prisma.report.findMany({
    where,
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
      updatedAt: true,
      reporter: { select: { id: true, nickname: true, email: true } },
      reported: { select: { id: true, nickname: true, email: true } },
    },
  });
  return ok(
    res,
    items.map((x) => {
      const parsed = parseRichDescription(x.description);
      return { ...x, description: parsed.text, images: parsed.images };
    }),
  );
});

const UpdateReportSchema = z.object({
  status: SupportStatusSchema.optional(),
  adminResponse: z.string().max(2000).nullable().optional(),
  isRead: z.boolean().optional(),
});

adminRouter.patch("/support/reports/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateReportSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const existing = await prisma.report.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      reason: true,
      reporterId: true,
      status: true,
      adminResponse: true,
      reported: { select: { nickname: true } },
    },
  });
  if (!existing) return fail(res, 404, "Report not found");

  const updated = await prisma.report.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      adminResponse: parsed.data.adminResponse ?? undefined,
      isRead: parsed.data.isRead,
    },
    select: { id: true, status: true, adminResponse: true, isRead: true, updatedAt: true },
  });

  const nextStatus = parsed.data.status ?? existing.status;
  const nextResponse =
    parsed.data.adminResponse !== undefined ? parsed.data.adminResponse : existing.adminResponse;
  const shouldNotify =
    (parsed.data.status !== undefined && parsed.data.status !== existing.status) ||
    (parsed.data.adminResponse !== undefined && parsed.data.adminResponse !== existing.adminResponse);

  if (shouldNotify) {
    const adminDisplayName = await getAdminDisplayName(req);
    await createSupportNotification({
      userId: existing.reporterId,
      adminDisplayName,
      kind: "report",
      reportReason: existing.reason,
      reportedUserNickname: existing.reported?.nickname ?? null,
      status: nextStatus,
      adminResponse: nextResponse,
    });
  }
  if (req.user?.id && shouldNotify) {
    const reporter = await prisma.user.findUnique({
      where: { id: existing.reporterId },
      select: { nickname: true },
    });
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "support.report",
      summary: `Жалоба (${reportReasonRu(existing.reason)}) на «${existing.reported?.nickname ?? "?"}» → ${supportStatusLabel(nextStatus)}`,
      targetUserId: existing.reporterId,
      targetNickname: reporter?.nickname ?? null,
      meta: { reportId: existing.id, reason: existing.reason, status: nextStatus },
    });
  }

  return ok(res, updated);
});

const CreateTaskSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  conditions: z.string().min(3).max(2000),
  rewardCoins: z.coerce.number().int().min(0).max(1_000_000).optional(),
  achievementId: z.string().uuid(),
  isActive: z.boolean().optional(),
  isEvent: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  styleTag: z.string().max(64).nullable().optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial();

adminRouter.get("/tasks", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const items = await prisma.task.findMany({
    orderBy: [{ isActive: "desc" }, { isEvent: "desc" }, { createdAt: "desc" }],
    include: {
      achievement: { select: { id: true, title: true, rarity: true, points: true, iconPath: true } },
      _count: { select: { submissions: true } },
    },
    take: 500,
  });
  return ok(
    res,
    items.map((t) => ({
      ...t,
      achievement: t.achievement ? { ...t.achievement, iconUrl: toPublicFileUrl(t.achievement.iconPath) } : null,
      submissionsCount: t._count.submissions,
    })),
  );
});

adminRouter.post("/tasks", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (startsAt && endsAt && startsAt > endsAt) {
    return fail(res, 400, "Дата окончания не может быть раньше даты начала");
  }
  const achievementExists = await prisma.achievement.findUnique({
    where: { id: parsed.data.achievementId },
    select: { id: true },
  });
  if (!achievementExists) return fail(res, 400, "Связанное достижение не найдено");
  // В схеме Prisma у `Task` поле `achievementId` помечено как `@unique`,
  // поэтому попытка создать второе задание для того же достижения приводит к `P2002`.
  const existingForAchievement = await prisma.task.findUnique({
    where: { achievementId: parsed.data.achievementId },
    select: { id: true, title: true },
  });
  if (existingForAchievement) {
    return fail(res, 409, `Задание для достижения уже существует: «${existingForAchievement.title}»`);
  }

  let created: Awaited<ReturnType<typeof prisma.task.create>>;
  try {
    created = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        conditions: parsed.data.conditions,
        rewardCoins: parsed.data.rewardCoins ?? 0,
        achievementId: parsed.data.achievementId,
        isActive: parsed.data.isActive ?? true,
        isEvent: parsed.data.isEvent ?? false,
        startsAt,
        endsAt,
        styleTag: parsed.data.styleTag ?? null,
        createdById: req.user?.id ?? null,
      },
    });
  } catch (err: unknown) {
    const anyErr = err as any;
    console.error("task_create_failed", {
      userId: req.user?.id ?? null,
      title: parsed.data.title,
      achievementId: parsed.data.achievementId,
      rewardCoins: parsed.data.rewardCoins ?? 0,
      isActive: parsed.data.isActive ?? true,
      isEvent: parsed.data.isEvent ?? false,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
      styleTag: parsed.data.styleTag ?? null,
      prismaCode: anyErr?.code,
      prismaMeta: anyErr?.meta ?? null,
      prismaMetaTarget: anyErr?.meta?.target ?? null,
      errMessage: anyErr?.message ?? String(anyErr),
    });
    throw err;
  }
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "task.create",
      summary: `Создано задание «${created.title}»`,
      meta: { taskId: created.id },
    });
  }
  return ok(res, created);
});

adminRouter.patch("/tasks/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  const before = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!before) return fail(res, 404, "Task not found");
  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      conditions: parsed.data.conditions,
      achievementId: parsed.data.achievementId,
      rewardCoins: parsed.data.rewardCoins,
      isActive: parsed.data.isActive,
      isEvent: parsed.data.isEvent,
      startsAt: parsed.data.startsAt === undefined ? undefined : parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt === undefined ? undefined : parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      styleTag: parsed.data.styleTag ?? undefined,
    },
  });
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "task.update",
      summary: `Задание «${updated.title}» обновлено`,
      meta: { taskId: updated.id },
    });
  }
  return ok(res, updated);
});

adminRouter.delete("/tasks/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const exists = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true, title: true } });
  if (!exists) return fail(res, 404, "Task not found");
  await prisma.task.delete({ where: { id: req.params.id } });
  if (req.user?.id) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "task.delete",
      summary: `Удалено задание «${exists.title}»`,
      meta: { taskId: exists.id },
    });
  }
  return ok(res, { deleted: true });
});

adminRouter.get("/tasks/submissions", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const status = SupportStatusSchema.optional().safeParse(req.query.status);
  const where = status.success && status.data ? { status: status.data } : undefined;
  const rows = await prisma.taskSubmission.findMany({
    where,
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, nickname: true, email: true } },
      task: {
        select: {
          id: true,
          title: true,
          rewardCoins: true,
          isEvent: true,
          startsAt: true,
          endsAt: true,
          styleTag: true,
          achievement: { select: { id: true, title: true, rarity: true, iconPath: true } },
        },
      },
    },
    take: 500,
  });
  return ok(
    res,
    rows.map((s) => ({
      ...s,
      evidence: (s.evidenceJson as unknown as string[] | null) ?? [],
      task: {
        ...s.task,
        achievement: s.task.achievement
          ? { ...s.task.achievement, iconUrl: toPublicFileUrl(s.task.achievement.iconPath) }
          : null,
      },
    })),
  );
});

const UpdateTaskSubmissionSchema = z.object({
  status: SupportStatusSchema.optional(),
  adminResponse: z.string().max(2000).nullable().optional(),
  rejectionReason: z.string().min(3).max(2000).optional(),
  isRead: z.boolean().optional(),
});

adminRouter.patch("/tasks/submissions/:id", async (req: AuthedRequest, res) => {
  if (!adminOnly(req, res)) return;
  const parsed = UpdateTaskSubmissionSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const existing = await prisma.taskSubmission.findUnique({
    where: { id: req.params.id },
    include: {
      task: { select: { id: true, title: true, achievementId: true, rewardCoins: true } },
      user: { select: { id: true, nickname: true } },
    },
  });
  if (!existing) return fail(res, 404, "Submission not found");

  const adminDisplayName = await getAdminDisplayName(req);
  const nextStatus = parsed.data.status ?? existing.status;
  const nextResponse = parsed.data.adminResponse !== undefined ? parsed.data.adminResponse : existing.adminResponse;
  const rejectionReason = parsed.data.rejectionReason?.trim();
  if (parsed.data.status === "REJECTED" && !rejectionReason) {
    return fail(res, 400, "Укажите причину отклонения (минимум 3 символа)");
  }
  const mergedResponse =
    parsed.data.status === "REJECTED" && rejectionReason
      ? [nextResponse?.trim(), `Причина отклонения: ${rejectionReason}`].filter(Boolean).join("\n")
      : nextResponse;

  const updated = await prisma.taskSubmission.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      adminResponse: mergedResponse ?? undefined,
      isRead: parsed.data.isRead,
      reviewedAt: parsed.data.status ? new Date() : undefined,
      reviewedById: parsed.data.status ? req.user?.id : undefined,
    },
  });

  if (parsed.data.status === "RESOLVED" && existing.task?.achievementId) {
    await prisma.$transaction(async (tx) => {
      await awardAchievementToUser(tx, { achievementId: existing.task.achievementId, userId: existing.user.id });

      const coins = Math.max(0, existing.task.rewardCoins ?? 0);
      if (coins > 0) {
        // Store coin bonus as a SHOP notification containing a marker that shop router can parse.
        await tx.notification.create({
          data: {
            type: "SHOP",
            userId: existing.user.id,
            adminName: adminDisplayName,
            text: `✅ Задание принято: ${existing.task.title}\nАдминистратор: ${adminDisplayName}\nНаграда: +${coins} монет\n[COIN_BONUS]:${coins}`,
          },
        });
      } else {
        await tx.notification.create({
          data: {
            type: "ACH",
            userId: existing.user.id,
            adminName: adminDisplayName,
            text: `✅ Задание принято: ${existing.task.title}\nАдминистратор: ${adminDisplayName}\nНаграда: достижение добавлено в профиль`,
          },
        });
      }
    });
    invalidateSupportUnreadCountCache(existing.user.id);
  }

  const shouldNotify =
    (parsed.data.status !== undefined && parsed.data.status !== existing.status) ||
    (parsed.data.adminResponse !== undefined && parsed.data.adminResponse !== existing.adminResponse) ||
    Boolean(rejectionReason);
  if (shouldNotify) {
    const parts: string[] = [`Ответ администрации по заданию «${existing.task.title}»`];
    parts.push(`Администратор: ${adminDisplayName}`);
    parts.push(`Статус: ${supportStatusLabel(nextStatus)}`);
    if (mergedResponse?.trim()) parts.push(`Ответ: ${mergedResponse.trim()}`);
    if (nextStatus === "REJECTED" && rejectionReason) {
      parts.push(`Ваше задание «${existing.task.title}» отклонено. Причина: ${rejectionReason}`);
    }
    await prisma.notification.create({
      data: {
        type: "SUPPORT",
        userId: existing.user.id,
        adminName: adminDisplayName,
        text: parts.join("\n"),
      },
    });
    invalidateSupportUnreadCountCache(existing.user.id);
  }

  const auditWorthy =
    parsed.data.status !== undefined ||
    parsed.data.adminResponse !== undefined ||
    parsed.data.isRead !== undefined;
  if (req.user?.id && auditWorthy) {
    await logAdminAction(prisma, {
      adminId: req.user.id,
      action: "task.submission",
      summary: `Задание «${existing.task.title}» — пользователь «${existing.user.nickname}»: ${supportStatusLabel(nextStatus)}`,
      targetUserId: existing.user.id,
      targetNickname: existing.user.nickname,
      meta: { submissionId: existing.id, taskId: existing.taskId, status: nextStatus },
    });
  }

  return ok(res, updated);
});

