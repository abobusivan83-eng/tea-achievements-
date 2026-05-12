import { apiRequest } from "./request";
import type { ShopItem, ShopMe } from "../types/shop";

export async function fetchShopItems(): Promise<ShopItem[]> {
  return apiRequest.get<ShopItem[]>("/api/shop/items");
}

export async function fetchShopMe(): Promise<ShopMe> {
  return apiRequest.get<ShopMe>("/api/shop/me");
}

export async function buyShopItem(itemId: string): Promise<unknown> {
  return apiRequest.post<unknown>("/api/shop/buy", { itemId });
}
