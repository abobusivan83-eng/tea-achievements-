import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getCoinBonus } from "../lib/coins.js";
import { parseJsonStringArray } from "../lib/cosmeticsAccess.js";
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
    await prisma.$transaction(async (tx) => {
      const [spentRows, bonus] = await Promise.all([
        tx.shopPurchase.findMany({
          where: { userId: req.user!.id },
          select: { item: { select: { price: true } } },
        }),
        getCoinBonus(tx, req.user!.id),
      ]);
      const spent = spentRows.reduce((s, p) => s + p.item.price, 0);
      if (bonus - spent < item.price) {
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
        });
      } else if (item.type === "BADGE") {
        if (item.key.startsWith("status:")) {
          const catalogKey = item.key.slice("status:".length);
          const nextStatuses = mergeUniqueStrings(fresh?.unlockedStatusesJson, catalogKey);
          const data: { statusEmoji?: string; unlockedStatusesJson: string[] } = { unlockedStatusesJson: nextStatuses };
          if (item.icon) data.statusEmoji = item.icon;
          await tx.user.update({ where: { id: req.user!.id }, data });
        } else {
          const currentUser = await tx.user.findUnique({ where: { id: req.user!.id }, select: { badgesJson: true } });
          const prev = (currentUser?.badgesJson as unknown as string[] | null) ?? [];
          const next = prev.includes(item.key) ? prev : [...prev, item.key];
          await tx.user.update({ where: { id: req.user!.id }, data: { badgesJson: next as any } });
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
    });
  } catch (e: any) {
    if (e?.message === "Not enough coins") return fail(res, 400, "Not enough coins");
    throw e;
  }

  invalidateShopItemsCache();
  invalidateShopMeCache(req.user!.id);
  invalidateUserProfileCache(req.user!.id);
  invalidateLeaderboardCache();
  return ok(res, { purchased: true });
});
