import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

export class TelegramNotConfiguredError extends Error {
  constructor() {
    super(
      "Telegram не настроен: задайте TELEGRAM_BOT_TOKEN (токен от @BotFather) и TELEGRAM_BOT_USERNAME (ник бота без @, как в t.me/…). На Render: Environment → добавь обе переменные → redeploy.",
    );
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

/** Открыть чат с ботом (без payload), для активации через Start. */
export function telegramOpenBotUrl() {
  const u = env.TELEGRAM_BOT_USERNAME!.replace(/^@/, "").trim();
  return `https://t.me/${u}`;
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

  const existingUser = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  });
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

/** Отправка кода при регистрации с уже известным chat id (кэш после /start у бота). */
export async function issueRegistrationCodeForPending(pendingId: string, chatId: string) {
  await issueCodeAndNotify(chatId, pendingId);
}

/** Если есть ожидающая регистрация по этому @username — отправить код в chatId. */
async function trySendPendingRegistrationCode(usernameLower: string, chatId: string): Promise<boolean> {
  const pending = await prisma.registrationOtp.findFirst({
    where: {
      telegramUsername: { equals: usernameLower, mode: "insensitive" },
      codeHash: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return false;

  const existingUser = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  });
  if (existingUser) return false;

  await issueCodeAndNotify(chatId, pending.id);
  return true;
}

let pollingOffset = 0;
let pollingStarted = false;

export function startTelegramLongPolling() {
  if (pollingStarted) return;
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    logger.warn("[telegram] TELEGRAM_BOT_TOKEN не задан — long polling отключён.");
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
        result?: Array<{
          update_id: number;
          message?: {
            text?: string;
            chat?: { id: number };
            from?: { id: number; username?: string; is_bot?: boolean };
          };
        }>;
      };

      if (!data.ok || !data.result) {
        logger.warn("[telegram] getUpdates not ok", { ok: data.ok });
        await new Promise((r) => setTimeout(r, 3000));
        setTimeout(() => void loop(), 0);
        return;
      }

      for (const u of data.result) {
        pollingOffset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.chat?.id) continue;
        const chatIdStr = String(msg.chat.id);
        const from = msg.from;

        if (from && !from.is_bot && from.username?.trim()) {
          const un = from.username.trim().toLowerCase();
          try {
            await prisma.telegramChatLookup.upsert({
              where: { usernameLower: un },
              create: { usernameLower: un, chatId: chatIdStr },
              update: { chatId: chatIdStr },
            });
          } catch (e) {
            logger.error("[telegram] TelegramChatLookup upsert", { err: e instanceof Error ? e.message : String(e) });
          }
        }

        const text = msg.text ?? "";
        const isStart = text.startsWith("/start");
        const startToken = isStart ? text.split(/\s+/)[1]?.trim() : undefined;

        if (isStart && startToken) {
          try {
            await handleTelegramStartLink(startToken, chatIdStr);
          } catch (e) {
            logger.error("[telegram] handleTelegramStartLink", { err: e instanceof Error ? e.stack ?? e.message : String(e) });
          }
          continue;
        }

        let issuedByUsername = false;
        if (from && !from.is_bot && from.username?.trim()) {
          try {
            issuedByUsername = await trySendPendingRegistrationCode(from.username.trim().toLowerCase(), chatIdStr);
          } catch (e) {
            logger.error("[telegram] trySendPendingRegistrationCode", {
              err: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (isStart && !startToken && !issuedByUsername) {
          try {
            await telegramSendMessage(
              chatIdStr,
              "Готово! Вернись на сайт и нажми «Продолжить», чтобы получить код.",
            );
          } catch (e) {
            logger.error("[telegram] /start reply", { err: e instanceof Error ? e.message : String(e) });
          }
        }
      }
    } catch (e) {
      logger.error("[telegram] getUpdates", { err: e instanceof Error ? e.stack ?? e.message : String(e) });
      await new Promise((r) => setTimeout(r, 4000));
    }
    setTimeout(() => void loop(), 0);
  };

  void loop();
}
