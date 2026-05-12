export { apiRequest } from "./request";
export { getApiClient } from "./client";
export { parseEnvelope, ApiError } from "./http";
export { isPublicAuthUrl } from "./authPaths";
export { API_TIMEOUT_MS, API_MAX_RETRIES } from "./config";

export { loginRequest, fetchMe, registerRequest, registerVerify } from "./auth";
export {
  fetchPublicProfile,
  patchMyProfile,
  uploadMyAvatar,
  uploadMyBanner,
} from "./profile";
export type { PatchMyProfilePayload, ProfileImagePick } from "./profile";
export { fetchTasks, submitTaskWithProgress } from "./tasks";
export type { TaskItem, TaskEvidencePick } from "./tasks";
export { fetchAchievementsCatalog } from "./achievements";
export { fetchLeaderboard } from "./leaderboard";
export { fetchNotifications, fetchNotificationUnreadCount, markNotificationRead } from "./support";
export {
  createSupportSuggestion,
  createSupportReport,
  uploadSupportSuggestionImages,
  uploadSupportReportImages,
} from "./supportForms";
export type { SupportEvidencePick } from "./supportForms";
export { fetchShopItems, fetchShopMe, buyShopItem } from "./shop";
export {
  fetchGiftsInbox,
  fetchGiftsOutbox,
  markGiftsReadAll,
  sendGiftRequest,
} from "./gifts";
export {
  fetchAdminInboxCounts,
  fetchAdminTaskSubmissions,
  patchAdminTaskSubmission,
  fetchAdminSupportSuggestions,
  fetchAdminSupportReports,
  patchAdminSupportSuggestion,
  patchAdminSupportReport,
  fetchAdminUsers,
  fetchAdminTasks,
  fetchAdminAchievements,
  fetchAdminShopItems,
  patchAdminUser,
  patchAdminUserCoins,
  fetchAdminAuditLogs,
  fetchAdminTelegramTemplates,
  sendAdminTelegramBroadcast,
} from "./admin";
