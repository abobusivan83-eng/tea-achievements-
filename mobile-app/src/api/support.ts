import { apiRequest } from "./request";
import type { Notification } from "../types/support";

export async function fetchNotifications(take = 50): Promise<Notification[]> {
  return apiRequest.get<Notification[]>("/api/support/notifications", {
    params: { take },
  });
}

export async function fetchNotificationUnreadCount(): Promise<number> {
  const res = await apiRequest.get<{ count: number }>("/api/support/notifications/unread-count");
  return res.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest.patch<unknown>(`/api/support/notifications/${id}/read`, {});
}
