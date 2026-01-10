/**
 * 缓存系统类型定义
 * 基于T3批次2会议产出物中的前端缓存方案设计
 */

import { Note, Folder, Review } from '@webnote/shared/types'

// ============================================================================
// 缓存键定义
// ============================================================================

/**
 * 缓存键常量
 */
export const CacheKeys = {
  USER: 'user',
  USER_SETTINGS: 'user:settings',
  NOTES: 'notes',
  NOTE: (id: number) => `note:${id}`,
  NOTES_BY_FOLDER: (folderId: number) => `folder:${folderId}:notes`,
  PINNED_NOTES: 'notes:pinned',
  FOLDERS: 'folders',
  FOLDER: (id: number) => `folder:${id}`,
  REVIEWS: 'reviews',
  REVIEW: (id: number) => `review:${id}`,
  REVIEWS_BY_DATE: (date: string) => `reviews:date:${date}`,
  SYNC_QUEUE: 'sync:queue',
  SYNC_STATUS: 'sync:status',
  SYNC_CONFLICTS: 'sync:conflicts',
  OFFLINE_EDITS: 'offline:edits',
  OFFLINE_CHANGES: 'offline:changes',
  CACHE_VERSION: 'cache:version',
} as const

// ============================================================================
// 缓存数据结构
// ============================================================================

/**
 * 带元数据的缓存数据
 */
export interface CacheData<T> {
  /** 实际数据 */
  data: T
  /** 缓存时间戳 */
  timestamp: number
  /** 数据版本号 */
  version: number
  /** 数据哈希值 */
  hash: string
  /** 过期时间（可选） */
  expiresAt?: number
  /** 是否为离线数据 */
  isOffline?: boolean
}

/**
 * 用户设置
 */
export interface UserSettings {
  theme: 'light' | 'dark' | 'auto'
  fontSize: 'small' | 'medium' | 'large'
  autoSave: boolean
  autoSaveInterval: number
  syncEnabled: boolean
  offlineMode: boolean
}

/**
 * 认证信息
 */
export interface AuthInfo {
  userId: number
  token: string
  deviceId: string
  expiresAt: number
}

/**
 * 同步队列项
 */
export interface SyncQueueItem {
  /** 唯一ID */
  id: string
  /** 操作类型 */
  type: 'create' | 'update' | 'delete'
  /** 实体类型 */
  entity: 'note' | 'folder' | 'review'
  /** 实体ID */
  entityId?: number
  /** 临时ID（客户端创建时使用） */
  tempId?: string
  /** 数据 */
  data: any
  /** 时间戳 */
  timestamp: number
  /** 重试次数 */
  retryCount: number
  /** 状态 */
  status: 'pending' | 'syncing' | 'failed' | 'resolved'
  /** 错误信息 */
  errorMessage?: string
  /** 操作前的版本号 */
  beforeVersion?: number
}

/**
 * 同步状态
 */
export interface SyncStatus {
  /** 上次同步时间 */
  lastSyncTime: number
  /** 是否正在同步 */
  isSyncing: boolean
  /** 待同步项数量 */
  pendingItems: number
  /** 失败项数量 */
  failedItems: number
  /** 冲突项数量 */
  conflictItems: number
  /** 同步模式 */
  syncMode: 'realtime' | 'offline' | 'polling'
  /** 连接状态 */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  /** 当前同步进度 */
  progress?: {
    current: number
    total: number
  }
}

/**
 * 冲突信息
 */
export interface Conflict {
  /** 冲突ID */
  id: string
  /** 实体类型 */
  type: 'note' | 'folder' | 'review'
  /** 实体ID */
  entityId: number
  /** 本地版本 */
  localVersion: any
  /** 远程版本 */
  remoteVersion: any
  /** 本地时间戳 */
  localTimestamp: number
  /** 远程时间戳 */
  remoteTimestamp: number
  /** 是否已解决 */
  resolved: boolean
  /** 解决方式 */
  resolution?: 'local' | 'remote' | 'merge'
  /** 冲突字段 */
  conflictFields?: string[]
}

// ============================================================================
// 缓存选项
// ============================================================================

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** TTL（毫秒），默认1小时 */
  ttl?: number
  /** 是否持久化到IndexedDB */
  persist?: boolean
  /** 是否需要哈希校验 */
  validateHash?: boolean
  /** 自定义哈希函数 */
  hashFunction?: (data: any) => string
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /** 过滤条件 */
  filter?: (item: any) => boolean
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
  /** 分页 */
  skip?: number
  take?: number
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  /** 成功数量 */
  success: number
  /** 失败数量 */
  failed: number
  /** 错误信息 */
  errors: Array<{
    key: string
    error: Error
  }>
}

// ============================================================================
// 缓存事件
// ============================================================================

/**
 * 缓存事件类型
 */
export type CacheEventType =
  | 'get'
  | 'set'
  | 'delete'
  | 'clear'
  | 'expired'
  | 'size_exceeded'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflict_detected'
  | 'conflict_resolved'

/**
 * 缓存事件
 */
