import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getCoinBonus, getUserCoins } from "../lib/coins.js";
import { parseJsonStringArray } from "../lib/cosmeticsAccess.js";
import { logAdminAction } from "../lib/adminAudit.js";
import {
  getCachedShopItems,
  getCachedShopMe,
  invalidateLeaderboardCache,
  invalidateShopItemsCache,
  invalidateShopMeCache,
  invalidateUserProfileCache,
  setCachedShopItems,
  setCachedShopMe,
} from "../lib/cache.js";

export const shopRouter = Router();
shopRouter.use(requireAuth);

function mergeUniqueStrings(prev: unknown, nextKey: string): string[] {
  const arr = parseJsonStringArray(prev);
  return arr.includes(nextKey) ? arr : [...arr, nextKey];
}

shopRouter.get("/items", async (_req, res) => {
  const cached = getCachedShopItems();
  if (cached) return ok(res, cached);

  const items = await prisma.shopItem.findMany({
    orderBy: [{ price: "asc" }, { rarity: "asc" }],
    take: 500,
    select: { id: true, name: true, type: true, key: true, price: true, rarity: true, description: true, icon: true },
  });
  setCachedShopItems(items);
  res.setHeader("Cache-Control", "public, max-age=120");
  return ok(res, items);
});

shopRouter.get("/me", async (req: AuthedRequest, res) => {
  const cached = getCachedShopMe<unknown>(req.user!.id);
  if (cached) return ok(res, cached);

  const [purchases, bonus, userRow] = await Promise.all([
    prisma.shopPurchase.findMany({
      where: { userId: req.user!.id },
      select: { itemId: true, item: { select: { price: true, key: true, type: true } } },
      take: 2000,
    }),
    getCoinBonus(prisma, req.user!.id),
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { unlockedFramesJson: true, unlockedStatusesJson: true },
    }),
  ]);
  const spent = purchases.reduce((s, p) => s + p.item.price, 0);
  const coins = Math.max(0, bonus - spent);
  const payload = {
    purchasedItemIds: purchases.map((p) => p.itemId),
    purchasedItems: purchases.map((p) => ({ id: p.itemId, key: p.item.key, type: p.item.type })),
    coins,
    earnedCoins: Math.max(0, bonus),
    spentCoins: spent,
    bonusCoins: bonus,
    unlockedFrames: parseJsonStringArray(userRow?.unlockedFramesJson),
    unlockedStatuses: parseJsonStringArray(userRow?.unlockedStatusesJson),
  };
  setCachedShopMe(req.user!.id, payload);
  res.setHeader("Cache-Control", "private, max-age=45");
  return ok(res, payload);
});

const BuySchema = z.object({
  itemId: z.string().uuid(),
});

shopRouter.post("/buy", async (req: AuthedRequest, res) => {
  const parsed = BuySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const item = await prisma.shopItem.findUnique({
    where: { id: parsed.data.itemId },
    select: { id: true, name: true, price: true, type: true, key: true, icon: true },
  });
  if (!item) return fail(res, 404, "Item not found");

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true },
  });
  if (!user) return fail(res, 404, "User not found");

  const already = await prisma.shopPurchase.findUnique({
    where: { userId_itemId: { userId: req.user!.id, itemId: item.id } },
  });
  if (already) return ok(res, { purchased: true, already: true });

  try {
    await prisma.$transaction(
      async (tx) => {
        const availableCoins = await getUserCoins(tx, req.user!.id);
        if (availableCoins < item.price) {
          throw new Error("Not enough coins");
        }

        await tx.shopPurchase.create({ data: { userId: req.user!.id, itemId: item.id } });

        const fresh = await tx.user.findUnique({
          where: { id: req.user!.id },
          select: { unlockedFramesJson: true, unlockedStatusesJson: true },
        });

        if (item.type === "FRAME") {
          const nextFrames = mergeUniqueStrings(fresh?.unlockedFramesJson, item.key);
          await tx.user.update({
            where: { id: req.user!.id },
            data: { frameKey: item.key, unlockedFramesJson: nextFrames },
            // Avoid selecting all columns (e.g. may fail if migration is not applied yet).
            select: { id: true },
          });
        } else if (item.type === "BADGE") {
          if (item.key.startsWith("status:")) {
            const catalogKey = item.key.slice("status:".length);
            const nextStatuses = mergeUniqueStrings(fresh?.unlockedStatusesJson, catalogKey);
            const data: { statusEmoji?: string; unlockedStatusesJson: string[] } = { unlockedStatusesJson: nextStatuses };
            if (item.icon) data.statusEmoji = item.icon;
            await tx.user.update({ where: { id: req.user!.id }, data, select: { id: true } });
          } else {
            const currentUser = await tx.user.findUnique({ where: { id: req.user!.id }, select: { badgesJson: true } });
            const prev = (currentUser?.badgesJson as unknown as string[] | null) ?? [];
            const next = prev.includes(item.key) ? prev : [...prev, item.key];
            await tx.user.update({ where: { id: req.user!.id }, data: { badgesJson: next as any }, select: { id: true } });
          }
        }

        await tx.notification.create({
          data: {
            type: "SHOP",
            text: `🛒 Куплено: ${item.name} (-${item.price} монет)`,
            userId: req.user!.id,
            adminName: null,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 3500,
        timeout: 10_000,
      },
    );
  } catch (e: any) {
    console.error("shop_buy_failed", {
      userId: req.user?.id,
      itemId: item.id,
      itemPrice: item.price,
      itemType: item.type,
      errMessage: e?.message ?? String(e),
      prismaCode: e?.code ?? null,
      prismaMeta: e?.meta ?? null,
    });

    // Also write into admin audit logs for debugging production issues.
    // We intentionally log who attempted the purchase and what Prisma returned.
    try {
      if (req.user?.id) {
        await logAdminAction(prisma, {
          adminId: req.user.id,
          action: "shop.buy_failed",
          summary: `Ошибка покупки в магазине: ${item.name}`,
          targetUserId: req.user.id,
          meta: {
            itemId: item.id,
            itemPrice: item.price,
            itemType: item.type,
            errMessage: e?.message ?? String(e),
            prismaCode: e?.code ?? null,
            prismaMeta: e?.meta ?? null,
          },
        });
      }
    } catch {
      // Never hide the original shop error if audit logging fails.
    }

    if (e?.message === "Not enough coins") return fail(res, 400, "Not enough coins");
    // To make debugging purchases easier on the client, return Prisma error code when possible.
    // Keep responses compatible with existing frontend logic (it only shows `error.message`).
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case "P2002":
          return fail(res, 409, `Record already exists (${e.code})`);
        case "P2025":
          return fail(res, 404, `Not found (${e.code})`);
        case "P2003":
          return fail(res, 400, `Invalid reference (${e.code})`);
        default:
          return fail(res, 500, `Database error (${e.code})`);
      }
    }
    if (typeof e?.code === "string") return fail(res, 500, `Database error (${e.code})`);
    return fail(res, 500, "Database error");
  }

  invalidateShopItemsCache();
  invalidateShopMeCache(req.user!.id);
  invalidateUserProfileCache(req.user!.id);
  invalidateLeaderboardCache();
  return ok(res, { purchased: true });
});
