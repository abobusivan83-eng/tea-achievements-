import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

const HOUR_MS = 60 * 60 * 1000;

/** Удаляет просроченные строки RegistrationOtp (временные коды регистрации, не «AuthCodes»). */
export async function sweepExpiredRegistrationOtps(): Promise<number> {
  const res = await prisma.registrationOtp.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}

export function startRegistrationOtpCleanup(): NodeJS.Timeout {
  const tick = () => {
    void sweepExpiredRegistrationOtps()
      .then((count) => {
        if (count > 0) logger.info("[registration-otp] removed expired rows", { count });
      })
      .catch((e) => {
        logger.error("[registration-otp] cleanup failed", { err: e instanceof Error ? e.message : String(e) });
      });
  };
  tick();
  return setInterval(tick, HOUR_MS);
}
