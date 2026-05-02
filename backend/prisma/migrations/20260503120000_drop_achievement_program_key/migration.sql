-- Rollback: programmatic achievement keys (restore manual-only awarding)
DROP INDEX IF EXISTS "Achievement_programKey_key";

ALTER TABLE "Achievement" DROP COLUMN "programKey";
