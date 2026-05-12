import { type PropsWithChildren, useEffect } from "react";
import { useAuthStore } from "../store/authStore";

/**
 * Провайдер сессии: восстановление токена из SecureStore при старте (auto-login).
 * Состояние авторизации — в Zustand (`useAuthStore` / `useAuth`).
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
