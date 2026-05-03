import { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

async function applyTelegramBroadcastDdl(ddlDb: Pick<PrismaClient, "$executeRawUnsafe">) {
  await ddlDb.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "TelegramBroadcastTemplate" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "mediaType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramBroadcastTemplate_pkey" PRIMARY KEY ("id")
)`);

  await ddlDb.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "TelegramBroadcastTemplate_sortOrder_createdAt_idx"
  ON "TelegramBroadcastTemplate" ("sortOrder", "createdAt")
`);

  await ddlDb.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TelegramBroadcastTemplate_createdById_fkey'
  ) THEN
    ALTER TABLE "TelegramBroadcastTemplate"
      ADD CONSTRAINT "TelegramBroadcastTemplate_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$
`);
}

/** DDL через pooled :6543 (transaction) часто неверен; если есть DIRECT_URL — отдельное подключение. */
export async function ensureTelegramBroadcastTemplateTable(): Promise<void> {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct?.startsWith("postgres")) {
    const ddl = new PrismaClient({
      datasources: { db: { url: direct } },
      log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
    });
    try {
      await applyTelegramBroadcastDdl(ddl);
      logger.info('[db] ensureTelegramBroadcastTemplateTable: DDL через DIRECT_URL (или таблица уже есть)');
    } catch (e) {
      logger.error("[db] ensureTelegramBroadcastTemplateTable (DIRECT_URL) failed", {
        err: e instanceof Error ? e.message : String(e),
      });
    } finally {
      await ddl.$disconnect().catch(() => {});
    }
    return;
  }

  try {
    await applyTelegramBroadcastDdl(prisma);
    logger.info('[db] ensureTelegramBroadcastTemplateTable: DDL через основной prisma (нет DIRECT_URL)');
  } catch (e) {
    logger.error("[db] ensureTelegramBroadcastTemplateTable (pool) failed", {
      err: e instanceof Error ? e.message : String(e),
    });
  }
}
