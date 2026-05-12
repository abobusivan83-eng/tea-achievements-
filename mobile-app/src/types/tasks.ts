/** Согласовано с frontend/src/lib/types.ts и расширено полями evidence/message из API. */
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "EXCLUSIVE" | "SECRET";

export type SupportStatus = "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED";

export type TaskScheduleStatus = "UPCOMING" | "ACTIVE" | "EXPIRED";

export type TaskSubmissionSummary = {
  id: string;
  status: SupportStatus;
  createdAt: string;
  reviewedAt: string | null;
  adminResponse: string | null;
  reviewedByNickname?: string | null;
  message?: string | null;
  evidence?: string[];
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
  scheduleStatus: TaskScheduleStatus;
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
  mySubmission?: TaskSubmissionSummary | null;
  submission?: TaskSubmissionSummary | null;
};
