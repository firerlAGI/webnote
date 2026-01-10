/**
 * 冲突解决场景测试套件
 * 测试5种冲突解决策略
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SyncService } from '../../src/services/sync/SyncService'
import {
  Conflict,
  ConflictResolutionStrategy,
  ConflictType,
  EntityType,
} from '@webnote/shared/types/sync'
import { prisma, logger, createTestUser, createTestNote, delay } from '../setup'

// ============================================================================
// 测试套件
// ============================================================================

describe('冲突解决场景测试', () => {
  let syncService: SyncService
  let testUser: any

  beforeEach(async () => {
    syncService = new SyncService(prisma, logger)
    const user = await createTestUser()
    testUser = user
  })

  afterEach(async () => {
    await syncService.shutdown()
  })

  // ========================================================================
  // SERVER_WINS 策略测试
  // ========================================================================

  describe('SERVER_WINS 策略', () => {
    it('应该使用服务器数据解决冲突', async () => {
      // 创建测试笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'Server Title',
        content: 'Server content',
      })

      // 创建冲突
      const conflict: Conflict = {
        conflict_id: 'conflict_server_wins',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_server_wins',
        server_data: {
          version: 2,
          data: {
            id: note.id,
            title: 'Server Title',
            content: 'Server content',
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            content: 'Client content',
          },
          modified_at: new Date(Date.now() - 1000).toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'content'],
        suggested_strategy: ConflictResolutionStrategy.SERVER_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.SERVER_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Server Title')
      expect(result.resolved_data?.content).toBe('Server content')
    })

    it('应该保留服务器版本号', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_server_version',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_server_version',
        server_data: {
          version: 5,
          data: { title: 'Server' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 3,
          data: { title: 'Client' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.SERVER_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.SERVER_WINS
      )

      expect(result.success).toBe(true)
      expect(result.new_version).toBe(5)
    })
  })

  // ========================================================================
  // CLIENT_WINS 策略测试
  // ========================================================================

  describe('CLIENT_WINS 策略', () => {
    it('应该使用客户端数据解决冲突', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'Server Title',
        content: 'Server content',
      })

      const conflict: Conflict = {
        conflict_id: 'conflict_client_wins',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_client_wins',
        server_data: {
          version: 2,
          data: {
            title: 'Server Title',
            content: 'Server content',
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            content: 'Client content',
          },
          modified_at: new Date(Date.now() - 1000).toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'content'],
        suggested_strategy: ConflictResolutionStrategy.CLIENT_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.CLIENT_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Client Title')
      expect(result.resolved_data?.content).toBe('Client content')
    })

    it('应该递增服务器版本号', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_client_version',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_client_version',
        server_data: {
          version: 5,
          data: { title: 'Server' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 3,
          data: { title: 'Client' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.CLIENT_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.CLIENT_WINS
      )

      expect(result.success).toBe(true)
      expect(result.new_version).toBe(6) // 服务器版本 + 1
    })
  })

  // ========================================================================
  // LATEST_WINS 策略测试
  // ========================================================================

  describe('LATEST_WINS 策略', () => {
    it('应该使用最新修改时间的数据', async () => {
      const note = await createTestNote(testUser.user.id)

      const serverTime = new Date(Date.now() - 5000).toISOString()
      const clientTime = new Date().toISOString()

      const conflict: Conflict = {
        conflict_id: 'conflict_latest_client',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_latest_client',
        server_data: {
          version: 2,
          data: { title: 'Server Title' },
          modified_at: serverTime,
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Title' },
          modified_at: clientTime,
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LATEST_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Client Title') // 客户端更新
    })

    it('应该选择服务器更新当服务器时间更新', async () => {
      const note = await createTestNote(testUser.user.id)

      const serverTime = new Date().toISOString()
      const clientTime = new Date(Date.now() - 5000).toISOString()

      const conflict: Conflict = {
        conflict_id: 'conflict_latest_server',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_latest_server',
        server_data: {
          version: 2,
          data: { title: 'Server Title' },
          modified_at: serverTime,
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Title' },
          modified_at: clientTime,
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LATEST_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Server Title') // 服务器更新
    })

    it('应该处理相同时间的冲突', async () => {
      const note = await createTestNote(testUser.user.id)

      const sameTime = new Date().toISOString()

      const conflict: Conflict = {
        conflict_id: 'conflict_same_time',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_same_time',
        server_data: {
          version: 2,
          data: { title: 'Server Title' },
          modified_at: sameTime,
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Title' },
          modified_at: sameTime,
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LATEST_WINS
      )

      expect(result.success).toBe(true)
      // 当时间相同时，应该有默认行为（客户端胜出）
      expect(result.resolved_data?.title).toBeDefined()
    })
  })

  // ========================================================================
  // MERGE 策略测试
  // ========================================================================

  describe('MERGE 策略', () => {
    it('应该合并不同的字段', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_merge',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_merge',
        server_data: {
          version: 2,
          data: {
            title: 'Server Title',
            content: 'Server content',
            is_pinned: false,
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            is_pinned: true,
            tags: ['client-tag'],
          },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'is_pinned'],
        suggested_strategy: ConflictResolutionStrategy.MERGE,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MERGE
      )

      expect(result.success).toBe(true)

      // 验证合并结果
      const merged = result.resolved_data
      expect(merged?.title).toBe('Client Title') // 客户端的值
      expect(merged?.content).toBe('Server content') // 服务器的值
      expect(merged?.is_pinned).toBe(true) // 客户端的值
      expect(merged?.tags).toEqual(['client-tag']) // 客户端独有的字段
    })

    it('应该处理嵌套对象合并', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_merge_nested',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_merge_nested',
        server_data: {
          version: 2,
          data: {
            title: 'Server Title',
            metadata: {
              author: 'server',
              category: 'work',
            },
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            metadata: {
              author: 'client',
              priority: 'high',
            },
          },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'metadata'],
        suggested_strategy: ConflictResolutionStrategy.MERGE,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MERGE
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Client Title')

      // 嵌套对象应该被完全替换
      expect(result.resolved_data?.metadata).toEqual({
        author: 'client',
        category: 'work', // 服务器有但客户端没有
        priority: 'high',  // 客户端有但服务器没有
      })
    })

    it('应该处理数组字段', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_merge_array',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_merge_array',
        server_data: {
          version: 2,
          data: {
            title: 'Server Title',
            tags: ['tag1', 'tag2'],
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            tags: ['tag3', 'tag4'],
          },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'tags'],
        suggested_strategy: ConflictResolutionStrategy.MERGE,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MERGE
      )

      expect(result.success).toBe(true)
      // 数组应该被客户端的值替换
      expect(result.resolved_data?.tags).toEqual(['tag3', 'tag4'])
    })
  })

  // ========================================================================
  // MANUAL 策略测试
  // ========================================================================

  describe('MANUAL 策略', () => {
    it('应该返回需要手动解决的错误', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_manual',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_manual',
        server_data: {
          version: 2,
          data: { title: 'Server Title' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Title' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.MANUAL,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MANUAL
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Manual resolution required')
    })

    it('应该不自动解决冲突', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_manual_no_auto',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_manual_no_auto',
        server_data: {
          version: 2,
          data: { title: 'Server Title' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Title' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.MANUAL,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MANUAL
      )

      expect(result.resolved_data).toBeUndefined()
      expect(result.new_version).toBeUndefined()
    })
  })

  // ========================================================================
  // 复杂冲突场景测试
  // ========================================================================

  describe('复杂冲突场景', () => {
    it('应该处理多字段冲突', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'Original',
        content: 'Original content',
        is_pinned: false,
      })

      const conflict: Conflict = {
        conflict_id: 'conflict_multi_field',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_multi_field',
        server_data: {
          version: 2,
          data: {
            title: 'Server Title',
            content: 'Server content',
            is_pinned: true,
          },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: {
            title: 'Client Title',
            content: 'Client content',
            is_pinned: false,
          },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title', 'content', 'is_pinned'],
        suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MERGE
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data).toBeDefined()

      // 验证所有字段都被处理
      const resolved = result.resolved_data
      expect(resolved?.title).toBe('Client Title')
      expect(resolved?.content).toBe('Client content')
      expect(resolved?.is_pinned).toBe(false)
    })

    it('应该处理删除冲突', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'To Delete or Update',
      })

      const conflict: Conflict = {
        conflict_id: 'conflict_delete',
        conflict_type: ConflictType.DELETE,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_delete',
        server_data: {
          version: 0,
          data: {},
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client Updated' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: [],
        suggested_strategy: ConflictResolutionStrategy.CLIENT_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.CLIENT_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.title).toBe('Client Updated')
    })

    it('应该处理不同实体类型的冲突', async () => {
      // 创建文件夹
      const folder = await prisma.folder.create({
        data: {
          user_id: testUser.user.id,
          name: 'Original Folder',
        },
      })

      const conflict: Conflict = {
        conflict_id: 'conflict_folder',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.FOLDER,
        entity_id: folder.id,
        operation_id: 'op_folder',
        server_data: {
          version: 2,
          data: { name: 'Server Folder' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { name: 'Client Folder' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['name'],
        suggested_strategy: ConflictResolutionStrategy.SERVER_WINS,
        timestamp: new Date().toISOString(),
      }

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.SERVER_WINS
      )

      expect(result.success).toBe(true)
      expect(result.resolved_data?.name).toBe('Server Folder')
    })
  })

  // ========================================================================
  // 性能测试
  // ========================================================================

  describe('性能测试', () => {
    it('应该快速解决简单冲突', async () => {
      const note = await createTestNote(testUser.user.id)

      const conflict: Conflict = {
        conflict_id: 'conflict_perf',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_perf',
        server_data: {
          version: 2,
          data: { title: 'Server' },
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: { title: 'Client' },
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: ['title'],
        suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
        timestamp: new Date().toISOString(),
      }

      const startTime = Date.now()

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LATEST_WINS
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该快速解决复杂合并冲突', async () => {
      const note = await createTestNote(testUser.user.id)

      // 创建大型数据对象
      const largeServerData: Record<string, any> = {}
      const largeClientData: Record<string, any> = {}

      for (let i = 0; i < 100; i++) {
        largeServerData[`field_${i}`] = `server_value_${i}`
        largeClientData[`field_${i}`] = `client_value_${i}`
      }

      const conflict: Conflict = {
        conflict_id: 'conflict_perf_merge',
        conflict_type: ConflictType.VERSION,
        entity_type: EntityType.NOTE,
        entity_id: note.id,
        operation_id: 'op_perf_merge',
        server_data: {
          version: 2,
          data: largeServerData,
          modified_at: new Date().toISOString(),
          modified_by: testUser.user.id,
        },
        client_data: {
          version: 1,
          data: largeClientData,
          modified_at: new Date().toISOString(),
          operation_type: 'update' as any,
        },
        conflict_fields: Object.keys(largeServerData),
        suggested_strategy: ConflictResolutionStrategy.MERGE,
        timestamp: new Date().toISOString(),
      }

      const startTime = Date.now()

      const result = await syncService.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MERGE
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(500) // 应该在500ms内完成
    })
  })
})
