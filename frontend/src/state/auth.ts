import { create } from "zustand";
import { apiFetch, apiJson } from "../lib/api";
import type { Me, Role } from "../lib/types";

type AuthState = {
  token: string | null;
  me: Me | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Отправка кода на почту (шаг 1 регистрации). */
  registerRequest: (nickname: string, email: string, password: string) => Promise<void>;
  /** Подтверждение кода из 4 цифр (шаг 2). */
  registerVerify: (email: string, code: string) => Promise<void>;
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

  async login(email, password) {
    const resp = await apiJson<{ token: string; user: { id: string; nickname: string; email: string; role: Role } }>(
      "/api/auth/login",
      { email, password },
    );
    localStorage.setItem("token", resp.token);
    set({ token: resp.token });
    await get().hydrate();
  },

  async registerRequest(nickname, email, password) {
    await apiJson<{ sent: boolean; email: string }>("/api/auth/register/request", { nickname, email, password });
  },

  async registerVerify(email, code) {
    const resp = await apiJson<{ token: string; user: { id: string; nickname: string; email: string; role: Role } }>(
      "/api/auth/register/verify",
      { email, code },
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

