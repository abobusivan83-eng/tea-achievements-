type AuthRememberMeProps = {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

/**
 * Премиальный переключатель: золотая рамка, мягкое свечение при включении.
 */
export function AuthRememberMe({ id, checked, onChange }: AuthRememberMeProps) {
  return (
    <div className="auth-remember">
      <input
        id={id}
        type="checkbox"
        className="auth-remember-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="auth-remember-label">
        <span className="auth-remember-track" aria-hidden>
          <span className="auth-remember-thumb" />
        </span>
        <span className="auth-remember-copy">
          <span className="auth-remember-title">Запомнить меня</span>
          <span className="auth-remember-sub">Сессия до 30 дней на этом устройстве</span>
        </span>
      </label>
    </div>
  );
}
