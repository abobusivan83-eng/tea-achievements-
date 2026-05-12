import { getApiBaseUrl } from "./env";

/**
 * Пробуждает спящий инстанс (например Render) до авторизованных запросов.
 * Не бросает: ошибки сети игнорируются, приложение продолжает работу.
 */
export async function pingBackendHealth(): Promise<void> {
  try {
    const base = getApiBaseUrl().replace(/\/+$/, "");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    await fetch(`${base}/api/health`, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
  } catch {
    /* cold start / offline — основной клиент сам покажет ошибку */
  }
}
