import NodeCache from "node-cache";

const shopItemsTtlSec = 120;

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
  // Heavy aggregate; match typical UI background refresh cadence.
  shopCache.set(LEADERBOARD_KEY, data, 60);
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
