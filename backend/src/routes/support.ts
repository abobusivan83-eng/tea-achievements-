import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/http.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { upload } from "../middleware/uploads.js";
import {
  getCachedSupportUnreadCount,
  invalidateSupportUnreadCountCache,
  setCachedSupportUnreadCount,
} from "../lib/cache.js";
import { uploadImageToMediaStorage } from "../lib/mediaStorage.js";

export const supportRouter = Router();

supportRouter.use(requireAuth);

const ATTACHMENTS_MARKER = "\n[[attachments:";

function parseRichDescription(value: string): { text: string; images: string[] } {
  const idx = value.indexOf(ATTACHMENTS_MARKER);
  if (idx < 0) return { text: value, images: [] };
  const text = value.slice(0, idx).trimEnd();
  const tail = value.slice(idx + ATTACHMENTS_MARKER.length).trim();
  if (!tail.endsWith("]]")) return { text: value, images: [] };
  const raw = tail.slice(0, -2);
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    return { text, images: list };
  } catch {
    return { text: value, images: [] };
  }
}

function withImages(value: string, images: string[]) {
  const base = parseRichDescription(value).text;
  if (!images.length) return base;
  return `${base}${ATTACHMENTS_MARKER}${JSON.stringify(images)}]]`;
}

const CreateSuggestionSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(2000),
});

supportRouter.post("/suggestions", async (req: AuthedRequest, res) => {
  const parsed = CreateSuggestionSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

  const suggestion = await prisma.suggestion.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      authorId: req.user!.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
    },
  });

  await prisma.notification.create({
    data: {
      type: "SUPPORT",
      text: `Новое предложение: ${parsed.data.title}`,
      adminName: null,
      userId: null,
    },
  });
  invalidateSupportUnreadCountCache();

  const parsedDesc = parseRichDescription(suggestion.description);
  return ok(res, { ...suggestion, description: parsedDesc.text, images: parsedDesc.images });
});

supportRouter.get("/suggestions/mine", async (req: AuthedRequest, res) => {
  const items = await prisma.suggestion.findMany({
    where: { authorId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 200,
  });

  return ok(
    res,
    items.map((item) => {
      const parsed = parseRichDescription(item.description);
      return { ...item, description: parsed.text, images: parsed.images };
    }),
  );
});

const CreateReportSchema = z.object({
  reportedId: z.string().uuid(),
  reason: z.enum(["spam", "insult", "cheat", "other"]),
  description: z.string().min(10).max(2000),
});

supportRouter.post("/reports", async (req: AuthedRequest, res) => {
  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
  if (parsed.data.reportedId === req.user!.id) return fail(res, 400, "You cannot report yourself");

  const report = await prisma.report.create({
    data: {
      reporterId: req.user!.id,
      reportedId: parsed.data.reportedId,
      reason: parsed.data.reason,
      description: parsed.data.description,
    },
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
      reportedId: true,
    },
  });

  await prisma.notification.create({
    data: {
      type: "SUPPORT",
      text: `Новая жалоба (${parsed.data.reason})`,
      adminName: null,
      userId: null,
    },
  });
  invalidateSupportUnreadCountCache();

  const parsedDesc = parseRichDescription(report.description);
  return ok(res, { ...report, description: parsedDesc.text, images: parsedDesc.images });
});

supportRouter.get("/reports/mine", async (req: AuthedRequest, res) => {
  const items = await prisma.report.findMany({
    where: { reporterId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      adminResponse: true,
      isRead: true,
      createdAt: true,
      updatedAt: true,
      reportedId: true,
    },
    take: 200,
  });

  return ok(
    res,
    items.map((item) => {
      const parsed = parseRichDescription(item.description);
      return { ...item, description: parsed.text, images: parsed.images };
    }),
  );
});

