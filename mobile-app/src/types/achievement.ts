import type { Rarity } from "./tasks";

/** GET /api/achievements — как на сайте. */
export type AchievementCatalogItem = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  points: number;
  iconUrl: string | null;
  frameKey: string | null;
  isPublic: boolean;
  createdAt: string;
  earned: boolean;
  awardedAt: string | null;
  taskConditions?: string | null;
  taskStartsAt?: string | null;
  taskEndsAt?: string | null;
  scheduleLocked?: boolean;
  eventEnded?: boolean;
};
