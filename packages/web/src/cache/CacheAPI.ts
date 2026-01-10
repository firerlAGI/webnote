/**
 * 缓存API接口定义
 * 定义统一的缓存操作接口，支持基础操作、批量操作、查询操作
 */

import {
  CacheData,
  CacheOptions,
  QueryOptions,
  BatchResult,
  CacheEvent,
  CacheEventListener,
} from './types'
import { Note, Folder, Review } from '@webnote/shared/types'

// ============================================================================
// 基础缓存接口
// ============================================================================

/**
 * 基础缓存接口
 * 定义所有缓存实现必须实现的基本操作
 */
export interface ICache {
  /**
   * 获取缓存数据
   * @param key 缓存键
   * @param options 缓存选项
   * @returns 缓存数据或null
   */
  get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null>

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 数据
   * @param options 缓存选项
   */
  set<T>(key: string, data: T, options?: CacheOptions): Promise<void>

  /**
   * 删除缓存数据
   * @param key 缓存键
   */
  delete(key: string): Promise<void>

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   */
  has(key: string): Promise<boolean>

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>

  /**
   * 获取缓存大小（字节）
   */
  getSize(): Promise<number>

  /**
   * 获取缓存项目数量
   */
  getCount(): Promise<number>

  /**
   * 清理过期缓存
   */
  cleanupExpired(): Promise<number>

  /**
   * 清理最久未使用的缓存（LRU）
   * @param bytes 需要清理的字节数
   */
  cleanupLRU(bytes: number): Promise<number>
}

// ============================================================================
// 批量操作接口
// ============================================================================

/**
 * 批量操作接口
 * 定义批量缓存操作
 */
export interface IBatchCache extends ICache {
  /**
   * 批量获取缓存数据
   * @param keys 缓存键数组
   * @param options 缓存选项
   * @returns 缓存数据映射
   */
  getMany<T>(keys: string[], options?: CacheOptions): Promise<Map<string, CacheData<T> | null>>

  /**
   * 批量设置缓存数据
   * @param entries 键值对数组
   * @param options 缓存选项
   */
  setMany<T>(entries: Array<{ key: string; data: T }>, options?: CacheOptions): Promise<BatchResult>

  /**
   * 批量删除缓存数据
   * @param keys 缓存键数组
   */
  deleteMany(keys: string[]): Promise<BatchResult>

  /**
   * 获取所有缓存键
   * @param prefix 键前缀（可选）
   */
  keys(prefix?: string): Promise<string[]>
}

// ============================================================================
// 查询操作接口
// ============================================================================

/**
 * 查询操作接口
 * 定义基于查询条件的缓存操作
 */
export interface IQueryCache extends IBatchCache {
  /**
   * 查询缓存数据
   * @param prefix 键前缀
   * @param options 查询选项
   * @returns 查询结果
   */
  query<T>(prefix: string, options?: QueryOptions): Promise<T[]>

  /**
   * 查找匹配的缓存键
   * @param pattern 键模式（支持通配符）
   */
  findKeys(pattern: string): Promise<string[]>

  /**
   * 获取缓存统计信息
   */
  getStats(): Promise<CacheStats>

  /**
   * 导出缓存数据
   */
  export(): Promise<Record<string, CacheData<any>>>

  /**
   * 导入缓存数据
   * @param data 缓存数据
   */
  import(data: Record<string, CacheData<any>>): Promise<BatchResult>
}

// ============================================================================
// 事件系统接口
// ============================================================================

/**
 * 事件系统接口
 * 定义缓存事件监听和触发
 */
export interface IEventCache extends IQueryCache {
  /**
   * 添加事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   */
  on(event: CacheEventType, listener: CacheEventListener): void

  /**
   * 移除事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   */
  off(event: CacheEventType, listener: CacheEventListener): void

  /**
   * 触发事件
   * @param event 缓存事件
   */
  emit(event: CacheEvent): void

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void
}

// ============================================================================
// 实体缓存接口
// ============================================================================

/**
 * 实体缓存接口
 * 定义针对业务实体的专用缓存操作
 */
export interface IEntityCache extends IEventCache {
  /**
   * 获取笔记
   * @param id 笔记ID
   */
  getNote(id: number): Promise<Note | null>

  /**
   * 设置笔记
   * @param note 笔记数据
   */
  setNote(note: Note): Promise<void>

