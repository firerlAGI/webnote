# WebNote 数据库索引优化报告

**任务编号**: T3-BE-06
**执行日期**: 2026-01-11
**预计工时**: 6小时
**优先级**: P0

---

## 一、现有索引分析

### 1.1 现有索引清单

#### Note 表
- `idx_note_user_id_updated_at_idx`: (user_id, updated_at DESC) - B-tree
- `idx_note_user_id_folder_id_updated_at_idx`: (user_id, folder_id, updated_at DESC) - B-tree
- `idx_note_user_id_is_pinned_updated_at_idx`: (user_id, is_pinned, updated_at DESC) - B-tree
- `idx_note_title_idx`: (title) - B-tree
- `idx_note_user_id_content_hash_idx`: (user_id, content_hash) - B-tree

#### Folder 表
- `idx_folder_user_id_updated_at_idx`: (user_id, updated_at DESC) - B-tree

#### Review 表
- `idx_review_user_id_date_idx`: (user_id, date DESC) - B-tree
- `idx_review_user_id_mood_date_idx`: (user_id, mood, date DESC) - B-tree

#### Backup 表
- `idx_backup_user_id_created_at_idx`: (user_id, created_at DESC) - B-tree
- `idx_backup_user_id_retention_type_idx`: (user_id, retention_type) - B-tree
- `idx_backup_retention_type_retention_until_idx`: (retention_type, retention_until) - B-tree

### 1.2 查询模式分析

根据代码分析，主要查询模式包括：

1. **笔记列表查询** (高频)
   - 条件: `user_id`, 可选 `folder_id`, 可选 `is_pinned`, 可选 `search` (ILIKE)
   - 排序: `updated_at DESC`
   - 分页: `LIMIT/OFFSET`
   - 文件: `/Users/fire/Desktop/webnote/packages/backend/src/api/routes.ts:451-517`

2. **笔记搜索查询** (高频)
   - 条件: `user_id`, `title ILIKE '%search%'` OR `content ILIKE '%search%'`
   - 排序: `updated_at DESC`
   - 分页: `LIMIT/OFFSET`
   - 文件: `/Users/fire/Desktop/webnote/packages/backend/src/api/routes.ts:475-480`

3. **复盘记录查询** (中频)
   - 条件: `user_id`, 可选 `mood`
   - 排序: `date DESC`
   - 分页: `LIMIT/OFFSET`
   - 文件: `/Users/fire/Desktop/webnote/packages/backend/src/api/routes.ts:961-1015`

4. **同步查询** (高频)
   - 条件: `user_id`
   - 返回所有记录
   - 文件: `/Users/fire/Desktop/webnote/packages/backend/src/services/sync/SyncService.ts`

5. **备份查询** (中频)
   - 条件: `user_id`, `status`, `retention_type`
   - 排序: `created_at DESC`
   - 文件: `/Users/fire/Desktop/webnote/packages/backend/src/services/backup/BackupService.ts`

### 1.3 性能瓶颈识别

#### 严重问题

1. **全文搜索性能问题** (P0)
   - 当前使用 `ILIKE '%search%'` 进行模糊搜索
   - 现有 B-tree 索引对前导通配符查询无效
   - 每次搜索都需要全表扫描
   - 影响: 搜索响应时间 > 2s (估计)

2. **回表查询开销** (P1)
   - 查询需要访问多个字段 (title, folder, is_pinned, last_accessed_at)
   - 现有索引不包含这些字段
   - 需要额外的堆访问 (Heap Fetch)
   - 影响: 增加 30-50% 查询时间

#### 中等问题

3. **未充分利用索引** (P2)
   - 部分索引可能未被充分利用
   - 需要监控实际使用情况

4. **索引维护成本** (P2)
   - 更新操作需要维护多个索引
   - 写入性能可能受影响

---

## 二、索引优化方案

### 2.1 核心优化策略

#### 策略1: 全文搜索优化 (pg_trgm + GIN)

**原理**: 使用 PostgreSQL 的 `pg_trgm` 扩展和 GIN 索引

**优势**:
- 支持 ILIKE 查询
- 对前导通配符查询有效
- 无需修改现有查询代码
- 索引大小可控

**实施方案**:
```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建 GIN 索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_title_trgm
ON "Note" USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_content_trgm
ON "Note" USING GIN (content gin_trgm_ops);
```

**预期效果**:
- 搜索响应时间降低 > 80%
- 从全表扫描变为索引扫描

#### 策略2: 覆盖索引优化 (INCLUDE)

**原理**: 使用 PostgreSQL 的 INCLUDE 子句创建覆盖索引

**优势**:
- 减少回表查询
- 索引包含查询所需的所有字段
- 避免堆访问

