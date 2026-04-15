const LAST_TG_LOGIN_KEY = "tea_last_tg_login";
const LEGACY_EMAIL_KEY = "tea_last_login_email";
const AUTH_STORAGE_KEY = "tea_auth_token";
const AUTH_SESSION_KEY = "tea_auth_session_token";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type StoredAuthToken = {
  token: string;
  expiresAt: number;
};

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

function safeParseStoredAuth(raw: string | null): StoredAuthToken | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuthToken;
    if (!parsed?.token || typeof parsed.token !== "string") return null;
    if (!parsed?.expiresAt || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function setStoredAuthToken(token: string, rememberMe: boolean) {
  try {
    const payload: StoredAuthToken = {
      token,
      expiresAt: Date.now() + THIRTY_DAYS_MS,
    };
    localStorage.removeItem("token");
    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload));
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Last fallback: keep compatibility with legacy key.
    localStorage.setItem("token", token);
  }
}

export function getStoredAuthToken(): string | null {
  try {
    const fromSession = safeParseStoredAuth(sessionStorage.getItem(AUTH_SESSION_KEY));
    if (fromSession) {
      if (Date.now() <= fromSession.expiresAt) return fromSession.token;
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }

    const fromLocal = safeParseStoredAuth(localStorage.getItem(AUTH_STORAGE_KEY));
    if (fromLocal) {
      if (Date.now() <= fromLocal.expiresAt) return fromLocal.token;
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    // Legacy fallback.
    const legacy = localStorage.getItem("token");
    if (legacy) return legacy;
    return null;
  } catch {
    return localStorage.getItem("token");
  }
}

export function clearStoredAuthToken() {
  clearAuthStorage();
}
