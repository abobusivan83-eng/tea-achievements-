-- SQLite: gifts idempotency, unlock columns, GIFT notifications (enums are stored as TEXT; CREATOR/GIFT need no ALTER TYPE)

-- User: cosmetic unlock lists (JSON arrays as TEXT)
ALTER TABLE "User" ADD COLUMN "unlockedFramesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN "unlockedStatusesJson" TEXT NOT NULL DEFAULT '[]';

-- Gift: read tracking
ALTER TABLE "Gift" ADD COLUMN "receiverViewedAt" DATETIME;

-- Replace index for inbox unread queries
DROP INDEX IF EXISTS "Gift_toUserId_accepted_createdAt_idx";
CREATE INDEX "Gift_toUserId_receiverViewedAt_createdAt_idx" ON "Gift"("toUserId", "receiverViewedAt", "createdAt");

-- Notification: optional link to Gift (for GIFT type + mark read)
ALTER TABLE "Notification" ADD COLUMN "giftId" TEXT;
CREATE UNIQUE INDEX "Notification_giftId_key" ON "Notification"("giftId");

-- Idempotent send ledger
CREATE TABLE "GiftSendRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftSendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GiftSendRequest_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GiftSendRequest_giftId_key" ON "GiftSendRequest"("giftId");
CREATE UNIQUE INDEX "GiftSendRequest_senderId_idempotencyKey_key" ON "GiftSendRequest"("senderId", "idempotencyKey");
CREATE INDEX "GiftSendRequest_senderId_createdAt_idx" ON "GiftSendRequest"("senderId", "createdAt");

-- Legacy: gifts that were never accepted (sender already debited) — credit receiver once
INSERT INTO "Notification" ("id", "type", "text", "userId", "isRead", "createdAt", "adminName", "giftId")
SELECT lower(hex(randomblob(16))), 'SHOP', '[COIN_BONUS]:+' || CAST("xpAmount" AS TEXT), "toUserId", 0, datetime('now'), NULL, NULL
FROM "Gift" WHERE "accepted" = 0;

UPDATE "Gift" SET "accepted" = 1, "acceptedAt" = COALESCE("acceptedAt", datetime('now')) WHERE "accepted" = 0;

-- Do not light up badge for historical gifts
UPDATE "Gift" SET "receiverViewedAt" = datetime('now') WHERE "receiverViewedAt" IS NULL;

-- Backfill frame unlocks from shop purchases
UPDATE "User" SET "unlockedFramesJson" = (
  SELECT COALESCE(json_group_array(t.k), '[]')
  FROM (
    SELECT DISTINCT si.key AS k
    FROM "ShopPurchase" sp
    INNER JOIN "ShopItem" si ON si.id = sp."itemId"
    WHERE sp."userId" = "User"."id" AND si.type = 'FRAME'
  ) AS t
)
WHERE EXISTS (
  SELECT 1 FROM "ShopPurchase" sp
  INNER JOIN "ShopItem" si ON si.id = sp."itemId"
  WHERE sp."userId" = "User"."id" AND si.type = 'FRAME'
);

-- Backfill status unlocks (shop keys status:calm -> calm)
UPDATE "User" SET "unlockedStatusesJson" = (
  SELECT COALESCE(json_group_array(t.s), '[]')
  FROM (
    SELECT DISTINCT substr(si.key, 8) AS s
    FROM "ShopPurchase" sp
    INNER JOIN "ShopItem" si ON si.id = sp."itemId"
    WHERE sp."userId" = "User"."id" AND si.type = 'BADGE' AND si.key LIKE 'status:%'
  ) AS t
)
WHERE EXISTS (
  SELECT 1 FROM "ShopPurchase" sp
  INNER JOIN "ShopItem" si ON si.id = sp."itemId"
  WHERE sp."userId" = "User"."id" AND si.type = 'BADGE' AND si.key LIKE 'status:%'
);
