-- Ускорение входа и поиска по нику / Telegram
CREATE INDEX IF NOT EXISTS "User_nickname_idx" ON "User"("nickname");
CREATE INDEX IF NOT EXISTS "User_telegramUsername_idx" ON "User"("telegramUsername");
