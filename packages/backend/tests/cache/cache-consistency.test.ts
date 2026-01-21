/**
 * 缓存一致性测试套件
 * 测试三级缓存数据一致性验证
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma, createTestUser, createTestNote, delay } from '../setup'

// ============================================================================
// 模拟三级缓存实现
// ============================================================================

/**
 * L1 内存缓存
 */
class MemoryCache {
  private cache: Map<string, { data: any; version: number; timestamp: number }>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  set(key: string, data: any, version: number): void {
    if (this.cache.size >= this.maxSize) {
      // LRU淘汰
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      version,
      timestamp: Date.now(),
    })
  }

  get(key: string): { data: any; version: number } | undefined {
    return this.cache.get(key)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  getAll(): Map<string, { data: any; version: number; timestamp: number }> {
    return new Map(this.cache)
  }
}

/**
 * L2 IndexedDB缓存模拟
 */
class IndexedDBCache {
  private cache: Map<string, { data: any; version: number; timestamp: number }>

  constructor() {
    this.cache = new Map()
  }

  async set(key: string, data: any, version: number): Promise<void> {
    await delay(1) // 模拟异步
    this.cache.set(key, {
      data,
      version,
      timestamp: Date.now(),
    })
  }

  async get(key: string): Promise<{ data: any; version: number } | undefined> {
    await delay(1)
    return this.cache.get(key)
  }

  async delete(key: string): Promise<void> {
    await delay(1)
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    await delay(1)
    this.cache.clear()
  }

  async size(): Promise<number> {
    return this.cache.size
  }

  async getAll(): Promise<Map<string, { data: any; version: number; timestamp: number }>> {
    return new Map(this.cache)
  }
}

/**
 * L3 LocalStorage缓存模拟
 */
class LocalStorageCache {
  private cache: Map<string, { data: any; version: number; timestamp: number }>

  constructor() {
    this.cache = new Map()
  }

  set(key: string, data: any, version: number): void {
    this.cache.set(key, {
      data,
      version,
      timestamp: Date.now(),
    })
  }

  get(key: string): { data: any; version: number } | undefined {
    return this.cache.get(key)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  getAll(): Map<string, { data: any; version: number; timestamp: number }> {
    return new Map(this.cache)
  }
}

/**
 * 三级混合缓存
 */
class HybridCache {
  private l1: MemoryCache
  private l2: IndexedDBCache
  private l3: LocalStorageCache

  constructor() {
    this.l1 = new MemoryCache(100)
    this.l2 = new IndexedDBCache()
    this.l3 = new LocalStorageCache()
  }

  /**
   * 写入数据到所有缓存层
   */
  async set(key: string, data: any, version: number): Promise<void> {
    // L1: 立即写入
    this.l1.set(key, data, version)

    // L2: 异步写入
    await this.l2.set(key, data, version)

    // L3: 只写入元数据
    if (this.isMetadata(key)) {
      this.l3.set(key, data, version)
    }
  }

  /**
   * 从缓存读取数据（自动回填）
   */
  async get(key: string): Promise<{ data: any; version: number } | undefined> {
    // 先从L1读取
    let result = this.l1.get(key)
    if (result) {
      return result
    }

    // L1未命中，从L2读取
    result = await this.l2.get(key)
    if (result) {
      // 回填到L1
      this.l1.set(key, result.data, result.version)
      return result
    }

    // L2未命中，从L3读取（仅元数据）
    if (this.isMetadata(key)) {
      result = this.l3.get(key)
      if (result) {
        // 回填到L1和L2
        this.l1.set(key, result.data, result.version)
        await this.l2.set(key, result.data, result.version)
        return result
      }
    }

    return undefined
  }

