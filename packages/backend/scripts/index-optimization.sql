-- WebNote Database Index Optimization Script
-- T3-BE-06: Database Index Optimization
-- Generated: 2026-01-11

-- ============================================
-- 第一阶段：启用扩展和全文搜索支持
-- ============================================

-- 启用 pg_trgm 扩展用于模糊搜索优化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 启用 unaccent 扩展用于去除重音符号（可选）
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================
-- 第二阶段：为 Note 表创建全文搜索索引
-- ============================================

-- 方法1：使用 GIN + pg_trgm 索引优化 LIKE/ILIKE 查询
-- 这对现有的 contains + insensitive 查询最有效

-- 为 title 字段创建 GIN 索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_title_trgm
ON "Note" USING GIN (title gin_trgm_ops);

-- 为 content 字段创建 GIN 索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_content_trgm
ON "Note" USING GIN (content gin_trgm_ops);

-- 方法2：创建 PostgreSQL 全文搜索索引（备选方案）
-- 需要修改应用层查询才能使用

-- 为 Note 创建 tsvector 列用于全文搜索
-- ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS title_tsv tsvector;
-- ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- 创建全文搜索索引
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_title_fulltext
-- ON "Note" USING GIN (title_tsv);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_content_fulltext
-- ON "Note" USING GIN (content_tsv);

-- ============================================
-- 第三阶段：为 Review 表创建全文搜索索引
-- ============================================

-- 为 content 字段创建 GIN 索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_content_trgm
ON "Review" USING GIN (content gin_trgm_ops);

-- ============================================
-- 第四阶段：优化现有索引（部分覆盖索引）
-- ============================================

-- 为 Note 表创建包含更多字段的覆盖索引
-- 减少回表查询，提高查询性能

-- 用户笔记列表查询优化（包含 folder 信息）
-- 这个索引可以帮助减少查询时的表访问
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_updated_folder_covering
ON "Note" (user_id, updated_at DESC)
INCLUDE (title, folder_id, is_pinned, last_accessed_at);

-- 按文件夹查询笔记优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_folder_updated_covering
ON "Note" (user_id, folder_id, updated_at DESC)
INCLUDE (title, is_pinned, last_accessed_at);

-- 置顶笔记查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_pinned_updated_covering
ON "Note" (user_id, is_pinned, updated_at DESC)
INCLUDE (title, folder_id, last_accessed_at);

-- ============================================
-- 第五阶段：Review 表优化
-- ============================================

-- 复盘记录查询优化（包含 mood 字段）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_date_covering
ON "Review" (user_id, date DESC)
INCLUDE (mood, content);

-- 情绪分析查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_mood_date_covering
ON "Review" (user_id, mood, date DESC)
INCLUDE (content);

-- ============================================
-- 第六阶段：Backup 表优化
-- ============================================

-- 备份列表查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_user_created_covering
ON "Backup" (user_id, created_at DESC)
INCLUDE (backup_id, status, size);

-- 过期备份查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_retention_type_until_covering
ON "Backup" (retention_type, retention_until)
INCLUDE (user_id, status);

-- ============================================
-- 第七阶段：索引维护和监控
-- ============================================

-- 创建索引使用情况监控视图
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE'
        WHEN idx_scan < 100 THEN 'MEDIUM_USAGE'
        ELSE 'HIGH_USAGE'
    END AS usage_level,
    indexdef
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- 创建索引性能监控视图
CREATE OR REPLACE VIEW index_performance_stats AS
SELECT 
    t.schemaname,
    t.tablename,
    t.seq_scan AS sequential_scans,
    t.seq_tup_read AS seq_tuples_read,
    t.idx_scan AS index_scans,
    t.idx_tup_fetch AS idx_tuples_fetched,
    CASE 
        WHEN t.seq_scan = 0 THEN 100
        ELSE ROUND((t.idx_scan::FLOAT / (t.seq_scan + t.idx_scan)) * 100, 2)
    END AS index_hit_percentage,
    pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(t.schemaname||'.'||t.tablename)) AS table_size
FROM pg_stat_user_tables t
WHERE t.schemaname = 'public'
ORDER BY t.seq_scan DESC;

-- ============================================
-- 验证和测试查询
-- ============================================

-- 测试全文搜索性能
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM "Note"
-- WHERE user_id = 1
--     AND (title ILIKE '%test%' OR content ILIKE '%test%')
-- ORDER BY updated_at DESC
-- LIMIT 20;

-- 测试文件夹查询性能
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM "Note"
-- WHERE user_id = 1 AND folder_id = 1
-- ORDER BY updated_at DESC
-- LIMIT 20;

-- 测试置顶笔记查询性能
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM "Note"
-- WHERE user_id = 1 AND is_pinned = true
-- ORDER BY updated_at DESC
-- LIMIT 20;

-- ============================================
-- 索引维护建议
-- ============================================

-- 定期运行 ANALYZE 更新统计信息
-- ANALYZE;

-- 定期运行 VACUUM 清理死元组
-- VACUUM ANALYZE;

-- 定期运行 REINDEX 重建碎片化索引（仅在必要时）
-- REINDEX INDEX CONCURRENTLY idx_note_title_trgm;

-- ============================================
-- 回滚脚本（仅在需要时使用）
-- ============================================

/*
-- 删除全文搜索索引
DROP INDEX CONCURRENTLY IF EXISTS idx_note_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_content_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_review_content_trgm;

-- 删除覆盖索引
DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_updated_folder_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_folder_updated_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_pinned_updated_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_review_user_date_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_review_user_mood_date_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_backup_user_created_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_backup_retention_type_until_covering;

-- 删除监控视图
DROP VIEW IF EXISTS index_usage_stats;
DROP VIEW IF EXISTS index_performance_stats;

-- 删除扩展（如果没有其他表使用）
-- DROP EXTENSION IF EXISTS unaccent CASCADE;
-- DROP EXTENSION IF EXISTS pg_trgm CASCADE;
*/
