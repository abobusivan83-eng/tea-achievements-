-- Кэш Telegram username → chat_id (после /start или любого сообщения боту)
CREATE TABLE "TelegramChatLookup" (
    "usernameLower" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChatLookup_pkey" PRIMARY KEY ("usernameLower")
);

CREATE INDEX "RegistrationOtp_telegramUsername_idx" ON "RegistrationOtp"("telegramUsername");
