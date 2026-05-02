import fs from "fs";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import type { RequestHandler } from "express";
import { isAllowedImageMime } from "../lib/allowedImageMime.js";
import { uploadRootAbs } from "../lib/uploadPaths.js";

type MediaKind = "avatars" | "banners";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const uploadRoot = uploadRootAbs;
const avatarsDir = path.join(uploadRoot, "avatars");
const bannersDir = path.join(uploadRoot, "banners");
const evidenceDir = path.join(uploadRoot, "evidence");
/** Временная папка для иконок достижений, вложений заявок и т.п. (файлы могут переезжать в подпапки). */
const miscDir = path.join(uploadRoot, "misc");
ensureDir(uploadRoot);
ensureDir(avatarsDir);
ensureDir(bannersDir);
ensureDir(evidenceDir);
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

const TASK_MEDIA_LIMIT_BYTES = 100 * 1024 * 1024;

const taskEvidenceDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, evidenceDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : "";
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${safeExt}`);
  },
});

/** Доказательства по заданиям — только под uploads/evidence (временные файлы, удаляются после решения админа). */
export const taskSubmissionUpload: RequestHandler = (req, res, next) => {
  const uploader = multer({
    storage: taskEvidenceDiskStorage,
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
    return next(err);
  });
};
