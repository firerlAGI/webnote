# T3项目前端缓存系统设计文档

## 概述

本文档描述了T3项目的前端缓存系统设计，包括三级缓存架构、同步管理器以及完整的API接口设计。

## 技术选择

### 1. IndexedDB
- **容量**: 500MB（可扩展）
- **用途**: 存储大量持久化数据（笔记、文件夹、复盘记录等）
- **优点**: 支持事务、索引、异步操作
- **适用场景**: 长期存储、大数据量、复杂查询

### 2. localStorage
- **容量**: 5MB
- **用途**: 存储元数据、配置信息、同步状态
- **优点**: 同步访问、简单易用
- **适用场景**: 小型配置、状态信息、用户设置

### 3. 内存缓存
- **容量**: 10MB
- **用途**: 存储频繁访问的热数据
- **优点**: 速度最快、支持LRU淘汰
- **适用场景**: 临时数据、会话数据、快速访问

## 三级缓存架构

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   混合缓存层 (HybridCache)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  L1: 内存缓存 │  │ L2: IndexedDB│  │ L3: localStorage│     │
│  │   (Memory)   │  │              │  │              │      │
│  │  • 10MB      │  │  • 500MB     │  │  • 5MB       │      │
│  │  • LRU       │  │  • 持久化    │  │  • 配置存储  │      │
│  │  • 5分钟TTL  │  │  • 1小时TTL  │  │  • 24小时TTL │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                同步管理层 (SyncManager)                       │
│  • 同步队列管理  • 冲突检测与解决  • 离线操作支持            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    网络层 (Network API)                       │
└─────────────────────────────────────────────────────────────┘
```

## 缓存API接口设计

### 1. 基础CRUD操作

```typescript
// 获取数据
const note = await cache.get<Note>(CacheKeys.NOTE(123))

// 设置数据
await cache.set(CacheKeys.NOTE(123), noteData, {
  ttl: 60 * 60 * 1000, // 1小时
  persist: true
})

// 删除数据
await cache.delete(CacheKeys.NOTE(123))

// 检查数据是否存在
const exists = await cache.has(CacheKeys.NOTE(123))

// 清空所有缓存
await cache.clear()

// 获取缓存大小
const size = await cache.getSize()

// 获取缓存项目数量
const count = await cache.getCount()

// 清理过期缓存
const expiredCount = await cache.cleanupExpired()

// 清理LRU缓存
const freedBytes = await cache.cleanupLRU(1024 * 1024) // 清理1MB
```

### 2. 批量操作

```typescript
// 批量获取
const notes = await cache.getMany<Note>([
  CacheKeys.NOTE(1),
  CacheKeys.NOTE(2),
  CacheKeys.NOTE(3)
])

// 批量设置
const result = await cache.setMany([
  { key: CacheKeys.NOTE(1), data: note1 },
  { key: CacheKeys.NOTE(2), data: note2 },
  { key: CacheKeys.NOTE(3), data: note3 }
])

console.log(`成功: ${result.success}, 失败: ${result.failed}`)

// 批量删除
const deleteResult = await cache.deleteMany([
  CacheKeys.NOTE(1),
  CacheKeys.NOTE(2)
])

// 获取所有键
const allKeys = await cache.keys('note:') // 获取所有note前缀的键
```

### 3. 查询操作

```typescript
// 查询笔记
const userNotes = await cache.query<Note>('note', {
  filter: (note) => note.user_id === userId,
  sortBy: 'updated_at',
  sortOrder: 'desc',
  skip: 0,
  take: 20
})

// 查找匹配的键
const patternKeys = await cache.findKeys('note:1*')

// 获取缓存统计信息
const stats = await cache.getStats()
console.log(`
  缓存项目数: ${stats.count}
  缓存大小: ${stats.size} bytes
  命中率: ${(stats.hitRate * 100).toFixed(2)}%
  过期项目: ${stats.expired}
`)

// 导出缓存数据
const exportedData = await cache.export()

// 导入缓存数据
await cache.import(exportedData)
```

### 4. 同步队列操作

```typescript
// 添加操作到同步队列
const syncId = await syncManager.addToQueue({
  type: 'create',
  entity: 'note',
  entityId: 123,
  data: noteData,
  beforeVersion: 1
})

// 从队列移除操作
await syncManager.removeFromQueue(syncId)

// 重试失败的操作
await syncManager.retryFailedItem(syncId)

// 重试所有失败的操作
await syncManager.retryAllFailed()

// 清空同步队列
await syncManager.clearQueue()

// 获取待同步操作数量
const pendingCount = await syncManager.getPendingCount()

