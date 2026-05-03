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

export class TelegramApiError extends Error {
  statusCode: number;
  description: string;
  retryAfterSec: number | null;
  isRetryable: boolean;

  constructor(params: { statusCode: number; description: string }) {
    super(params.description || `Telegram API error (${params.statusCode})`);
    this.name = "TelegramApiError";
    this.statusCode = params.statusCode;
    this.description = params.description || "";
    const retryMatch = this.description.match(/retry after\s+(\d+)/i);
    this.retryAfterSec = retryMatch ? Number(retryMatch[1]) : null;
    this.isRetryable =
      params.statusCode >= 500 ||
      this.statusCode === 429 ||
      /too many requests|timeout|temporarily unavailable|internal/i.test(this.description);
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

async function telegramCallApi(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok?: boolean; description?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new TelegramNotConfiguredError();
  }
  const res = await fetch(`${apiBase()}${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data.ok) {
    throw new TelegramApiError({
      statusCode: res.status,
      description: data.description ?? `Telegram ${method} failed (${res.status})`,
    });
  }
  return data;
}

type TelegramMultipartResult = Record<string, unknown>;

async function telegramCallMultipart(method: string, form: FormData): Promise<TelegramMultipartResult> {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new TelegramNotConfiguredError();
  }
  const res = await fetch(`${apiBase()}${method}`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as TelegramMultipartResult & { ok?: boolean; description?: string };
  if (!data.ok) {
    throw new TelegramApiError({
      statusCode: res.status,
      description: (data.description as string | undefined) ?? `Telegram ${method} failed (${res.status})`,
    });
  }
  return data;
}

/**
 * Однократная отправка медиа с телом multipart (буфер) — нужна, чтобы получить file_id без CDN/диска.
 * Дальнейшие получатели рассылки могут использовать тот же file_id у этого бота.
 */
export async function telegramUploadPhotoFromBuffer(params: {
  chatId: string;
  buffer: Buffer;
  mime: string;
  filename: string;
  caption?: string;
}): Promise<string> {
  const form = new FormData();
  form.set("chat_id", params.chatId);
  form.set(
    "photo",
    new Blob([new Uint8Array(params.buffer)], { type: params.mime || "image/jpeg" }),
    params.filename || "photo.jpg",
  );
  if (params.caption?.trim()) form.set("caption", params.caption.trim());
  const data = await telegramCallMultipart("sendPhoto", form);
  const result = data.result as { photo?: Array<{ file_id?: string }> } | undefined;
  const photos = result?.photo;
  if (!photos?.length) {
    throw new TelegramApiError({ statusCode: 500, description: "Telegram sendPhoto: ответ без photo." });
  }
  const fid = photos[photos.length - 1]?.file_id;
  if (!fid) {
    throw new TelegramApiError({ statusCode: 500, description: "Telegram sendPhoto: ответ без file_id." });
  }
  return fid;
}

/** См. {@link telegramUploadPhotoFromBuffer} для видео. */
export async function telegramUploadVideoFromBuffer(params: {
  chatId: string;
  buffer: Buffer;
  mime: string;
  filename: string;
  caption?: string;
}): Promise<string> {
  const form = new FormData();
  form.set("chat_id", params.chatId);
  form.set(
    "video",
    new Blob([new Uint8Array(params.buffer)], { type: params.mime || "video/mp4" }),
    params.filename || "video.mp4",
  );
  if (params.caption?.trim()) form.set("caption", params.caption.trim());
  form.set("supports_streaming", "true");
  const data = await telegramCallMultipart("sendVideo", form);
  const result = data.result as { video?: { file_id?: string } } | undefined;
  const fid = result?.video?.file_id;
  if (!fid) {
    throw new TelegramApiError({ statusCode: 500, description: "Telegram sendVideo: ответ без video.file_id." });
  }
  return fid;
}

/** Снять webhook (локальная отладка / перенос между URL). В production обычно не нужен — вызывается setWebhook. */
export async function telegramDeleteWebhook() {
  await telegramCallApi("deleteWebhook", { drop_pending_updates: false }).catch(() => {});
}

export async function telegramSendMessage(chatId: string, text: string) {
  await telegramCallApi("sendMessage", { chat_id: chatId, text });
}

export async function telegramSendPhoto(chatId: string, photoUrl: string, caption?: string) {
  await telegramCallApi("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    ...(caption?.trim() ? { caption: caption.trim() } : {}),
  });
}

export async function telegramSendVideo(chatId: string, videoUrl: string, caption?: string) {
  await telegramCallApi("sendVideo", {
    chat_id: chatId,
    video: videoUrl,
    supports_streaming: true,
    ...(caption?.trim() ? { caption: caption.trim() } : {}),
  });
}

export function isTelegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_BOT_USERNAME?.trim());
}

/** Достаточно токена для setWebhook / приёма апдейтов (username нужен для ссылок t.me/..., не для webhook). */
export function isTelegramBotTokenSet(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim());
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

/** Вызывается из webhook: пользователь открыл бота с /start <linkToken>. */
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

/** Структура update.message от Telegram Bot API (минимально нужные поля). */
export type TelegramWebhookUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number; username?: string; is_bot?: boolean };
  };
};

/**
 * Обработать одно входящее обновление webhook. Тяжёлую работу вызывайте через setImmediate после ответа 200 Telegram.
 */
export async function processTelegramUpdate(update: TelegramWebhookUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.chat?.id) return;
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
      logger.error("[telegram] handleTelegramStartLink", {
        err: e instanceof Error ? e.stack ?? e.message : String(e),
      });
    }
    return;
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

/**
 * Публичный HTTPS-адрес этого Node-процесса (куда Telegram шлёт webhook).
 *
 * На Render **нельзя** подставлять домен фронта (Vercel): там нет маршрута `/api/telegraf-webhook`.
 * Поэтому при `RENDER_EXTERNAL_URL` он имеет приоритет над `API_URL` / `PUBLIC_BASE_URL`.
 */
export function resolveWebhookServerBase(): string {
  const explicit = process.env.TELEGRAM_WEBHOOK_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) {
    logger.info("[telegram] WEBHOOK: базовый URL из TELEGRAM_WEBHOOK_PUBLIC_BASE_URL", { explicit });
    return explicit;
  }

  const fromApi = env.API_URL.replace(/\/$/, "");

  if (process.env.RENDER === "true") {
    const fromRender = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, "");
    if (fromRender) {
      if (fromRender !== fromApi) {
        logger.warn(
          "[telegram] WEBHOOK: используется RENDER_EXTERNAL_URL, а не API_URL/DEFAULT (чтобы обновления бота попадали на этот сервис, а не на Vercel SPA).",
          { webhookBase: fromRender, apiUrlConfiguredAs: fromApi },
        );
      }
      return fromRender;
    }
  }

  return fromApi;
}

/**
 * Зарегистрировать webhook на api.telegram.org (HTTPS только).
 */
export async function bootstrapTelegramWebhook(): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    logger.warn("[telegram] webhook: TELEGRAM_BOT_TOKEN не задан — регистрация пропущена.");
    return;
  }
  const base = resolveWebhookServerBase();
  const webhookUrl = `${base}/api/telegraf-webhook`;

  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  };
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    payload.secret_token = secret;
  } else if (env.APP_ENV === "production" || env.APP_ENV === "staging") {
    logger.warn(
      "[telegram] TELEGRAM_WEBHOOK_SECRET не задан — endpoint /api/telegraf-webhook открыт только по «секретному» знанию URL; задайте секрет в Render.",
    );
  }

  const delaysMs = [0, 2500, 8000];
  for (let i = 0; i < delaysMs.length; i++) {
    if (delaysMs[i] > 0) {
      await new Promise((r) => setTimeout(r, delaysMs[i]));
    }
    try {
      await telegramCallApi("setWebhook", payload);
      logger.info("[telegram] setWebhook успешно.", { url: webhookUrl, attempt: i + 1 });
      logger.info("[telegram] Режим доставки обновлений: только HTTPS webhook (polling не используется).");
      const info = await telegramCallApi("getWebhookInfo", {});
      logger.info("[telegram] getWebhookInfo", { info });
      return;
    } catch (e) {
      logger.error("[telegram] setWebhook / getWebhookInfo ошибка", {
        err: e instanceof Error ? e.message : String(e),
        url: webhookUrl,
        attempt: i + 1,
      });
    }
  }
}
