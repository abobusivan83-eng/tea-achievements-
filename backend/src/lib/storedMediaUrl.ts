import { toPublicFileUrl } from "./publicUrl.js";
import { uploadPublicDir } from "./uploadPaths.js";

function normalizeExplicitUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const localPrefix = new RegExp(`^https?:\\/\\/localhost(?::\\d+)?\\/${uploadPublicDir.replace("/", "\\/")}\\/`, "i");
  if (localPrefix.test(trimmed)) {
    const rest = trimmed.replace(/^https?:\/\/localhost(?::\d+)?\//i, "");
    return toPublicFileUrl(rest);
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith(uploadPublicDir) || trimmed.startsWith("/")) {
    return toPublicFileUrl(trimmed);
  }
  return toPublicFileUrl(trimmed);
}

/** Prefer stored absolute URL; fall back to legacy relative path in DB. */
export function resolveStoredMediaUrl(
  explicitUrl: string | null | undefined,
  legacyPath: string | null | undefined,
): string | null {
  return normalizeExplicitUrl(explicitUrl) ?? toPublicFileUrl(legacyPath);
}
