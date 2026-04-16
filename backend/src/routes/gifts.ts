import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getUserCoins } from "../lib/coins.js";
import {
  getCachedGiftsUnreadCount,
  invalidateGiftsUnreadCountCache,
  invalidateShopMeCache,
  invalidateSupportUnreadCountCache,
  setCachedGiftsUnreadCount,
} from "../lib/cache.js";

export const giftsRouter = Router();
giftsRouter.use(requireAuth);

const giftSelectInbox = {
  id: true,
  xpAmount: true,
  message: true,
  createdAt: true,
  accepted: true,
  acceptedAt: true,
  receiverViewedAt: true,
  fromUser: { select: { id: true, nickname: true } },
} as const;

giftsRouter.get("/inbox", async (req: AuthedRequest, res) => {
  const items = await prisma.gift.findMany({
    where: { toUserId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: giftSelectInbox,
  });
  return ok(
    res,
    items.map((g) => ({
      ...g,
      isRead: g.receiverViewedAt != null,
    })),
  );
});

giftsRouter.get("/list", async (req: AuthedRequest, res) => {
  const items = await prisma.gift.findMany({
    where: { toUserId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: giftSelectInbox,
  });
  return ok(
    res,
    items.map((g) => ({
      ...g,
      isRead: g.receiverViewedAt != null,
    })),
  );
});

giftsRouter.get("/unread-count", async (req: AuthedRequest, res) => {
  const cached = getCachedGiftsUnreadCount(req.user!.id);
  if (cached !== undefined) {
    res.setHeader("Cache-Control", "private, max-age=20");
    return ok(res, { count: cached });
  }

  const count = await prisma.gift.count({
    where: { toUserId: req.user!.id, receiverViewedAt: null },
  });
  setCachedGiftsUnreadCount(req.user!.id, count);
  res.setHeader("Cache-Control", "private, max-age=20");
  return ok(res, { count });
});

giftsRouter.get("/outbox", async (req: AuthedRequest, res) => {
  const items = await prisma.gift.findMany({
    where: { fromUserId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      xpAmount: true,
      message: true,
      createdAt: true,
      accepted: true,
      acceptedAt: true,
      toUser: { select: { id: true, nickname: true } },
    },
  });
  return ok(res, items);
});

const SendGiftSchema = z.object({
  toUserId: z.string().uuid(),
  xpAmount: z.coerce.number().int().min(1).max(5_000_000),
  message: z.string().max(500).optional(),
});

function normalizeIdempotencyKey(raw: string) {
  return raw.trim().slice(0, 128);
}

giftsRouter.post("/send", async (req: AuthedRequest, res) => {
  const parsed = SendGiftSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  if (parsed.data.toUserId === req.user!.id) return fail(res, 400, "You cannot gift yourself");

  const rawKey = req.headers["idempotency-key"];
  if (typeof rawKey !== "string") return fail(res, 400, "Idempotency-Key header is required");
  const idempotencyKey = normalizeIdempotencyKey(rawKey);
  if (idempotencyKey.length < 8) return fail(res, 400, "Idempotency-Key must be at least 8 characters");

  const existing = await prisma.giftSendRequest.findUnique({
    where: { senderId_idempotencyKey: { senderId: req.user!.id, idempotencyKey } },
    select: { giftId: true },
  });
  if (existing) return ok(res, { sent: true, giftId: existing.giftId, idempotentReplay: true });

  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, nickname: true } }),
    prisma.user.findUnique({ where: { id: parsed.data.toUserId }, select: { id: true, nickname: true } }),
  ]);
  if (!from) return fail(res, 404, "Sender not found");
  if (!to) return fail(res, 404, "Receiver not found");

  const now = new Date();
  const msg = parsed.data.message?.trim() ? parsed.data.message.trim().slice(0, 500) : null;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const dup = await tx.giftSendRequest.findUnique({
          where: { senderId_idempotencyKey: { senderId: from.id, idempotencyKey } },
          select: { giftId: true },
        });
        if (dup) return { kind: "replay" as const, giftId: dup.giftId };

        const recentSends = await tx.gift.count({
          where: { fromUserId: from.id, createdAt: { gte: new Date(now.getTime() - 60_000) } },
        });
        if (recentSends >= 25) throw new Error("RATE_LIMIT");

        const senderCoins = await getUserCoins(tx, from.id);
        if (senderCoins < parsed.data.xpAmount) throw new Error("INSUFFICIENT");

        await tx.notification.create({
          data: {
            type: "SHOP",
            text: `[COIN_BONUS]:-${parsed.data.xpAmount}`,
            userId: from.id,
            adminName: null,
          },
        });
        await tx.notification.create({
          data: {
            type: "SHOP",
            text: `[COIN_BONUS]:${parsed.data.xpAmount}`,
            userId: to.id,
            adminName: null,
          },
        });

        const gift = await tx.gift.create({
          data: {
            fromUserId: from.id,
            toUserId: to.id,
            xpAmount: parsed.data.xpAmount,
            message: msg,
            accepted: true,
            acceptedAt: now,
            receiverViewedAt: null,
          },
          select: { id: true },
        });

        const preview = msg
          ? `${from.nickname} · ${parsed.data.xpAmount} монет · «${msg}»`
          : `${from.nickname} · ${parsed.data.xpAmount} монет`;
        await tx.notification.create({
          data: {
            type: "GIFT",
            text: `🎁 Подарок доставлен: ${preview}`,
            userId: to.id,
            adminName: null,
            giftId: gift.id,
            isRead: false,
          },
        });

        await tx.giftSendRequest.create({
          data: { senderId: from.id, idempotencyKey, giftId: gift.id },
        });

        return { kind: "created" as const, giftId: gift.id };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 3500,
        timeout: 10_000,
      },
    );

    if (result.kind === "replay") {
      return ok(res, { sent: true, giftId: result.giftId, idempotentReplay: true });
    }
    invalidateShopMeCache(from.id);
    invalidateShopMeCache(to.id);
    invalidateGiftsUnreadCountCache(to.id);
    invalidateSupportUnreadCountCache(from.id);
    invalidateSupportUnreadCountCache(to.id);
    return ok(res, { sent: true, giftId: result.giftId, idempotentReplay: false });
  } catch (e: unknown) {
    const msgErr = e instanceof Error ? e.message : "";
    if (msgErr === "INSUFFICIENT") return fail(res, 400, "Not enough coins");
    if (msgErr === "RATE_LIMIT") return fail(res, 429, "Too many gifts, try again shortly");
    if (msgErr === "Transaction already closed") return fail(res, 503, "Service busy, please retry");
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2034") {
      const replay = await prisma.giftSendRequest.findUnique({
        where: { senderId_idempotencyKey: { senderId: req.user!.id, idempotencyKey } },
        select: { giftId: true },
      });
      if (replay) return ok(res, { sent: true, giftId: replay.giftId, idempotentReplay: true });
      return fail(res, 503, "Gift processing busy, retry request");
    }
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2028") {
      return fail(res, 503, "Gift processing timeout, retry request");
    }
    throw e;
  }
});

