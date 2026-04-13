import { EmailParams, MailerSend, Recipient, Sender } from "mailersend";
import { env } from "./env.js";

export class MailNotConfiguredError extends Error {
  constructor() {
    super(
      "Почта не настроена: в Render → Environment задайте MAILERSEND_API_KEY и SMTP_FROM (отправитель в MailerSend).",
    );
    this.name = "MailNotConfiguredError";
  }
}

/** Разбор `Имя <a@b.c>` или `a@b.c` в Sender для MailerSend. */
function parseSmtpFrom(raw: string): Sender {
  const s = raw.trim();
  const m = s.match(/^(.+?)\s*<([^<>]+@[^<>]+)>\s*$/);
  if (m) {
    const name = m[1].replace(/^["']|["']$/g, "").trim();
    const email = m[2].trim();
    return name ? new Sender(email, name) : new Sender(email);
  }
  if (s.includes("@") && !s.includes(" ")) {
    return new Sender(s);
  }
  throw new Error("Некорректный SMTP_FROM: укажите email или формат «Имя <email@домен>».");
}

function registrationEmailHtml(code: string): string {
  const safeCode = escapeHtml(code);
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f0f;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr>
          <td style="padding:8px 8px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C5A059;text-align:center;">
            ЧАЙНЫЙ ШКАФ | ПОДТВЕРЖДЕНИЕ
          </td>
        </tr>
        <tr>
          <td style="padding:0 12px 28px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.65;color:#d1d1d1;text-align:center;">
            Привет! Твой путь к достижениям начинается здесь. Используй этот код для входа:
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 12px 32px;">
            <div style="display:inline-block;padding:20px 36px;border:2px solid #C5A059;border-radius:14px;background:#141414;text-align:center;">
              <span style="font-family:ui-monospace,Consolas,monospace;font-size:38px;font-weight:700;color:#C5A059;letter-spacing:0.25em;">${safeCode}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;line-height:1.5;color:#8a8a8a;text-align:center;">
            Код действует 15 минут. Если ты не регистрировался — проигнорируй это письмо.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function registrationEmailText(code: string) {
  return [
    "ЧАЙНЫЙ ШКАФ | ПОДТВЕРЖДЕНИЕ",
    "",
    "Привет! Твой путь к достижениям начинается здесь. Используй этот код для входа:",
    "",
    code,
    "",
    "Код действует 15 минут.",
  ].join("\n");
}

export function formatMailSendError(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const body = o.body;
    if (body && typeof body === "object") {
      const msg = (body as { message?: string }).message;
      if (typeof msg === "string") return msg.slice(0, 500);
    }
    const sc = typeof o.statusCode === "number" ? String(o.statusCode) : "";
    const msg = err instanceof Error ? err.message : String(err);
    return [sc, msg].filter(Boolean).join(" | ").slice(0, 500);
  }
  return String(err);
}

export function isMailerSendConfigured(): boolean {
  return Boolean(env.MAILERSEND_API_KEY?.trim() && env.SMTP_FROM?.trim());
}

export async function sendRegistrationCode(to: string, code: string, _nickname: string) {
  if (!isMailerSendConfigured()) {
    if (env.APP_ENV === "development") {
      console.warn(`[mail:dev] Код регистрации для ${to}: ${code}`);
      return;
    }
    throw new MailNotConfiguredError();
  }

  const from = parseSmtpFrom(env.SMTP_FROM!);
  const mailerSend = new MailerSend({ apiKey: env.MAILERSEND_API_KEY! });

  const emailParams = new EmailParams()
    .setFrom(from)
    .setTo([new Recipient(to)])
    .setSubject("Чайный шкаф — код подтверждения")
    .setText(registrationEmailText(code))
    .setHtml(registrationEmailHtml(code));

  try {
    await mailerSend.email.send(emailParams);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) {
      const ex = e as { statusCode?: number; body?: { message?: string } };
      const msg = ex.body?.message ?? `MailerSend HTTP ${ex.statusCode ?? "error"}`;
      throw new Error(msg);
    }
    throw e;
  }
}
