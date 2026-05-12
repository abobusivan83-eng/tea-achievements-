export type ShopStackParamList = {
  ShopMain: undefined;
  Gifts: undefined;
};

export type TasksStackParamList = {
  TasksMain: undefined;
  TaskDetail: { taskId: string };
};

export type NotificationsStackParamList = { NotificationsMain: undefined };
export type LeaderboardStackParamList = {
  LeaderboardMain: undefined;
  PublicProfile: {
    userId: string;
  };
  PublicAchievements: { userId: string; nickname?: string };
};
export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: undefined;
  AchievementsMain: undefined;
  PublicProfile: {
    userId: string;
  };
  PublicAchievements: { userId: string; nickname?: string };
  SupportIdea: undefined;
  SupportReport: undefined;
  AdminMain: undefined;
};
export type MainTabParamList = {
  Profile: undefined;
  Tasks: undefined;
  Shop: undefined;
  Leaderboard: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  App: undefined;
};
