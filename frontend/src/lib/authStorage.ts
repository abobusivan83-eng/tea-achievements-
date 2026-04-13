const LAST_LOGIN_EMAIL_KEY = "tea_last_login_email";

export function getStoredLoginEmail(): string {
  try {
    return localStorage.getItem(LAST_LOGIN_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredLoginEmail(email: string) {
  try {
    const t = email.trim().toLowerCase();
    if (t) localStorage.setItem(LAST_LOGIN_EMAIL_KEY, t);
  } catch {
    /* ignore */
  }
}
