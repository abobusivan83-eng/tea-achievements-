/**
 * Клиентское чтение exp без проверки подписи (как на всех JWT-клиентах).
 * Нужно лишь чтобы не слать заведомо просроченный токен.
 */
export function getJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const raw = globalThis.atob(b64 + pad);
    const payload = JSON.parse(raw) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

const CLOCK_SKEW_MS = 15_000;

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const exp = getJwtExpiryMs(token);
  if (exp == null) return false;
  return nowMs >= exp - CLOCK_SKEW_MS;
}
