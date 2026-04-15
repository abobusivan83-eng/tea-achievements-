import { Router } from "express";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { signToken } from "../lib/auth.js";
import { computeUserPublicId } from "../lib/userPublicId.js";
import { parseJsonStringArray } from "../lib/cosmeticsAccess.js";
import { resolveStoredMediaUrl } from "../lib/storedMediaUrl.js";
import { env } from "../lib/env.js";
import {
  isTelegramConfigured,
  issueRegistrationCodeForPending,
  telegramOpenBotUrl,
  telegramSyntheticEmail,
  TelegramNotConfiguredError,
} from "../lib/telegram.js";

export const authRouter = Router();

const RegisterSchema = z
  .object({
    nickname: z.string().min(2).max(24),
    password: z.string().min(6).max(72),
    telegramUsername: z.string().min(1).max(32),
  })
  .superRefine((data, ctx) => {
    const u = normalizeTelegramUsername(data.telegramUsername);
    if (!u || !/^[a-zA-Z0-9_]{5,32}$/.test(u)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["telegramUsername"],
        message: "Ник Telegram: 5–32 символа, латиница, цифры и подчёркивание (как в t.me/username).",
      });
    }
  });

const RegisterVerifySchema = z.object({
  linkToken: z.string().min(16),
  code: z.string().regex(/^\d{4}$/, "Нужен код из 4 цифр"),
  rememberMe: z.boolean().optional(),
});

const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

function newLinkToken() {
  return randomBytes(16).toString("hex");
}

function normalizeTelegramUsername(s: string | undefined) {
  if (!s?.trim()) return undefined;
  return s.trim().replace(/^@/, "").toLowerCase();
}

const loginUserSelect = {
  id: true,
  nickname: true,
  email: true,
  role: true,
  passwordHash: true,
  blocked: true,
} satisfies Prisma.UserSelect;

async function findUserForLogin(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  // @nickname — Telegram, не email
  if (t.startsWith("@") && !t.slice(1).includes("@")) {
    const uname = t.slice(1).toLowerCase();
    return prisma.user.findFirst({
      where: { telegramUsername: { equals: uname, mode: "insensitive" } },
      select: loginUserSelect,
    });
  }
  if (t.includes("@")) {
    return prisma.user.findFirst({
      where: { email: { equals: lower, mode: "insensitive" } },
      select: loginUserSelect,
    });
  }
  if (/^\d+$/.test(t)) {
    const syn = telegramSyntheticEmail(t);
    return prisma.user.findFirst({
      where: { OR: [{ telegramChatId: t }, { email: syn }] },
      select: loginUserSelect,
    });
  }
  const uname = t.toLowerCase();
  return prisma.user.findFirst({
    where: { telegramUsername: { equals: uname, mode: "insensitive" } },
    select: loginUserSelect,
  });
}

