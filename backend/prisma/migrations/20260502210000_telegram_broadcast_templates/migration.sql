CREATE TABLE "TelegramBroadcastTemplate" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "mediaType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramBroadcastTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramBroadcastTemplate_sortOrder_createdAt_idx"
  ON "TelegramBroadcastTemplate"("sortOrder", "createdAt");

ALTER TABLE "TelegramBroadcastTemplate"
  ADD CONSTRAINT "TelegramBroadcastTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
