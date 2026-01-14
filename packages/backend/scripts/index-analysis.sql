-- Database Index Analysis Report for WebNote
-- Generated: 2026-01-11

-- ============================================
-- 1. 现有索引查询和分析
-- ============================================

-- 查看所有索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 查看索引大小统计
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;  -- 最少使用的索引排在前面

-- 查看未使用的索引（idx_scan = 0）
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    indexdef
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 查看索引使用率
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    seq_scan AS sequential_scans,
    idx_scan::FLOAT / NULLIF(seq_scan + idx_scan, 0) * 100 AS usage_percentage
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY usage_percentage ASC;

-- ============================================
-- 2. 表大小统计
-- ============================================

SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 3. 查询性能分析
-- ============================================

-- 模拟常见的笔记查询（带搜索）
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Note"
WHERE user_id = 1
    AND (title ILIKE '%test%' OR content ILIKE '%test%')
ORDER BY updated_at DESC
LIMIT 20;

-- 模拟文件夹查询
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Note"
WHERE user_id = 1 AND folder_id = 1
ORDER BY updated_at DESC
LIMIT 20;

-- 模拟置顶笔记查询
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Note"
WHERE user_id = 1 AND is_pinned = true
ORDER BY updated_at DESC
LIMIT 20;

-- 模拟复盘记录查询
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Review"
WHERE user_id = 1
ORDER BY date DESC
LIMIT 20;

-- ============================================
-- 4. 索引建议
-- ============================================

-- 查看缺失索引的建议
SELECT 
    schemaname,
    tablename,
    attname AS column_name,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND attname IN ('user_id', 'folder_id', 'is_pinned', 'updated_at', 'date', 'mood')
ORDER BY tablename, attname;
