/** Эвристика: видео-доказательства (CDN / расширение). */
export function isEvidenceVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("video/")) return true;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);
}
