import fs from "fs";
import multer from "multer";
import path from "path";
import type { RequestHandler } from "express";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { isAllowedImageMime } from "../lib/allowedImageMime.js";
import { uploadRootAbs } from "../lib/uploadPaths.js";
import { ensureCloudinaryConfigured } from "../lib/mediaStorage.js";

type MediaKind = "avatars" | "banners";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const uploadRoot = uploadRootAbs;
const avatarsDir = path.join(uploadRoot, "avatars");
const bannersDir = path.join(uploadRoot, "banners");
/** Временная папка для иконок достижений, вложений заявок и т.п. (файлы могут переезжать в подпапки). */
const miscDir = path.join(uploadRoot, "misc");
ensureDir(uploadRoot);
ensureDir(avatarsDir);
ensureDir(bannersDir);
ensureDir(miscDir);

function buildStorage(kind: MediaKind) {
  void kind;
  return multer.memoryStorage();
}

function buildUploader(kind: MediaKind) {
  return multer({
    storage: buildStorage(kind),
    limits: { fileSize: kind === "avatars" ? 8 * 1024 * 1024 : 12 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, cb) {
      if (!isAllowedImageMime(file.mimetype)) {
        return cb(new Error("Only JPEG, PNG, WebP or GIF images are allowed"));
      }
      cb(null, true);
    },
  });
}

function withUploadErrorHandling(mw: RequestHandler): RequestHandler {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return next(new Error("Image is too large"));
        return next(new Error(`Upload failed: ${err.message}`));
      }
      return next(err);
    });
  };
}

export const avatarUpload = withUploadErrorHandling(buildUploader("avatars").single("file"));
export const bannerUpload = withUploadErrorHandling(buildUploader("banners").single("file"));

/** Универсальная загрузка (иконки, несколько файлов к заявкам/заданиям). */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 8 },
  fileFilter(_req, file, cb) {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

function taskSubmissionCloudinaryStorage() {
  return new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      return {
        folder: "clan-salamanca/task-submissions",
        type: "upload",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm", "mkv"],
        public_id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext ? `-${ext.slice(1)}` : ""}`,
      };
    },
  });
}

const TASK_MEDIA_LIMIT_BYTES = 100 * 1024 * 1024;

export const taskSubmissionUpload: RequestHandler = (req, res, next) => {
  if (!ensureCloudinaryConfigured()) {
    const err = new Error("Cloudinary upload is not configured") as Error & { status?: number };
    err.status = 503;
    return next(err);
  }
  const uploader = multer({
    storage: taskSubmissionCloudinaryStorage(),
    limits: { fileSize: TASK_MEDIA_LIMIT_BYTES, files: 8 },
    fileFilter(_req, file, cb) {
      if (!/^image\//.test(file.mimetype) && !/^video\//.test(file.mimetype)) {
        return cb(new Error("Only image or video files are allowed"));
      }
      cb(null, true);
    },
  }).array("files", 8);

  uploader(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new Error("Media file is too large (max. 100 MB)"));
      return next(new Error(`Upload failed: ${err.message}`));
    }
    const e = err as { message?: string; error?: { message?: string }; http_code?: number; status?: number };
    const msg = e?.message || e?.error?.message || "Cloudinary upload failed";
    const wrapped = new Error(`Upload failed: ${msg}`) as Error & { status?: number };
    wrapped.status = e?.http_code || e?.status;
    return next(wrapped);
  });
};