  /**
   * 删除笔记
   * @param id 笔记ID
   */
  deleteNote(id: number): Promise<void>

  /**
   * 获取用户的所有笔记
   * @param userId 用户ID
   */
  getNotes(userId: number): Promise<Note[]>

  /**
   * 获取文件夹下的笔记
   * @param folderId 文件夹ID
   */
  getNotesByFolder(folderId: number): Promise<Note[]>

  /**
   * 获取置顶笔记
   * @param userId 用户ID
   */
  getPinnedNotes(userId: number): Promise<Note[]>

  /**
   * 获取文件夹
   * @param id 文件夹ID
   */
  getFolder(id: number): Promise<Folder | null>

  /**
   * 设置文件夹
   * @param folder 文件夹数据
   */
  setFolder(folder: Folder): Promise<void>

  /**
   * 删除文件夹
   * @param id 文件夹ID
   */
  deleteFolder(id: number): Promise<void>

  /**
   * 获取用户的所有文件夹
   * @param userId 用户ID
   */
  getFolders(userId: number): Promise<Folder[]>

  /**
   * 获取复盘记录
   * @param id 复盘ID
   */
  getReview(id: number): Promise<Review | null>

  /**
   * 设置复盘记录
   * @param review 复盘数据
   */
  setReview(review: Review): Promise<void>

  /**
   * 删除复盘记录
   * @param id 复盘ID
   */
  deleteReview(id: number): Promise<void>

  /**
   * 获取用户的所有复盘记录
   * @param userId 用户ID
   */
  getReviews(userId: number): Promise<Review[]>

  /**
   * 按日期获取复盘记录
   * @param date 日期字符串
   */
  getReviewsByDate(date: string): Promise<Review[]>
}

// ============================================================================
// 缓存统计信息
// ============================================================================

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存键数量 */
  count: number
  /** 缓存大小（字节） */
  size: number
  /** 命中次数 */
  hits: number
  /** 未命中次数 */
  misses: number
  /** 命中率 */
  hitRate: number
  /** 过期项目数量 */
  expired: number
  /** 内存使用率 */
  memoryUsage: number
  /** 最大内存 */
  maxMemory: number
}

// ============================================================================
// 同步缓存接口
// ============================================================================

/**
 * 同步缓存接口
 * 定义支持同步操作的缓存
 */
export interface ISyncCache extends IEntityCache {
  /**
   * 获取缓存版本
   * @param key 缓存键
   */
  getVersion(key: string): Promise<number | null>

  /**
   * 获取缓存哈希
   * @param key 缓存键
   */
  getHash(key: string): Promise<string | null>

  /**
   * 检查缓存是否过期
   * @param key 缓存键
   */
  isExpired(key: string): Promise<boolean>

  /**
   * 刷新缓存过期时间
   * @param key 缓存键
   * @param ttl 新的TTL（毫秒）
   */
  refresh(key: string, ttl?: number): Promise<void>

  /**
   * 批量刷新缓存过期时间
   * @param keys 缓存键数组
   * @param ttl 新的TTL（毫秒）
   */
  refreshMany(keys: string[], ttl?: number): Promise<void>

  /**
   * 获取最后访问时间
   * @param key 缓存键
   */
  getLastAccessed(key: string): Promise<number | null>

  /**
   * 更新最后访问时间
   * @param key 缓存键
   */
  updateLastAccessed(key: string): Promise<void>
}

// ============================================================================
// 缓存接口联合类型
// ============================================================================

/**
 * 完整缓存接口
 * 包含所有缓存功能
 */
export type IFullCache = ISyncCache

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

// ============================================================================
// 缓存工厂接口
// ============================================================================

/**
 * 缓存工厂接口
 * 用于创建不同类型的缓存实例
 */
export interface ICacheFactory {
  /**
   * 创建内存缓存实例
   */
  createMemoryCache(): ICache

  /**
   * 创建IndexedDB缓存实例
   */
  createIndexedDBCache(): Promise<IQueryCache>

  /**
   * 创建localStorage缓存实例
   */
  createLocalStorageCache(): ICache

  /**
   * 创建混合缓存实例
   */
  createHybridCache(): Promise<IFullCache>
}

// ============================================================================
// 缓存适配器接口
// ============================================================================

