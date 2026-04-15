import { toPublicFileUrl } from "./publicUrl.js";
import { env } from "./env.js";

function normalizeExplicitUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/localhost(?::\d+)?\/uploads\//i.test(trimmed)) {
    const rest = trimmed.replace(/^https?:\/\/localhost(?::\d+)?\//i, "");
    return toPublicFileUrl(rest);
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith(env.UPLOAD_DIR) || trimmed.startsWith("/")) {
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
