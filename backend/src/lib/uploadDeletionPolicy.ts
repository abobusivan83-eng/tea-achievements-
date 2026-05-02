import fs from "fs";
import path from "path";
import { uploadPublicDir, uploadRootAbs } from "./uploadPaths.js";

function absoluteFromStoredRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) {
    // Облачные URL удаляются отдельно при необходимости; локально не трогаем.
    return null;
  }
  const rel = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = `${uploadPublicDir}/`;
  if (!rel.startsWith(prefix)) return null;
  const tail = rel.slice(prefix.length);
  const abs = path.join(uploadRootAbs, tail);
  const root = path.resolve(uploadRootAbs);
  if (!path.resolve(abs).startsWith(root)) return null;
  return abs;
}

function isProtectedRelPath(ref: string): boolean {
  const r = ref.replace(/\\/g, "/").toLowerCase();
  return (
    r.includes("/achievements/") ||
    r.startsWith("achievements/") ||
    r.includes("/defaults/") ||
    r.startsWith("defaults/")
  );
}

/**
 * Безопасно удалить старый локальный файл аватара/баннера (не трогать defaults, icons, evidence).
 */
export function tryDeleteReplaceableProfileMedia(ref: string | null | undefined): void {
  if (!ref?.trim()) return;
  const abs = absoluteFromStoredRef(ref);
  if (!abs) return;
  const rel = ref.replace(/\\/g, "/");
  if (isProtectedRelPath(rel)) return;
  if (!rel.includes("/avatars/") && !rel.includes("/banners/") && !rel.includes("/mock-cloud/")) {
    return;
  }
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

export function evidenceAbsPathFromPublicRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  // Полный URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const tail = u.pathname.replace(/^\/+/, "");
      if (!tail.startsWith(`${uploadPublicDir}/evidence/`)) return null;
      return absoluteFromStoredRef(tail);
    } catch {
      return null;
    }
  }
  const rel = trimmed.replace(/\\/g, "/");
  if (!rel.includes("/evidence/") && !rel.startsWith("evidence/")) return null;
  if (isProtectedRelPath(rel) && !rel.includes("/evidence/")) return null;
  return absoluteFromStoredRef(rel.startsWith(`${uploadPublicDir}/`) ? rel : `${uploadPublicDir}/${rel.replace(/^\/+/, "")}`);
}

export async function tryDeleteEvidenceFiles(evidenceUrls: unknown): Promise<void> {
  if (!evidenceUrls) return;
  if (!Array.isArray(evidenceUrls)) return;
  for (const raw of evidenceUrls) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const abs = evidenceAbsPathFromPublicRef(raw);
    if (!abs) continue;
    try {
      if (fs.existsSync(abs)) await fs.promises.unlink(abs);
    } catch {
      // ignore
    }
  }
}
