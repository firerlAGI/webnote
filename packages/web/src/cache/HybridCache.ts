/**
 * 混合缓存实现
 * 结合内存缓存、IndexedDB和localStorage的混合缓存策略
 * 提供三级缓存架构以优化性能和容量
 */

import {
  IFullCache,
  ICache,
  IQueryCache,
  IEventCache,
  CacheStats,
  CacheEvent,
  CacheEventListener,
  CacheOptions,
  QueryOptions,
  BatchResult,
} from './CacheAPI'
import {
  CacheData,
  CacheKeys,
  DEFAULT_CACHE_CONFIG,
  CacheConfig,
  DB_CONFIG,
  STORE_NAMES,
  DATABASE_SCHEMA,
} from './types'
import { Note, Folder, Review } from '@webnote/shared/types'

// ============================================================================
// 内存缓存实现
// ============================================================================

/**
 * 内存缓存实现
 * 使用Map存储，支持LRU淘汰策略
 */
export class MemoryCache implements ICache {
  private cache: Map<string, CacheData<any>>
  private maxItems: number
  private maxSize: number
  private currentSize: number
  private accessQueue: string[]
  private stats: Omit<CacheStats, 'memoryUsage' | 'maxMemory'>

  constructor(maxItems = 1000, maxSize = 10 * 1024 * 1024) {
    this.cache = new Map()
    this.maxItems = maxItems
    this.maxSize = maxSize
    this.currentSize = 0
    this.accessQueue = []
    this.stats = {
      count: 0,
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      expired: 0,
    }
  }

  async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null> {
    const item = this.cache.get(key)

    if (!item) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key)
      this.stats.expired++
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    this.stats.hits++
    this.updateHitRate()

    // 更新访问队列（LRU）
    this.updateAccessOrder(key)

    return item
  }

  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 5 * 60 * 1000 // 默认5分钟
    const serialized = JSON.stringify(data)
    const size = new Blob([serialized]).size

    // 检查是否需要清理
    if (!this.cache.has(key) && this.shouldCleanup(size)) {
      await this.cleanupLRU(size)
    }

    const item: CacheData<T> = {
      data,
      timestamp: Date.now(),
      version: 1,
      hash: this.generateHash(data),
      expiresAt: options?.ttl ? Date.now() + ttl : undefined,
    }

    // 如果key已存在，先删除旧数据
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key)!
      this.currentSize -= this.calculateSize(oldItem.data)
    }

    this.cache.set(key, item)
    this.currentSize += size
    this.updateAccessOrder(key)
    this.updateStats()
  }

  async delete(key: string): Promise<void> {
    const item = this.cache.get(key)
    if (item) {
      this.currentSize -= this.calculateSize(item.data)
      this.cache.delete(key)
      this.removeFromAccessQueue(key)
      this.updateStats()
    }
  }

  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key)
    if (!item) return false

    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.currentSize = 0
    this.accessQueue = []
    this.updateStats()
  }

  async getSize(): Promise<number> {
    return this.currentSize
  }

  async getCount(): Promise<number> {
    return this.cache.size
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now()
    let count = 0

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this.cache.delete(key)
        this.removeFromAccessQueue(key)
        count++
      }
    }

    this.updateStats()
    return count
  }

  async cleanupLRU(bytes: number): Promise<number> {
    let freed = 0
    let bytesToFree = bytes

    while (bytesToFree > 0 && this.accessQueue.length > 0) {
      const key = this.accessQueue.shift()!
      const item = this.cache.get(key)
      if (item) {
        const size = this.calculateSize(item.data)
        this.cache.delete(key)
        this.currentSize -= size
        freed += size
        bytesToFree -= size
      }
    }

    this.updateStats()
    return freed
  }

  // 私有辅助方法
  private updateAccessOrder(key: string): void {
    const index = this.accessQueue.indexOf(key)
    if (index > -1) {
      this.accessQueue.splice(index, 1)
    }
    this.accessQueue.push(key)
  }

  private removeFromAccessQueue(key: string): void {
    const index = this.accessQueue.indexOf(key)
    if (index > -1) {
      this.accessQueue.splice(index, 1)
    }
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 0
    }
  }

  private shouldCleanup(size: number): boolean {
    return (
      this.cache.size >= this.maxItems ||
      this.currentSize + size > this.maxSize
    )
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private updateStats(): void {
    this.stats.count = this.cache.size
    this.stats.size = this.currentSize
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      memoryUsage: (this.currentSize / this.maxSize) * 100,
      maxMemory: this.maxSize,
    }
  }
}

