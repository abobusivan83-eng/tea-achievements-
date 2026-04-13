import nodemailer from "nodemailer";
import { env } from "./env.js";

/** В production/staging без SMTP регистрация по почте должна явно сообщать об ошибке, а не «успех без письма». */
export class MailNotConfiguredError extends Error {
  constructor() {
    super("SMTP не настроен: в Render → Environment задайте SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS и SMTP_FROM.");
    this.name = "MailNotConfiguredError";
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTransportOptions() {
  const host = env.SMTP_HOST!;
  const port = env.SMTP_PORT ?? (env.SMTP_SECURE ? 465 : 587);
  /** Порт 465 — обычно SSL с первого байта; 587 — STARTTLS после приветствия. */
  const secure = env.SMTP_SECURE ?? port === 465;
  const useStartTls = !secure && port === 587;

  return {
    host,
    port,
    secure,
    requireTLS: useStartTls,
    auth:
      env.SMTP_USER != null && env.SMTP_USER !== ""
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" }
        : undefined,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 25_000,
    tls: { minVersion: "TLSv1.2" as const },
    debug: env.SMTP_DEBUG,
    logger: env.SMTP_DEBUG,
  };
}

function registrationEmailHtml(code: string, nickname: string): string {
  const safeNick = escapeHtml(nickname);
  const digits = code.split("").map((d) => escapeHtml(d));

  const digitCells = digits
    .map(
      (d) =>
        `<td style="width:56px;height:64px;text-align:center;vertical-align:middle;background:#0d1117;border-radius:12px;border:1px solid rgba(102,192,244,0.35);font-family:ui-monospace,Consolas,monospace;font-size:28px;font-weight:700;color:#66c0f4;letter-spacing:0;">${d}</td>`,
    )
    .join('<td style="width:8px"></td>');

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e12;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0e12;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-radius:20px;overflow:hidden;border:1px solid rgba(102,192,244,0.22);background:#111822;">
        <tr>
          <td style="padding:28px 28px 20px;background:linear-gradient(135deg,#1a2332 0%,#121a24 50%,#0f1620 100%);border-bottom:1px solid rgba(102,192,244,0.15);">
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#66c0f4;">Чайные достижения</div>
            <h1 style="margin:12px 0 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:22px;font-weight:700;line-height:1.25;color:#e5eef8;">Подтвердите регистрацию</h1>
            <p style="margin:10px 0 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#9fb3c8;">Здравствуйте, <strong style="color:#dce9f5;">${safeNick}</strong>! Введите код на сайте, чтобы завершить создание аккаунта.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px;">
            <p style="margin:0 0 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;color:#7a8fa3;">Ваш код (действует <strong style="color:#b8d4ea;">15 минут</strong>)</p>
            <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;"><tr>${digitCells}</tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;">
            <p style="margin:16px 0 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.55;color:#6b7c8f;">Если вы не запрашивали регистрацию, просто проигнорируйте это письмо — аккаунт не будет создан.</p>
            <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.06);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:11px;color:#4d5c6b;line-height:1.5;">Это автоматическое сообщение. Отвечать на него не нужно.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function registrationEmailText(code: string, nickname: string) {
  return [
    "Чайные достижения — подтверждение регистрации",
    "",
    `Здравствуйте, ${nickname}!`,
    "",
    `Ваш код: ${code}`,
    "Код действует 15 минут.",
    "",
    "Если вы не запрашивали регистрацию, проигнорируйте это письмо.",
  ].join("\n");
}

/** Сообщение для логов без секретов. */
export function formatMailSendError(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code : "";
    const cmd = typeof o.command === "string" ? o.command : "";
    const resp = typeof o.response === "string" ? o.response.slice(0, 200) : "";
    const msg = err instanceof Error ? err.message : String(err);
    return [code, cmd, resp, msg].filter(Boolean).join(" | ").slice(0, 500);
  }
  return String(err);
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_HOST.trim().length > 0);
}

export async function sendRegistrationCode(to: string, code: string, nickname: string) {
  if (!isSmtpConfigured()) {
    if (env.APP_ENV === "development") {
      console.warn(`[mail:dev] Код регистрации для ${to} (${nickname}): ${code}`);
      return;
    }
    throw new MailNotConfiguredError();
  }

  const from = env.SMTP_FROM ?? env.SMTP_USER;
  if (!from || !from.trim()) {
    throw new Error("Задайте SMTP_FROM или SMTP_USER как адрес отправителя (From).");
  }

  const transporter = nodemailer.createTransport(buildTransportOptions());

  await transporter.sendMail({
    from: from.trim(),
    to,
    subject: "Код для регистрации — Чайные достижения",
    text: registrationEmailText(code, nickname),
    html: registrationEmailHtml(code, nickname),
    headers: {
      "X-Entity-Ref-ID": "registration-otp",
    },
  });
}