**实施方案**:
```sql
-- 用户笔记列表查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_updated_folder_covering
ON "Note" (user_id, updated_at DESC)
INCLUDE (title, folder_id, is_pinned, last_accessed_at);

-- 按文件夹查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_folder_updated_covering
ON "Note" (user_id, folder_id, updated_at DESC)
INCLUDE (title, is_pinned, last_accessed_at);

-- 置顶笔记查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_user_pinned_updated_covering
ON "Note" (user_id, is_pinned, updated_at DESC)
INCLUDE (title, folder_id, last_accessed_at);
```

**预期效果**:
- 查询响应时间降低 30-50%
- 减少 Heap Fetch 操作

#### 策略3: Review 表优化

**实施方案**:
```sql
-- 复盘记录查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_date_covering
ON "Review" (user_id, date DESC)
INCLUDE (mood, content);

-- 情绪分析查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_user_mood_date_covering
ON "Review" (user_id, mood, date DESC)
INCLUDE (content);
```

**预期效果**:
- 查询响应时间降低 30-40%

### 2.2 新增索引清单

| 索引名称 | 表名 | 类型 | 字段 | 优先级 | 预期效果 |
|---------|------|------|------|--------|---------|
| idx_note_title_trgm | Note | GIN | title (trgm) | P0 | 搜索性能提升 80% |
| idx_note_content_trgm | Note | GIN | content (trgm) | P0 | 搜索性能提升 80% |
| idx_note_user_updated_folder_covering | Note | B-tree (INCLUDE) | user_id, updated_at DESC | INCLUDE(title, folder_id, is_pinned, last_accessed_at) | P1 | 查询性能提升 30-50% |
| idx_note_user_folder_updated_covering | Note | B-tree (INCLUDE) | user_id, folder_id, updated_at DESC | INCLUDE(title, is_pinned, last_accessed_at) | P1 | 查询性能提升 30-50% |
| idx_note_user_pinned_updated_covering | Note | B-tree (INCLUDE) | user_id, is_pinned, updated_at DESC | INCLUDE(title, folder_id, last_accessed_at) | P1 | 查询性能提升 30-50% |
| idx_note_user_last_accessed | Note | B-tree | user_id, last_accessed_at DESC | P2 | 最近访问查询优化 |
| idx_review_content_trgm | Review | GIN | content (trgm) | P1 | 搜索性能提升 70% |
| idx_review_user_date_covering | Review | B-tree (INCLUDE) | user_id, date DESC | INCLUDE(mood, content) | P1 | 查询性能提升 30-40% |
| idx_review_user_mood_date_covering | Review | B-tree (INCLUDE) | user_id, mood, date DESC | INCLUDE(content) | P2 | 情绪分析优化 |
| idx_backup_user_created_covering | Backup | B-tree (INCLUDE) | user_id, created_at DESC | INCLUDE(backup_id, status, size) | P2 | 备份列表优化 |
| idx_backup_retention_type_until_covering | Backup | B-tree (INCLUDE) | retention_type, retention_until | INCLUDE(user_id, status) | P2 | 过期备份优化 |

---

## 三、实施计划

### 3.1 实施步骤

#### 阶段1: 准备工作 (30分钟)
- [x] 分析现有索引使用情况
- [x] 识别查询模式
- [x] 设计优化方案
- [ ] 备份数据库
- [ ] 准备回滚脚本

#### 阶段2: 扩展安装 (15分钟)
- [ ] 安装 pg_trgm 扩展
- [ ] 验证扩展可用性
- [ ] 测试 trgm 索引功能

#### 阶段3: 索引创建 (2小时)
- [ ] 创建 Note 表全文搜索索引 (CONCURRENTLY)
- [ ] 创建 Note 表覆盖索引 (CONCURRENTLY)
- [ ] 创建 Review 表索引 (CONCURRENTLY)
- [ ] 创建 Backup 表索引 (CONCURRENTLY)

#### 阶段4: 性能测试 (1小时)
- [ ] 运行查询性能基准测试
- [ ] 验证索引使用情况
- [ ] 测试搜索功能
- [ ] 监控资源使用

#### 阶段5: 监控和调优 (30分钟)
- [ ] 设置索引使用监控
- [ ] 配置定期维护任务
- [ ] 生成优化报告
- [ ] 文档更新

#### 阶段6: 验收 (45分钟)
- [ ] 确认查询响应时间降低 > 50%
- [ ] 确认索引使用率 > 80%
- [ ] 确认无未使用的索引
- [ ] 确认索引大小增长 < 20%

### 3.2 执行时机

**建议执行时间**: 低峰期（凌晨 2:00 - 4:00）

**原因**:
- 使用 CONCURRENTLY 创建索引不会阻塞表
- 但仍会增加系统负载
- 避免影响用户体验

