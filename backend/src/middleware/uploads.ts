import fs from "fs";
import multer from "multer";
import path from "path";
import type { RequestHandler } from "express";
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