/**
 * 缓存适配器接口
 * 用于将不同的存储后端适配为统一接口
 */
export interface ICacheAdapter {
  /**
   * 初始化适配器
   */
  initialize(): Promise<void>

  /**
   * 关闭适配器
   */
  close(): Promise<void>

  /**
   * 检查适配器是否可用
   */
  isAvailable(): boolean

  /**
   * 获取适配器信息
   */
  getInfo(): CacheAdapterInfo
}

/**
 * 缓存适配器信息
 */
export interface CacheAdapterInfo {
  /** 适配器名称 */
  name: string
  /** 适配器版本 */
  version: string
  /** 支持的功能 */
  features: string[]
  /** 最大容量 */
  maxSize: number
  /** 是否支持持久化 */
  isPersistent: boolean
}

// ============================================================================
// 缓存管理器接口
// ============================================================================

/**
 * 缓存管理器接口
 * 用于管理多个缓存实例
 */
export interface ICacheManager {
  /**
   * 注册缓存实例
   * @param name 缓存名称
   * @param cache 缓存实例
   */
  register(name: string, cache: ICache): void

  /**
   * 获取缓存实例
   * @param name 缓存名称
   */
  get(name: string): ICache | undefined

  /**
   * 注销缓存实例
   * @param name 缓存名称
   */
  unregister(name: string): void

  /**
   * 获取所有缓存实例名称
   */
  getCacheNames(): string[]

  /**
   * 清空所有缓存实例
   */
  clearAll(): Promise<void>

  /**
   * 获取全局统计信息
   */
  getGlobalStats(): Promise<GlobalCacheStats>
}

/**
 * 全局缓存统计信息
 */
export interface GlobalCacheStats {
  /** 缓存实例数量 */
  cacheCount: number
  /** 总项目数 */
  totalCount: number
  /** 总大小（字节） */
  totalSize: number
  /** 总命中次数 */
  totalHits: number
  /** 总未命中次数 */
  totalMisses: number
  /** 总命中率 */
  totalHitRate: number
  /** 各缓存统计 */
  cacheStats: Record<string, CacheStats>
}

// ============================================================================
// 离线缓存接口
// ============================================================================

/**
 * 离线缓存接口
 * 定义离线场景下的缓存操作
 */
export interface IOfflineCache extends ISyncCache {
  /**
   * 标记数据为离线数据
   * @param key 缓存键
   */
  markOffline(key: string): Promise<void>

  /**
   * 取消离线标记
   * @param key 缓存键
   */
  unmarkOffline(key: string): Promise<void>

  /**
   * 检查是否为离线数据
   * @param key 缓存键
   */
  isOffline(key: string): Promise<boolean>

  /**
   * 获取所有离线数据
   */
  getOfflineData(): Promise<Map<string, CacheData<any>>>

  /**
   * 同步离线数据到服务器
   */
  syncOfflineData(): Promise<BatchResult>

  /**
   * 清除离线标记
   */
  clearOfflineMarks(): Promise<void>
}

// ============================================================================
// 缓存钩子接口
// ============================================================================

/**
 * 缓存钩子接口
 * 定义缓存操作的钩子函数
 */
export interface ICacheHooks {
  /**
   * 获取前钩子
   */
  beforeGet?(key: string, options?: CacheOptions): void | Promise<void>

  /**
   * 获取后钩子
   */
  afterGet?<T>(key: string, data: CacheData<T> | null, options?: CacheOptions): void | Promise<void>

  /**
   * 设置前钩子
   */
  beforeSet?<T>(key: string, data: T, options?: CacheOptions): void | Promise<void>

  /**
   * 设置后钩子
   */
  afterSet?<T>(key: string, data: T, options?: CacheOptions): void | Promise<void>

  /**
   * 删除前钩子
   */
  beforeDelete?(key: string): void | Promise<void>

  /**
   * 删除后钩子
   */
  afterDelete?(key: string): void | Promise<void>

  /**
   * 错误钩子
   */
  onError?(error: Error, operation: string, key?: string): void | Promise<void>
}

/**
 * 可钩子化的缓存接口
 */
export interface IHookableCache extends IFullCache {
  /**
   * 添加钩子
   * @param hooks 钩子对象
   */
  addHooks(hooks: ICacheHooks): void

  /**
   * 移除钩子
   */
  removeHooks(): void
}