export interface CacheEvent {
  /** 事件类型 */
  type: CacheEventType
  /** 键 */
  key?: string
  /** 数据 */
  data?: any
  /** 时间戳 */
  timestamp: number
  /** 错误信息 */
  error?: Error
}

/**
 * 事件监听器
 */
export type CacheEventListener = (event: CacheEvent) => void

// ============================================================================
// IndexedDB 数据库结构
// ============================================================================

/**
 * 数据库配置
 */
export const DB_CONFIG = {
  NAME: 'WebNoteCache',
  VERSION: 1,
} as const

/**
 * 对象存储名称
 */
export const STORE_NAMES = {
  NOTES: 'notes',
  FOLDERS: 'folders',
  REVIEWS: 'reviews',
  SYNC_QUEUE: 'syncQueue',
  CONFLICTS: 'conflicts',
  METADATA: 'metadata',
} as const

/**
 * 索引定义
 */
export interface IndexDefinition {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

/**
 * 对象存储定义
 */
export interface StoreDefinition {
  name: string
  keyPath: string
  options?: IDBObjectStoreParameters
  indexes: IndexDefinition[]
}

/**
 * 数据库结构定义
 */
export const DATABASE_SCHEMA: Record<string, StoreDefinition> = {
  [STORE_NAMES.NOTES]: {
    name: STORE_NAMES.NOTES,
    keyPath: 'id',
    options: { keyPath: 'id', autoIncrement: false },
    indexes: [
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'folder_id', keyPath: 'folder_id' },
      { name: 'updated_at', keyPath: 'updated_at' },
      { name: 'user_folder', keyPath: ['user_id', 'folder_id'], options: { unique: false } },
      { name: 'user_updated', keyPath: ['user_id', 'updated_at'], options: { unique: false } },
    ],
  },
  [STORE_NAMES.FOLDERS]: {
    name: STORE_NAMES.FOLDERS,
    keyPath: 'id',
    options: { keyPath: 'id', autoIncrement: false },
    indexes: [
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'updated_at', keyPath: 'updated_at' },
      { name: 'user_updated', keyPath: ['user_id', 'updated_at'], options: { unique: false } },
    ],
  },
  [STORE_NAMES.REVIEWS]: {
    name: STORE_NAMES.REVIEWS,
    keyPath: 'id',
    options: { keyPath: 'id', autoIncrement: false },
    indexes: [
      { name: 'user_id', keyPath: 'user_id' },
      { name: 'date', keyPath: 'date' },
      { name: 'user_date', keyPath: ['user_id', 'date'], options: { unique: false } },
      { name: 'user_updated', keyPath: ['user_id', 'updated_at'], options: { unique: false } },
    ],
  },
  [STORE_NAMES.SYNC_QUEUE]: {
    name: STORE_NAMES.SYNC_QUEUE,
    keyPath: 'id',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'entity', keyPath: 'entity' },
      { name: 'status_timestamp', keyPath: ['status', 'timestamp'], options: { unique: false } },
    ],
  },
  [STORE_NAMES.CONFLICTS]: {
    name: STORE_NAMES.CONFLICTS,
    keyPath: 'id',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      { name: 'resolved', keyPath: 'resolved' },
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'type', keyPath: 'type' },
    ],
  },
  [STORE_NAMES.METADATA]: {
    name: STORE_NAMES.METADATA,
    keyPath: 'key',
    options: { keyPath: 'key', autoIncrement: false },
    indexes: [],
  },
}

// ============================================================================
// 缓存配置
// ============================================================================

/**
 * 缓存层级配置
 */
export interface CacheLayerConfig {
  /** 是否启用 */
  enabled: boolean
  /** 最大容量（字节） */
  maxSize: number
  /** 最大项目数 */
  maxItems: number
  /** 默认TTL（毫秒） */
  defaultTTL: number
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** Memory缓存配置 */
  memory: CacheLayerConfig
  /** IndexedDB缓存配置 */
  indexedDB: CacheLayerConfig
  /** localStorage缓存配置 */
  localStorage: CacheLayerConfig
  /** 是否启用事件系统 */
  enableEvents: boolean
  /** 是否启用日志 */
  enableLogging: boolean
  /** 缓存版本 */
  version: string
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  memory: {
    enabled: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    maxItems: 1000,
    defaultTTL: 5 * 60 * 1000, // 5分钟
  },
  indexedDB: {
    enabled: true,
    maxSize: 500 * 1024 * 1024, // 500MB
    maxItems: 10000,
    defaultTTL: 60 * 60 * 1000, // 1小时
  },
  localStorage: {
    enabled: true,
    maxSize: 5 * 1024 * 1024, // 5MB
    maxItems: 100,
    defaultTTL: 24 * 60 * 60 * 1000, // 24小时
  },
  enableEvents: true,
  enableLogging: false,
  version: '1.0.0',
}

// ============================================================================
// 实用类型
// ============================================================================

/**
 * 缓存结果
 */
export type CacheResult<T> = {
  data: T
  fromCache: boolean
  source: 'memory' | 'indexedDB' | 'localStorage' | 'network'
}

/**
 * Promise化的IDBRequest
 */
export type IDBRequestPromise<T> = Promise<T>
