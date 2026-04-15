const viteApi = import.meta.env.VITE_API_URL as string | undefined;
const viteBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

function normalizeBaseUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

/**
 * Пустая строка после сборки = запросы на тот же origin (nginx проксирует /api и /uploads).
 * В dev Vite `import.meta.env.DEV` указывает на отдельный backend на :4000.
 */
export const API_BASE_URL =
  normalizeBaseUrl(viteApi) !== undefined && normalizeBaseUrl(viteApi) !== ""
    ? (normalizeBaseUrl(viteApi) as string)
    : normalizeBaseUrl(viteBase) !== undefined && normalizeBaseUrl(viteBase) !== ""
      ? (normalizeBaseUrl(viteBase) as string)
      : import.meta.env.DEV
        ? "http://localhost:4000"
        : "";

export const STAGING_ACCESS_TOKEN =
  import.meta.env.VITE_STAGING_ACCESS_TOKEN ?? "";

const viteTgBot = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, "").trim();
/** Ник бота без @ (совпадает с t.me/…). По умолчанию TeaCabinetBot. */
export const TELEGRAM_BOT_HANDLE = viteTgBot && viteTgBot.length > 0 ? viteTgBot : "TeaCabinetBot";
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_HANDLE}`;
export const TELEGRAM_BOT_MENTION = `@${TELEGRAM_BOT_HANDLE}`;
