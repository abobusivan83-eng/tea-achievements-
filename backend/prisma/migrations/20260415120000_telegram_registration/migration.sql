-- User: Telegram
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;

CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- RegistrationOtp: Telegram вместо email
DELETE FROM "RegistrationOtp";

DROP INDEX IF EXISTS "RegistrationOtp_email_key";

ALTER TABLE "RegistrationOtp" DROP COLUMN "email";

ALTER TABLE "RegistrationOtp" ADD COLUMN "linkToken" TEXT NOT NULL;
ALTER TABLE "RegistrationOtp" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "RegistrationOtp" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "RegistrationOtp" ALTER COLUMN "codeHash" DROP NOT NULL;

CREATE UNIQUE INDEX "RegistrationOtp_linkToken_key" ON "RegistrationOtp"("linkToken");
CREATE INDEX "RegistrationOtp_telegramChatId_idx" ON "RegistrationOtp"("telegramChatId");
