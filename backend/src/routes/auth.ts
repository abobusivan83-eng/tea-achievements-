import { Router } from "express";
import { z } from "zod";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { signToken } from "../lib/auth.js";
import { computeUserPublicId } from "../lib/userPublicId.js";
import { parseJsonStringArray } from "../lib/cosmeticsAccess.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { sendRegistrationCode } from "../lib/mailer.js";

export const authRouter = Router();

const RegisterSchema = z.object({
  nickname: z.string().min(2).max(24),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const RegisterVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{4}$/, "Нужен код из 4 цифр"),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function randomFourDigitCode() {
  return String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
}

authRouter.post("/register/request", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const { nickname, email, password } = parsed.data;
  const emailNorm = normalizeEmail(email);

  const exists = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
  });
  if (exists) return fail(res, 409, "Email already registered");

  const code = randomFourDigitCode();
  const [codeHash, passwordHash] = await Promise.all([bcrypt.hash(code, 8), bcrypt.hash(password, 10)]);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.registrationOtp.upsert({
    where: { email: emailNorm },
    create: {
      email: emailNorm,
      nickname: nickname.trim(),
      passwordHash,
      codeHash,
      expiresAt,
    },
    update: {
      nickname: nickname.trim(),
      passwordHash,
      codeHash,
      expiresAt,
    },
  });

  try {
    await sendRegistrationCode(emailNorm, code, nickname.trim());
  } catch (e) {
    await prisma.registrationOtp.deleteMany({ where: { email: emailNorm } });
    console.error("[mail] sendRegistrationCode failed", e);
    return fail(res, 502, "Не удалось отправить письмо. Проверьте настройки почты на сервере.");
  }

  return ok(res, { sent: true, email: emailNorm });
});

authRouter.post("/register/verify", async (req, res) => {
  const parsed = RegisterVerifySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const emailNorm = normalizeEmail(parsed.data.email);
  const pending = await prisma.registrationOtp.findUnique({ where: { email: emailNorm } });
  if (!pending) return fail(res, 400, "Нет активной регистрации. Запросите код снова.");

  if (pending.expiresAt < new Date()) {
    await prisma.registrationOtp.delete({ where: { id: pending.id } });
    return fail(res, 400, "Код истёк. Запросите новый.");
  }

  const match = await bcrypt.compare(parsed.data.code, pending.codeHash);
  if (!match) return fail(res, 400, "Неверный код");

  let user: { id: string; nickname: string; email: string; role: Role };
  try {
    user = await prisma.user.create({
      data: {
        nickname: pending.nickname,
        email: pending.email,
        passwordHash: pending.passwordHash,
      },
      select: { id: true, nickname: true, email: true, role: true },
    });
  } catch {
    await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});
    return fail(res, 409, "Email already registered");
  }

  await prisma.registrationOtp.delete({ where: { id: pending.id } }).catch(() => {});

  const token = signToken({ sub: user.id, role: user.role });
  const publicId = await computeUserPublicId(prisma as any, user.id);
  return ok(res, { token, user: { ...user, publicId } });
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid payload");

  const emailNorm = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
  });
  if (!user) return fail(res, 401, "Invalid credentials");
  if (user.blocked) return fail(res, 403, "User is blocked");

  const match = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!match) return fail(res, 401, "Invalid credentials");

  const token = signToken({ sub: user.id, role: user.role });
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
    avatarUrl: user.avatarUrl ?? toPublicFileUrl(user.avatarPath),
    bannerUrl: user.bannerUrl ?? toPublicFileUrl(user.bannerPath),
    publicId,
    unlockedFrames,
    unlockedStatuses,
  });
});