// ============================================================================
// IndexedDB缓存实现
// ============================================================================

/**
 * IndexedDB缓存实现
 * 用于持久化大量数据
 */
export class IndexedDBCache implements IQueryCache, IEventCache {
  private db: IDBDatabase | null = null
  private config: CacheConfig
  private eventListeners: Map<string, Set<CacheEventListener>> = new Map()
  private stats: Omit<CacheStats, 'memoryUsage' | 'maxMemory'>

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config
    this.stats = {
      count: 0,
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      expired: 0,
    }
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.updateStats()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建所有对象存储
        for (const [storeName, schema] of Object.entries(DATABASE_SCHEMA)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, schema.options)
            schema.indexes.forEach((index) => {
              store.createIndex(index.name, index.keyPath, index.options)
            })
          }
        }
      }
    })
  }

  async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null> {
    if (!this.db) {
      await this.initialize()
    }

    const storeName = this.getStoreNameFromKey(key)
    if (!storeName) {
      return null
    }

    const id = this.extractIdFromKey(key)
    if (!id) {
      return null
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          this.stats.misses++
          this.updateHitRate()
          resolve(null)
          return
        }

        // 检查是否过期
        if (result.expiresAt && result.expiresAt < Date.now()) {
          this.delete(key)
          this.stats.expired++
          this.stats.misses++
          this.updateHitRate()
          resolve(null)
          return
        }

        this.stats.hits++
        this.updateHitRate()
        resolve(result)
      }

      request.onerror = () => {
        this.stats.misses++
        this.updateHitRate()
        resolve(null)
      }
    })
  }

  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    const storeName = this.getStoreNameFromKey(key)
    if (!storeName) {
      return
    }

    const id = this.extractIdFromKey(key)
    if (!id) {
      return
    }

    const ttl = options?.ttl || this.config.indexedDB.defaultTTL
    const item: CacheData<T> = {
      data,
      timestamp: Date.now(),
      version: 1,
      hash: this.generateHash(data),
      expiresAt: options?.ttl ? Date.now() + ttl : undefined,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put({ ...item, id })

      request.onsuccess = () => {
        this.emit({ type: 'set', key, data, timestamp: Date.now() })
        this.updateStats()
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
  }

  async delete(key: string): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    const storeName = this.getStoreNameFromKey(key)
    if (!storeName) {
      return
    }

    const id = this.extractIdFromKey(key)
    if (!id) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        this.emit({ type: 'delete', key, timestamp: Date.now() })
        this.updateStats()
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key)
    return item !== null
  }

  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        Object.values(STORE_NAMES),
        'readwrite'
      )

      transaction.oncomplete = () => {
        this.emit({ type: 'clear', timestamp: Date.now() })
        this.updateStats()
        resolve()
      }

      transaction.onerror = () => reject(transaction.error)

      for (const storeName of Object.values(STORE_NAMES)) {
        const store = transaction.objectStore(storeName)
        store.clear()
      }
    })
  }

  async getSize(): Promise<number> {
    if (!this.db) {
      await this.initialize()
    }

    let totalSize = 0

    for (const storeName of Object.values(STORE_NAMES)) {
      const size = await this.getStoreSize(storeName)
      totalSize += size
    }

    return totalSize
  }

  async getCount(): Promise<number> {
    if (!this.db) {
      await this.initialize()
    }

    let totalCount = 0

    for (const storeName of Object.values(STORE_NAMES)) {
      const count = await this.getStoreCount(storeName)
      totalCount += count
    }

    return totalCount
  }

  async cleanupExpired(): Promise<number> {
    if (!this.db) {
      await this.initialize()
    }

    let count = 0
    const now = Date.now()

    for (const storeName of Object.values(STORE_NAMES)) {
      count += await this.cleanupStoreExpired(storeName, now)
    }

    return count
  }

  async cleanupLRU(bytes: number): Promise<number> {
    // IndexedDB不需要LRU清理，它有更大的容量
    return 0
  }

  // 批量操作
  async getMany<T>(
    keys: string[],
    options?: CacheOptions
  ): Promise<Map<string, CacheData<T> | null>> {
    const result = new Map<string, CacheData<T> | null>()

    for (const key of keys) {
      result.set(key, await this.get<T>(key, options))
    }

    return result
  }

  async setMany<T>(
    entries: Array<{ key: string; data: T }>,
    options?: CacheOptions
  ): Promise<BatchResult> {
    let success = 0
    let failed = 0
    const errors: Array<{ key: string; error: Error }> = []

    for (const entry of entries) {
      try {
        await this.set(entry.key, entry.data, options)
        success++
      } catch (error) {
        failed++
        errors.push({ key: entry.key, error: error as Error })
      }
    }

    return { success, failed, errors }
  }

  async deleteMany(keys: string[]): Promise<BatchResult> {
    let success = 0
    let failed = 0
    const errors: Array<{ key: string; error: Error }> = []

    for (const key of keys) {
      try {
        await this.delete(key)
        success++
      } catch (error) {
        failed++
        errors.push({ key, error: error as Error })
      }
    }

    return { success, failed, errors }
  }

  async keys(prefix?: string): Promise<string[]> {
    if (!this.db) {
      await this.initialize()
    }

    const allKeys: string[] = []

    for (const storeName of Object.values(STORE_NAMES)) {
      const storeKeys = await this.getStoreKeys(storeName, prefix)
      allKeys.push(...storeKeys)
    }

    return allKeys
  }

  // 查询操作
  async query<T>(prefix: string, options?: QueryOptions): Promise<T[]> {
    if (!this.db) {
      await this.initialize()
    }

    const storeName = this.getStoreNameFromPrefix(prefix)
    if (!storeName) {
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const indexName = options?.sortBy ? options.sortBy : null
      const objectStore = indexName ? store.index(indexName) : store

      const results: T[] = []
      const request = objectStore.openCursor(
        null,
        options?.sortOrder === 'desc' ? 'prev' : 'next'
      )

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const item = cursor.value as CacheData<T>

          // 过滤
          if (!options?.filter || options.filter(item.data)) {
            results.push(item.data)
          }

          cursor.continue()
        } else {
          // 分页
          let finalResults = results
          if (options?.skip || options?.take) {
            finalResults = results.slice(options.skip || 0, (options.skip || 0) + (options.take || results.length))
          }

          resolve(finalResults)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async findKeys(pattern: string): Promise<string[]> {
    const allKeys = await this.keys()
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return allKeys.filter((key) => regex.test(key))
  }

  async getStats(): Promise<CacheStats> {
    return {
      ...this.stats,
      memoryUsage: 0, // IndexedDB不受内存限制
      maxMemory: this.config.indexedDB.maxSize,
    }
  }

  async export(): Promise<Record<string, CacheData<any>>> {
    const result: Record<string, CacheData<any>> = {}

    for (const storeName of Object.values(STORE_NAMES)) {
      const data = await this.exportStore(storeName)
      Object.assign(result, data)
    }

    return result
  }

  async import(data: Record<string, CacheData<any>>): Promise<BatchResult> {
    const entries = Object.entries(data).map(([key, item]) => ({
      key,
      data: item,
    }))

    return this.setMany(entries)
  }

  // 事件系统
  on(event: string, listener: CacheEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  off(event: string, listener: CacheEventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  emit(event: CacheEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach((listener) => listener(event))
    }
  }

  removeAllListeners(): void {
    this.eventListeners.clear()
  }

  // 私有辅助方法
  private getStoreNameFromKey(key: string): string | null {
    if (key.startsWith('note:')) return STORE_NAMES.NOTES
    if (key.startsWith('folder:')) return STORE_NAMES.FOLDERS
    if (key.startsWith('review:')) return STORE_NAMES.REVIEWS
    if (key.startsWith('sync:queue')) return STORE_NAMES.SYNC_QUEUE
    if (key.startsWith('sync:conflicts')) return STORE_NAMES.CONFLICTS
    if (key.startsWith('metadata:')) return STORE_NAMES.METADATA
    return null
  }

  private getStoreNameFromPrefix(prefix: string): string | null {
    if (prefix.startsWith('note')) return STORE_NAMES.NOTES
    if (prefix.startsWith('folder')) return STORE_NAMES.FOLDERS
    if (prefix.startsWith('review')) return STORE_NAMES.REVIEWS
    if (prefix.startsWith('sync:queue')) return STORE_NAMES.SYNC_QUEUE
    if (prefix.startsWith('sync:conflicts')) return STORE_NAMES.CONFLICTS
    return null
  }

  private extractIdFromKey(key: string): number | string | null {
    const parts = key.split(':')
    if (parts.length >= 2) {
      const id = parts[parts.length - 1]
      return isNaN(Number(id)) ? id : Number(id)
    }
    return null
  }

  private async getStoreSize(storeName: string): Promise<number> {
    // 估算大小，实际实现可能需要遍历所有记录
    return 0
  }

  private async getStoreCount(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async getStoreKeys(storeName: string, prefix?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        const keys = request.result as (number | string)[]
        const formattedKeys = keys.map((id) => {
          if (storeName === STORE_NAMES.NOTES) return `note:${id}`
          if (storeName === STORE_NAMES.FOLDERS) return `folder:${id}`
          if (storeName === STORE_NAMES.REVIEWS) return `review:${id}`
          return `${storeName}:${id}`
        })

        if (prefix) {
          resolve(formattedKeys.filter((key) => key.startsWith(prefix)))
        } else {
          resolve(formattedKeys)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private async cleanupStoreExpired(storeName: string, now: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const index = store.index('expiresAt')
      const request = index.openCursor(IDBKeyRange.upperBound(now))

      let count = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          count++
          cursor.continue()
        } else {
          resolve(count)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  private async exportStore(storeName: string): Promise<Record<string, CacheData<any>>> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = request.result as Array<{ id: number | string } & CacheData<any>>
        const result: Record<string, CacheData<any>> = {}

        for (const item of items) {
          const key = `${storeName}:${item.id}`
          result[key] = {
            data: item.data,
            timestamp: item.timestamp,
            version: item.version,
            hash: item.hash,
            expiresAt: item.expiresAt,
          }
        }

        resolve(result)
      }

      request.onerror = () => reject(request.error)
    })
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private updateStats(): void {
    // 在实际实现中，应该定期更新统计信息
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

// ============================================================================
// LocalStorage缓存实现
// ============================================================================

/**
 * LocalStorage缓存实现
 * 用于存储小型配置和元数据
 */
export class LocalStorageCache implements ICache {
  private prefix: string
  private maxSize: number
  private maxItems: number
  private stats: Omit<CacheStats, 'memoryUsage' | 'maxMemory'>

  constructor(prefix = 'cache_', maxSize = 5 * 1024 * 1024, maxItems = 100) {
    this.prefix = prefix
    this.maxSize = maxSize
    this.maxItems = maxItems
    this.stats = {
      count: 0,
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      expired: 0,
    }
  }

  async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null> {
    const fullKey = this.prefix + key
    const value = localStorage.getItem(fullKey)

    if (!value) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    try {
      const item: CacheData<T> = JSON.parse(value)

      // 检查是否过期
      if (item.expiresAt && item.expiresAt < Date.now()) {
        this.delete(key)
        this.stats.expired++
        this.stats.misses++
        this.updateHitRate()
        return null
      }

      // 验证哈希
      if (options?.validateHash && item.hash) {
        const newHash = options.hashFunction?.(item.data) || this.generateHash(item.data)
        if (newHash !== item.hash) {
          this.stats.misses++
          this.updateHitRate()
          return null
        }
      }

      this.stats.hits++
      this.updateHitRate()
      return item
    } catch {
      this.stats.misses++
      this.updateHitRate()
      return null
    }
  }

  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 24 * 60 * 60 * 1000 // 默认24小时
    const serialized = JSON.stringify(data)
    const size = new Blob([serialized]).size

    // 检查容量
    if (size > this.maxSize) {
      throw new Error(`Data size exceeds maximum allowed size`)
    }

    const item: CacheData<T> = {
      data,
      timestamp: Date.now(),
      version: 1,
      hash: this.generateHash(data),
      expiresAt: options?.ttl ? Date.now() + ttl : undefined,
    }

    const fullKey = this.prefix + key
    const itemString = JSON.stringify(item)

    localStorage.setItem(fullKey, itemString)
    this.updateStats()
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.prefix + key
    localStorage.removeItem(fullKey)
    this.updateStats()
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key)
    return item !== null
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key)
      }
    }
    this.updateStats()
  }

  async getSize(): Promise<number> {
    let size = 0
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        size += localStorage.getItem(key)!.length * 2 // 每个字符2字节
      }
    }
    return size
  }

  async getCount(): Promise<number> {
    let count = 0
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        count++
      }
    }
    return count
  }

  async cleanupExpired(): Promise<number> {
    const keys = Object.keys(localStorage)
    let count = 0
    const now = Date.now()

    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            const item: CacheData<any> = JSON.parse(value)
            if (item.expiresAt && item.expiresAt < now) {
              localStorage.removeItem(key)
              count++
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    this.updateStats()
    return count
  }

  async cleanupLRU(bytes: number): Promise<number> {
    // LocalStorage的LRU清理需要额外的时间戳信息
    // 这里简化为清理所有数据
    await this.clear()
    return bytes
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private updateStats(): void {
    this.stats.count = 0
    this.stats.size = 0

    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(this.prefix)) {
        this.stats.count++
        this.stats.size += localStorage.getItem(key)!.length * 2
      }
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

// ============================================================================
// 混合缓存实现
// ============================================================================

/**
 * 混合缓存实现
 * 结合内存缓存、IndexedDB和localStorage的优势
 * 采用三级缓存架构
 */
export class HybridCache implements IFullCache {
  private memoryCache: MemoryCache
  private indexedDBCache: IndexedDBCache
  private localStorageCache: LocalStorageCache
  private config: CacheConfig
  private eventListeners: Map<string, Set<CacheEventListener>> = new Map()

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config
    this.memoryCache = new MemoryCache(
      config.memory.maxItems,
      config.memory.maxSize
    )
    this.indexedDBCache = new IndexedDBCache(config)
    this.localStorageCache = new LocalStorageCache(
      'cache_',
      config.localStorage.maxSize,
      config.localStorage.maxItems
    )

    // 初始化IndexedDB
    this.indexedDBCache.initialize()
  }

  // 基础缓存操作（三级缓存查找）
  async get<T>(key: string, options?: CacheOptions): Promise<CacheData<T> | null> {
    // L1: 内存缓存
    let item = await this.memoryCache.get<T>(key, options)
    if (item) {
      this.emit({ type: 'get', key, data: item.data, timestamp: Date.now() })
      return item
    }

    // L2: IndexedDB缓存
    item = await this.indexedDBCache.get<T>(key, options)
    if (item) {
      // 回填到内存缓存
      await this.memoryCache.set(key, item.data, {
        ttl: this.config.memory.defaultTTL,
      })
      this.emit({ type: 'get', key, data: item.data, timestamp: Date.now() })
      return item
    }

    // L3: LocalStorage缓存（仅用于元数据）
    if (this.isMetadataKey(key)) {
      item = await this.localStorageCache.get<T>(key, options)
      if (item) {
        // 回填到内存缓存
        await this.memoryCache.set(key, item.data, {
          ttl: this.config.memory.defaultTTL,
        })
        this.emit({ type: 'get', key, data: item.data, timestamp: Date.now() })
        return item
      }
    }

    return null
  }

  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    // 写入所有层级的缓存
    await Promise.all([
      this.memoryCache.set(key, data, {
        ttl: this.config.memory.defaultTTL,
        ...options,
      }),
      this.indexedDBCache.set(key, data, {
        ttl: this.config.indexedDB.defaultTTL,
        ...options,
      }),
    ])

    // 仅对元数据写入localStorage
    if (this.isMetadataKey(key)) {
      await this.localStorageCache.set(key, data, {
        ttl: this.config.localStorage.defaultTTL,
        ...options,
      })
    }

    this.emit({ type: 'set', key, data, timestamp: Date.now() })
  }

  async delete(key: string): Promise<void> {
    // 从所有层级删除
    await Promise.all([
      this.memoryCache.delete(key),
      this.indexedDBCache.delete(key),
    ])

    if (this.isMetadataKey(key)) {
      await this.localStorageCache.delete(key)
    }

    this.emit({ type: 'delete', key, timestamp: Date.now() })
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.memoryCache.clear(),
      this.indexedDBCache.clear(),
      this.localStorageCache.clear(),
    ])

    this.emit({ type: 'clear', timestamp: Date.now() })
  }

  async getSize(): Promise<number> {
    const [memorySize, indexedDBSize, localStorageSize] = await Promise.all([
      this.memoryCache.getSize(),
      this.indexedDBCache.getSize(),
      this.localStorageCache.getSize(),
    ])

    return memorySize + indexedDBSize + localStorageSize
  }

  async getCount(): Promise<number> {
    const [memoryCount, indexedDBCount, localStorageCount] = await Promise.all([
      this.memoryCache.getCount(),
      this.indexedDBCache.getCount(),
      this.localStorageCache.getCount(),
    ])

    return memoryCount + indexedDBCount + localStorageCount
  }

  async cleanupExpired(): Promise<number> {
    const [memoryCount, indexedDBCount, localStorageCount] = await Promise.all([
      this.memoryCache.cleanupExpired(),
      this.indexedDBCache.cleanupExpired(),
      this.localStorageCache.cleanupExpired(),
    ])

    return memoryCount + indexedDBCount + localStorageCount
  }

  async cleanupLRU(bytes: number): Promise<number> {
    return this.memoryCache.cleanupLRU(bytes)
  }

  // 批量操作
  async getMany<T>(
    keys: string[],
    options?: CacheOptions
  ): Promise<Map<string, CacheData<T> | null>> {
    const result = new Map<string, CacheData<T> | null>()

    for (const key of keys) {
      result.set(key, await this.get<T>(key, options))
    }

    return result
  }

  async setMany<T>(
    entries: Array<{ key: string; data: T }>,
    options?: CacheOptions
  ): Promise<BatchResult> {
    let success = 0
    let failed = 0
    const errors: Array<{ key: string; error: Error }> = []

    for (const entry of entries) {
      try {
        await this.set(entry.key, entry.data, options)
        success++
      } catch (error) {
        failed++
        errors.push({ key: entry.key, error: error as Error })
      }
    }

    return { success, failed, errors }
  }

  async deleteMany(keys: string[]): Promise<BatchResult> {
    let success = 0
    let failed = 0
    const errors: Array<{ key: string; error: Error }> = []

    for (const key of keys) {
      try {
        await this.delete(key)
        success++
      } catch (error) {
        failed++
        errors.push({ key, error: error as Error })
      }
    }

    return { success, failed, errors }
  }

  async keys(prefix?: string): Promise<string[]> {
    return this.indexedDBCache.keys(prefix)
  }

  // 查询操作
  async query<T>(prefix: string, options?: QueryOptions): Promise<T[]> {
    return this.indexedDBCache.query(prefix, options)
  }

  async findKeys(pattern: string): Promise<string[]> {
    return this.indexedDBCache.findKeys(pattern)
  }

  async getStats(): Promise<CacheStats> {
    const [memoryStats, indexedDBStats, localStorageStats] = await Promise.all([
      this.memoryCache.getStats(),
      this.indexedDBCache.getStats(),
      this.localStorageCache.getStats(),
    ])

    return {
      count: memoryStats.count + indexedDBStats.count + localStorageStats.count,
      size: memoryStats.size + indexedDBStats.size + localStorageStats.size,
      hits: memoryStats.hits + indexedDBStats.hits + localStorageStats.hits,
      misses: memoryStats.misses + indexedDBStats.misses + localStorageStats.misses,
      hitRate:
        (memoryStats.hits + indexedDBStats.hits + localStorageStats.hits) /
        (memoryStats.hits +
          indexedDBStats.hits +
          localStorageStats.hits +
          memoryStats.misses +
          indexedDBStats.misses +
          localStorageStats.misses),
      expired: memoryStats.expired + indexedDBStats.expired + localStorageStats.expired,
      memoryUsage: memoryStats.memoryUsage,
      maxMemory: memoryStats.maxMemory,
    }
  }

  async export(): Promise<Record<string, CacheData<any>>> {
    return this.indexedDBCache.export()
  }

  async import(data: Record<string, CacheData<any>>): Promise<BatchResult> {
    return this.indexedDBCache.import(data)
  }

  // 事件系统
  on(event: string, listener: CacheEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  off(event: string, listener: CacheEventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  emit(event: CacheEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach((listener) => listener(event))
    }
  }

  removeAllListeners(): void {
    this.eventListeners.clear()
  }

  // 实体缓存操作
  async getNote(id: number): Promise<Note | null> {
    const item = await this.get<Note>(CacheKeys.NOTE(id))
    return item?.data || null
  }

  async setNote(note: Note): Promise<void> {
    await this.set(CacheKeys.NOTE(note.id), note)
  }

  async deleteNote(id: number): Promise<void> {
    await this.delete(CacheKeys.NOTE(id))
  }

  async getNotes(userId: number): Promise<Note[]> {
    return this.query<Note>('note', {
      filter: (note) => note.user_id === userId,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  async getNotesByFolder(folderId: number): Promise<Note[]> {
    return this.query<Note>('note', {
      filter: (note) => note.folder_id === folderId,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  async getPinnedNotes(userId: number): Promise<Note[]> {
    return this.query<Note>('note', {
      filter: (note) => note.user_id === userId && note.is_pinned,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  async getFolder(id: number): Promise<Folder | null> {
    const item = await this.get<Folder>(CacheKeys.FOLDER(id))
    return item?.data || null
  }

  async setFolder(folder: Folder): Promise<void> {
    await this.set(CacheKeys.FOLDER(folder.id), folder)
  }

  async deleteFolder(id: number): Promise<void> {
    await this.delete(CacheKeys.FOLDER(id))
  }

  async getFolders(userId: number): Promise<Folder[]> {
    return this.query<Folder>('folder', {
      filter: (folder) => folder.user_id === userId,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  async getReview(id: number): Promise<Review | null> {
    const item = await this.get<Review>(CacheKeys.REVIEW(id))
    return item?.data || null
  }

  async setReview(review: Review): Promise<void> {
    await this.set(CacheKeys.REVIEW(review.id), review)
  }

  async deleteReview(id: number): Promise<void> {
    await this.delete(CacheKeys.REVIEW(id))
  }

  async getReviews(userId: number): Promise<Review[]> {
    return this.query<Review>('review', {
      filter: (review) => review.user_id === userId,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  async getReviewsByDate(date: string): Promise<Review[]> {
    return this.query<Review>('review', {
      filter: (review) => review.date === date,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  // 同步缓存操作
  async getVersion(key: string): Promise<number | null> {
    const item = await this.get(key)
    return item?.version || null
  }

  async getHash(key: string): Promise<string | null> {
    const item = await this.get(key)
    return item?.hash || null
  }

  async isExpired(key: string): Promise<boolean> {
    const item = await this.get(key)
    if (!item) return true
    return item.expiresAt ? item.expiresAt < Date.now() : false
  }

  async refresh(key: string, ttl?: number): Promise<void> {
    const item = await this.get(key)
    if (item) {
      const newTtl = ttl || this.config.memory.defaultTTL
      item.expiresAt = Date.now() + newTtl
      await this.set(key, item.data, { ttl: newTtl })
    }
  }

  async refreshMany(keys: string[], ttl?: number): Promise<void> {
    for (const key of keys) {
      await this.refresh(key, ttl)
    }
  }

  async getLastAccessed(key: string): Promise<number | null> {
    const item = await this.get(key)
    return item?.timestamp || null
  }

  async updateLastAccessed(key: string): Promise<void> {
    const item = await this.get(key)
    if (item) {
      item.timestamp = Date.now()
      await this.set(key, item.data)
    }
  }

  // 私有辅助方法
  private isMetadataKey(key: string): boolean {
    return key.startsWith('metadata:') ||
           key.startsWith('sync:') ||
           key.startsWith('user:') ||
           key.startsWith('cache:')
  }
}

// ============================================================================
// 缓存工厂
// ============================================================================

/**
 * 缓存工厂
 * 用于创建不同类型的缓存实例
 */
export class CacheFactory {
  static createMemoryCache(): ICache {
    return new MemoryCache()
  }

  static async createIndexedDBCache(): Promise<IQueryCache> {
    const cache = new IndexedDBCache()
    await cache.initialize()
    return cache
  }

  static createLocalStorageCache(): ICache {
    return new LocalStorageCache()
  }

  static async createHybridCache(): Promise<IFullCache> {
    return new HybridCache()
  }
}
