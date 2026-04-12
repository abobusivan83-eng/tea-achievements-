import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getAdminDisplayName(req: { user?: { id: string } }): Promise<string> {
  const id = req.user?.id;
  if (!id) return "Администрация";
  const u = await prisma.user.findUnique({ where: { id }, select: { nickname: true } });
  return u?.nickname ?? "Администрация";
}

export async function logAdminAction(
  db: DbClient,
  params: {
    adminId: string;
    action: string;
    summary: string;
    targetUserId?: string | null;
    targetNickname?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const admin = await db.user.findUnique({ where: { id: params.adminId }, select: { nickname: true } });
  const adminNickname = admin?.nickname ?? "Неизвестно";
  let targetNickname = params.targetNickname ?? null;
  if (params.targetUserId && !targetNickname) {
    const t = await db.user.findUnique({ where: { id: params.targetUserId }, select: { nickname: true } });
    targetNickname = t?.nickname ?? null;
  }
  await db.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      adminNickname,
      action: params.action,
      summary: params.summary,
      targetUserId: params.targetUserId ?? null,
      targetNickname,
      meta: params.meta ? (params.meta as object) : undefined,
    },
  });
}
