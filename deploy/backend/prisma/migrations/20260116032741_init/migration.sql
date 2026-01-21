-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "folder_id" INTEGER,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "last_accessed_at" DATETIME NOT NULL,
    "content_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Note_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Note_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Folder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "mood" INTEGER,
    "achievements" TEXT,
    "improvements" TEXT,
    "plans" TEXT,
    "template_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "backup_id" TEXT NOT NULL,
    "oss_key" TEXT NOT NULL,
    "oss_version_id" TEXT,
    "size" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "encryption" TEXT NOT NULL DEFAULT 'AES256',
    "retention_type" TEXT NOT NULL,
    "retention_until" DATETIME,
    "item_count" INTEGER NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "phase" TEXT NOT NULL DEFAULT 'init',
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "progress_completed" INTEGER NOT NULL DEFAULT 0,
    "progress_failed" INTEGER NOT NULL DEFAULT 0,
    "progress_percentage" REAL NOT NULL DEFAULT 0,
    "current_operation" TEXT,
    "error_message" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "operations" TEXT,
    "conflicts" TEXT,
    "notes_created" INTEGER NOT NULL DEFAULT 0,
    "notes_updated" INTEGER NOT NULL DEFAULT 0,
    "notes_deleted" INTEGER NOT NULL DEFAULT 0,
    "folders_created" INTEGER NOT NULL DEFAULT 0,
    "folders_updated" INTEGER NOT NULL DEFAULT 0,
    "folders_deleted" INTEGER NOT NULL DEFAULT 0,
    "reviews_created" INTEGER NOT NULL DEFAULT 0,
    "reviews_updated" INTEGER NOT NULL DEFAULT 0,
    "reviews_deleted" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sync_session_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "data" TEXT
);

-- CreateTable
CREATE TABLE "SyncStatistics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "total_syncs" INTEGER NOT NULL DEFAULT 0,
    "successful_syncs" INTEGER NOT NULL DEFAULT 0,
    "failed_syncs" INTEGER NOT NULL DEFAULT 0,
    "last_sync_time" DATETIME,
    "total_notes_synced" INTEGER NOT NULL DEFAULT 0,
    "total_folders_synced" INTEGER NOT NULL DEFAULT 0,
    "total_reviews_synced" INTEGER NOT NULL DEFAULT 0,
    "total_bytes_transferred" BIGINT NOT NULL DEFAULT 0,
    "average_sync_duration" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "device_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_data" TEXT NOT NULL DEFAULT '{}',
    "entity_id" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "scheduled_at" DATETIME,
    "completed_at" DATETIME,
    "started_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Note_user_id_updated_at_idx" ON "Note"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Note_user_id_folder_id_updated_at_idx" ON "Note"("user_id", "folder_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Note_user_id_is_pinned_updated_at_idx" ON "Note"("user_id", "is_pinned", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Note_title_idx" ON "Note"("title");

-- CreateIndex
CREATE INDEX "Note_user_id_content_hash_idx" ON "Note"("user_id", "content_hash");

-- CreateIndex
CREATE INDEX "idx_note_user_last_accessed" ON "Note"("user_id", "last_accessed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_note_updated" ON "Note"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "Folder_user_id_updated_at_idx" ON "Folder"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Review_user_id_date_idx" ON "Review"("user_id", "date" DESC);

-- CreateIndex
CREATE INDEX "Review_user_id_mood_date_idx" ON "Review"("user_id", "mood", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Backup_backup_id_key" ON "Backup"("backup_id");

-- CreateIndex
CREATE INDEX "Backup_user_id_created_at_idx" ON "Backup"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Backup_user_id_retention_type_idx" ON "Backup"("user_id", "retention_type");

-- CreateIndex
CREATE INDEX "Backup_retention_type_retention_until_idx" ON "Backup"("retention_type", "retention_until");

-- CreateIndex
CREATE INDEX "SyncSession_user_id_started_at_idx" ON "SyncSession"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "SyncSession_user_id_device_id_started_at_idx" ON "SyncSession"("user_id", "device_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "SyncSession_status_updated_at_idx" ON "SyncSession"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sync_session_created" ON "SyncSession"("started_at" DESC);

-- CreateIndex
CREATE INDEX "SyncOperation_sync_session_id_idx" ON "SyncOperation"("sync_session_id");

-- CreateIndex
CREATE INDEX "SyncOperation_user_id_status_idx" ON "SyncOperation"("user_id", "status");

-- CreateIndex
CREATE INDEX "SyncOperation_entity_type_entity_id_idx" ON "SyncOperation"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "SyncOperation_status_created_at_idx" ON "SyncOperation"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SyncStatistics_user_id_key" ON "SyncStatistics"("user_id");

-- CreateIndex
CREATE INDEX "SyncStatistics_user_id_idx" ON "SyncStatistics"("user_id");

-- CreateIndex
CREATE INDEX "SyncQueue_user_id_status_idx" ON "SyncQueue"("user_id", "status");

-- CreateIndex
CREATE INDEX "SyncQueue_user_id_priority_idx" ON "SyncQueue"("user_id", "priority");

-- CreateIndex
CREATE INDEX "SyncQueue_status_priority_created_at_idx" ON "SyncQueue"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "SyncQueue_entity_type_idx" ON "SyncQueue"("entity_type");

-- CreateIndex
CREATE INDEX "SyncQueue_created_at_idx" ON "SyncQueue"("created_at");

-- CreateIndex
CREATE INDEX "SyncQueue_scheduled_at_idx" ON "SyncQueue"("scheduled_at");

-- CreateIndex
CREATE INDEX "SyncQueue_completed_at_idx" ON "SyncQueue"("completed_at");

-- CreateIndex
CREATE INDEX "SyncQueue_user_id_priority_status_idx" ON "SyncQueue"("user_id", "priority", "status");
