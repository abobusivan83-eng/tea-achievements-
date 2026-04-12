-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "avatarPath" TEXT,
    "bannerPath" TEXT,
    "frameKey" TEXT,
    "badgesJson" JSONB,
    "statusEmoji" TEXT,
    "adminNotes" TEXT,
    "adminTags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("adminNotes", "adminTags", "avatarPath", "badgesJson", "bannerPath", "blocked", "createdAt", "email", "frameKey", "id", "nickname", "passwordHash", "role", "updatedAt") SELECT "adminNotes", "adminTags", "avatarPath", "badgesJson", "bannerPath", "blocked", "createdAt", "email", "frameKey", "id", "nickname", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
