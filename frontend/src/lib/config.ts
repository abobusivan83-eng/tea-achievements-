const viteApi = import.meta.env.VITE_API_URL as string | undefined;

function normalizeBaseUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

/**
 * В продакшене API URL задаётся строго через VITE_API_URL.
 * Если переменная не задана — это ошибка конфигурации деплоя.
 */
export const API_BASE_URL = (() => {
  const normalized = normalizeBaseUrl(viteApi);
  if (normalized !== undefined && normalized !== "") return normalized as string;
  if (import.meta.env.DEV) return "http://localhost:4000";
  throw new Error("VITE_API_URL is required in production build");
})();

export const STAGING_ACCESS_TOKEN =
  import.meta.env.VITE_STAGING_ACCESS_TOKEN ?? "";

const viteTgBot = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, "").trim();
/** Ник бота без @ (совпадает с t.me/…). По умолчанию TeaCabinetBot. */
export const TELEGRAM_BOT_HANDLE = viteTgBot && viteTgBot.length > 0 ? viteTgBot : "TeaCabinetBot";
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_HANDLE}`;
export const TELEGRAM_BOT_MENTION = `@${TELEGRAM_BOT_HANDLE}`;
