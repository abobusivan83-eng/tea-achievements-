-- Index for pending registration lookup by @username (column added in 20260415120000_telegram_registration).
CREATE INDEX IF NOT EXISTS "RegistrationOtp_telegramUsername_idx" ON "RegistrationOtp"("telegramUsername");
