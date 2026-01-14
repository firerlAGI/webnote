-- T3-BE-05: 同步队列管理
-- 创建SyncQueue表用于管理同步操作队列

-- 创建同步队列表
CREATE TABLE "SyncQueue" (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('note', 'folder', 'review')),
    entity_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    entity_id INTEGER,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    started_at TIMESTAMP
);

-- 创建索引以优化查询性能
CREATE INDEX "idx_sync_queue_user_status" ON "SyncQueue" (user_id, status);
CREATE INDEX "idx_sync_queue_user_priority" ON "SyncQueue" (user_id, priority);
CREATE INDEX "idx_sync_queue_status_priority" ON "SyncQueue" (status, priority, created_at);
CREATE INDEX "idx_sync_queue_entity_type" ON "SyncQueue" (entity_type);
CREATE INDEX "idx_sync_queue_created_at" ON "SyncQueue" (created_at);
CREATE INDEX "idx_sync_queue_scheduled_at" ON "SyncQueue" (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX "idx_sync_queue_completed_at" ON "SyncQueue" (completed_at) WHERE completed_at IS NOT NULL;

-- 创建部分索引用于查询待处理操作
CREATE INDEX "idx_sync_queue_pending" ON "SyncQueue" (user_id, priority, created_at)
WHERE status = 'pending';

-- 添加外键约束（如果User表存在）
-- ALTER TABLE "SyncQueue" ADD CONSTRAINT "fk_sync_queue_user"
-- FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- 添加注释
COMMENT ON TABLE "SyncQueue" IS '同步操作队列，用于管理待处理的同步操作';
COMMENT ON COLUMN "SyncQueue".id IS '操作唯一标识';
COMMENT ON COLUMN "SyncQueue".user_id IS '用户ID';
COMMENT ON COLUMN "SyncQueue".device_id IS '设备ID';
COMMENT ON COLUMN "SyncQueue".client_id IS '客户端ID';
COMMENT ON COLUMN "SyncQueue".operation_type IS '操作类型：create/update/delete';
COMMENT ON COLUMN "SyncQueue".entity_type IS '实体类型：note/folder/review';
COMMENT ON COLUMN "SyncQueue".entity_data IS '实体数据（JSON格式）';
COMMENT ON COLUMN "SyncQueue".entity_id IS '实体ID（更新和删除时需要）';
COMMENT ON COLUMN "SyncQueue".priority IS '优先级：high/medium/low';
COMMENT ON COLUMN "SyncQueue".retry_count IS '当前重试次数';
COMMENT ON COLUMN "SyncQueue".max_retries IS '最大重试次数';
COMMENT ON COLUMN "SyncQueue".status IS '状态：pending/processing/completed/failed';
COMMENT ON COLUMN "SyncQueue".error IS '错误信息';
COMMENT ON COLUMN "SyncQueue".created_at IS '创建时间';
COMMENT ON COLUMN "SyncQueue".updated_at IS '更新时间';
COMMENT ON COLUMN "SyncQueue".scheduled_at IS '预定执行时间';
COMMENT ON COLUMN "SyncQueue".completed_at IS '完成时间';
COMMENT ON COLUMN "SyncQueue".started_at IS '开始处理时间';
