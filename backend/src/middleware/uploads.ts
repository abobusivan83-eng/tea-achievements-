import fs from "fs";
import multer from "multer";
import path from "path";
import type { RequestHandler } from "express";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { env } from "../lib/env.js";
import type { AuthedRequest } from "./auth.js";
import { isAllowedImageMime } from "../lib/allowedImageMime.js";

type MediaKind = "avatars" | "banners";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
const avatarsDir = path.join(uploadRoot, "avatars");
const bannersDir = path.join(uploadRoot, "banners");
/** Временная папка для иконок достижений, вложений заявок и т.п. (файлы могут переезжать в подпапки). */
const miscDir = path.join(uploadRoot, "misc");
ensureDir(uploadRoot);
ensureDir(avatarsDir);
ensureDir(bannersDir);
ensureDir(miscDir);

function buildStorage(kind: MediaKind) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, kind === "avatars" ? avatarsDir : bannersDir);
    },
    filename(req, file, cb) {
      const authedReq = req as AuthedRequest;
      const userId = authedReq.user?.id ?? "anonymous";
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : ".bin";
      cb(null, `${userId}-${Date.now()}${safeExt}`);
    },
  });
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

const genericStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, miscDir);
  },
  filename(req, file, cb) {
    const authedReq = req as AuthedRequest;
    const userId = authedReq.user?.id ?? "anonymous";
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : ".bin";
    const unique = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

/** Универсальная загрузка (иконки, несколько файлов к заявкам/заданиям). */
export const upload = multer({
  storage: genericStorage,
  limits: { fileSize: 12 * 1024 * 1024, files: 8 },
  fileFilter(_req, file, cb) {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

let cloudinaryReady = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryReady) return true;
  if (env.CLOUDINARY_URL) {
    cloudinary.config(env.CLOUDINARY_URL);
    const cfg = cloudinary.config();
    if (cfg.cloud_name && cfg.api_key && cfg.api_secret) {
      cloudinaryReady = true;
      return true;
    }
    return false;
  }
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryReady = true;
    return true;
  }
  return false;
}

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
