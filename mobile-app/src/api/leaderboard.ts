import { apiRequest } from "./request";
import type { LeaderboardRow } from "../types/leaderboard";

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  return apiRequest.get<LeaderboardRow[]>("/api/leaderboard");
}
