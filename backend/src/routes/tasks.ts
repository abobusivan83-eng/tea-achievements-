import path from "path";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { upload } from "../middleware/uploads.js";
import { env } from "../lib/env.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

function toRelUploadPath(absPath: string) {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const rel = path.relative(process.cwd(), absPath);
  if (rel.startsWith(env.UPLOAD_DIR)) return rel.replaceAll("\\", "/");
  return path.relative(process.cwd(), path.join(uploadRoot, path.basename(absPath))).replaceAll("\\", "/");
}

function taskListWhere(userId: string, now: Date): Prisma.TaskWhereInput {
  return {
    isActive: true,
    achievement: {
      OR: [{ isPublic: true }, { accessGrants: { some: { userId } } }],
    },
    OR: [
      { isEvent: false },
      {
        isEvent: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    ],
  };
}

// List is shared by all users; `submissions` are filtered by req.user so completion is per account.
tasksRouter.get("/", async (req: AuthedRequest, res) => {
  const now = new Date();
  const rows = await prisma.task.findMany({
    where: taskListWhere(req.user!.id, now),
    orderBy: [{ isEvent: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      conditions: true,
      rewardCoins: true,
      isActive: true,
      isEvent: true,
      startsAt: true,
      endsAt: true,
      styleTag: true,
      achievementId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      achievement: {
        select: {
          id: true,
          title: true,
          description: true,
          rarity: true,
          points: true,
          iconPath: true,
          frameKey: true,
          isPublic: true,
          createdAt: true,
        },
      },
      submissions: {
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          adminResponse: true,
          reviewedBy: { select: { nickname: true } },
        },
      },
    },
  });

  return ok(
    res,
    rows.map((t) => {
      const sub = t.submissions[0] ?? null;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        conditions: t.conditions,
        rewardCoins: t.rewardCoins,
        isActive: t.isActive,
        isEvent: t.isEvent,
        startsAt: t.startsAt?.toISOString() ?? null,
        endsAt: t.endsAt?.toISOString() ?? null,
        styleTag: t.styleTag,
        achievementId: t.achievementId,
        createdById: t.createdById,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        achievement: t.achievement
          ? {
              id: t.achievement.id,
              title: t.achievement.title,
              description: t.achievement.description,
              rarity: t.achievement.rarity,
              points: t.achievement.points,
              iconUrl: toPublicFileUrl(t.achievement.iconPath),
              frameKey: t.achievement.frameKey,
              isPublic: t.achievement.isPublic,
              createdAt: t.achievement.createdAt.toISOString(),
            }
          : null,
        mySubmission: sub
          ? {
              id: sub.id,
              status: sub.status,
              createdAt: sub.createdAt.toISOString(),
              reviewedAt: sub.reviewedAt?.toISOString() ?? null,
              adminResponse: sub.adminResponse,
              reviewedByNickname: sub.reviewedBy?.nickname ?? null,
            }
          : null,
      };
    }),
  );
});

tasksRouter.post("/:taskId/submit", upload.array("files", 8), async (req: AuthedRequest, res) => {
  const taskId = req.params.taskId;
  if (!z.string().uuid().safeParse(taskId).success) return fail(res, 400, "Invalid task id");

  const message = String((req.body as { message?: string })?.message ?? "").trim();
  if (message.length < 10) return fail(res, 400, "Message must be at least 10 characters");
  if (message.length > 2000) return fail(res, 400, "Message too long");

  const now = new Date();
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: taskId }, taskListWhere(req.user!.id, now)] },
    select: { id: true, title: true },
  });
  if (!task) return fail(res, 404, "Task not found or not available");

  const last = await prisma.taskSubmission.findFirst({
    where: { taskId, userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (last) {
    if (last.status === "PENDING" || last.status === "REVIEWED") {
      return fail(res, 409, "You already have a submission awaiting review");
    }
    if (last.status === "RESOLVED") {
      return fail(res, 409, "Вы уже выполнили это задание; повторная отправка не требуется");
    }
  }

  const files = (req as Express.Request & { files?: Express.Multer.File[] }).files ?? [];
  const evidencePaths = files.map((f) => toRelUploadPath(f.path));
  const evidenceUrls = evidencePaths.map((p) => toPublicFileUrl(p));

  const created = await prisma.taskSubmission.create({
    data: {
      taskId,
      userId: req.user!.id,
      message,
      evidenceJson: evidenceUrls.length ? (evidenceUrls as unknown as object) : undefined,
      status: "PENDING",
    },
    select: {
      id: true,
      taskId: true,
      status: true,
      createdAt: true,
      message: true,
      adminResponse: true,
      evidenceJson: true,
    },
  });

  return ok(res, {
    ...created,
    createdAt: created.createdAt.toISOString(),
    evidence: evidenceUrls,
  });
});