const ReadGiftsSchema = z.object({
  giftIds: z.array(z.string().uuid()).max(200).optional(),
  markAll: z.boolean().optional(),
});

giftsRouter.post("/read", async (req: AuthedRequest, res) => {
  const parsed = ReadGiftsSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");
  const uid = req.user!.id;
  const now = new Date();

  if (parsed.data.markAll) {
    await prisma.$transaction(async (tx) => {
      const gifts = await tx.gift.findMany({
        where: { toUserId: uid, receiverViewedAt: null },
        select: { id: true },
      });
      if (!gifts.length) return;
      await tx.gift.updateMany({ where: { toUserId: uid, receiverViewedAt: null }, data: { receiverViewedAt: now } });
      await tx.notification.updateMany({
        where: { userId: uid, type: "GIFT", giftId: { in: gifts.map((g) => g.id) } },
        data: { isRead: true },
      });
    });
    invalidateGiftsUnreadCountCache(uid);
    return ok(res, { ok: true });
  }

  const ids = parsed.data.giftIds ?? [];
  if (!ids.length) return fail(res, 400, "giftIds or markAll required");

  await prisma.$transaction(async (tx) => {
    const mine = await tx.gift.findMany({
      where: { id: { in: ids }, toUserId: uid },
      select: { id: true },
    });
    const allowed = mine.map((g) => g.id);
    if (!allowed.length) return;
    await tx.gift.updateMany({
      where: { id: { in: allowed }, toUserId: uid },
      data: { receiverViewedAt: now },
    });
    await tx.notification.updateMany({
      where: { userId: uid, type: "GIFT", giftId: { in: allowed } },
      data: { isRead: true },
    });
  });

  invalidateGiftsUnreadCountCache(uid);
  return ok(res, { ok: true });
});
