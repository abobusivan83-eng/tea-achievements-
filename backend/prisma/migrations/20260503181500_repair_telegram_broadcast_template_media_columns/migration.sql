-- Idempotent repair (P2022): колонки есть в Prisma, но иногда отсутствуют в БД.
-- ALTER без таблицы роняет весь migrate deploy — сначала проверяем существование.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'TelegramBroadcastTemplate'
  ) THEN
    ALTER TABLE "TelegramBroadcastTemplate" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
    ALTER TABLE "TelegramBroadcastTemplate" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
  END IF;
END $$;
