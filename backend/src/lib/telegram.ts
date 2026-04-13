import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

export class TelegramNotConfiguredError extends Error {
  constructor() {
    super("Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME в переменных окружения.");
    this.name = "TelegramNotConfiguredError";
  }
}

export function telegramSyntheticEmail(chatId: string) {
  return `tg_${chatId}@telegram.local`;
}

export function registrationCodeMessage(code: string) {
  return `\u{1F4E6} ЧАЙНЫЙ ШКАФ \n\nТвой код для входа: ${code} \nНикому не сообщай его!`;
}

function apiBase() {
  const token = env.TELEGRAM_BOT_TOKEN!.trim();
  return `https://api.telegram.org/bot${token}/`;
}

export async function telegramSendMessage(chatId: string, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new TelegramNotConfiguredError();
  }
  const res = await fetch(`${apiBase()}sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram sendMessage failed (${res.status})`);
  }
}

export function isTelegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_BOT_USERNAME?.trim());
}

export function telegramDeepLink(linkToken: string) {
  const u = env.TELEGRAM_BOT_USERNAME!.replace(/^@/, "").trim();
  return `https://t.me/${u}?start=${encodeURIComponent(linkToken)}`;
}

export function randomFourDigitCode() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

async function issueCodeAndNotify(chatId: string, pendingId: string) {
  const code = randomFourDigitCode();
  const codeHash = await bcrypt.hash(code, 8);
  await prisma.registrationOtp.update({
    where: { id: pendingId },
    data: { telegramChatId: chatId, codeHash },
  });
  await telegramSendMessage(chatId, registrationCodeMessage(code));
}

/** Вызывается из long polling: пользователь открыл бота с /start <linkToken>. */
export async function handleTelegramStartLink(linkToken: string, chatId: string) {
  const pending = await prisma.registrationOtp.findUnique({ where: { linkToken } });
  if (!pending) {
    await telegramSendMessage(chatId, "Ссылка недействительна или устарела. Зарегистрируйся на сайте и нажми кнопку снова.");
    return;
  }
  if (pending.expiresAt < new Date()) {
    await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});
    await telegramSendMessage(chatId, "Срок регистрации истёк. Начни заново на сайте.");
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (existingUser) {
    await telegramSendMessage(chatId, "Этот Telegram уже привязан к аккаунту. Войди на сайте.");
    return;
  }

  if (pending.telegramChatId && pending.telegramChatId !== chatId) {
    await telegramSendMessage(chatId, "Эта ссылка уже использована с другого аккаунта Telegram.");
    return;
  }

  if (pending.codeHash && pending.telegramChatId === chatId) {
    await telegramSendMessage(chatId, "Код уже отправлен. Проверь сообщения выше или запроси новый код на сайте.");
    return;
  }

  await issueCodeAndNotify(chatId, pending.id);
}

/** Отправка кода при регистрации с уже известным chat id (пользователь ввёл ID на сайте). */
export async function issueRegistrationCodeForPending(pendingId: string, chatId: string) {
  await issueCodeAndNotify(chatId, pendingId);
}

let pollingOffset = 0;
let pollingStarted = false;

export function startTelegramLongPolling() {
  if (pollingStarted) return;
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    if (env.APP_ENV === "development") {
      console.warn("[telegram] TELEGRAM_BOT_TOKEN не задан — long polling отключён.");
    }
    return;
  }
  pollingStarted = true;

  const loop = async () => {
    try {
      const url = new URL(`${apiBase()}getUpdates`);
      url.searchParams.set("offset", String(pollingOffset));
      url.searchParams.set("timeout", "45");

      const res = await fetch(url.toString());
      const data = (await res.json()) as {
        ok?: boolean;
        result?: Array<{ update_id: number; message?: { text?: string; chat?: { id: number } } }>;
      };

      if (!data.ok || !data.result) {
        await new Promise((r) => setTimeout(r, 3000));
        void loop();
        return;
      }

      for (const u of data.result) {
        pollingOffset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text?.startsWith("/start")) continue;
        const chatId = msg.chat?.id;
        if (chatId == null) continue;
        const parts = msg.text.split(/\s+/);
        const token = parts[1]?.trim();
        if (!token) {
          await telegramSendMessage(
            String(chatId),
            "Открой ссылку с сайта «Подтвердить через Telegram» или введи свой числовой Telegram ID на сайте и нажми «Получить код».",
          );
          continue;
        }
        try {
          await handleTelegramStartLink(token, String(chatId));
        } catch (e) {
          console.error("[telegram] handleTelegramStartLink:", e);
        }
      }
    } catch (e) {
      console.error("[telegram] getUpdates:", e);
      await new Promise((r) => setTimeout(r, 4000));
    }
    void loop();
  };

  void loop();
}
