/**
 * Эндпоинты, на которых 401 не означает «сбросить сессию»
 * (неверный пароль, код регистрации и т.д.).
 */
const PUBLIC_AUTH_PREFIXES = ["/api/auth/login", "/api/auth/register/request", "/api/auth/register/verify"];

export function isPublicAuthUrl(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  return PUBLIC_AUTH_PREFIXES.some((p) => path.startsWith(p));
}
