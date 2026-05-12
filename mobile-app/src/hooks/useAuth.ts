import { useAuthStore } from "../store/authStore";

/**
 * Обёртка над Zustand для экранов (аналог «auth context» без лишнего контекста).
 */
export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  return {
    token,
    user,
    hydrated,
    isAuthenticated: Boolean(token),
    setSession,
    clearSession,
  };
}
