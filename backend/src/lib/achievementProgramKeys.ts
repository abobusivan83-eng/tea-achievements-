/** Стабильные ключи для поля Achievement.programKey и автовыдачи. */
export const AchievementProgramKey = {
  WELCOME_LEAF: "WELCOME_LEAF",
  LEVEL_10: "LEVEL_10",
  LEVEL_30: "LEVEL_30",
  LEVEL_60: "LEVEL_60",
  LEVEL_100: "LEVEL_100",
  COLLECTOR_5: "COLLECTOR_5",
  COLLECTOR_12: "COLLECTOR_12",
  COLLECTOR_25: "COLLECTOR_25",
} as const;

export type AchievementProgramKeyId = (typeof AchievementProgramKey)[keyof typeof AchievementProgramKey];
