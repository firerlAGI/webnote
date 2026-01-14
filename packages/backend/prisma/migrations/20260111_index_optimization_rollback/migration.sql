-- WebNote Database Index Optimization - Rollback
-- Migration: 20260111_index_optimization_rollback
-- Task: T3-BE-06

-- ============================================
-- Drop covering indexes for Backup table
-- ============================================

DROP INDEX CONCURRENTLY IF EXISTS idx_backup_user_created_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_backup_retention_type_until_covering;

-- ============================================
-- Drop covering indexes for Review table
-- ============================================

DROP INDEX CONCURRENTLY IF EXISTS idx_review_user_date_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_review_user_mood_date_covering;

-- ============================================
-- Drop covering indexes for Note table
-- ============================================

DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_updated_folder_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_folder_updated_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_user_pinned_updated_covering;

-- ============================================
-- Drop full-text search indexes
-- ============================================

DROP INDEX CONCURRENTLY IF EXISTS idx_note_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_note_content_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_review_content_trgm;

-- ============================================
-- Drop monitoring views
-- ============================================

DROP VIEW IF EXISTS index_usage_stats;
DROP VIEW IF EXISTS index_performance_stats;

-- ============================================
-- Drop extensions (if not used by other tables)
-- ============================================

-- Uncomment if no other tables use these extensions
-- DROP EXTENSION IF EXISTS unaccent CASCADE;
-- DROP EXTENSION IF EXISTS pg_trgm CASCADE;
