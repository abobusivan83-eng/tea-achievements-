import fs from "fs";
import path from "path";
import { uploadPublicDir, uploadRootAbs } from "./uploadPaths.js";

const DEFAULT_AVATAR_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#243447"/>
      <stop offset="100%" stop-color="#0d141d"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <circle cx="128" cy="100" r="44" fill="#d9e2ec" fill-opacity="0.92"/>
  <path d="M56 214c11-37 39-58 72-58s61 21 72 58" fill="#d9e2ec" fill-opacity="0.92"/>
</svg>`;

const DEFAULT_BANNER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 520">
  <defs>
    <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#17212c"/>
      <stop offset="50%" stop-color="#243447"/>
      <stop offset="100%" stop-color="#0b1016"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="520" fill="url(#bbg)"/>
  <circle cx="270" cy="120" r="140" fill="#66c0f4" fill-opacity="0.13"/>
  <circle cx="1320" cy="420" r="180" fill="#ffd56a" fill-opacity="0.1"/>
  <circle cx="880" cy="100" r="120" fill="#c084fc" fill-opacity="0.08"/>
</svg>`;

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/** Относительные пути как в БД (совместимо с toPublicFileUrl / resolveStoredMediaUrl). */
export function defaultAvatarPath(): string {
  return `${uploadPublicDir}/defaults/avatar.svg`;
}

export function defaultBannerPath(): string {
  return `${uploadPublicDir}/defaults/banner.svg`;
}

/**
 * Создаёт каталоги постоянного хранения и дефолтные SVG, если их ещё нет.
 * Иконки достижений, аватары и баннеры не удаляются автоматическими задачами — только явная логика профиля/админки.
 */
export function ensureDefaultProfileAssets(): void {
  const defaultsDir = path.join(uploadRootAbs, "defaults");
  const avatarsDir = path.join(uploadRootAbs, "avatars");
  const bannersDir = path.join(uploadRootAbs, "banners");
  const achievementsDir = path.join(uploadRootAbs, "achievements");
  const evidenceDir = path.join(uploadRootAbs, "evidence");

  for (const d of [defaultsDir, avatarsDir, bannersDir, achievementsDir, evidenceDir]) {
    ensureDir(d);
  }

  const avatarFile = path.join(defaultsDir, "avatar.svg");
  const bannerFile = path.join(defaultsDir, "banner.svg");
  if (!fs.existsSync(avatarFile)) {
    fs.writeFileSync(avatarFile, DEFAULT_AVATAR_SVG, "utf8");
  }
  if (!fs.existsSync(bannerFile)) {
    fs.writeFileSync(bannerFile, DEFAULT_BANNER_SVG, "utf8");
  }
}
