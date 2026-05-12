import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { AuthUser } from "../types/api";
import { STORAGE_KEYS } from "../services/storageKeys";
import { loadPersistedToken, persistTokenSecure, wipeSecureToken } from "../services/secureTokenStore";
import { invalidateHttpClient } from "../api/sessionTransport";
import { emitAuthCleared } from "../services/authEvents";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (token: string, user: AuthUser, rememberMe?: boolean) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  setSession: async (token, user, rememberMe) => {
    set({ token, user });
    await persistTokenSecure(token);
    await AsyncStorage.setItem(STORAGE_KEYS.rememberMe, rememberMe ? "1" : "0");
  },

  clearSession: async () => {
    set({ token: null, user: null });
    await wipeSecureToken();
    await AsyncStorage.removeItem(STORAGE_KEYS.rememberMe);
    invalidateHttpClient();
    emitAuthCleared();
  },

  hydrate: async () => {
    try {
      const token = await loadPersistedToken();
      if (!token) {
        set({ hydrated: true });
        return;
      }
      set({ token });
    } finally {
      set({ hydrated: true });
    }
  },
}));
