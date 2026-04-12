import path from "path";
import { env } from "./env.js";

export function toPublicFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const normalized = filePath.replaceAll("\\", "/");
  // We store relative paths like "uploads/user/<file>"
  const rel = normalized.startsWith(env.UPLOAD_DIR)
    ? normalized
    : path.posix.join(env.UPLOAD_DIR.replaceAll("\\", "/"), normalized);
  return `${env.PUBLIC_BASE_URL}/${rel}`;
}

