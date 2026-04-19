import path from "path";
import { env } from "./env.js";

export const uploadPublicDir = env.UPLOAD_DIR.replace(/^\/+|\/+$/g, "");
export const uploadRootAbs = path.resolve(process.cwd(), env.UPLOAD_ROOT_DIR ?? uploadPublicDir);

export function toRelUploadPath(absPath: string) {
  const relFromRoot = path.relative(uploadRootAbs, absPath).replaceAll("\\", "/");
  const normalizedRel = relFromRoot.replace(/^\/+/, "");
  if (!normalizedRel || normalizedRel.startsWith("..")) {
    return `${uploadPublicDir}/${path.basename(absPath).replaceAll("\\", "/")}`;
  }
  return `${uploadPublicDir}/${normalizedRel}`;
}

