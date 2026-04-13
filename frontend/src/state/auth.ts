import { create } from "zustand";
import { apiFetch, apiJson } from "../lib/api";
import { setStoredTelegramLogin } from "../lib/authStorage";
import type { Me, Role } from "../lib/types";

export type RegisterRequestResponse = {
  linkToken: string;
  deepLink: string | null;
  botUsername: string | null;
  codeSent: boolean;
  activationNeeded?: boolean;
};

type AuthState = {
  token: string | null;
  me: Me | null;
  isReady: boolean;
  login: (login: string, password: string, rememberMe?: boolean) => Promise<void>;
  registerRequest: (nickname: string, password: string, telegramUsername: string) => Promise<RegisterRequestResponse>;
  registerVerify: (linkToken: string, code: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  isAdmin: () => boolean;
  isCreator: () => boolean;
  isStaff: () => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  me: null,
  isReady: false,

  async login(login, password, rememberMe) {
    const resp = await apiJson<{ token: string; user: { id: string; nickname: string; email: string; role: Role } }>(
      "/api/auth/login",
      { login, password, rememberMe: Boolean(rememberMe) },
    );
    setStoredTelegramLogin(login);
    localStorage.setItem("token", resp.token);
    set({ token: resp.token });
    await get().hydrate();
  },

  async registerRequest(nickname, password, telegramUsername) {
    return apiJson<RegisterRequestResponse>("/api/auth/register/request", {
      nickname,
      password,
      telegramUsername: telegramUsername.trim(),
    });
  },

  async registerVerify(linkToken, code, rememberMe) {
    const resp = await apiJson<{ token: string; user: { id: string; nickname: string; email: string; role: Role } }>(
      "/api/auth/register/verify",
      { linkToken, code, rememberMe: Boolean(rememberMe) },
    );
    localStorage.setItem("token", resp.token);
    set({ token: resp.token });
    await get().hydrate();
  },

  logout() {
    localStorage.removeItem("token");
    set({ token: null, me: null, isReady: true });
  },

  async hydrate() {
    const token = localStorage.getItem("token");
    if (!token) return set({ token: null, me: null, isReady: true });
    try {
      const me = await apiFetch<Me>("/api/auth/me");
      set({ token, me, isReady: true });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, me: null, isReady: true });
    }
  },

  isAdmin() {
    return get().me?.role === "ADMIN";
  },

  isCreator() {
    return get().me?.role === "CREATOR";
  },

  isStaff() {
    const r = get().me?.role;
    return r === "ADMIN" || r === "CREATOR";
  },
}));
