/** Ключи TanStack Query — единый формат для инвалидации после действий в админке. */
export function profileQueryKey(userId: string | undefined | null) {
  return ["profile", userId ?? ""] as const;
}
