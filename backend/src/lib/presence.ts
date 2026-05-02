import { prisma } from "./prisma.js";

const THROTTLE_MS = 75_000;
const lastBumpAt = new Map<string, number>();

/** Обновляет lastActiveAt не чаще чем раз в ~75 с, чтобы не нагружать БД на каждом запросе. */
export function bumpUserPresence(userId: string): void {
  const now = Date.now();
  const prev = lastBumpAt.get(userId) ?? 0;
  if (now - prev < THROTTLE_MS) return;
  lastBumpAt.set(userId, now);
  void prisma.user
    .update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});
}
