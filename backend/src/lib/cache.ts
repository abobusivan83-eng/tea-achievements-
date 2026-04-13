import NodeCache from "node-cache";

const shopItemsTtlSec = 120;

const shopCache = new NodeCache({
  stdTTL: shopItemsTtlSec,
  checkperiod: Math.min(60, shopItemsTtlSec),
  useClones: false,
});

const SHOP_ITEMS_KEY = "shop:items:v1";

export function getCachedShopItems(): unknown {
  return shopCache.get(SHOP_ITEMS_KEY);
}

export function setCachedShopItems(data: unknown): void {
  shopCache.set(SHOP_ITEMS_KEY, data);
}

export function invalidateShopItemsCache(): void {
  shopCache.del(SHOP_ITEMS_KEY);
}
