import { toPublicFileUrl } from "./publicUrl.js";

/** Prefer stored absolute URL; fall back to legacy relative path in DB. */
export function resolveStoredMediaUrl(
  explicitUrl: string | null | undefined,
  legacyPath: string | null | undefined,
): string | null {
  return explicitUrl ?? toPublicFileUrl(legacyPath);
}
