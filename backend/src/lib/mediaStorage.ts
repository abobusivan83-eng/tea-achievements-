import fs from "fs";
import path from "path";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { logger } from "./logger.js";
import { env } from "./env.js";
import { uploadPublicDir, uploadRootAbs } from "./uploadPaths.js";
import { toPublicFileUrl } from "./publicUrl.js";

type TransformPreset = {
  width: number;
  height: number;
  quality: number;
  fit?: "cover" | "inside";
};

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

let cloudinaryReady = false;
export function ensureCloudinaryConfigured() {
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

async function optimizeBufferToWebp(buffer: Buffer, preset: TransformPreset) {
  return sharp(buffer)
    .rotate()
    .resize(preset.width, preset.height, {
      fit: preset.fit ?? "cover",
      withoutEnlargement: false,
    })
    .webp({ quality: preset.quality, effort: 4 })
    .toBuffer();
}

async function saveLocallyAsMock(fileBuffer: Buffer, folder: string, prefix: string) {
  const targetDir = path.join(uploadRootAbs, "mock-cloud", folder);
  ensureDir(targetDir);
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
  const absPath = path.join(targetDir, filename);
  fs.writeFileSync(absPath, fileBuffer);
  const relPath = `${uploadPublicDir}/mock-cloud/${folder}/${filename}`;
  return toPublicFileUrl(relPath);
}

async function saveLocallyAsRawMock(params: {
  buffer: Buffer;
  folder: string;
  prefix: string;
  extension: string;
}) {
  const targetDir = path.join(uploadRootAbs, "mock-cloud", params.folder);
  ensureDir(targetDir);
  const cleanExt = params.extension.replace(/[^a-z0-9.]/gi, "").toLowerCase() || ".bin";
  const filename = `${params.prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${cleanExt.startsWith(".") ? cleanExt : `.${cleanExt}`}`;
  const absPath = path.join(targetDir, filename);
  fs.writeFileSync(absPath, params.buffer);
  const relPath = `${uploadPublicDir}/mock-cloud/${params.folder}/${filename}`;
  return toPublicFileUrl(relPath);
}

export async function uploadImageToMediaStorage(params: {
  buffer: Buffer;
  folder: string;
  publicIdPrefix: string;
  preset: TransformPreset;
}) {
  const optimized = await optimizeBufferToWebp(params.buffer, params.preset);

  if (!ensureCloudinaryConfigured()) {
    // Local development fallback: emulate cloud URL served by Express static.
    const localUrl = await saveLocallyAsMock(optimized, params.folder, params.publicIdPrefix);
    if (!localUrl) throw new Error("Failed to save local mock image");
    return localUrl;
  }

  const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `clan-salamanca/${params.folder}`,
        resource_type: "image",
        format: "webp",
        public_id: `${params.publicIdPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result as { secure_url: string });
      },
    );
    uploadStream.end(optimized);
  });

  return uploaded.secure_url;
}

export async function uploadTelegramAttachmentToMediaStorage(params: {
  buffer: Buffer;
  folder: string;
  publicIdPrefix: string;
  resourceType: "image" | "video";
  extension: string;
}) {
  if (!ensureCloudinaryConfigured()) {
    if (env.APP_ENV !== "development") {
      throw new Error(
        "Не настроено облако для медиа (CLOUDINARY_URL или CLOUDINARY_*). На Render локальное сохранение в uploads/ недоступно между рестартами — задайте Cloudinary или отправляйте рассылку с вложением без сохранения шаблона.",
      );
    }
    return saveLocallyAsRawMock({
      buffer: params.buffer,
      folder: params.folder,
      prefix: params.publicIdPrefix,
      extension: params.extension,
    });
  }

  const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `clan-salamanca/${params.folder}`,
        resource_type: params.resourceType,
        public_id: `${params.publicIdPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result as { secure_url: string });
      },
    );
    uploadStream.end(params.buffer);
  });

  return uploaded.secure_url;
}

function extFromOriginalName(name: string | undefined): string {
  const ext = path.extname(name ?? "").toLowerCase();
  if (!ext || ext.length > 16) return "";
  return /^\.[a-z0-9.]+$/i.test(ext) ? ext : "";
}

