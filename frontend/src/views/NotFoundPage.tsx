import { Link } from "react-router-dom";
import { FiAlertTriangle, FiHome, FiLogIn } from "react-icons/fi";
import { useAuth } from "../state/auth";
import { Button } from "../ui/components/Button";

export function NotFoundPage() {
  const me = useAuth((s) => s.me);

  return (
    <div className="mx-auto grid max-w-2xl place-items-center py-10">
      <div className="steam-card glow w-full p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-steam-accent">
            <FiAlertTriangle className="text-2xl" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-semibold tracking-tight text-steam-text">404 — Страница не найдена</div>
            <div className="mt-2 text-sm text-steam-muted">
              Похоже, ссылка неверная или страница была перемещена.
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {me ? (
                <Link to="/profile">
                  <Button leftIcon={<FiHome />} variant="primary">
                    В профиль
                  </Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button leftIcon={<FiLogIn />} variant="primary">
                    Войти
                  </Button>
                </Link>
              )}

              <Link to="/">
                <Button variant="ghost">На главную</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