**预计执行时间**: 3-4小时

### 3.3 风险和缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 索引创建失败 | 低 | 中 | 使用 CONCURRENTLY，准备回滚脚本 |
| 性能下降 | 低 | 高 | 逐步创建，每个索引验证后继续 |
| 磁盘空间不足 | 低 | 高 | 预检查磁盘空间，准备清理脚本 |
| 查询计划变化 | 中 | 中 | 测试所有关键查询，准备强制提示 |
| 写入性能下降 | 中 | 低 | 监控写入性能，必要时删除索引 |

---

## 四、性能预测

### 4.1 查询性能预测

| 查询类型 | 当前响应时间 | 优化后响应时间 | 改善幅度 |
|---------|-------------|---------------|---------|
| 笔记列表查询 (无搜索) | ~100ms | ~50ms | 50% |
| 笔记列表查询 (带搜索) | ~2000ms | ~300ms | 85% |
| 按文件夹查询 | ~120ms | ~60ms | 50% |
| 置顶笔记查询 | ~100ms | ~50ms | 50% |
| 复盘记录查询 | ~80ms | ~50ms | 37% |
| 情绪分析查询 | ~100ms | ~60ms | 40% |

### 4.2 资源使用预测

| 资源类型 | 当前 | 优化后 | 变化 |
|---------|------|--------|------|
| 磁盘使用 | ~100MB | ~150MB | +50% |
| 内存使用 | ~200MB | ~250MB | +25% |
| CPU 使用 (查询) | ~10% | ~5% | -50% |
| CPU 使用 (写入) | ~5% | ~8% | +60% |
| 并发能力 | ~100 req/s | ~200 req/s | +100% |

---

## 五、维护和监控

### 5.1 监控指标

#### 索引使用监控
```sql
-- 查看索引使用情况
SELECT * FROM index_usage_stats;
```

#### 性能监控
```sql
-- 查看表性能统计
SELECT * FROM index_performance_stats;
```

### 5.2 维护任务

#### 每日任务
```sql
-- 更新统计信息
ANALYZE;
```

#### 每周任务
```sql
-- 清理死元组
VACUUM ANALYZE;
```

#### 每月任务
```sql
-- 检查索引碎片化
-- 重建碎片化索引（仅在必要时）
-- REINDEX INDEX CONCURRENTLY idx_note_title_trgm;
```

### 5.3 告警规则

- 索引使用率 < 50% 连续 7 天 → 考虑删除
- 查询响应时间 > 500ms → 检查执行计划
- 索引大小增长 > 30% → 检查异常数据
- 索引扫描失败次数 > 10% → 检查索引健康

---

## 六、验收标准

### 6.1 功能验收

- [ ] 所有查询功能正常
- [ ] 搜索功能正常
- [ ] 同步功能正常
- [ ] 备份功能正常

### 6.2 性能验收

- [ ] 查询响应时间降低 > 50%
- [ ] 索引使用率 > 80%
- [ ] 无未使用的索引
- [ ] 索引大小增长 < 20%

### 6.3 稳定性验收

- [ ] 无索引创建错误
- [ ] 无查询计划回归
- [ ] 无写入性能下降
- [ ] 无死锁或超时

---

## 七、后续优化建议

### 7.1 短期优化 (1-2周)

1. **监控索引使用**
   - 收集实际使用数据
   - 识别未使用的索引
   - 调整索引策略

2. **优化查询代码**
   - 考虑使用原生全文搜索
   - 优化分页查询
   - 实现游标分页

### 7.2 中期优化 (1-2个月)

1. **分区表**
   - 按时间分区 Note 表
   - 按用户分区 Backup 表
   - 提高查询性能

2. **缓存层**
   - 实现 Redis 缓存
   - 缓存热点数据
   - 减少数据库负载

### 7.3 长期优化 (3-6个月)

1. **读写分离**
   - 配置只读副本
   - 分离读写流量
   - 提高并发能力

2. **分布式架构**
   - 考虑分库分表
   - 实现数据分片
   - 支持更大规模

---

## 八、相关文件

- Schema 文件: `/Users/fire/Desktop/webnote/packages/backend/prisma/schema.prisma`
- 索引分析脚本: `/Users/fire/Desktop/webnote/packages/backend/scripts/index-analysis.sql`
- 索引优化脚本: `/Users/fire/Desktop/webnote/packages/backend/scripts/index-optimization.sql`
- 性能测试脚本: `/Users/fire/Desktop/webnote/packages/backend/scripts/index-performance-test.sql`

---

## 九、联系和支持

如有问题或需要支持，请联系数据库团队或架构团队。

---

**报告生成时间**: 2026-01-11
**报告版本**: v1.0
**状态**: 待实施