function taskEvidenceResourceFromMime(mimetype: string): "image" | "video" {
  return /^video\//i.test(mimetype ?? "") ? "video" : "image";
}

/**
 * Загрузка фото/видео-доказательств заданий в Cloudinary (постоянный URL в БД).
 */
export async function uploadTaskEvidenceToMediaStorage(params: {
  buffer: Buffer;
  mimetype: string;
  originalname?: string | undefined;
  publicIdPrefix: string;
}): Promise<string> {
  const resourceType = taskEvidenceResourceFromMime(params.mimetype || "");
  const ext =
    resourceType === "video"
      ? extFromOriginalName(params.originalname) || ".webm"
      : extFromOriginalName(params.originalname) || "";

  if (!ensureCloudinaryConfigured()) {
    if (env.APP_ENV !== "development") {
      throw new Error(
        "Не настроено облако для медиа (CLOUDINARY_URL или CLOUDINARY_*). На production доказательства сохраняются только в CDN.",
      );
    }
    return saveLocallyAsRawMock({
      buffer: params.buffer,
      folder: "task-evidence",
      prefix: params.publicIdPrefix.slice(0, 80),
      extension: resourceType === "video" ? ext : ".jpg",
    });
  }

  const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `clan-salamanca/task-evidence`,
        resource_type: resourceType,
        public_id: `${params.publicIdPrefix.slice(0, 80)}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result as { secure_url: string });
      },
    );
    uploadStream.end(params.buffer);
  });

  return uploaded.secure_url;
}

export type CloudinaryDestroyDeliveryParams = { publicId: string; resourceType: "image" | "video" | "raw" };

/**
 * Из URL доставки Cloudinary …/{image|video|raw}/upload/… извлекаем resource_type и public_id для destroy().
 */
export function cloudinaryDestroyParamsFromDeliveryUrl(urlStr: string): CloudinaryDestroyDeliveryParams | null {
  const trimmed = urlStr.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, "");
  if (!/\.cloudinary\.com$/i.test(host) && !/^cloudinary\.com$/i.test(host)) return null;

  const segments = decodeURIComponent(u.pathname).split("/").filter(Boolean);

  let uploadIdx = -1;
  let resourceDelivery: string | undefined;
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i + 1] === "upload") {
      const cand = segments[i];
      if (cand === "image" || cand === "video" || cand === "raw") {
        uploadIdx = i + 1;
        resourceDelivery = cand;
        break;
      }
    }
  }
  if (uploadIdx < 0 || !resourceDelivery) return null;

  let rest = segments.slice(uploadIdx + 1);
  while (rest.length && rest[0]!.includes(",")) {
    rest = rest.slice(1);
  }
  if (rest.length && /^v\d+$/i.test(rest[0]!)) rest = rest.slice(1);
  if (!rest.length) return null;

  const last = rest[rest.length - 1]!;
  if (/\.[a-z0-9]{2,12}$/i.test(last)) {
    rest = [...rest.slice(0, -1), last.replace(/\.[^.]+$/, "")];
  }
  const publicId = rest.join("/");
  if (!publicId) return null;

  const resourceType: CloudinaryDestroyDeliveryParams["resourceType"] =
    resourceDelivery === "video" ? "video" : resourceDelivery === "raw" ? "raw" : "image";
  return { publicId, resourceType };
}

export async function destroyCloudinaryDeliveryUrlIfApplicable(urlStr: string): Promise<void> {
  if (!/^https?:\/\//i.test(urlStr.trim())) return;
  if (!ensureCloudinaryConfigured()) return;

  const parsed = cloudinaryDestroyParamsFromDeliveryUrl(urlStr);
  if (!parsed) return;

  try {
    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(
        parsed.publicId,
        { resource_type: parsed.resourceType, invalidate: true },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          const r = result as { result?: string } | undefined;
          if (r?.result && r.result !== "ok" && r.result !== "not found") {
            reject(new Error(`Cloudinary destroy: ${r.result}`));
            return;
          }
          resolve();
        },
      );
    });
  } catch (e) {
    logger.warn("cloudinary_evidence_destroy_failed", { url: urlStr.slice(0, 120), message: String(e) });
  }
}

