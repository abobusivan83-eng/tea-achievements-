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
