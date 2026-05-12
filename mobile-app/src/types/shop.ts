import type { Rarity } from "./tasks";

export type ShopItemType = "FRAME" | "BADGE";

export type ShopItem = {
  id: string;
  name: string;
  type: ShopItemType;
  key: string;
  price: number;
  rarity: Rarity;
  description: string | null;
  icon: string | null;
};

export type ShopMe = {
  purchasedItemIds: string[];
  purchasedItems: Array<{ id: string; key: string; type: string }>;
  coins: number;
  earnedCoins: number;
  spentCoins: number;
  bonusCoins: number;
  unlockedFrames: string[];
  unlockedStatuses: string[];
};