// 获取失败操作数量
const failedCount = await syncManager.getFailedCount()
```

### 5. 同步状态操作

```typescript
// 获取同步状态
const status = await syncManager.getSyncStatus()
console.log(`
  最后同步时间: ${new Date(status.lastSyncTime).toLocaleString()}
  是否正在同步: ${status.isSyncing}
  待同步项: ${status.pendingItems}
  失败项: ${status.failedItems}
  冲突项: ${status.conflictItems}
  同步模式: ${status.syncMode}
  连接状态: ${status.connectionStatus}
`)

// 开始自动同步
syncManager.startAutoSync()

// 停止自动同步
syncManager.stopAutoSync()

// 手动触发同步
await syncManager.sync()

// 监听同步事件
syncManager.on('sync_start', (event) => {
  console.log('同步开始', event)
})

syncManager.on('sync_complete', (event) => {
  console.log('同步完成', event)
})

syncManager.on('sync_error', (event) => {
  console.error('同步失败', event.error)
})

syncManager.on('sync_conflict', (event) => {
  console.log('检测到冲突', event.data)
})
```

### 6. 数据差异操作

```typescript
// 计算数据差异
const diff = await syncManager.computeDiff(localData, remoteData)
console.log(`
  新增字段: ${Object.keys(diff.added)}
  删除字段: ${Object.keys(diff.removed)}
  修改字段: ${Object.keys(diff.modified)}
  未变字段: ${Object.keys(diff.unchanged)}
`)

// 检测冲突
const hasConflict = await syncManager.detectConflict(
  localData,
  remoteData,
  localVersion,
  remoteVersion
)

// 应用补丁
const updatedData = await syncManager.applyPatch(baseData, patch)

// 生成补丁
const patch = await syncManager.generatePatch(beforeData, afterData)
```

## 同步管理器核心方法

### 初始化与配置

```typescript
import { HybridCache, SyncManager } from './cache'

// 创建缓存实例
const cache = await HybridCache.createHybridCache()

// 创建同步管理器
const syncManager = new SyncManager(cache, {
  apiBaseUrl: '/api',
  syncInterval: 30 * 1000, // 30秒
  maxRetries: 3,
  retryDelay: 5000, // 5秒
  batchSize: 50,
  defaultConflictStrategy: ConflictResolutionStrategy.LATEST_WINS,
  autoSync: true,
  enableRealtime: true,
  offlineTimeout: 60 * 1000 // 1分钟
})
```

### 实体同步操作

```typescript
// 同步笔记
await syncManager.syncNote(note, 'create')
await syncManager.syncNote(note, 'update')
await syncManager.syncNote(note, 'delete')

// 同步文件夹
await syncManager.syncFolder(folder, 'create')
await syncManager.syncFolder(folder, 'update')
await syncManager.syncFolder(folder, 'delete')

// 同步复盘记录
await syncManager.syncReview(review, 'create')
await syncManager.syncReview(review, 'update')
await syncManager.syncReview(review, 'delete')
```

### 离线操作支持

```typescript
// 创建离线笔记（临时ID）
const tempNoteId = await syncManager.createOfflineNote({
  user_id: userId,
  title: '离线笔记',
  content: '这是离线创建的笔记'
})

// 创建离线文件夹
const tempFolderId = await syncManager.createOfflineFolder({
  user_id: userId,
  name: '离线文件夹'
})

// 创建离线复盘记录
const tempReviewId = await syncManager.createOfflineReview({
  user_id: userId,
  date: '2024-01-10',
  content: '离线复盘'
})

// 网络恢复后，这些数据会自动同步到服务器
// 临时ID会被替换为服务器分配的真实ID
```

### 冲突解决

```typescript
// 获取所有冲突
const conflicts = await syncManager.getConflicts()

// 获取特定冲突
const conflict = await syncManager.getConflict(conflictId)

// 解决冲突（服务器版本胜出）
const result = await syncManager.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.SERVER_WINS
)

// 解决冲突（客户端版本胜出）
await syncManager.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.CLIENT_WINS
)

// 解决冲突（最新版本胜出）
await syncManager.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.LATEST_WINS
)

// 解决冲突（合并版本）
await syncManager.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.MERGE
)

// 手动解决冲突
await syncManager.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.MANUAL,
  { title: '合并后的标题', content: '合并后的内容' }
)

// 清除所有冲突
await syncManager.clearConflicts()
```

## 事件系统

### 缓存事件

```typescript
// 监听缓存事件
cache.on('get', (event) => {
  console.log('数据被访问', event.key)
})

