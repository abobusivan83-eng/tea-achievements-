import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { signToken } from "../lib/auth.js";
import { computeUserPublicId } from "../lib/userPublicId.js";
import { parseJsonStringArray } from "../lib/cosmeticsAccess.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";

export const authRouter = Router();

const RegisterSchema = z.object({
  nickname: z.string().min(2).max(24),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

authRouter.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const { nickname, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { nickname, email, passwordHash },
    select: { id: true, nickname: true, email: true, role: true },
  });

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

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail(res, 401, "Invalid credentials");
  if (user.blocked) return fail(res, 403, "User is blocked");

  const match = await bcrypt.compare(password, user.passwordHash);
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

