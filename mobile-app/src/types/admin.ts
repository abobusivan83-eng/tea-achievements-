import type { SupportStatus } from "./tasks";

export type AdminInboxCounts = {
  tasks: number;
  suggestions: number;
  reports: number;
};

export type AdminTaskSubmission = {
  id: string;
  taskId: string;
  userId: string;
  message: string | null;
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  reviewedAt: string | null;
  evidence: string[];
  task: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    nickname: string;
  };
};

export type AdminSupportSuggestion = {
  id: string;
  title: string;
  description: string;
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  author: { id: string; nickname: string; email: string };
};

export type AdminSupportReport = {
  id: string;
  reason: string;
  description: string;
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  reporter: { id: string; nickname: string; email: string };
  reported: { id: string; nickname: string; email: string };
};

export type AdminUserRow = {
  id: string;
  nickname: string;
  email: string;
  role: "USER" | "ADMIN" | "CREATOR";
  avatarUrl: string | null;
  level: number;
  xp: number;
  publicId?: number;
  blocked?: boolean;
  adminNotes?: string | null;
  adminTags?: string[];
  frameKey?: string | null;
  statusEmoji?: string | null;
  badges?: string[];
};

export type AdminShopItem = {
  id: string;
  name: string;
  type: "FRAME" | "BADGE";
  key: string;
  price: number;
  description: string | null;
};

export type AdminTaskRow = {
  id: string;
  title: string;
  isActive: boolean;
  isEvent: boolean;
  submissionsCount?: number;
  achievement: { title: string } | null;
};

export type AdminAchievementRow = {
  id: string;
  title: string;
  rarity: string;
  points: number;
  isPublic: boolean;
};

export type AdminAuditLogRow = {
  id: string;
  adminNickname: string | null;
  action: string;
  summary: string;
  targetNickname: string | null;
  createdAt: string;
};

export type AdminTelegramTemplateRow = {
  id: string;
  label: string;
  message: string;
  mediaUrl: string | null;
  mediaType: "photo" | "video" | null;
  sortOrder: number;
};