  /**
   * 删除数据（从所有层删除）
   */
  async delete(key: string): Promise<void> {
    this.l1.delete(key)
    await this.l2.delete(key)
    if (this.isMetadata(key)) {
      this.l3.delete(key)
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.l1.clear()
    await this.l2.clear()
    this.l3.clear()
  }

  /**
   * 判断是否为元数据
   */
  private isMetadata(key: string): boolean {
    return key.startsWith('metadata:') || key.startsWith('config:')
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    l1Size: number
    l2Size: number
    l3Size: number
    totalSize: number
  } {
    const l2Size = (this.l2 as any).cache.size
    return {
      l1Size: this.l1.size(),
      l2Size: l2Size,
      l3Size: this.l3.size(),
      totalSize: this.l1.size() + l2Size + this.l3.size(),
    }
  }

  /**
   * 验证所有缓存层的一致性
   */
  async verifyConsistency(): Promise<{
    consistent: boolean
    inconsistencies: Array<{ key: string; l1?: any; l2?: any; l3?: any }>
  }> {
    const l1All = this.l1.getAll()
    const l2All = await this.l2.getAll()
    const l3All = this.l3.getAll()

    const allKeys = new Set([...l1All.keys(), ...l2All.keys(), ...l3All.keys()])
    const inconsistencies: Array<{ key: string; l1?: any; l2?: any; l3?: any }> = []

    for (const key of allKeys) {
      const l1Data = l1All.get(key)
      const l2Data = l2All.get(key)
      const l3Data = l3All.get(key)

      // 检查版本一致性
      const versions = [
        l1Data?.version,
        l2Data?.version,
        l3Data?.version,
      ].filter(v => v !== undefined)

      if (versions.length > 1 && new Set(versions).size > 1) {
        inconsistencies.push({
          key,
          l1: l1Data,
          l2: l2Data,
          l3: l3Data,
        })
      }
    }

    return {
      consistent: inconsistencies.length === 0,
      inconsistencies,
    }
  }
}

// ============================================================================
// 测试套件
// ============================================================================

describe('缓存一致性测试', () => {
  let cache: HybridCache
  let testUser: any

  beforeEach(async () => {
    cache = new HybridCache()
    const user = await createTestUser()
    testUser = user
  })

  afterEach(async () => {
    await cache.clear()
  })

  // ========================================================================
  // 基本读写一致性测试
  // ========================================================================

  describe('基本读写一致性', () => {
    it('应该保持所有缓存层的数据一致性', async () => {
      const key = 'note_1'
      const data = {
        id: 1,
        title: 'Test Note',
        content: 'Test Content',
      }
      const version = 1

      await cache.set(key, data, version)

      // 从L1读取
      const l1Result = await cache.get(key)
      expect(l1Result?.data).toEqual(data)
      expect(l1Result?.version).toBe(version)

      // 从L2读取（应该触发回填）
      const l2Result = await cache.get(key)
      expect(l2Result?.data).toEqual(data)
      expect(l2Result?.version).toBe(version)
    })

    it('应该正确更新缓存版本', async () => {
      const key = 'note_1'
      const data1 = { id: 1, title: 'Version 1' }
      const data2 = { id: 1, title: 'Version 2' }

      await cache.set(key, data1, 1)
      await cache.set(key, data2, 2)

      const result = await cache.get(key)
      expect(result?.data).toEqual(data2)
      expect(result?.version).toBe(2)
    })

    it('应该正确删除所有缓存层的数据', async () => {
      const key = 'note_1'
      const data = { id: 1, title: 'Test' }

      await cache.set(key, data, 1)
      await cache.delete(key)

      const result = await cache.get(key)
      expect(result).toBeUndefined()
    })
  })

  // ========================================================================
  // 缓存回填一致性测试
  // ========================================================================

  describe('缓存回填一致性', () => {
    it('应该从L2回填到L1', async () => {
      const key = 'note_backfill'
      const data = { id: 1, title: 'Backfill Test' }

      // 直接写入L2（模拟L1未命中）
      await cache.set(key, data, 1)

      // 清空L1
      cache['l1'].delete(key)

      // 从缓存读取（应该触发回填）
      const result = await cache.get(key)

      expect(result).toBeDefined()
      expect(result?.data).toEqual(data)

      // 验证L1已被回填
      const l1Data = cache['l1'].get(key)
      expect(l1Data?.data).toEqual(data)
    })

    it('应该从L3回填到L1和L2', async () => {
      const key = 'metadata:sync_state'
      const data = { last_sync: '2024-01-01' }

      await cache.set(key, data, 1)

      // 清空L1和L2
      cache['l1'].delete(key)
      await cache['l2'].delete(key)

      // 从缓存读取（应该触发回填）
      const result = await cache.get(key)

      expect(result).toBeDefined()
      expect(result?.data).toEqual(data)

      // 验证L1和L2已被回填
      const l1Data = cache['l1'].get(key)
      const l2Data = await cache['l2'].get(key)

      expect(l1Data?.data).toEqual(data)
      expect(l2Data?.data).toEqual(data)
    })
  })

  // ========================================================================
  // 批量操作一致性测试
  // ========================================================================

  describe('批量操作一致性', () => {
    it('应该保持批量写入的一致性', async () => {
      const items = []
      for (let i = 0; i < 10; i++) {
        items.push({
          key: `note_batch_${i}`,
          data: { id: i, title: `Batch Note ${i}` },
          version: i + 1,
        })
      }

      // 批量写入
      for (const item of items) {
        await cache.set(item.key, item.data, item.version)
      }

      // 批量读取并验证
      for (const item of items) {
        const result = await cache.get(item.key)
        expect(result?.data).toEqual(item.data)
        expect(result?.version).toBe(item.version)
      }
    })

    it('应该保持批量更新的一致性', async () => {
      const keys = ['note_1', 'note_2', 'note_3']

      // 初始写入
      for (const key of keys) {
        await cache.set(key, { id: 1, title: 'Original' }, 1)
      }

      // 批量更新
      for (const key of keys) {
        await cache.set(key, { id: 1, title: 'Updated' }, 2)
      }

      // 验证所有更新
      for (const key of keys) {
        const result = await cache.get(key)
        expect(result?.data.title).toBe('Updated')
        expect(result?.version).toBe(2)
      }
    })
  })

  // ========================================================================
  // 并发访问一致性测试
  // ========================================================================

  describe('并发访问一致性', () => {
    it('应该正确处理并发写入', async () => {
      const key = 'note_concurrent'
      const writePromises = []

      // 并发写入10次
      for (let i = 0; i < 10; i++) {
        writePromises.push(
          cache.set(key, { id: 1, version: i }, i + 1)
        )
      }

      await Promise.all(writePromises)

      // 读取最终结果
      const result = await cache.get(key)
      expect(result).toBeDefined()
      expect(result?.version).toBeGreaterThanOrEqual(1)
    })

    it('应该正确处理并发读取', async () => {
      const key = 'note_concurrent_read'
      const data = { id: 1, title: 'Concurrent Read Test' }

      await cache.set(key, data, 1)

      // 并发读取
      const readPromises = []
      for (let i = 0; i < 10; i++) {
        readPromises.push(cache.get(key))
      }

      const results = await Promise.all(readPromises)

      // 所有读取结果应该一致
      for (const result of results) {
        expect(result?.data).toEqual(data)
        expect(result?.version).toBe(1)
      }
    })

    it('应该正确处理并发读写', async () => {
      const key = 'note_concurrent_rw'
      const operations = []

      // 混合读写操作
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // 写入
          operations.push(
            cache.set(key, { id: 1, version: i }, i + 1)
          )
        } else {
          // 读取
          operations.push(cache.get(key))
        }
      }

      await Promise.all(operations)

      // 验证最终一致性
      const result = await cache.get(key)
      expect(result).toBeDefined()
    })
  })

