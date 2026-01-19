# 数据库性能优化方案

## 当前状态分析

### 数据库类型
- **数据库**: SQLite
- **ORM**: Prisma
- **当前索引数量**: 38个索引

### 已有索引
#### User 表
- `User_username_key` (唯一索引)
- `User_email_key` (唯一索引)

#### Note 表
- `Note_user_id_updated_at_idx` (复合索引: user_id, updated_at DESC)
- `Note_user_id_folder_id_updated_at_idx` (复合索引: user_id, folder_id, updated_at DESC)
- `Note_user_id_is_pinned_updated_at_idx` (复合索引: user_id, is_pinned, updated_at DESC)
- `Note_title_idx` (单列索引)
- `Note_user_id_content_hash_idx` (复合索引: user_id, content_hash)
- `idx_note_user_last_accessed` (复合索引: user_id, last_accessed_at DESC)
- `idx_note_updated` (单列索引: updated_at DESC)

#### Review 表
- `Review_user_id_date_idx` (复合索引: user_id, date DESC)
- `Review_user_id_mood_date_idx` (复合索引: user_id, mood, date DESC)

#### Folder 表
- `Folder_user_id_updated_at_idx` (复合索引: user_id, updated_at DESC)

#### Backup 表
- `Backup_backup_id_key` (唯一索引)
- `Backup_user_id_created_at_idx` (复合索引: user_id, created_at DESC)
- `Backup_user_id_retention_type_idx` (复合索引: user_id, retention_type)
- `Backup_retention_type_retention_until_idx` (复合索引: retention_type, retention_until)

#### SyncSession 表
- `SyncSession_user_id_started_at_idx` (复合索引: user_id, started_at DESC)
- `SyncSession_user_id_device_id_started_at_idx` (复合索引: user_id, device_id, started_at DESC)
- `SyncSession_status_updated_at_idx` (复合索引: status, updated_at DESC)
- `idx_sync_session_created` (单列索引: started_at DESC)

#### SyncOperation 表
- `SyncOperation_sync_session_id_idx` (单列索引)
- `SyncOperation_user_id_status_idx` (复合索引: user_id, status)
- `SyncOperation_entity_type_entity_id_idx` (复合索引: entity_type, entity_id)
- `SyncOperation_status_created_at_idx` (复合索引: status, created_at DESC)

#### SyncQueue 表
- `SyncQueue_user_id_status_idx` (复合索引: user_id, status)
- `SyncQueue_user_id_priority_idx` (复合索引: user_id, priority)
- `SyncQueue_status_priority_created_at_idx` (复合索引: status, priority, created_at)
- `SyncQueue_entity_type_idx` (单列索引)
- `SyncQueue_created_at_idx` (单列索引)
- `SyncQueue_scheduled_at_idx` (单列索引)
- `SyncQueue_completed_at_idx` (单列索引)
- `SyncQueue_user_id_priority_status_idx` (复合索引: user_id, priority, status)

#### SyncStatistics 表
- `SyncStatistics_user_id_key` (唯一索引)
- `SyncStatistics_user_id_idx` (单列索引)

#### UserSettings 表
- `UserSettings_user_id_key` (唯一索引)
- `UserSettings_user_id_idx` (单列索引)

## 性能瓶颈识别

### 1. 索引问题

#### 问题1: Note 表搜索查询优化不足
**现状**: 搜索功能使用 `OR` 查询 title 和 content 字段
```typescript
OR: [
  { title: { contains: search, mode: 'insensitive' } },
  { content: { contains: search, mode: 'insensitive' } }
]
```
**问题**: SQLite 的 `LIKE` 查询无法有效利用索引
**影响**: 搜索功能性能较差

#### 问题2: 部分复合索引冗余
**现状**: Note 表有多个 `user_id` 开头的复合索引
**问题**: 索引过多可能影响写入性能
**影响**: 插入和更新操作变慢

#### 问题3: 缺少部分覆盖索引
**现状**: 某些查询需要回表查询
**问题**: 缺少覆盖索引导致额外的 I/O 操作
**影响**: 查询性能下降

### 2. 查询优化问题

#### 问题1: N+1 查询问题
**现状**: 在获取笔记列表时,每个笔记都要单独查询 folder
**影响**: 当笔记数量多时性能严重下降

#### 问题2: Dashboard 查询性能
**现状**: 多次查询获取统计数据
```typescript
const recentReviews = await prisma.review.findMany(...)
const parsedRecentReviews = recentReviewsList.map(normalizeReview)
```
**影响**: 响应时间较长

#### 问题3: 分页查询优化不足
**现状**: 使用 `skip` 进行分页
**影响**: 当页码很大时性能下降

### 3. 连接管理问题

#### 问题1: 缺少连接池配置
**现状**: Prisma 使用默认配置
**影响**: 高并发时连接管理不当

#### 问题2: 缺少查询超时配置
**现状**: 没有设置查询超时
**影响**: 慢查询可能导致连接阻塞

### 4. 监控问题

#### 问题1: 缺少慢查询日志
**现状**: 没有记录慢查询
**影响**: 无法及时发现性能问题

#### 问题2: 缺少性能指标
**现状**: 没有收集数据库性能指标
**影响**: 无法进行性能分析和优化

## 优化方案

### 阶段1: 索引优化 (最高优先级)

#### 1.1 添加全文搜索支持
**方案**: 使用 SQLite FTS5 扩展实现全文搜索
**步骤**:
1. 创建虚拟表 `Note_fts`
2. 添加触发器同步数据
3. 修改搜索查询使用 FTS5

