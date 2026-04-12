/** Разрешённые типы загрузок (без SVG — снижает риск XSS при отдаче как image). */
export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedImageMime(mimetype: string): boolean {
  return ALLOWED_IMAGE_MIMES.has(mimetype.toLowerCase().trim());
}