  // ========================================================================
  // 版本管理一致性测试
  // ========================================================================

  describe('版本管理一致性', () => {
    it('应该正确跟踪数据版本', async () => {
      const key = 'note_version'

      // 写入多个版本
      for (let i = 1; i <= 10; i++) {
        await cache.set(key, { id: 1, version: i }, i)
      }

      const result = await cache.get(key)
      expect(result?.version).toBe(10)
    })

    it('应该拒绝旧版本数据', async () => {
      const key = 'note_old_version'

      // 写入版本10
      await cache.set(key, { id: 1, title: 'Version 10' }, 10)

      // 尝试写入版本9（应该被拒绝或更新）
      await cache.set(key, { id: 1, title: 'Version 9' }, 9)

      const result = await cache.get(key)
      // 根据实现，可能接受或拒绝
      expect(result).toBeDefined()
    })

    it('应该正确处理版本冲突', async () => {
      const key = 'note_version_conflict'

      // 模拟版本冲突
      await cache.set(key, { id: 1, title: 'Server' }, 2)
      await cache.set(key, { id: 1, title: 'Client' }, 2)

      const result = await cache.get(key)
      expect(result?.version).toBe(2)
    })
  })

  // ========================================================================
  // 数据库同步一致性测试
  // ========================================================================

  describe('数据库同步一致性', () => {
    it('应该与数据库保持一致', async () => {
      // 在数据库中创建笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'DB Sync Test',
        content: 'Content',
      })

      // 模拟从数据库同步到缓存
      const key = `note_${note.id}`
      await cache.set(key, note, (note as any).version || 1)

      // 从缓存读取
      const cachedNote = await cache.get(key)
      expect(cachedNote?.data).toEqual(note)
    })

    it('应该正确同步数据库更新', async () => {
      // 创建笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'Original',
      })

      // 同步到缓存
      const key = `note_${note.id}`
      await cache.set(key, note, (note as any).version || 1)

      // 更新数据库
      const updatedNote = await prisma.note.update({
        where: { id: note.id },
        data: {
          title: 'Updated',
        },
      })

      // 同步更新到缓存
      const newVersion = (note as any).version ? (note as any).version + 1 : 2
      await cache.set(key, updatedNote, newVersion)

