import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { taskSubmissionUpload } from "../middleware/uploads.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { getCachedTasksList, invalidateSupportUnreadCountCache, invalidateTasksListCache, setCachedTasksList } from "../lib/cache.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

type TaskScheduleStatus = "UPCOMING" | "ACTIVE" | "EXPIRED";

function scheduleStatusFromTime(startsAt: Date | null, endsAt: Date | null, now: Date): TaskScheduleStatus {
  if (startsAt && now < startsAt) return "UPCOMING";
  if (endsAt && now > endsAt) return "EXPIRED";
  return "ACTIVE";
}

function taskListWhere(userId: string): Prisma.TaskWhereInput {
  // List should contain scheduled tasks too; lock/unlock is handled by frontend.
  return {
    isActive: true,
    achievement: {
      OR: [{ isPublic: true }, { accessGrants: { some: { userId } } }],
    },
  };
}

function taskActiveWhere(userId: string, now: Date): Prisma.TaskWhereInput {
  // For submissions we must ensure the task is currently ACTIVE by schedule.
  return {
    isActive: true,
    achievement: {
      OR: [{ isPublic: true }, { accessGrants: { some: { userId } } }],
    },
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

// List is shared by all users; `submissions` are filtered by req.user so completion is per account.
tasksRouter.get("/", async (req: AuthedRequest, res) => {
  const cached = getCachedTasksList<unknown[]>(req.user!.id);
  if (cached) return ok(res, cached);

  const now = new Date();
  const rows = await prisma.task.findMany({
    where: taskListWhere(req.user!.id),
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

  const payload = rows.map((t) => {
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
        scheduleStatus: scheduleStatusFromTime(t.startsAt, t.endsAt, now),
      };
    });
  setCachedTasksList(req.user!.id, payload);
  return ok(res, payload);
});

tasksRouter.post("/:taskId/submit", taskSubmissionUpload, async (req: AuthedRequest, res) => {
  const taskId = req.params.taskId;
  if (!z.string().uuid().safeParse(taskId).success) return fail(res, 400, "Invalid task id");

  const message = String((req.body as { message?: string })?.message ?? "").trim();
  if (message.length < 10) return fail(res, 400, "Message must be at least 10 characters");
  if (message.length > 2000) return fail(res, 400, "Message too long");

  const now = new Date();
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: taskId }, taskActiveWhere(req.user!.id, now)] },
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
  const evidenceUrls = files.map((f) => {
    if (typeof f.path === "string" && /^https?:\/\//i.test(f.path)) return f.path;
    if (typeof f.filename === "string" && /^https?:\/\//i.test(f.filename)) return f.filename;
    return toPublicFileUrl(f.path ?? "");
  });

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
  invalidateTasksListCache(req.user!.id);
  await prisma.notification.create({
    data: {
      type: "SUPPORT",
      userId: req.user!.id,
      adminName: null,
      text: `📝 Заявка по заданию «${task.title}» отправлена и ожидает проверки администрации.`,
      isRead: false,
    },
  });
  invalidateSupportUnreadCountCache(req.user!.id);

  return ok(res, {
    ...created,
    createdAt: created.createdAt.toISOString(),
    evidence: evidenceUrls,
  });
});
