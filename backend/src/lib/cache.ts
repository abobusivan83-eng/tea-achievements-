import NodeCache from "node-cache";

const shopItemsTtlSec = 45;

const shopCache = new NodeCache({
  stdTTL: shopItemsTtlSec,
  checkperiod: Math.min(60, shopItemsTtlSec),
  useClones: false,
});

const SHOP_ITEMS_KEY = "shop:items:v1";
const LEADERBOARD_KEY = "leaderboard:v1";
const SHOP_ME_PREFIX = "shop:me:";
const GIFTS_UNREAD_PREFIX = "gifts:unread:";
const SUPPORT_UNREAD_PREFIX = "support:unread:";
const USER_PROFILE_PREFIX = "user:profile:";
const TASKS_LIST_PREFIX = "tasks:list:";
const ACHIEVEMENT_CATALOG_PREFIX = "achievements:catalog:";

export function getCachedShopItems(): unknown {
  return shopCache.get(SHOP_ITEMS_KEY);
}

export function setCachedShopItems(data: unknown): void {
  shopCache.set(SHOP_ITEMS_KEY, data);
}

export function invalidateShopItemsCache(): void {
  shopCache.del(SHOP_ITEMS_KEY);
}

export function getCachedLeaderboard<T>(): T | undefined {
  return shopCache.get(LEADERBOARD_KEY) as T | undefined;
}

export function setCachedLeaderboard<T>(data: T): void {
  /** Агрегат по всей базе (~60 с); маршрут дополнительно дедупит параллельные промахи одиним in-flight промисом. */
  shopCache.set(LEADERBOARD_KEY, data, 58);
}

export function invalidateLeaderboardCache(): void {
  shopCache.del(LEADERBOARD_KEY);
}

export function getCachedShopMe<T>(userId: string): T | undefined {
  return shopCache.get(`${SHOP_ME_PREFIX}${userId}`) as T | undefined;
}

export function setCachedShopMe<T>(userId: string, data: T): void {
  shopCache.set(`${SHOP_ME_PREFIX}${userId}`, data, 45);
}

export function invalidateShopMeCache(userId: string): void {
  shopCache.del(`${SHOP_ME_PREFIX}${userId}`);
}

export function getCachedGiftsUnreadCount(userId: string): number | undefined {
  return shopCache.get(`${GIFTS_UNREAD_PREFIX}${userId}`) as number | undefined;
}

export function setCachedGiftsUnreadCount(userId: string, count: number): void {
  shopCache.set(`${GIFTS_UNREAD_PREFIX}${userId}`, count, 45);
}

export function invalidateGiftsUnreadCountCache(userId: string): void {
  shopCache.del(`${GIFTS_UNREAD_PREFIX}${userId}`);
}

export function getCachedSupportUnreadCount(cacheKey: string): number | undefined {
  return shopCache.get(`${SUPPORT_UNREAD_PREFIX}${cacheKey}`) as number | undefined;
}

export function setCachedSupportUnreadCount(cacheKey: string, count: number): void {
  shopCache.set(`${SUPPORT_UNREAD_PREFIX}${cacheKey}`, count, 45);
}

export function invalidateSupportUnreadCountCache(cacheKey?: string): void {
  if (cacheKey) {
    shopCache.del(`${SUPPORT_UNREAD_PREFIX}${cacheKey}`);
    return;
  }
  const keys = shopCache.keys().filter((k) => k.startsWith(SUPPORT_UNREAD_PREFIX));
  if (keys.length) shopCache.del(keys);
}

export function getCachedUserProfile<T>(userId: string): T | undefined {
  return shopCache.get(`${USER_PROFILE_PREFIX}${userId}`) as T | undefined;
}

export function setCachedUserProfile<T>(userId: string, payload: T): void {
  shopCache.set(`${USER_PROFILE_PREFIX}${userId}`, payload, 60);
}

export function invalidateUserProfileCache(userId: string): void {
  shopCache.del(`${USER_PROFILE_PREFIX}${userId}`);
}

export function getCachedTasksList<T>(userId: string): T | undefined {
  return shopCache.get(`${TASKS_LIST_PREFIX}${userId}`) as T | undefined;
}

export function setCachedTasksList<T>(userId: string, data: T): void {
  shopCache.set(`${TASKS_LIST_PREFIX}${userId}`, data, 45);
}

export function invalidateTasksListCache(userId: string): void {
  shopCache.del(`${TASKS_LIST_PREFIX}${userId}`);
}

export function invalidateAllTasksListCaches(): void {
  const keys = shopCache.keys().filter((k) => k.startsWith(TASKS_LIST_PREFIX));
  if (keys.length) shopCache.del(keys);
}

export function invalidateAllUserProfileCaches(): void {
  const keys = shopCache.keys().filter((k) => k.startsWith(USER_PROFILE_PREFIX));
  if (keys.length) shopCache.del(keys);
}

export function getCachedAchievementCatalog<T>(userId: string, queryHash: string): T | undefined {
  return shopCache.get(`${ACHIEVEMENT_CATALOG_PREFIX}${userId}:${queryHash}`) as T | undefined;
}

export function setCachedAchievementCatalog<T>(userId: string, queryHash: string, data: T): void {
  shopCache.set(`${ACHIEVEMENT_CATALOG_PREFIX}${userId}:${queryHash}`, data, 42);
}

/** Сброс ответов GET /api/achievements для одного пользователя (выдача/отзыв, задание, доступ). */
export function invalidateAchievementCatalogForUser(userId: string): void {
  const prefix = `${ACHIEVEMENT_CATALOG_PREFIX}${userId}:`;
  const keys = shopCache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) shopCache.del(keys);
}

/** Новое/изменённое/удалённое достижение в каталоге — сброс кэша для всех. */
export function invalidateAllAchievementCatalogCaches(): void {
  const keys = shopCache.keys().filter((k) => k.startsWith(ACHIEVEMENT_CATALOG_PREFIX));
  if (keys.length) shopCache.del(keys);
}
