import { apiRequest } from "./request";
import type { AchievementCatalogItem } from "../types/achievement";

export async function fetchAchievementsCatalog(): Promise<AchievementCatalogItem[]> {
  return apiRequest.get<AchievementCatalogItem[]>("/api/achievements");
}