cache.on('set', (event) => {
  console.log('数据被设置', event.key, event.data)
})

cache.on('delete', (event) => {
  console.log('数据被删除', event.key)
})

cache.on('expired', (event) => {
  console.log('数据已过期', event.key)
})

cache.on('sync_started', (event) => {
  console.log('同步开始')
})

cache.on('sync_completed', (event) => {
  console.log('同步完成', event.data)
})

cache.on('sync_failed', (event) => {
  console.error('同步失败', event.error)
})

cache.on('conflict_detected', (event) => {
  console.log('检测到冲突', event.data)
})

cache.on('conflict_resolved', (event) => {
  console.log('冲突已解决', event.data)
})
```

### 同步事件

```typescript
// 监听同步事件
syncManager.on('sync_start', (event) => {
  console.log('同步开始', event.timestamp)
})

syncManager.on('sync_progress', (event) => {
  console.log(`同步进度: ${event.data.current}/${event.data.total}`)
})

syncManager.on('sync_complete', (event) => {
  console.log('同步完成', event.data)
})

syncManager.on('sync_error', (event) => {
  console.error('同步错误', event.error)
})

syncManager.on('sync_conflict', (event) => {
  console.log('同步冲突', event.data)
})

syncManager.on('sync_conflict_resolved', (event) => {
  console.log('冲突已解决', event.data)
})

syncManager.on('offline_mode', (event) => {
  console.log('进入离线模式')
})

syncManager.on('online_mode', (event) => {
  console.log('进入在线模式')
})

syncManager.on('queue_updated', (event) => {
  console.log('同步队列已更新', event.data)
})

syncManager.on('status_changed', (event) => {
  console.log('同步状态已变更', event.data)
})
```

## 使用示例

### 完整的应用集成示例

```typescript
import { HybridCache, SyncManager, CacheKeys } from './cache'

class App {
  private cache: HybridCache
  private syncManager: SyncManager

  async initialize() {
    // 1. 创建缓存实例
    this.cache = await HybridCache.createHybridCache()

    // 2. 创建同步管理器
    this.syncManager = new SyncManager(this.cache, {
      autoSync: true,
      enableRealtime: true
    })

    // 3. 设置事件监听
    this.setupEventListeners()

    // 4. 加载初始数据
    await this.loadInitialData()
  }

  private setupEventListeners() {
    // 监听同步状态变化
    this.syncManager.on('sync_complete', (event) => {
      console.log('数据已同步', event.data)
      // 刷新UI
      this.refreshUI()
    })

    this.syncManager.on('sync_conflict', (event) => {
      console.log('发现冲突', event.data)
      // 显示冲突解决对话框
      this.showConflictDialog(event.data)
    })

    // 监听缓存事件
    this.cache.on('set', (event) => {
      if (event.key?.startsWith('note:')) {
        // 笔记被更新
        this.onNoteUpdated(event.key)
      }
    })
  }

  async loadInitialData() {
    // 从缓存加载笔记
    const notes = await this.cache.getNotes(userId)
    this.displayNotes(notes)

    // 从缓存加载文件夹
    const folders = await this.cache.getFolders(userId)
    this.displayFolders(folders)

    // 从缓存加载复盘记录
    const reviews = await this.cache.getReviews(userId)
    this.displayReviews(reviews)
  }

  async createNote(noteData: Partial<Note>) {
    // 创建离线笔记
    const tempId = await this.syncManager.createOfflineNote(noteData)

    // 显示在UI中（使用临时ID）
    this.displayNote({ ...noteData, id: tempId } as Note)

    // 同步到服务器（自动处理）
    // 网络恢复后，tempId会被替换为真实ID
    // 需要监听同步完成事件来更新UI
  }

  async updateNote(note: Note) {
    // 更新缓存
    await this.cache.setNote(note)

    // 同步到服务器
    await this.syncManager.syncNote(note, 'update')
  }

  async deleteNote(noteId: number) {
    // 从缓存删除
    await this.cache.deleteNote(noteId)

    // 同步删除
    await this.syncManager.syncNote({ id: noteId } as Note, 'delete')
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge') {
    const strategy = resolution === 'local'
      ? ConflictResolutionStrategy.CLIENT_WINS
      : resolution === 'remote'
      ? ConflictResolutionStrategy.SERVER_WINS
      : ConflictResolutionStrategy.MERGE

    const result = await this.syncManager.resolveConflict(conflictId, strategy)

    if (result.success) {
      console.log('冲突已解决', result.resolved_data)
      // 刷新UI
      this.refreshUI()
    }
  }

