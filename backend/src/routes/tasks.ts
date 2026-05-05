import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { taskSubmissionUpload } from "../middleware/uploads.js";
import { toPublicFileUrl } from "../lib/publicUrl.js";
import { toRelUploadPath } from "../lib/uploadPaths.js";
import { getCachedTasksList, invalidateSupportUnreadCountCache, invalidateTasksListCache, setCachedTasksList } from "../lib/cache.js";
import { achievementWhereForTaskList } from "../lib/achievementVisibility.js";

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
  // Приватное достижение с активным заданием остаётся в списке (каталог достижений скрывает до старта по времени).
  return {
    isActive: true,
    achievement: achievementWhereForTaskList(userId),
  };
}

function taskActiveWhere(userId: string, now: Date): Prisma.TaskWhereInput {
  // For submissions we must ensure the task is currently ACTIVE by schedule.
  return {
    isActive: true,
    achievement: achievementWhereForTaskList(userId),
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
  const userId = req.user!.id;
  const rows = await prisma.task.findMany({
    where: taskListWhere(userId),
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
        where: { userId },
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
  const achievementIds = rows.map((t) => t.achievementId);
  const earnedRows =
    achievementIds.length > 0
      ? await prisma.userAchievement.findMany({
          where: { userId, achievementId: { in: achievementIds } },
          select: { achievementId: true, awardedAt: true },
        })
      : [];
  const earnedMap = new Map(earnedRows.map((x) => [x.achievementId, x.awardedAt]));

  const payload = rows.map((t) => {
    const sub = t.submissions[0];
    const earnedAt = earnedMap.get(t.achievementId) ?? null;
    const normalizedSubmission =
      sub?.status === "RESOLVED" || earnedAt
        ? {
            id: sub?.id ?? `award:${t.id}`,
            status: "RESOLVED" as const,
            createdAt: sub?.createdAt ?? earnedAt ?? now,
            reviewedAt: sub?.reviewedAt ?? earnedAt ?? null,
            adminResponse: sub?.adminResponse ?? null,
            reviewedByNickname: sub?.reviewedBy?.nickname ?? null,
          }
        : sub
          ? {
              ...sub,
              reviewedByNickname: sub.reviewedBy?.nickname ?? null,
            }
          : null;
    return {
      ...t,
      achievement: {
        ...t.achievement,
        iconUrl: toPublicFileUrl(t.achievement.iconPath),
      },
      mySubmission: normalizedSubmission,
      submission: normalizedSubmission,
      scheduleStatus: scheduleStatusFromTime(t.startsAt, t.endsAt, now),
    };
  });

  setCachedTasksList(userId, payload);
  res.setHeader("Cache-Control", "private, max-age=45");
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
    if (typeof f.path === "string" && f.path) {
      return toPublicFileUrl(toRelUploadPath(f.path));
    }
    return "";
  }).filter((u) => u.length > 0);

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
