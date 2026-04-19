import path from "path";
import { env } from "./env.js";
import { uploadPublicDir } from "./uploadPaths.js";

export function toPublicFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const normalized = filePath.replaceAll("\\", "/").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  // We store relative paths like "uploads/user/<file>"
  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  const rel = withoutLeadingSlash.startsWith(uploadPublicDir)
    ? withoutLeadingSlash
    : path.posix.join(uploadPublicDir.replaceAll("\\", "/"), withoutLeadingSlash);
  return `${env.PUBLIC_BASE_URL}/${rel}`;
}

