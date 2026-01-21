-- AlterTable
ALTER TABLE "Review" ADD COLUMN "attachments" TEXT;
ALTER TABLE "Review" ADD COLUMN "creativity" INTEGER;
ALTER TABLE "Review" ADD COLUMN "emotion" INTEGER;
ALTER TABLE "Review" ADD COLUMN "energy" INTEGER;
ALTER TABLE "Review" ADD COLUMN "energy_score" INTEGER;
ALTER TABLE "Review" ADD COLUMN "focus" INTEGER;
ALTER TABLE "Review" ADD COLUMN "focus_score" INTEGER;
ALTER TABLE "Review" ADD COLUMN "mood_score" REAL;
ALTER TABLE "Review" ADD COLUMN "prime_directive" TEXT;
ALTER TABLE "Review" ADD COLUMN "social" INTEGER;
ALTER TABLE "Review" ADD COLUMN "spirit" INTEGER;
ALTER TABLE "Review" ADD COLUMN "system_interrupts" TEXT;

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'cyan',
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "density" TEXT NOT NULL DEFAULT 'standard',
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "offline_retention_days" INTEGER NOT NULL DEFAULT 7,
    "notifications" TEXT NOT NULL DEFAULT '{}',
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "encryption_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_user_id_key" ON "UserSettings"("user_id");

-- CreateIndex
CREATE INDEX "UserSettings_user_id_idx" ON "UserSettings"("user_id");