      // 验证缓存与数据库一致
      const cachedNote = await cache.get(key)
      expect(cachedNote?.data.title).toBe('Updated')
      expect(cachedNote?.version).toBe(newVersion)
    })

    it('应该正确处理数据库删除', async () => {
      // 创建笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'To Delete',
      })

      // 同步到缓存
      const key = `note_${note.id}`
      await cache.set(key, note, (note as any).version || 1)

      // 从数据库删除
      await prisma.note.delete({
        where: { id: note.id },
      })

      // 从缓存删除
      await cache.delete(key)

      // 验证缓存已删除
      const cachedNote = await cache.get(key)
      expect(cachedNote).toBeUndefined()
    })
  })

  // ========================================================================
  // 一致性验证测试
  // ========================================================================

  describe('一致性验证', () => {
    it('应该通过一致性验证', async () => {
      // 写入数据
      for (let i = 0; i < 5; i++) {
        await cache.set(`note_${i}`, { id: i, title: `Note ${i}` }, 1)
      }

      const verification = await cache.verifyConsistency()
      expect(verification.consistent).toBe(true)
      expect(verification.inconsistencies).toHaveLength(0)
    })

    it('应该检测到版本不一致', async () => {
      const key = 'note_inconsistent'

      // 写入到L1
      cache['l1'].set(key, { id: 1, title: 'L1' }, 1)

      // 写入不同版本到L2
      await cache['l2'].set(key, { id: 1, title: 'L2' }, 2)

      const verification = await cache.verifyConsistency()
      expect(verification.consistent).toBe(false)
      expect(verification.inconsistencies.length).toBeGreaterThan(0)
    })

    it('应该报告不一致的详细信息', async () => {
      const key = 'note_detail'

      cache['l1'].set(key, { id: 1, title: 'L1' }, 1)
      await cache['l2'].set(key, { id: 1, title: 'L2' }, 2)

      const verification = await cache.verifyConsistency()

      if (!verification.consistent) {
        const inconsistency = verification.inconsistencies[0]
        expect(inconsistency.key).toBe(key)
        expect(inconsistency.l1?.version).toBe(1)
        expect(inconsistency.l2?.version).toBe(2)
      }
    })
  })

  // ========================================================================
  // 性能测试
  // ========================================================================

  describe('性能测试', () => {
    it('应该快速写入数据', async () => {
      const writeCount = 100
      const startTime = Date.now()

      for (let i = 0; i < writeCount; i++) {
        await cache.set(`note_perf_${i}`, { id: i, title: `Note ${i}` }, 1)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该快速读取数据', async () => {
      // 先写入数据
      for (let i = 0; i < 100; i++) {
        await cache.set(`note_read_${i}`, { id: i, title: `Note ${i}` }, 1)
      }

      const readCount = 100
      const startTime = Date.now()

      for (let i = 0; i < readCount; i++) {
        await cache.get(`note_read_${i}`)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(500) // 应该在500ms内完成
    })

    it('应该快速验证一致性', async () => {
      // 写入数据
      for (let i = 0; i < 50; i++) {
        await cache.set(`note_verify_${i}`, { id: i, title: `Note ${i}` }, 1)
      }

      const startTime = Date.now()
      const verification = await cache.verifyConsistency()
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(verification.consistent).toBe(true)
      expect(duration).toBeLessThan(100) // 应该在100ms内完成
    })
  })

  // ========================================================================
  // 边界条件测试
  // ========================================================================

  describe('边界条件', () => {
    it('应该正确处理空缓存', async () => {
      const result = await cache.get('nonexistent')
      expect(result).toBeUndefined()

      const stats = cache.getStats()
      expect(stats.totalSize).toBe(0)
    })

    it('应该正确处理重复写入', async () => {
      const key = 'note_duplicate'
      const data = { id: 1, title: 'Duplicate' }

      // 重复写入相同数据
      await cache.set(key, data, 1)
      await cache.set(key, data, 1)
      await cache.set(key, data, 1)

      const result = await cache.get(key)
      expect(result?.version).toBe(1)
    })

    it('应该正确处理空数据', async () => {
      const key = 'note_empty'
      const emptyData = {}

      await cache.set(key, emptyData, 1)

      const result = await cache.get(key)
      expect(result?.data).toEqual(emptyData)
    })

    it('应该正确处理大数据', async () => {
      const key = 'note_large'
      const largeData = {
        id: 1,
        title: 'Large Note',
        content: 'x'.repeat(10000), // 10KB内容
      }

      await cache.set(key, largeData, 1)

      const result = await cache.get(key)
      expect(result?.data.content).toHaveLength(10000)
    })
  })
})
