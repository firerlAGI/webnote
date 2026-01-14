-- WebNote Database Index Optimization
-- Migration: 20260111_index_optimization
-- Task: T3-BE-06

-- ============================================
-- Enable extensions for full-text search
-- ============================================

-- Enable pg_trgm extension for ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Create full-text search indexes (GIN with pg_trgm)
-- ============================================

-- Note table - title search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_title_trgm
ON "Note" USING GIN (title gin_trgm_ops);

-- Note table - content search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_content_trgm
ON "Note" USING GIN (content gin_trgm_ops);

-- Review table - content search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_content_trgm
ON "Review" USING GIN (content gin_trgm_ops);

-- ============================================
-- Create covering indexes for Note table
-- ============================================

-- User note list query optimization (includes folder info)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_updated_folder_covering
ON "Note" (user_id, updated_at DESC)
INCLUDE (title, folder_id, is_pinned, last_accessed_at);

-- Folder query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_folder_updated_covering
ON "Note" (user_id, folder_id, updated_at DESC)
INCLUDE (title, is_pinned, last_accessed_at);

-- Pinned notes query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_pinned_updated_covering
ON "Note" (user_id, is_pinned, updated_at DESC)
INCLUDE (title, folder_id, last_accessed_at);

-- ============================================
-- Create covering indexes for Review table
-- ============================================

-- Review list query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_date_covering
ON "Review" (user_id, date DESC)
INCLUDE (mood, content);

-- Mood analysis query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_mood_date_covering
ON "Review" (user_id, mood, date DESC)
INCLUDE (content);

-- ============================================
-- Create covering indexes for Backup table
-- ============================================

-- Backup list query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_user_created_covering
ON "Backup" (user_id, created_at DESC)
INCLUDE (backup_id, status, size);

-- Expiring backup query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_retention_type_until_covering
ON "Backup" (retention_type, retention_until)
INCLUDE (user_id, status);

-- ============================================
-- Create monitoring views
-- ============================================

-- Index usage statistics view
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

-- Index performance statistics view
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