supportRouter.post("/suggestions/:id/images", upload.array("files", 8), async (req: AuthedRequest, res) => {
  const existing = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
    select: { id: true, authorId: true, description: true },
  });
  if (!existing) return fail(res, 404, "Suggestion not found");
  if (existing.authorId !== req.user!.id && req.user!.role !== "ADMIN") return fail(res, 403, "Forbidden");

  const files = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return fail(res, 400, "No files");

  const uploadedUrls = await Promise.all(
    files
      .filter((file) => !!file.buffer)
      .map((file, index) =>
        uploadImageToMediaStorage({
          buffer: file.buffer,
          folder: "support",
          publicIdPrefix: `suggestion-${existing.id}-${index}`,
          preset: { width: 1600, height: 1600, quality: 80, fit: "inside" },
        }),
      ),
  );

  const parsed = parseRichDescription(existing.description);
  const nextImages = [...parsed.images, ...uploadedUrls.filter(Boolean)].slice(0, 12) as string[];

  const updated = await prisma.suggestion.update({
    where: { id: existing.id },
    data: { description: withImages(existing.description, nextImages) },
    select: { id: true, description: true },
  });
  const next = parseRichDescription(updated.description);
  return ok(res, { id: updated.id, images: next.images });
});

supportRouter.post("/reports/:id/images", upload.array("files", 8), async (req: AuthedRequest, res) => {
  const existing = await prisma.report.findUnique({
    where: { id: req.params.id },
    select: { id: true, reporterId: true, description: true },
  });
  if (!existing) return fail(res, 404, "Report not found");
  if (existing.reporterId !== req.user!.id && req.user!.role !== "ADMIN") return fail(res, 403, "Forbidden");

  const files = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return fail(res, 400, "No files");

  const uploadedUrls = await Promise.all(
    files
      .filter((file) => !!file.buffer)
      .map((file, index) =>
        uploadImageToMediaStorage({
          buffer: file.buffer,
          folder: "support",
          publicIdPrefix: `report-${existing.id}-${index}`,
          preset: { width: 1600, height: 1600, quality: 80, fit: "inside" },
        }),
      ),
  );

  const parsed = parseRichDescription(existing.description);
  const nextImages = [...parsed.images, ...uploadedUrls.filter(Boolean)].slice(0, 12) as string[];

  const updated = await prisma.report.update({
    where: { id: existing.id },
    data: { description: withImages(existing.description, nextImages) },
    select: { id: true, description: true },
  });
  const next = parseRichDescription(updated.description);
  return ok(res, { id: updated.id, images: next.images });
});

supportRouter.get("/notifications", async (req: AuthedRequest, res) => {
  const take = Math.min(200, Math.max(1, Number(req.query.take ?? 50)));
  const where = { userId: req.user!.id };

  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, text: true, adminName: true, userId: true, isRead: true, createdAt: true },
    take,
  });

  return ok(res, items);
});

supportRouter.get("/notifications/unread-count", async (req: AuthedRequest, res) => {
  const cacheKey = req.user!.id;
  const cached = getCachedSupportUnreadCount(cacheKey);
  if (cached !== undefined) {
    res.setHeader("Cache-Control", "private, max-age=20");
    return ok(res, { count: cached });
  }

  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  setCachedSupportUnreadCount(cacheKey, count);
  res.setHeader("Cache-Control", "private, max-age=20");
  return ok(res, { count });
});

supportRouter.patch("/notifications/:id/read", async (req: AuthedRequest, res) => {
  const item = await prisma.notification.findUnique({
    where: { id: req.params.id },
    select: { id: true, userId: true },
  });
  if (!item) return fail(res, 404, "Notification not found");
  if (item.userId !== req.user!.id) return fail(res, 403, "Forbidden");

  const updated = await prisma.notification.update({
    where: { id: item.id },
    data: { isRead: true },
    select: { id: true, isRead: true },
  });
  invalidateSupportUnreadCountCache();
  return ok(res, updated);
});

supportRouter.patch("/notifications/read-all", async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  invalidateSupportUnreadCountCache();
  return ok(res, { updated: true });
});
