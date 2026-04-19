import fs from "fs";
import path from "path";
import sharp from "sharp";

type ImagePreset = {
  width: number;
  height: number;
  quality: number;
};

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export async function optimizeToWebp(inputPath: string, preset: ImagePreset, prefix: string) {
  const dir = path.dirname(inputPath);
  ensureDir(dir);
  const outputPath = path.join(dir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`);

  await sharp(inputPath)
    .rotate()
    .resize(preset.width, preset.height, { fit: "cover", withoutEnlargement: false })
    .webp({ quality: preset.quality, effort: 4 })
    .toFile(outputPath);

  try {
    fs.unlinkSync(inputPath);
  } catch {
    // keep optimized output even if cleanup of original fails
  }

  return outputPath;
}

