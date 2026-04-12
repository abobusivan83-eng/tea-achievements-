import type { Prisma } from "@prisma/client";

type Db = Pick<
  Prisma.TransactionClient,
  "notification" | "shopPurchase"
>;

export function parseCoinBonusDelta(text: string): number {
  const matches = [...text.matchAll(/\[COIN_BONUS\]:(-?\d+)/g)];
  if (!matches.length) return 0;
  return matches.reduce((sum, m) => sum + (Number(m[1]) || 0), 0);
}

export async function getCoinBonus(db: Db, userId: string): Promise<number> {
  const rows = await db.notification.findMany({
    where: { userId, type: "SHOP", text: { contains: "[COIN_BONUS]:" } },
    select: { text: true },
    take: 5000,
  });
  return rows.reduce((sum, r) => sum + parseCoinBonusDelta(r.text), 0);
}

export async function getUserCoins(db: Db, userId: string): Promise<number> {
  const [purchases, bonus] = await Promise.all([
    db.shopPurchase.findMany({
      where: { userId },
      select: { item: { select: { price: true } } },
      take: 2000,
    }),
    getCoinBonus(db, userId),
  ]);
  const spent = purchases.reduce((s, p) => s + p.item.price, 0);
  return Math.max(0, bonus - spent);
}
