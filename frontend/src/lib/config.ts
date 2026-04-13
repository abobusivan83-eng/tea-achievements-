const viteApi = import.meta.env.VITE_API_URL as string | undefined;
const viteBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * Пустая строка после сборки = запросы на тот же origin (nginx проксирует /api и /uploads).
 * В dev Vite `import.meta.env.DEV` указывает на отдельный backend на :4000.
 */
export const API_BASE_URL =
  viteApi !== undefined && viteApi !== ""
    ? viteApi
    : viteBase !== undefined && viteBase !== ""
      ? viteBase
      : import.meta.env.DEV
        ? "http://localhost:4000"
        : "";

export const STAGING_ACCESS_TOKEN =
  import.meta.env.VITE_STAGING_ACCESS_TOKEN ?? "";

const viteTgBot = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, "").trim();
/** Ник бота без @ (совпадает с t.me/…). По умолчанию TeaCabinetBot. */
export const TELEGRAM_BOT_HANDLE = viteTgBot && viteTgBot.length > 0 ? viteTgBot : "TeaCabinetBot";
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_HANDLE}`;
/** Открывает приложение Telegram на iOS/Android (не веб-версию). */
export const TELEGRAM_BOT_TG_APP = `tg://resolve?domain=${TELEGRAM_BOT_HANDLE}`;
export const TELEGRAM_BOT_MENTION = `@${TELEGRAM_BOT_HANDLE}`;

/**
 * Ссылка для открытия бота: tg:// (приложение) или https://t.me/...?start=...
 * Если есть payload start — передаём в tg://resolve.
 */
export function telegramOpenHref(deepLink: string | null | undefined): string {
  if (!deepLink?.trim()) return TELEGRAM_BOT_TG_APP;
  try {
    const u = new URL(deepLink);
    if (u.hostname !== "t.me" && !u.hostname.endsWith(".t.me")) return deepLink;
    const path = u.pathname.replace(/^\//, "");
    const seg = path.split("/").filter(Boolean);
    const domain = seg[0] ?? TELEGRAM_BOT_HANDLE;
    const start = u.searchParams.get("start");
    if (start) {
      return `tg://resolve?domain=${encodeURIComponent(domain)}&start=${encodeURIComponent(start)}`;
    }
    return `tg://resolve?domain=${encodeURIComponent(domain)}`;
  } catch {
    return TELEGRAM_BOT_TG_APP;
  }
}


