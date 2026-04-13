import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { Button } from "../ui/components/Button";
import { FiArrowRight, FiAward, FiShield, FiTrendingUp, FiUserPlus } from "react-icons/fi";
import { motion } from "framer-motion";

export function RegisterPage() {
  const nav = useNavigate();
  const registerRequest = useAuth((s) => s.registerRequest);
  const registerVerify = useAuth((s) => s.registerVerify);
  const [step, setStep] = useState<"form" | "code">("form");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          После регистрации ты получишь доступ к личному профилю, системе достижений, заданиям от администрации, рейтингу участников и магазину наград. Это пространство, где активность внутри клана становится заметной, ценной и визуально красивой.
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
              setError(null);
              setLoading(true);
              try {
                await registerRequest(nickname.trim(), email.trim(), password);
                setCode("");
                setStep("code");
              } catch (e: any) {
                setError(e?.message ?? "Ошибка регистрации");
              } finally {
                setLoading(false);
              }
            }}
          >
            <label className="auth-field">
              <span className="auth-label">Никнейм</span>
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
              <span className="auth-label">Почта</span>
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </label>

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

            <Button type="submit" loading={loading} className="auth-submit auth-submit--register">
              {loading ? "Отправляем код…" : "Продолжить — код на почту"}
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
                await registerVerify(email.trim(), code.trim());
                nav("/profile");
              } catch (e: any) {
                setError(e?.message ?? "Ошибка подтверждения");
              } finally {
                setLoading(false);
              }
            }}
          >
            <p className="text-sm text-steam-muted">
              Мы отправили код из 4 цифр на <span className="text-steam-text">{email.trim()}</span>. Введите его ниже.
            </p>
            <label className="auth-field">
              <span className="auth-label">Код из письма</span>
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
                    await registerRequest(nickname.trim(), email.trim(), password);
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
