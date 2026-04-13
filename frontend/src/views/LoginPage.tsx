import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { getStoredTelegramLogin } from "../lib/authStorage";
import { AuthRememberMe } from "../ui/components/AuthRememberMe";
import { AuthTelegramBotPromo } from "../ui/components/AuthTelegramBotPromo";
import { Button } from "../ui/components/Button";
import { useVisualViewportKeyboardInset } from "../hooks/useVisualViewportKeyboardInset";
import { FiArrowRight, FiLock, FiLogIn, FiShield, FiStar } from "react-icons/fi";
import { motion } from "framer-motion";

export function LoginPage() {
  const keyboardInset = useVisualViewportKeyboardInset();
  const nav = useNavigate();
  const signIn = useAuth((s) => s.login);
  const [loginField, setLoginField] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = getStoredTelegramLogin();
    if (saved) setLoginField(saved);
  }, []);

  return (
    <div className="auth-shell">
      <motion.section
        className="auth-hero-panel"
        initial={{ opacity: 0, x: -18, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="auth-badge">
          <FiStar />
          Добро пожаловать
        </div>
        <h1 className="auth-title">Добро пожаловать в систему достижений «Чайные достижения»</h1>
        <p className="auth-copy">
          Это внутренняя система прогресса клана, где администрация создает достижения и задания, а участники получают цели, награды и повод быть активнее внутри сообщества. Здесь каждый шаг в клане можно превратить в заметный личный прогресс.
        </p>

        <div className="auth-feature-grid">
          <div className="auth-feature-card">
            <div className="auth-feature-icon"><FiShield /></div>
            <div>
              <div className="auth-feature-title">Понятная система прогресса</div>
              <div className="auth-feature-text">Выполняй задания, собирай достижения, получай XP и рейтинг за достижения, а монеты зарабатывай через задания и активности клана.</div>
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon"><FiStar /></div>
            <div>
              <div className="auth-feature-title">Мотивация для участников</div>
              <div className="auth-feature-text">Сайт создан, чтобы достижения внутри клана были не формальностью, а интересной системой активности, статуса и вовлеченности.</div>
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon"><FiLock /></div>
            <div>
              <div className="auth-feature-title">Все важное в одном месте</div>
              <div className="auth-feature-text">Профиль, достижения, рейтинг, задания, магазин и уведомления об ответах администрации собраны в одной удобной системе.</div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="auth-form-panel"
        style={{
          paddingBottom: `calc(28px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
        }}
        initial={{ opacity: 0, x: 18, y: 10, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
      >
        <div className="auth-form-head">
          <div className="auth-form-icon"><FiLogIn /></div>
          <div>
            <div className="auth-form-kicker">Система клановых достижений</div>
            <h2 className="auth-form-title">Вход в аккаунт</h2>
          </div>
        </div>

        <form
          className="mt-6 grid gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              await signIn(loginField, password, rememberMe);
              nav("/profile");
            } catch (e: any) {
              setError(e?.message ?? "Ошибка входа");
            } finally {
              setLoading(false);
            }
          }}
        >
          <AuthTelegramBotPromo />

          <label className="auth-field">
            <span className="auth-label">Ваш ник в Telegram</span>
            <input
              className="auth-input"
              value={loginField}
              onChange={(e) => setLoginField(e.target.value)}
              placeholder="@username или username"
              autoComplete="username"
            />
            <span className="mt-1 block text-xs text-steam-muted">
              Можно с @ или без. Альтернатива: числовой ID чата. Для очень старых аккаунтов допускается почта.
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Пароль</span>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <AuthRememberMe id="remember-me-login" checked={rememberMe} onChange={setRememberMe} />

          {error ? <div className="auth-error">{error}</div> : null}

          <Button type="submit" loading={loading} className="auth-submit">
            {loading ? "Входим…" : "Войти"}
          </Button>
        </form>

        <div className="auth-footer">
          <span className="text-steam-muted">Нет аккаунта?</span>
          <Link className="auth-link" to="/register">
            Регистрация <FiArrowRight />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
