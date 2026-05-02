-- Presence / «в сети»: последняя активность по авторизованным запросам (с троттлингом в приложении).
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
