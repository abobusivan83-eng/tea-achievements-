import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { getStoredTelegramLogin, setStoredTelegramLogin } from "../lib/authStorage";
import { AuthRememberMe } from "../ui/components/AuthRememberMe";
import { Button } from "../ui/components/Button";
import { FiArrowRight, FiAward, FiExternalLink, FiShield, FiTrendingUp, FiUserPlus } from "react-icons/fi";
import { motion } from "framer-motion";

export function RegisterPage() {
  const nav = useNavigate();
  const registerRequest = useAuth((s) => s.registerRequest);
  const registerVerify = useAuth((s) => s.registerVerify);
  const [step, setStep] = useState<"form" | "code">("form");
  const [nickname, setNickname] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [password, setPassword] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = getStoredTelegramLogin();
    if (!saved) return;
    if (/^\d+$/.test(saved)) setTelegramChatId(saved);
    else setTelegramUsername(saved.replace(/^@/, ""));
  }, []);

  async function submitRegistration() {
    setError(null);
    const tg = telegramUsername.trim().replace(/^@/, "");
    const chat = telegramChatId.trim();
    if (!chat) {
      if (!tg || tg.length < 5 || tg.length > 32 || !/^[a-zA-Z0-9_]+$/.test(tg)) {
        setError("Укажи ник в Telegram (латиница, 5–32 символа) или числовой ID чата.");
        return;
      }
    }
    setLoading(true);
    try {
      const resp = await registerRequest(nickname.trim(), password, {
        telegramUsername: tg || undefined,
        telegramChatId: chat || undefined,
      });
      setLinkToken(resp.linkToken);
      setDeepLink(resp.deepLink);
      setCodeSent(resp.codeSent);
      if (tg) setStoredTelegramLogin(tg.startsWith("@") ? tg : `@${tg}`);
      else if (chat) setStoredTelegramLogin(chat);
      setCode("");
      setStep("code");
      if (resp.deepLink && !resp.codeSent) {
        window.open(resp.deepLink, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setError(e?.message ?? "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell auth-shell--register">
      <motion.section
        className="auth-hero-panel auth-hero-panel--register"
        initial={{ opacity: 0, x: -18, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="auth-badge">
          <FiUserPlus />
          Новый участник
        </div>
        <h1 className="auth-title">Присоединяйся к «Чайным достижениям» и начни свой путь в системе прогресса клана</h1>
        <p className="auth-copy">
          Вход и регистрация привязаны к твоему нику в Telegram. Код подтверждения приходит в личку бота — по одному только нику Telegram API не шлёт сообщения, нужен либо переход по ссылке с кнопкой «Start», либо числовой ID.
        </p>

        <div className="auth-feature-grid">
          <Feature icon={<FiAward />} title="Личная витрина достижений" text="Получай обычные, редкие и секретные награды, которые будут формировать твой профиль и репутацию внутри клана." />
          <Feature icon={<FiTrendingUp />} title="Рост в рейтинге" text="Получай XP и рейтинг за достижения, а монеты копи за выполненные задания и клановые активности." />
          <Feature icon={<FiShield />} title="Единая клановая система" text="Все ключевые разделы проекта собраны в одном месте: задания, достижения, уведомления, магазин и связь с администрацией." />
        </div>
      </motion.section>

      <motion.section
        className="auth-form-panel auth-form-panel--register"
        initial={{ opacity: 0, x: 18, y: 10, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
      >
        <div className="auth-form-head">
          <div className="auth-form-icon"><FiUserPlus /></div>
          <div>
            <div className="auth-form-kicker">Добро пожаловать в клановую систему</div>
            <h2 className="auth-form-title">Регистрация</h2>
          </div>
        </div>

        {step === "form" ? (
          <form
            className="mt-6 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await submitRegistration();
            }}
          >
            <label className="auth-field">
              <span className="auth-label">Никнейм на сайте</span>
              <input
                className="auth-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Например, Salamanca"
                minLength={2}
                maxLength={24}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Ваш ник в Telegram</span>
              <input
                className="auth-input"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value.replace(/^@+/, ""))}
                placeholder="username (латиница, без @), если нет ID ниже"
                maxLength={32}
              />
              <span className="mt-1 block text-xs text-steam-muted">
                Как в ссылке t.me/<strong className="text-steam-text/90">username</strong>. Не подставляй ник с сайта — только Telegram.
              </span>
            </label>

            <label className="auth-field">
              <span className="auth-label">Числовой ID в Telegram (необязательно)</span>
              <input
                className="auth-input font-mono"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value.replace(/\D/g, ""))}
                placeholder="Чтобы код пришёл сразу — узнай у @userinfobot"
                inputMode="numeric"
              />
            </label>
            <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-steam-muted">
              <span className="font-medium text-steam-text/90">Как приходит код:</span> с ID бот шлёт сообщение сразу (ты уже должен был написать боту хотя бы раз).{" "}
              <span className="text-steam-text/80">Только ник без ID</span> — откроется бот, нажми «Start»: сервер узнает твой chat_id и тогда отправит код. По API нельзя написать пользователю, зная только @ник.
            </p>

            <label className="auth-field">
              <span className="auth-label">Пароль</span>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                maxLength={72}
                required
              />
            </label>

            {error ? <div className="auth-error">{error}</div> : null}

            <AuthRememberMe id="remember-me-register-form" checked={rememberMe} onChange={setRememberMe} />

            <Button type="submit" loading={loading} className="auth-submit auth-submit--register">
              {loading ? "Отправляем…" : "Продолжить"}
            </Button>
          </form>
        ) : (
          <form
            className="mt-6 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              try {
                await registerVerify(linkToken, code.trim(), rememberMe);
                const u = telegramUsername.trim().replace(/^@/, "");
                if (u) setStoredTelegramLogin(u.startsWith("@") ? u : `@${u}`);
                else if (telegramChatId.trim()) setStoredTelegramLogin(telegramChatId.trim());
                nav("/profile");
              } catch (e: any) {
                setError(e?.message ?? "Ошибка подтверждения");
              } finally {
                setLoading(false);
              }
            }}
          >
            {!codeSent && deepLink ? (
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-steam-muted">
                <p className="mb-2 text-steam-text">
                  Открой бота и нажми «Start» — мы уже открыли ссылку в новой вкладке. После этого бот сможет отправить код в личку (так работает Telegram для регистрации по нику).
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<FiExternalLink />}
                  onClick={() => deepLink && window.open(deepLink, "_blank", "noopener,noreferrer")}
                >
                  Подтвердить через Telegram
                </Button>
              </div>
            ) : null}

            {codeSent ? (
              <p className="text-sm text-steam-muted">Код из 4 цифр отправлен в Telegram. Введи его ниже.</p>
            ) : !deepLink ? (
              <p className="text-sm text-steam-muted">Введи код из Telegram.</p>
            ) : null}

            <label className="auth-field">
              <span className="auth-label">Код из Telegram</span>
              <input
                className="auth-input font-mono tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                required
              />
            </label>
            {error ? <div className="auth-error">{error}</div> : null}

            <AuthRememberMe id="remember-me-register-code" checked={rememberMe} onChange={setRememberMe} />

            <Button type="submit" loading={loading} className="auth-submit auth-submit--register" disabled={code.length !== 4}>
              {loading ? "Проверяем…" : "Завершить регистрацию"}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError(null);
                }}
              >
                Назад
              </Button>
              <Button
                type="button"
                variant="ghost"
                loading={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const tg = telegramUsername.trim().replace(/^@/, "");
                    const chat = telegramChatId.trim();
                    const resp = await registerRequest(nickname.trim(), password, {
                      telegramUsername: tg || undefined,
                      telegramChatId: chat || undefined,
                    });
                    setLinkToken(resp.linkToken);
                    setDeepLink(resp.deepLink);
                    setCodeSent(resp.codeSent);
                    if (resp.deepLink && !resp.codeSent) {
                      window.open(resp.deepLink, "_blank", "noopener,noreferrer");
                    }
                  } catch (e: any) {
                    setError(e?.message ?? "Не удалось отправить код повторно");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Отправить код снова
              </Button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <span className="text-steam-muted">Уже есть аккаунт?</span>
          <Link className="auth-link" to="/login">
            Войти <FiArrowRight />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

function Feature(props: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="auth-feature-card">
      <div className="auth-feature-icon">{props.icon}</div>
      <div>
        <div className="auth-feature-title">{props.title}</div>
        <div className="auth-feature-text">{props.text}</div>
      </div>
    </div>
  );
}
