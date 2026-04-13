const LAST_TG_LOGIN_KEY = "tea_last_tg_login";
const LEGACY_EMAIL_KEY = "tea_last_login_email";

export function getStoredTelegramLogin(): string {
  try {
    return localStorage.getItem(LAST_TG_LOGIN_KEY) ?? localStorage.getItem(LEGACY_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredTelegramLogin(login: string) {
  try {
    const t = login.trim();
    if (t) localStorage.setItem(LAST_TG_LOGIN_KEY, t);
  } catch {
    /* ignore */
  }
}