authRouter.post("/register/request", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const tgUser = normalizeTelegramUsername(parsed.data.telegramUsername);
  if (!tgUser) return fail(res, 400, "Укажи ник в Telegram.");

  const clash = await prisma.user.findFirst({
    where: { telegramUsername: { equals: tgUser, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return fail(res, 409, "Этот Telegram-ник уже занят");

  if (!isTelegramConfigured()) {
    if (env.APP_ENV === "development") {
      console.warn("[auth] Задай TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME для регистрации.");
    }
    return fail(res, 503, new TelegramNotConfiguredError().message);
  }

  const linkToken = newLinkToken();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const nickname = parsed.data.nickname.trim();

  await prisma.registrationOtp.deleteMany({
    where: {
      telegramUsername: { equals: tgUser, mode: "insensitive" },
      codeHash: null,
    },
  });

  const pending = await prisma.registrationOtp.create({
    data: {
      linkToken,
      nickname,
      passwordHash,
      telegramUsername: tgUser,
      expiresAt,
      telegramChatId: null,
      codeHash: null,
    },
  });

  const cached = await prisma.telegramChatLookup.findUnique({
    where: { usernameLower: tgUser },
  });

  if (cached) {
    try {
      await issueRegistrationCodeForPending(pending.id, cached.chatId);
      return ok(res, {
        linkToken,
        deepLink: telegramOpenBotUrl(),
        botUsername: env.TELEGRAM_BOT_USERNAME,
        codeSent: true,
        activationNeeded: false,
      });
    } catch (e) {
      await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});
      console.error("[auth] Telegram:", e);
      const msg =
        e instanceof Error
          ? e.message
          : "Не удалось отправить код в Telegram. Сначала напиши боту /start, затем нажми «Продолжить» снова.";
      return fail(res, 502, msg);
    }
  }

  return ok(res, {
    linkToken,
    deepLink: telegramOpenBotUrl(),
    botUsername: env.TELEGRAM_BOT_USERNAME,
    codeSent: false,
    activationNeeded: true,
  });
});

authRouter.post("/register/verify", async (req, res) => {
  const parsed = RegisterVerifySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const pending = await prisma.registrationOtp.findUnique({
    where: { linkToken: parsed.data.linkToken },
  });
  if (!pending) return fail(res, 400, "Сессия регистрации не найдена. Начни заново.");

  if (pending.expiresAt < new Date()) {
    await prisma.registrationOtp.delete({ where: { id: pending.id } });
    return fail(res, 400, "Срок истёк. Запроси код снова.");
  }

  if (!pending.telegramChatId || !pending.codeHash) {
    return fail(
      res,
      400,
      "Пожалуйста, сначала активируй бота кнопкой Start в Telegram, затем на сайте нажми «Продолжить», чтобы получить код.",
    );
  }

  const match = await bcrypt.compare(parsed.data.code, pending.codeHash);
  if (!match) return fail(res, 400, "Неверный код");

  let user: { id: string; nickname: string; email: string; role: Role };
  try {
    user = await prisma.user.create({
      data: {
        nickname: pending.nickname,
        email: telegramSyntheticEmail(pending.telegramChatId),
        telegramChatId: pending.telegramChatId,
        telegramUsername: pending.telegramUsername ?? null,
        passwordHash: pending.passwordHash,
      },
      select: { id: true, nickname: true, email: true, role: true },
    });
  } catch {
    await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});
    return fail(res, 409, "Не удалось создать аккаунт (конфликт данных).");
  }

  await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});

  const token = signToken({ sub: user.id, role: user.role }, { rememberMe: parsed.data.rememberMe === true });
  const publicId = await computeUserPublicId(prisma as any, user.id);
  return ok(res, { token, user: { ...user, publicId } });
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const user = await findUserForLogin(parsed.data.login);
  if (!user) return fail(res, 401, "Invalid credentials");
  if (user.blocked) return fail(res, 403, "User is blocked");

  const match = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!match) return fail(res, 401, "Invalid credentials");

  const token = signToken({ sub: user.id, role: user.role }, { rememberMe: parsed.data.rememberMe === true });
  const publicId = await computeUserPublicId(prisma as any, user.id);
  return ok(res, {
    token,
    user: { id: user.id, nickname: user.nickname, email: user.email, role: user.role, publicId },
  });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      nickname: true,
      email: true,
      telegramChatId: true,
      telegramUsername: true,
      role: true,
      blocked: true,
      level: true,
      xp: true,
      avatarUrl: true,
      bannerUrl: true,
      avatarPath: true,
      bannerPath: true,
      frameKey: true,
      badgesJson: true,
      statusEmoji: true,
      unlockedFramesJson: true,
      unlockedStatusesJson: true,
      createdAt: true,
    },
  });
  if (!user) return fail(res, 404, "User not found");
  const publicId = await computeUserPublicId(prisma as any, user.id);
  const { unlockedFramesJson, unlockedStatusesJson, ...rest } = user;
  const unlockedFrames = parseJsonStringArray(unlockedFramesJson);
  const unlockedStatuses = parseJsonStringArray(unlockedStatusesJson);
  return ok(res, {
    ...rest,
    avatarUrl: resolveStoredMediaUrl(user.avatarUrl, user.avatarPath),
    bannerUrl: resolveStoredMediaUrl(user.bannerUrl, user.bannerPath),
    publicId,
    unlockedFrames,
    unlockedStatuses,
  });
});
