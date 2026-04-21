import type { Prisma } from "@prisma/client";

type Db = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "notification" | "shopPurchase"
>;

type SumRow = { total: number | bigint | null };

const COIN_BONUS_MARKER = "[COIN_BONUS]:";

function toSafeInt(value: number | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return 0;
}

function isSqliteRuntime() {
  return process.env.DATABASE_URL?.startsWith("file:") ?? false;
}

export function parseCoinBonusDelta(text: string): number {
  // Поддерживаем формат:
  // - [COIN_BONUS]:123
  // - [COIN_BONUS]:-123
  // - [COIN_BONUS]:+123
  const matches = [...text.matchAll(/\[COIN_BONUS\]:([+-]?\d+)/g)];
  if (!matches.length) return 0;
  return matches.reduce((sum, m) => sum + (Number(m[1]) || 0), 0);
}

export async function getCoinBonus(db: Db, userId: string): Promise<number> {
  try {
    if (isSqliteRuntime()) {
      const rows = await db.$queryRaw<SumRow[]>`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN instr(text, ${COIN_BONUS_MARKER}) > 0
                THEN CAST(substr(text, instr(text, ${COIN_BONUS_MARKER}) + length(${COIN_BONUS_MARKER})) AS INTEGER)
              ELSE 0
            END
          ),
          0
        ) AS total
        FROM "Notification"
        WHERE "userId" = ${userId}
          AND type = 'SHOP'
          AND instr(text, ${COIN_BONUS_MARKER}) > 0
      `;
      return Math.max(0, toSafeInt(rows[0]?.total));
    }

    const rows = await db.$queryRaw<SumRow[]>`
      SELECT COALESCE(
        SUM(CAST(SUBSTRING(text FROM '\\[COIN_BONUS\\]:([+-]?\\d+)') AS INTEGER)),
        0
      ) AS total
      FROM "Notification"
      WHERE "userId" = ${userId}
        AND type = 'SHOP'
        AND text LIKE ${`%${COIN_BONUS_MARKER}%`}
    `;
    return Math.max(0, toSafeInt(rows[0]?.total));
  } catch {
    const rows = await db.notification.findMany({
      where: { userId, type: "SHOP", text: { contains: COIN_BONUS_MARKER } },
      select: { text: true },
      take: 5000,
    });
    return rows.reduce((sum, r) => sum + parseCoinBonusDelta(r.text), 0);
  }
}

async function getSpentCoins(db: Db, userId: string): Promise<number> {
  try {
    const rows = await db.$queryRaw<SumRow[]>`
      SELECT COALESCE(SUM(si.price), 0) AS total
      FROM "ShopPurchase" sp
      INNER JOIN "ShopItem" si ON si.id = sp."itemId"
      WHERE sp."userId" = ${userId}
    `;
    return Math.max(0, toSafeInt(rows[0]?.total));
  } catch {
    const purchases = await db.shopPurchase.findMany({
      where: { userId },
      select: { item: { select: { price: true } } },
      take: 2000,
    });
    return purchases.reduce((sum, purchase) => sum + purchase.item.price, 0);
  }
}

export async function getUserCoins(db: Db, userId: string): Promise<number> {
  const [spent, bonus] = await Promise.all([getSpentCoins(db, userId), getCoinBonus(db, userId)]);
  return Math.max(0, bonus - spent);
}
