import fs from "fs";
import path from "path";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
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