**预期效果**: 搜索性能提升 10-100 倍

#### 1.2 优化复合索引
**方案**: 移除冗余索引,优化索引顺序
**步骤**:
1. 分析查询模式
2. 移除不常用的索引
3. 调整复合索引字段顺序

**预期效果**: 写入性能提升 20-30%

#### 1.3 添加覆盖索引
**方案**: 为常用查询添加覆盖索引
**示例**:
```prisma
@@index([user_id, updated_at(sort: Desc)], 
        where: { is_pinned: true },
        name: "idx_note_pinned_user_updated")
```

**预期效果**: 查询性能提升 30-50%

### 阶段2: 查询优化

#### 2.1 解决 N+1 查询问题
**方案**: 使用 `include` 或 `select` 一次性获取关联数据
**示例**:
```typescript
const notes = await prisma.note.findMany({
  include: {
    folder: {
      select: { id: true, name: true }
    }
  }
})
```

**预期效果**: 查询时间从 O(n) 降到 O(1)

#### 2.2 优化 Dashboard 查询
**方案**: 使用聚合查询减少数据库往返
**示例**:
```typescript
const [currentReview, bioMetrics] = await Promise.all([
  prisma.review.findFirst(...),
  prisma.review.aggregate({
    where: { user_id, date: { gte: sevenDaysAgo } },
    _avg: {
      spirit: true,
      energy: true,
      // ...
    }
  })
])
```

**预期效果**: 响应时间减少 40-60%

#### 2.3 优化分页查询
**方案**: 使用基于游标的分页替代 `skip`
**示例**:
```typescript
const notes = await prisma.note.findMany({
  take: limit + 1,
  cursor: { id: lastId },
  orderBy: { id: 'asc' }
})
```

**预期效果**: 大页码查询性能提升 10-100 倍

### 阶段3: 连接管理优化

#### 3.1 配置连接池
**方案**: 在 Prisma 配置中添加连接池设置
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})
```

**注意**: SQLite 不支持传统连接池,但可以优化连接复用

#### 3.2 添加查询超时
**方案**: 在 Prisma 配置中设置超时
```typescript
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  errorFormat: 'pretty'
})
```

**预期效果**: 避免慢查询阻塞

### 阶段4: 监控和优化

#### 4.1 添加慢查询日志
**方案**: 实现查询日志中间件
**步骤**:
1. 创建查询拦截器
2. 记录执行时间超过阈值的查询
3. 输出到日志文件

**预期效果**: 可以及时发现性能问题

#### 4.2 添加性能指标收集
**方案**: 收集数据库性能指标
**指标**:
- 查询执行时间
- 查询频率
- 数据库大小
- 索引使用率

**预期效果**: 可以进行性能分析和优化

#### 4.3 定期分析优化
**方案**: 定期运行 SQLite ANALYZE 命令
**步骤**:
1. 创建定时任务
2. 定期更新统计信息
3. 优化查询计划

**预期效果**: 查询计划更优

## 实施计划

### 第一天: 索引优化
- [ ] 添加 FTS5 全文搜索支持
- [ ] 优化复合索引
- [ ] 添加覆盖索引
- [ ] 测试索引效果

### 第二天: 查询优化
- [ ] 解决 N+1 查询问题
- [ ] 优化 Dashboard 查询
- [ ] 优化分页查询
- [ ] 测试查询性能

### 第三天: 连接管理和监控
- [ ] 配置 Prisma 连接
- [ ] 添加查询超时
- [ ] 实现慢查询日志
- [ ] 添加性能指标收集

### 第四天: 测试和验证
- [ ] 性能基准测试
- [ ] 压力测试
- [ ] 优化调整
- [ ] 文档更新

## 预期效果

### 性能提升
- **查询性能**: 提升 50-80%
- **搜索性能**: 提升 10-100 倍
- **写入性能**: 提升 20-30%
- **并发性能**: 提升 30-50%

### 资源使用
- **CPU 使用**: 降低 20-30%
- **内存使用**: 降低 10-20%
- **磁盘 I/O**: 降低 30-40%

## 风险和注意事项

### 风险1: 索引过多影响写入性能
**缓解措施**: 只为高频查询添加索引,定期分析索引使用率

### 风险2: FTS5 扩展兼容性问题
**缓解措施**: 检查 SQLite 版本,确保支持 FTS5

### 风险3: 查询优化可能引入新问题
**缓解措施**: 充分测试,逐步上线

### 风险4: 数据库迁移可能失败
**缓解措施**: 备份数据库,使用事务确保数据一致性

## 监控指标

### 关键指标
- 平均查询响应时间 < 100ms
- P95 查询响应时间 < 500ms
- 慢查询率 < 5%
- 数据库连接池使用率 < 80%
- 搜索响应时间 < 200ms

### 告警规则
- 慢查询数量 > 10/分钟
- 数据库响应时间 > 1秒
- 连接池耗尽
- 查询错误率 > 1%

## 持续优化

### 定期任务
- 每周: 分析慢查询日志
- 每月: 分析索引使用率
- 每季度: 重新评估索引策略

### 优化迭代
1. 收集性能数据
2. 分析瓶颈
3. 设计优化方案
4. 实施优化
5. 验证效果
6. 持续监控

---

**文档版本**: 1.0  
**创建日期**: 2026-01-19  
**最后更新**: 2026-01-19
