-- Programmatic achievement keys (auto-grants, collectors, level milestones)
ALTER TABLE "Achievement" ADD COLUMN "programKey" TEXT;

CREATE UNIQUE INDEX "Achievement_programKey_key" ON "Achievement"("programKey");
