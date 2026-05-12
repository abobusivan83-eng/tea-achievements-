import { getApiBaseUrl } from "../services/env";
import type { ShopItem } from "../types/shop";

/** Как на сайте (`ShopPage.tsx` → `isImageIcon`): только явные URL/пути — иначе показываем emoji-текстом. */
export function isShopImageIcon(icon: string | null | undefined): boolean {
  if (!icon?.trim()) return false;
  const v = icon.trim().toLowerCase();
  return (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("/") ||
    v.startsWith("data:image/") ||
    v.startsWith("uploads/")
  );
}

export function resolveShopMediaUrl(path: string | null | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  const p = path.trim();
  if (p.startsWith("http")) return p;
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const rel = p.startsWith("/") ? p : `/${p}`;
  return `${base}${rel}`;
}

/** Превью товара: только настоящие картинки в `<Image>`; emoji и прочие строки — в `Text`. */
export function shopItemVisual(item: ShopItem): { uri: string } | { emoji: string } {
  const fallback = item.type === "FRAME" ? "🖼️" : "🏅";
  const raw = item.icon?.trim();
  if (!raw) return { emoji: fallback };
  if (isShopImageIcon(raw)) {
    const uri = resolveShopMediaUrl(raw);
    return uri ? { uri } : { emoji: fallback };
  }
  return { emoji: raw };
}
