import { apiRequest } from "./request";
import type {
  AdminInboxCounts,
  AdminAchievementRow,
  AdminAuditLogRow,
  AdminShopItem,
  AdminSupportReport,
  AdminSupportSuggestion,
  AdminTaskRow,
  AdminTaskSubmission,
  AdminTelegramTemplateRow,
  AdminUserRow,
} from "../types/admin";
import type { SupportStatus } from "../types/tasks";

export function fetchAdminInboxCounts() {
  return apiRequest.get<AdminInboxCounts>("/api/admin/inbox-counts");
}

export function fetchAdminTaskSubmissions(limit = 30, offset = 0) {
  return apiRequest.get<{ items: AdminTaskSubmission[]; total: number }>(
    `/api/admin/tasks/submissions?limit=${limit}&offset=${offset}`,
  );
}

export function patchAdminTaskSubmission(
  id: string,
  payload: { status?: SupportStatus; adminResponse?: string; isRead?: boolean },
) {
  return apiRequest.patch<AdminTaskSubmission>(`/api/admin/tasks/submissions/${id}`, payload);
}

export function fetchAdminSupportSuggestions() {
  return apiRequest.get<AdminSupportSuggestion[]>("/api/admin/support/suggestions");
}

export function fetchAdminSupportReports() {
  return apiRequest.get<AdminSupportReport[]>("/api/admin/support/reports");
}

export function patchAdminSupportSuggestion(
  id: string,
  payload: { status?: SupportStatus; adminResponse?: string; isRead?: boolean },
) {
  return apiRequest.patch<AdminSupportSuggestion>(`/api/admin/support/suggestions/${id}`, payload);
}

export function patchAdminSupportReport(
  id: string,
  payload: { status?: SupportStatus; adminResponse?: string; isRead?: boolean },
) {
  return apiRequest.patch<AdminSupportReport>(`/api/admin/support/reports/${id}`, payload);
}

export function fetchAdminUsers() {
  return apiRequest.get<AdminUserRow[]>("/api/admin/users");
}

export function fetchAdminTasks() {
  return apiRequest.get<AdminTaskRow[]>("/api/admin/tasks");
}

export function fetchAdminAchievements() {
  return apiRequest.get<AdminAchievementRow[]>("/api/admin/achievements");
}

export function fetchAdminShopItems() {
  return apiRequest.get<AdminShopItem[]>("/api/admin/shop/items");
}

export function patchAdminUser(
  id: string,
  payload: {
    role?: "USER" | "ADMIN" | "CREATOR";
    nickname?: string;
    xp?: number;
    level?: number;
    adminNotes?: string | null;
    adminTags?: string[];
    frameKey?: string | null;
    badges?: string[];
    statusEmoji?: string | null;
  },
) {
  return apiRequest.patch<AdminUserRow>(`/api/admin/users/${id}`, payload);
}

export function patchAdminUserCoins(id: string, delta: number) {
  return apiRequest.post<{ updated: boolean; delta: number }>(`/api/admin/users/${id}/coins`, { delta });
}

export function fetchAdminAuditLogs() {
  return apiRequest.get<AdminAuditLogRow[]>("/api/admin/audit-logs");
}

export function fetchAdminTelegramTemplates() {
  return apiRequest.get<AdminTelegramTemplateRow[]>("/api/admin/telegram-broadcast/templates");
}

export function sendAdminTelegramBroadcast(message: string, templateId?: string) {
  return apiRequest.post<{ attempted: number; sent: number; failed: number }>("/api/admin/telegram-broadcast", {
    message,
    templateId,
  });
}
