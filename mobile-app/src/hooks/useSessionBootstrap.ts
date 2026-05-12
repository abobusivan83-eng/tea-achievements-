import { useEffect } from "react";
import { fetchMe } from "../api/auth";
import { ApiError } from "../api/http";
import { useAuthStore } from "../store/authStore";
import type { AuthUser } from "../types/api";

function pickAuthUser(me: Record<string, unknown>): AuthUser {
  return {
    id: String(me.id),
    nickname: String(me.nickname),
    email: String(me.email),
    role: me.role as AuthUser["role"],
    publicId: String(me.publicId ?? ""),
  };
}

/**
 * После гидрации токена подгружаем профиль, чтобы стор был согласован с /api/auth/me.
 */
export function useSessionBootstrap() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    if (!hydrated || !token || user) return;
    let cancelled = false;
    (async () => {
      try {
        const me = (await fetchMe()) as Record<string, unknown>;
        if (cancelled) return;
        await setSession(token, pickAuthUser(me));
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await useAuthStore.getState().clearSession();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, user, setSession]);
}
