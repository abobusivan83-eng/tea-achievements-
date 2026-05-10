/** Ключи TanStack Query — единый формат для инвалидации после действий в админке. */
export function profileQueryKey(userId: string | undefined | null) {
  return ["profile", userId ?? ""] as const;
}

export const tasksListQueryKey = ["tasks", "list"] as const;

export const leaderboardQueryKey = ["leaderboard"] as const;

export const shopItemsQueryKey = ["shop", "items"] as const;

export const shopMeQueryKey = ["shop", "me"] as const;

export function giftsPackQueryKey(userId: string | undefined | null) {
  return ["gifts", "pack", userId ?? ""] as const;
}
