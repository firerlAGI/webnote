# T3项目前端缓存API接口文档

## 概述

T3项目的前端缓存API提供了一套完整的三层缓存系统（Memory、IndexedDB、localStorage），支持数据的高效存储、查询和同步。本文档详细描述了所有缓存接口的方法签名、参数说明、返回值类型和使用示例。

## 目录

1. [基础操作](#基础操作)
2. [批量操作](#批量操作)
3. [查询操作](#查询操作)
4. [同步队列操作](#同步队列操作)
5. [同步状态操作](#同步状态操作)
6. [数据差异操作](#数据差异操作)
7. [类型定义](#类型定义)
8. [缓存架构](#缓存架构)

---

## 基础操作

### get

获取缓存数据。

**方法签名:**
```typescript
async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 缓存键 |
| options | CacheOptions | 否 | 缓存选项 |

**返回值:**
`Promise<CacheData<T> | null>` - 缓存数据，如果不存在或已过期则返回null

**使用示例:**
```typescript
const cache = new HybridCache(config)

const note = await cache.get<Note>('note:123')
if (note) {
  console.log('笔记数据:', note.data)
  console.log('版本:', note.version)
}
```

### set

设置缓存数据。

**方法签名:**
```typescript
async set<T>(key: string, data: T, options?: CacheOptions): Promise<void>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 缓存键 |
| data | T | 是 | 要缓存的数据 |
| options | CacheOptions | 否 | 缓存选项 |

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
await cache.set('note:123', {
  id: 123,
  title: '新笔记',
  content: '笔记内容'
}, {
  ttl: 3600000, // 1小时过期
  tags: ['note', 'personal']
})
```

### delete

删除缓存数据。

**方法签名:**
```typescript
async delete(key: string): Promise<boolean>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 缓存键 |

**返回值:**
`Promise<boolean>` - 删除是否成功

**使用示例:**
```typescript
const deleted = await cache.delete('note:123')
if (deleted) {
  console.log('删除成功')
}
```

### clear

清空所有缓存数据。

**方法签名:**
```typescript
async clear(): Promise<void>
```

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
await cache.clear()
console.log('缓存已清空')
```

### has

检查缓存是否存在且未过期。

**方法签名:**
```typescript
async has(key: string): Promise<boolean>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 缓存键 |

**返回值:**
`Promise<boolean>` - 缓存是否存在

**使用示例:**
```typescript
const exists = await cache.has('note:123')
if (exists) {
  console.log('笔记在缓存中')
}
```

### size

获取缓存项数量。

**方法签名:**
```typescript
async size(): Promise<number>
```

**返回值:**
`Promise<number>` - 缓存项数量

**使用示例:**
```typescript
const count = await cache.size()
console.log(`缓存中有 ${count} 项`)
```

---

## 批量操作

### mget

批量获取缓存数据。

**方法签名:**
```typescript
async mget<T>(keys: string[], options?: CacheOptions): Promise<Map<string, CacheData<T> | null>>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keys | string[] | 是 | 缓存键数组 |
| options | CacheOptions | 否 | 缓存选项 |

**返回值:**
`Promise<Map<string, CacheData<T> | null>>` - 键值对映射

**使用示例:**
```typescript
const results = await cache.mget<Note>(['note:1', 'note:2', 'note:3'])
results.forEach((data, key) => {
  if (data) {
    console.log(`${key}:`, data.data)
  }
})
```

### mset

批量设置缓存数据。

**方法签名:**
```typescript
async mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entries | Map<string, T> | 是 | 键值对映射 |
| options | CacheOptions | 否 | 缓存选项 |

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
const entries = new Map([
  ['note:1', { id: 1, title: '笔记1' }],
  ['note:2', { id: 2, title: '笔记2' }]
])
await cache.mset(entries)
```

### mdelete

批量删除缓存数据。

**方法签名:**
```typescript
async mdelete(keys: string[]): Promise<number>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keys | string[] | 是 | 缓存键数组 |

**返回值:**
`Promise<number>` - 成功删除的数量

**使用示例:**
```typescript
const deleted = await cache.mdelete(['note:1', 'note:2', 'note:3'])
console.log(`删除了 ${deleted} 项`)
```

### keys

获取所有缓存键。

**方法签名:**
```typescript
async keys(pattern?: string): Promise<string[]>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pattern | string | 否 | 键匹配模式（glob风格） |

**返回值:**
`Promise<string[]>` - 缓存键数组

**使用示例:**
```typescript
const allKeys = await cache.keys()
const noteKeys = await cache.keys('note:*')
console.log('所有笔记键:', noteKeys)
```

---

## 查询操作

### query

查询缓存数据。

**方法签名:**
```typescript
async query<T>(options: QueryOptions): Promise<CacheData<T>[]>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| options | QueryOptions | 是 | 查询选项 |

**返回值:**
`Promise<CacheData<T>[]>` - 匹配的缓存数据数组

**使用示例:**
```typescript
const results = await cache.query<Note>({
  tags: ['note'],
  startTime: Date.now() - 86400000, // 最近24小时
  limit: 10
})
```

### queryByTags

按标签查询缓存数据。

**方法签名:**
```typescript
async queryByTags<T>(tags: string[], options?: QueryOptions): Promise<CacheData<T>[]>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tags | string[] | 是 | 标签数组 |
| options | QueryOptions | 否 | 额外查询选项 |

**返回值:**
`Promise<CacheData<T>[]>` - 匹配的缓存数据数组

**使用示例:**
```typescript
const notes = await cache.queryByTags<Note>(['note', 'important'], {
  limit: 5
})
```

### queryByTimeRange

按时间范围查询缓存数据。

**方法签名:**
```typescript
async queryByTimeRange<T>(startTime: number, endTime: number, options?: QueryOptions): Promise<CacheData<T>[]>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | number | 是 | 开始时间戳 |
| endTime | number | 是 | 结束时间戳 |
| options | QueryOptions | 否 | 额外查询选项 |

**返回值:**
`Promise<CacheData<T>[]>` - 匹配的缓存数据数组

**使用示例:**
```typescript
const yesterday = Date.now() - 86400000
const today = Date.now()
const notes = await cache.queryByTimeRange<Note>(yesterday, today)
```

---

## 同步队列操作

### getSyncQueue

获取同步队列。

**方法签名:**
```typescript
async getSyncQueue(): Promise<SyncQueueItem[]>
```

**返回值:**
`Promise<SyncQueueItem[]>` - 同步队列项数组

**使用示例:**
```typescript
const queue = await cache.getSyncQueue()
console.log(`待同步项: ${queue.length}`)
```

### addToSyncQueue

添加项到同步队列。

**方法签名:**
```typescript
async addToSyncQueue(item: SyncQueueItem): Promise<void>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| item | SyncQueueItem | 是 | 同步队列项 |

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
await cache.addToSyncQueue({
  operationId: 'op_001',
  operationType: 'create',
  entityType: 'note',
  data: { id: 123, title: '新笔记' },
  timestamp: Date.now()
})
```

### updateSyncQueue

更新同步队列项。

**方法签名:**
```typescript
async updateSyncQueue(operationId: string, updates: Partial<SyncQueueItem>): Promise<boolean>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operationId | string | 是 | 操作ID |
| updates | Partial<SyncQueueItem> | 是 | 更新内容 |

**返回值:**
`Promise<boolean>` - 更新是否成功

**使用示例:**
```typescript
const updated = await cache.updateSyncQueue('op_001', {
  status: 'synced',
  syncedAt: Date.now()
})
```

### removeFromSyncQueue

从同步队列移除项。

**方法签名:**
```typescript
async removeFromSyncQueue(operationId: string): Promise<boolean>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operationId | string | 是 | 操作ID |

**返回值:**
`Promise<boolean>` - 移除是否成功

**使用示例:**
```typescript
const removed = await cache.removeFromSyncQueue('op_001')
if (removed) {
  console.log('已从队列移除')
}
```

### clearSyncQueue

清空同步队列。

**方法签名:**
```typescript
async clearSyncQueue(): Promise<void>
```

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
await cache.clearSyncQueue()
console.log('同步队列已清空')
```

---

## 同步状态操作

### getSyncStatus

获取同步状态。

**方法签名:**
```typescript
async getSyncStatus(): Promise<SyncStatus>
```

**返回值:**
`Promise<SyncStatus>` - 同步状态对象

**使用示例:**
```typescript
const status = await cache.getSyncStatus()
console.log(`上次同步: ${new Date(status.lastSyncTime).toLocaleString()}`)
console.log(`同步中: ${status.isSyncing}`)
console.log(`待同步: ${status.pendingItems}`)
```

### updateSyncStatus

更新同步状态。

**方法签名:**
```typescript
async updateSyncStatus(updates: Partial<SyncStatus>): Promise<void>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| updates | Partial<SyncStatus> | 是 | 状态更新内容 |

**返回值:**
`Promise<void>`

**使用示例:**
```typescript
await cache.updateSyncStatus({
  isSyncing: true,
  lastSyncTime: Date.now()
})
```

### getConflictItems

获取冲突项列表。

**方法签名:**
```typescript
async getConflictItems(): Promise<Conflict[]>
```

**返回值:**
`Promise<Conflict[]>` - 冲突项数组

**使用示例:**
```typescript
const conflicts = await cache.getConflictItems()
conflicts.forEach(conflict => {
  console.log(`冲突: ${conflict.entityType}:${conflict.entityId}`)
  console.log(`类型: ${conflict.conflictType}`)
})
```

### updateConflictStatus

更新冲突状态。

**方法签名:**
```typescript
async updateConflictStatus(conflictId: string, status: ConflictStatus): Promise<boolean>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conflictId | string | 是 | 冲突ID |
| status | ConflictStatus | 是 | 冲突状态 |

**返回值:**
`Promise<boolean>` - 更新是否成功

**使用示例:**
```typescript
const updated = await cache.updateConflictStatus('conflict_001', 'resolved')
if (updated) {
  console.log('冲突已标记为已解决')
}
```

---

## 数据差异操作

### computeDiff

计算数据差异。

**方法签名:**
```typescript
async computeDiff(localData: any, remoteData: any): Promise<DataDiff>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| localData | any | 是 | 本地数据 |
| remoteData | any | 是 | 远程数据 |

**返回值:**
`Promise<DataDiff>` - 数据差异对象

**使用示例:**
```typescript
const localNote = { id: 123, title: '本地标题', content: '本地内容' }
const remoteNote = { id: 123, title: '远程标题', content: '本地内容' }

const diff = await cache.computeDiff(localNote, remoteNote)
console.log('差异字段:', diff.fieldDiffs)
console.log('有冲突:', diff.hasConflict)
```

### applyDiff

应用数据差异。

**方法签名:**
```typescript
async applyDiff<T>(baseData: T, diff: DataDiff): Promise<T>
```

**参数说明:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| baseData | T | 是 | 基础数据 |
| diff | DataDiff | 是 | 数据差异 |

**返回值:**
`Promise<T>` - 合并后的数据

**使用示例:**
```typescript
const baseNote = { id: 123, title: '原标题', content: '原内容' }
const diff = await cache.computeDiff(localNote, remoteNote)

const merged = await cache.applyDiff(baseNote, diff)
console.log('合并后:', merged)
```

---

## 类型定义

### CacheOptions

```typescript
interface CacheOptions {
  ttl?: number;           // 过期时间（毫秒）
  tags?: string[];        // 标签
  version?: number;       // 版本号
  metadata?: Record<string, any>; // 元数据
}
```

### CacheData

```typescript
interface CacheData<T> {
  data: T;              // 数据内容
  key: string;          // 缓存键
  timestamp: number;     // 时间戳
  expiresAt?: number;   // 过期时间
  version?: number;      // 版本号
  tags?: string[];       // 标签
  metadata?: Record<string, any>; // 元数据
}
```

### QueryOptions

```typescript
interface QueryOptions {
  tags?: string[];      // 标签过滤
  startTime?: number;    // 开始时间
  endTime?: number;      // 结束时间
  limit?: number;        // 数量限制
  offset?: number;      // 偏移量
  sort?: 'asc' | 'desc'; // 排序方向
}
```

### SyncQueueItem

```typescript
interface SyncQueueItem {
  operationId: string;        // 操作ID
  operationType: 'create' | 'update' | 'delete' | 'read'; // 操作类型
  entityType: string;          // 实体类型
  entityId?: string | number;  // 实体ID
  data: any;                 // 操作数据
  status: 'pending' | 'syncing' | 'synced' | 'failed'; // 状态
  retryCount?: number;        // 重试次数
  createdAt: number;          // 创建时间
  syncedAt?: number;         // 同步时间
  error?: Error;             // 错误信息
}
```

### SyncStatus

```typescript
interface SyncStatus {
  lastSyncTime: number;           // 上次同步时间
  isSyncing: boolean;            // 是否同步中
  pendingItems: number;           // 待同步项数
  failedItems: number;           // 失败项数
  conflictItems: number;          // 冲突项数
  syncMode: 'realtime' | 'offline' | 'polling'; // 同步模式
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'; // 连接状态
}
```

### Conflict

```typescript
interface Conflict {
  conflictId: string;            // 冲突ID
  conflictType: ConflictType;     // 冲突类型
  entityType: string;             // 实体类型
  entityId: string | number;      // 实体ID
  localData: any;                // 本地数据
  remoteData: any;               // 远程数据
  conflictFields: string[];       // 冲突字段
  timestamp: number;             // 冲突时间
  status: ConflictStatus;         // 冲突状态
}

type ConflictType = 'content' | 'version' | 'delete' | 'parent' | 'unique';
type ConflictStatus = 'pending' | 'resolved' | 'ignored';
```

### DataDiff

```typescript
interface DataDiff {
  hasConflict: boolean;          // 是否有冲突
  fieldDiffs: FieldDiff[];      // 字段差异
}

interface FieldDiff {
  field: string;                // 字段名
  localValue: any;              // 本地值
  remoteValue: any;             // 远程值
  diffType: 'same' | 'modified' | 'added' | 'deleted' | 'conflict'; // 差异类型
}
```

---

## 缓存架构

### 三层缓存结构

T3项目采用三层缓存架构，各层职责如下：

#### L1: Memory Cache（内存缓存）
- **特点**: 最快访问速度，容量有限
- **容量**: 默认100项，可配置
- **淘汰策略**: LRU（最近最少使用）
- **持久化**: 不持久化，页面刷新后丢失
- **适用场景**: 频繁访问的热点数据

#### L2: IndexedDB Cache（浏览器数据库）
- **特点**: 较快访问速度，容量较大，异步API
- **容量**: 取决于浏览器配额（通常50MB-500MB）
- **持久化**: 持久化存储
- **适用场景**: 需要跨会话保持的数据

#### L3: localStorage Cache（本地存储）
- **特点**: 较慢访问速度，容量最小，同步API
- **容量**: 5-10MB
- **持久化**: 持久化存储
- **适用场景**: 元数据、配置信息

### 缓存写入策略

#### Write-Through（写穿透）
```typescript
async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
  // 同时写入所有层级
  await this.memoryCache.set(key, data, options);
  await this.indexedDBCache.set(key, data, options);
  
  if (this.isMetadataKey(key)) {
    await this.localStorageCache.set(key, data, options);
  }
}
```

#### Read-Through with Promotion（读穿透与缓存提升）
```typescript
async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null> {
  // L1: 检查内存缓存
  let item = await this.memoryCache.get<T>(key, options);
  if (item) {
    this.emit({ type: 'get', key, data: item.data, timestamp: Date.now() });
    return item;
  }
  
  // L2: 检查IndexedDB缓存
  item = await this.indexedDBCache.get<T>(key, options);
  if (item) {
    // 提升到L1缓存
    await this.memoryCache.set(key, item.data, { ttl: this.config.memory.defaultTTL });
    return item;
  }
  
  // L3: 检查localStorage（仅元数据）
  if (this.isMetadataKey(key)) {
    item = await this.localStorageCache.get<T>(key, options);
    if (item) {
      await this.memoryCache.set(key, item.data, { ttl: this.config.memory.defaultTTL });
      return item;
    }
  }
  
  return null;
}
```

### LRU淘汰机制

```typescript
class MemoryCache {
  private cache: Map<string, CacheData<any>>;
  private capacity: number;
  
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    if (this.cache.size >= this.capacity) {
      // 淘汰最久未使用的项
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      key,
      timestamp: Date.now(),
      expiresAt: options?.ttl ? Date.now() + options.ttl : undefined
    });
  }
}
```

### 跨层级一致性保障

```typescript
async delete(key: string): Promise<boolean> {
  // 同时删除所有层级
  const memoryDeleted = await this.memoryCache.delete(key);
  const indexedDBDeleted = await this.indexedDBCache.delete(key);
  
  let localStorageDeleted = true;
  if (this.isMetadataKey(key)) {
    localStorageDeleted = await this.localStorageCache.delete(key);
  }
  
  // 返回删除状态
  return memoryDeleted || indexedDBDeleted || localStorageDeleted;
}
```

### 事件系统

缓存系统支持事件监听，可用于实时更新UI：

```typescript
cache.on('get', (event) => {
  console.log('缓存读取:', event.key);
});

cache.on('set', (event) => {
  console.log('缓存写入:', event.key);
});

cache.on('delete', (event) => {
  console.log('缓存删除:', event.key);
});

cache.on('sync', (event) => {
  console.log('数据同步:', event.type);
});
```

### 缓存配置

```typescript
interface HybridCacheConfig {
  memory: {
    capacity: number;        // 容量（默认100）
    defaultTTL: number;     // 默认TTL（默认5分钟）
  };
  indexedDB: {
    dbName: string;         // 数据库名
    storeName: string;      // 存储名称
    version: number;        // 版本号
  };
  localStorage: {
    prefix: string;        // 键前缀
  };
  writeStrategy: 'write-through' | 'write-back'; // 写策略
}

const defaultConfig: HybridCacheConfig = {
  memory: {
    capacity: 100,
    defaultTTL: 300000 // 5分钟
  },
  indexedDB: {
    dbName: 'webnote-cache',
    storeName: 'cache',
    version: 1
  },
  localStorage: {
    prefix: 'cache:'
  },
  writeStrategy: 'write-through'
};
```

---

## 使用示例

### 基础使用

```typescript
import { HybridCache } from '@/cache/HybridCache';

const cache = new HybridCache();

// 设置数据
await cache.set('user:123', {
  id: 123,
  name: '张三',
  email: 'zhangsan@example.com'
}, {
  ttl: 3600000, // 1小时
  tags: ['user']
});

// 获取数据
const user = await cache.get('user:123');
console.log(user);

// 删除数据
await cache.delete('user:123');
```

### 批量操作

```typescript
// 批量设置
const entries = new Map([
  ['note:1', { id: 1, title: '笔记1' }],
  ['note:2', { id: 2, title: '笔记2' }],
  ['note:3', { id: 3, title: '笔记3' }]
]);
await cache.mset(entries);

// 批量获取
const results = await cache.mget(['note:1', 'note:2', 'note:3']);

// 批量删除
await cache.mdelete(['note:1', 'note:2']);
```

### 查询操作

```typescript
// 按标签查询
const notes = await cache.queryByTags<Note>(['note', 'important']);

// 按时间范围查询
const yesterday = Date.now() - 86400000;
const today = Date.now();
const recentNotes = await cache.queryByTimeRange<Note>(yesterday, today);

// 复杂查询
const results = await cache.query<Note>({
  tags: ['note'],
  startTime: Date.now() - 86400000,
  limit: 10,
  sort: 'desc'
});
```

### 同步队列管理

```typescript
// 添加到同步队列
await cache.addToSyncQueue({
  operationId: 'op_001',
  operationType: 'create',
  entityType: 'note',
  data: { id: 123, title: '新笔记' },
  timestamp: Date.now()
});

// 获取同步队列
const queue = await cache.getSyncQueue();
console.log(`待同步: ${queue.filter(q => q.status === 'pending').length} 项`);

// 更新队列项状态
await cache.updateSyncQueue('op_001', {
  status: 'synced',
  syncedAt: Date.now()
});

// 清空已同步项
for (const item of queue) {
  if (item.status === 'synced') {
    await cache.removeFromSyncQueue(item.operationId);
  }
}
```

### 同步状态监控

```typescript
// 获取同步状态
const status = await cache.getSyncStatus();

// 监听状态变化
cache.on('status_changed', (event) => {
  console.log('同步状态变化:', event.data);
  updateUI(event.data);
});

// 更新同步状态
await cache.updateSyncStatus({
  isSyncing: true,
  pendingItems: queue.length
});
```

### 冲突处理

```typescript
// 获取冲突项
const conflicts = await cache.getConflictItems();

// 处理冲突
for (const conflict of conflicts) {
  console.log(`冲突: ${conflict.entityType}:${conflict.entityId}`);
  console.log(`冲突字段: ${conflict.conflictFields.join(', ')}`);
  
  // 计算差异
  const diff = await cache.computeDiff(conflict.localData, conflict.remoteData);
  console.log('差异:', diff.fieldDiffs);
  
  // 更新冲突状态
  await cache.updateConflictStatus(conflict.conflictId, 'resolved');
}
```

---

## 注意事项

1. **TTL过期**: 缓存数据会在TTL到期后自动失效，访问过期数据会返回null
2. **容量限制**: Memory Cache有容量限制，超出容量时会自动淘汰最久未使用的数据
3. **异步操作**: 所有缓存操作都是异步的，需要使用await
4. **错误处理**: 建议使用try-catch处理可能的错误
5. **键命名**: 建议使用冒号分隔的层级命名，如`note:123`、`user:456`
6. **类型安全**: 使用泛型确保类型安全，如`cache.get<Note>('note:123')`
7. **事件清理**: 不再需要监听事件时，使用`cache.off()`移除监听器

---

## 版本历史

- **v1.0.0** (2024-01-10): 初始版本，支持基础缓存操作和同步功能