  async getSyncStatus() {
    const status = await this.syncManager.getSyncStatus()
    return {
      lastSyncTime: new Date(status.lastSyncTime).toLocaleString(),
      isSyncing: status.isSyncing,
      pendingItems: status.pendingItems,
      failedItems: status.failedItems,
      conflictItems: status.conflictItems,
      connectionStatus: status.connectionStatus
    }
  }

  private refreshUI() {
    // 刷新UI的逻辑
    this.loadInitialData()
  }

  private onNoteUpdated(noteKey: string) {
    const noteId = parseInt(noteKey.split(':')[1])
    // 更新特定笔记的UI
    this.updateNoteUI(noteId)
  }

  private showConflictDialog(conflict: Conflict) {
    // 显示冲突解决对话框
    // 让用户选择保留哪个版本
  }
}
```

## 性能优化建议

### 1. 缓存策略优化

```typescript
// 根据数据类型选择合适的缓存层
async getData(key: string) {
  // 元数据使用localStorage
  if (key.startsWith('metadata:')) {
    return localStorageCache.get(key)
  }

  // 大数据使用IndexedDB
  if (key.startsWith('note:') || key.startsWith('review:')) {
    return indexedDBCache.get(key)
  }

  // 热数据使用内存缓存
  return memoryCache.get(key)
}
```

### 2. 批量操作优化

```typescript
// 批量设置比单个设置更高效
await cache.setMany([
  { key: CacheKeys.NOTE(1), data: note1 },
  { key: CacheKeys.NOTE(2), data: note2 },
  { key: CacheKeys.NOTE(3), data: note3 }
])
```

### 3. 查询优化

```typescript
// 使用索引进行高效查询
const notes = await cache.query<Note>('note', {
  filter: (note) => note.user_id === userId,
  sortBy: 'updated_at',
  sortOrder: 'desc'
})
```

### 4. 同步优化

```typescript
// 批量同步比单个同步更高效
await Promise.all([
  syncManager.syncNote(note1, 'update'),
  syncManager.syncNote(note2, 'update'),
  syncManager.syncNote(note3, 'update')
])
```

## 最佳实践

### 1. 始终使用缓存包装器

```typescript
// 创建一个包装函数来处理缓存和网络
async function getNote(id: number): Promise<Note | null> {
  // 先从缓存获取
  const cached = await cache.getNote(id)
  if (cached) {
    return cached
  }

  // 从网络获取
  const response = await fetch(`/api/notes/${id}`)
  const note = await response.json()

  // 写入缓存
  if (note) {
    await cache.setNote(note)
  }

  return note
}
```

### 2. 处理冲突

```typescript
// 提供冲突解决UI
async function handleConflict(conflict: Conflict) {
  // 显示冲突对话框
  const resolution = await showConflictDialog({
    localVersion: conflict.localVersion,
    remoteVersion: conflict.remoteVersion
  })

  // 应用用户的选择
  await syncManager.resolveConflict(conflict.id, resolution)
}
```

### 3. 监听同步状态

```typescript
// 在UI中显示同步状态
function renderSyncStatus(status: SyncStatus) {
  return `
    <div class="sync-status">
      <span class="connection ${status.connectionStatus}">
        ${status.connectionStatus === 'connected' ? '在线' : '离线'}
      </span>
      ${status.isSyncing ? '<span class="syncing">同步中...</span>' : ''}
      ${status.pendingItems > 0 ? `<span class="pending">待同步: ${status.pendingItems}</span>` : ''}
      ${status.conflictItems > 0 ? `<span class="conflict">冲突: ${status.conflictItems}</span>` : ''}
    </div>
  `
}
```

## 文件结构

```
src/cache/
├── CacheAPI.ts          # 缓存接口定义
├── HybridCache.ts       # 混合缓存实现
├── SyncManager.ts       # 同步管理器实现
├── types.ts            # 类型定义
├── index.ts            # 统一导出
└── README.md           # 使用文档
```

## 总结

T3项目的前端缓存系统采用三级缓存架构，结合了IndexedDB、localStorage和内存缓存的优势，提供了：

1. **高性能**: 内存缓存提供毫秒级访问
2. **大容量**: IndexedDB支持大量数据存储
3. **持久化**: 所有数据持久化到本地
4. **离线支持**: 完整的离线操作能力
5. **自动同步**: 智能的数据同步机制
6. **冲突解决**: 灵活的冲突检测与解决策略
7. **事件系统**: 完善的事件通知机制
8. **类型安全**: 完整的TypeScript类型定义

通过这个缓存系统，T3项目能够提供出色的用户体验，即使在网络不稳定的情况下也能保证数据的完整性和一致性。
