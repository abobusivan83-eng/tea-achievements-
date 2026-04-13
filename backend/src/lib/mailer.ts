import nodemailer from "nodemailer";
import { env } from "./env.js";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendRegistrationCode(to: string, code: string, nickname: string) {
  if (!env.SMTP_HOST) {
    console.warn(`[mail:dev] Код регистрации для ${to} (${nickname}): ${code}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
  });

  const from = env.SMTP_FROM ?? env.SMTP_USER ?? "noreply@localhost";
  const safeNick = escapeHtml(nickname);

  await transporter.sendMail({
    from,
    to,
    subject: "Код подтверждения регистрации",
    text: `Здравствуйте, ${nickname}!\n\nКод для завершения регистрации: ${code}\nКод действует 15 минут.\n\nЕсли вы не запрашивали регистрацию, проигнорируйте это письмо.`,
    html: `<p>Здравствуйте, <strong>${safeNick}</strong>!</p><p>Код для завершения регистрации: <strong style="font-size:1.25rem;letter-spacing:0.15em">${code}</strong></p><p>Код действует 15 минут.</p><p style="color:#666;font-size:12px">Если вы не запрашивали регистрацию, проигнорируйте это письмо.</p>`,
  });
}
