export type Role = "USER" | "ADMIN" | "CREATOR";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "EXCLUSIVE" | "SECRET";

export type Me = {
  id: string;
  publicId?: number;
  nickname: string;
  email: string;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  role: Role;
  blocked: boolean;
  level?: number;
  xp?: number;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarPath?: string | null;
  bannerPath?: string | null;
  frameKey?: string | null;
  badgesJson?: unknown;
  statusEmoji?: string | null;
  createdAt: string;
  unlockedFrames?: string[];
  unlockedStatuses?: string[];
};

export type Achievement = {
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
};

export type LeaderboardRow = {
  id: string;
  publicId?: number;
  nickname: string;
  avatarUrl: string | null;
  frameKey: string | null;
  totalPoints: number;
  achievementCount: number;
  level?: number;
  xp?: number;
  xpIntoLevel?: number;
  xpForNext?: number;
};

export type AdminUserRow = {
  id: string;
  publicId?: number;
  nickname: string;
  email: string;
  role: Role;
  blocked: boolean;
  level?: number;
  xp?: number;
  xpIntoLevel?: number;
  xpForNext?: number;
  frameKey?: string | null;
  badges?: string[];
  statusEmoji?: string | null;
  adminNotes?: string | null;
  adminTags?: string[];
  createdAt: string;
};

export type AdminAchievement = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  points: number;
  iconUrl: string | null;
  frameKey: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatedAchievement = {
  id: string;
  title: string;
  rarity: Rarity;
  points: number;
  isPublic: boolean;
  awardedUserIds?: string[];
};

export type SupportStatus = "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED";
export type NotificationType = "SYSTEM" | "ACH" | "XP" | "LVL" | "SHOP" | "SUPPORT" | "GIFT";

export type Notification = {
  id: string;
  type: NotificationType;
  text: string;
  adminName: string | null;
  userId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type Suggestion = {
  id: string;
  title: string;
  description: string;
  images?: string[];
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Report = {
  id: string;
  reason: "spam" | "insult" | "cheat" | "other";
  description: string;
  images?: string[];
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  reportedId: string;
  createdAt: string;
  updatedAt?: string;
};

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

export type GiftInboxItem = {
  id: string;
  xpAmount: number;
  message: string | null;
  createdAt: string;
  isRead: boolean;
  fromUser: { id: string; nickname: string };
};

export type GiftOutboxItem = {
  id: string;
  xpAmount: number;
  message: string | null;
  createdAt: string;
  toUser: { id: string; nickname: string };
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  conditions: string;
  rewardCoins?: number;
  isActive: boolean;
  isEvent: boolean;
  startsAt: string | null;
  endsAt: string | null;
  styleTag: string | null;
  achievementId: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  achievement: {
    id: string;
    title: string;
    description?: string;
    rarity: Rarity;
    points: number;
    iconUrl: string | null;
    frameKey?: string | null;
    isPublic?: boolean;
    createdAt?: string;
  } | null;
  mySubmission?: {
    id: string;
    status: SupportStatus;
    createdAt: string;
    reviewedAt: string | null;
    adminResponse: string | null;
    /** Модератор, принявший задание (если есть в БД) */
    reviewedByNickname?: string | null;
  } | null;
};

export type AdminAuditLogRow = {
  id: string;
  adminId: string;
  adminNickname: string;
  action: string;
  summary: string;
  targetUserId: string | null;
  targetNickname: string | null;
  meta: unknown;
  createdAt: string;
};

export type TaskSubmission = {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  status: SupportStatus;
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
  evidence: string[];
  task: {
    id: string;
    title: string;
    description: string;
    conditions: string;
    rewardCoins?: number;
    isActive: boolean;
    isEvent: boolean;
    startsAt: string | null;
    endsAt: string | null;
    styleTag: string | null;
    achievementId: string;
    createdById: string | null;
    createdAt: string;
    updatedAt: string;
    achievement: {
      id: string;
      title: string;
      description?: string;
      rarity: Rarity;
      iconUrl: string | null;
      points: number;
      frameKey?: string | null;
      isPublic?: boolean;
      createdAt?: string;
    } | null;
  };
  user?: { id: string; nickname: string; email: string };
};
