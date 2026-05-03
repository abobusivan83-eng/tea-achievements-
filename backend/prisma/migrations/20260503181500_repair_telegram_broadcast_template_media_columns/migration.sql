-- Idempotent repair (P2022): колонки уже в схеме Prisma, но на части БД их нет —
-- например когда migrate deploy шёл через DIRECT_URL на другой проект, чем DATABASE_URL в runtime.
ALTER TABLE "TelegramBroadcastTemplate" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "TelegramBroadcastTemplate" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
