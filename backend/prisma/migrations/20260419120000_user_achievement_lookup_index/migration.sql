-- Improves profile/achievement share lookups by achievementId + time.
CREATE INDEX "UserAchievement_achievementId_awardedAt_idx"
ON "UserAchievement"("achievementId", "awardedAt");

