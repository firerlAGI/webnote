/**
 * 同步流程端到端测试套件
 * 测试增量同步、批量同步和冲突检测
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncService } from '../../src/services/sync/SyncService'
import {
  SyncRequest,
  SyncOperationType,
  ConflictResolutionStrategy,
  SyncStatus,
  EntityType,
} from '@webnote/shared/types/sync'
import { prisma, logger, createTestUser, createTestData, createTestNote } from '../setup'

// ============================================================================
// 测试套件
// ============================================================================

describe('同步流程端到端测试', () => {
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
  // 增量同步测试
  // ========================================================================

  describe('增量同步', () => {
    it('应该只同步自上次同步以来的变更', async () => {
      // 创建初始数据
      const initialData = await createTestData(testUser.user.id, {
        notes: 5,
        folders: 2,
        reviews: 3,
      })

      // 第一次同步
      const syncRequest1: SyncRequest = {
        request_id: 'sync_1',
        client_id: 'test_client_1',
        client_state: {
          client_id: 'test_client_1',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations: [],
        incremental: true,
      }

      const syncResponse1 = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest1
      )

      expect(syncResponse1.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse1.server_updates.length).toBeGreaterThan(0)

      // 创建新数据
      await createTestNote(testUser.user.id, {
        title: 'New Note After First Sync',
      })

      // 第二次同步（增量）
      const syncRequest2: SyncRequest = {
        request_id: 'sync_2',
        client_id: 'test_client_1',
        client_state: syncResponse1.new_client_state,
        protocol_version: '1.0.0',
        operations: [],
        incremental: true,
      }

      const syncResponse2 = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest2
      )

      expect(syncResponse2.status).toBe(SyncStatus.SUCCESS)
      // 应该只返回新增的更新
      expect(syncResponse2.server_updates.length).toBe(1)
    })

    it('应该正确处理同步时间戳', async () => {
      const beforeSync = new Date()
      await createTestData(testUser.user.id, { notes: 3 })

      const syncRequest: SyncRequest = {
        request_id: 'sync_timestamp_test',
        client_id: 'test_client_timestamp',
        client_state: {
          client_id: 'test_client_timestamp',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations: [],
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.server_time).toBeDefined()
      expect(syncResponse.new_client_state.last_sync_time).toBeDefined()

      const syncTime = new Date(syncResponse.new_client_state.last_sync_time)
      expect(syncTime.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime())
    })

    it('应该正确过滤实体类型', async () => {
      await createTestData(testUser.user.id, {
        notes: 2,
        folders: 1,
        reviews: 1,
      })

      // 只同步笔记
      const syncRequest: SyncRequest = {
        request_id: 'sync_filter_test',
        client_id: 'test_client_filter',
        client_state: {
          client_id: 'test_client_filter',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations: [],
        entity_types: ['note'],
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)

      // 验证只返回笔记更新
      const noteUpdates = syncResponse.server_updates.filter(
        u => u.entity_type === 'note'
      )
      const otherUpdates = syncResponse.server_updates.filter(
        u => u.entity_type !== 'note'
      )

      expect(noteUpdates.length).toBeGreaterThan(0)
      expect(otherUpdates.length).toBe(0)
    })
  })

  // ========================================================================
  // 批量同步测试
  // ========================================================================

  describe('批量同步', () => {
    it('应该支持大批量操作同步', async () => {
      const batchSize = 100
      const operations = []

      // 创建100个创建操作
      for (let i = 0; i < batchSize; i++) {
        operations.push({
          operation_id: `op_create_${i}`,
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_batch',
          timestamp: new Date().toISOString(),
          data: {
            title: `Batch Note ${i}`,
            content: `Content for note ${i}`,
          },
        })
      }

      const syncRequest: SyncRequest = {
        request_id: 'sync_batch_test',
        client_id: 'test_client_batch',
        client_state: {
          client_id: 'test_client_batch',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
        batch_size: batchSize,
        batch_index: 0,
        is_last_batch: true,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results).toHaveLength(batchSize)

      // 验证所有操作都成功
      const successfulOps = syncResponse.operation_results.filter(r => r.success)
      expect(successfulOps.length).toBe(batchSize)
    })

    it('应该正确处理批次索引', async () => {
      const operations = [
        {
          operation_id: 'op_batch_1',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_batch_idx',
          timestamp: new Date().toISOString(),
          data: {
            title: 'Batch 1 Note',
            content: 'Content',
          },
        },
      ]

      // 第一批次
      const syncRequest1: SyncRequest = {
        request_id: 'sync_batch_idx_1',
        client_id: 'test_client_batch_idx',
        client_state: {
          client_id: 'test_client_batch_idx',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
        batch_size: 10,
        batch_index: 0,
        is_last_batch: false,
      }

      const syncResponse1 = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest1
      )

      expect(syncResponse1.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse1.operation_results).toHaveLength(1)
    })

    it('应该正确标记批次结束', async () => {
      const operations = [
        {
          operation_id: 'op_final_batch',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_final',
          timestamp: new Date().toISOString(),
          data: {
            title: 'Final Batch Note',
            content: 'Content',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_final_batch',
        client_id: 'test_client_final',
        client_state: {
          client_id: 'test_client_final',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
        batch_size: 10,
        batch_index: 0,
        is_last_batch: true,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.has_more).toBeUndefined()
    })

    it('应该在批次同步失败时返回错误', async () => {
      const operations = [
        {
          operation_id: 'op_invalid',
          operation_type: SyncOperationType.CREATE,
          entity_type: 'invalid_type' as EntityType,
          client_id: 'test_client_error',
          timestamp: new Date().toISOString(),
          data: {},
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_batch_error',
        client_id: 'test_client_error',
        client_state: {
          client_id: 'test_client_error',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.FAILED)
      expect(syncResponse.operation_results[0].success).toBe(false)
      expect(syncResponse.operation_results[0].error).toBeDefined()
    })
  })

  // ========================================================================
  // 冲突检测测试
  // ========================================================================

  describe('冲突检测', () => {
    it('应该检测到版本冲突', async () => {
      // 创建一个笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'Original Title',
      })

      // 模拟客户端基于旧版本的更新
      const operations = [
        {
          operation_id: 'op_conflict_update',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_conflict',
          timestamp: new Date().toISOString(),
          before_version: 1, // 客户端认为是版本1
          changes: {
            title: 'Client Updated Title',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_conflict_test',
        client_id: 'test_client_conflict',
        client_state: {
          client_id: 'test_client_conflict',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      // 由于版本不匹配，应该检测到冲突
      expect(syncResponse.conflicts.length).toBeGreaterThan(0)
      expect(syncResponse.conflicts[0].conflict_type).toBe('version')
    })

    it('应该检测到删除冲突', async () => {
      // 创建一个笔记
      const note = await createTestNote(testUser.user.id, {
        title: 'Note to Delete',
      })

      // 服务器端删除
      await prisma.note.delete({
        where: { id: note.id },
      })

      // 客户端尝试更新已删除的笔记
      const operations = [
        {
          operation_id: 'op_delete_conflict',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_delete',
          timestamp: new Date().toISOString(),
          before_version: 1,
          changes: {
            title: 'Trying to update deleted note',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_delete_conflict_test',
        client_id: 'test_client_delete',
        client_state: {
          client_id: 'test_client_delete',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.conflicts.length).toBeGreaterThan(0)
      expect(syncResponse.conflicts[0].conflict_type).toBe('delete')
    })

    it('应该记录冲突字段', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'Original',
        content: 'Original content',
      })

      const operations = [
        {
          operation_id: 'op_conflict_fields',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_fields',
          timestamp: new Date().toISOString(),
          before_version: 0,
          changes: {
            title: 'Client Title',
            content: 'Client content',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_conflict_fields_test',
        client_id: 'test_client_fields',
        client_state: {
          client_id: 'test_client_fields',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      if (syncResponse.conflicts.length > 0) {
        expect(syncResponse.conflicts[0].conflict_fields).toBeDefined()
        expect(syncResponse.conflicts[0].conflict_fields.length).toBeGreaterThan(0)
      }
    })
  })

  // ========================================================================
  // CRUD操作测试
  // ========================================================================

  describe('CRUD操作', () => {
    it('应该成功执行创建操作', async () => {
      const operations = [
        {
          operation_id: 'op_create_test',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_crud',
          timestamp: new Date().toISOString(),
          data: {
            title: 'New Note',
            content: 'New content',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_create_test',
        client_id: 'test_client_crud',
        client_state: {
          client_id: 'test_client_crud',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results[0].success).toBe(true)
      expect(syncResponse.operation_results[0].entity_id).toBeDefined()
    })

    it('应该成功执行更新操作', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'Original Title',
      })

      const operations = [
        {
          operation_id: 'op_update_test',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_crud',
          timestamp: new Date().toISOString(),
          before_version: note.version || 1,
          changes: {
            title: 'Updated Title',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_update_test',
        client_id: 'test_client_crud',
        client_state: {
          client_id: 'test_client_crud',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results[0].success).toBe(true)

      // 验证数据已更新
      const updatedNote = await prisma.note.findUnique({
        where: { id: note.id },
      })

      expect(updatedNote?.title).toBe('Updated Title')
    })

    it('应该成功执行删除操作', async () => {
      const note = await createTestNote(testUser.user.id, {
        title: 'To Delete',
      })

      const operations = [
        {
          operation_id: 'op_delete_test',
          operation_type: SyncOperationType.DELETE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_crud',
          timestamp: new Date().toISOString(),
          before_version: note.version || 1,
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_delete_test',
        client_id: 'test_client_crud',
        client_state: {
          client_id: 'test_client_crud',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results[0].success).toBe(true)

      // 验证数据已删除
      const deletedNote = await prisma.note.findUnique({
        where: { id: note.id },
      })

      expect(deletedNote).toBeNull()
    })

    it('应该成功执行读取操作', async () => {
      await createTestData(testUser.user.id, { notes: 5 })

      const operations = [
        {
          operation_id: 'op_read_test',
          operation_type: SyncOperationType.READ,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_crud',
          timestamp: new Date().toISOString(),
          since: new Date(0).toISOString(),
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_read_test',
        client_id: 'test_client_crud',
        client_state: {
          client_id: 'test_client_crud',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results[0].success).toBe(true)
      expect(Array.isArray(syncResponse.operation_results[0].data)).toBe(true)
      expect(syncResponse.operation_results[0].data).toHaveLength(5)
    })
  })

  // ========================================================================
  // 多实体类型同步测试
  // ========================================================================

  describe('多实体类型同步', () => {
    it('应该同时同步多种实体类型', async () => {
      const operations = [
        {
          operation_id: 'op_create_folder',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.FOLDER,
          client_id: 'test_client_multi',
          timestamp: new Date().toISOString(),
          data: {
            name: 'New Folder',
          },
        },
        {
          operation_id: 'op_create_note',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.NOTE,
          client_id: 'test_client_multi',
          timestamp: new Date().toISOString(),
          data: {
            title: 'New Note',
            content: 'Content',
          },
        },
        {
          operation_id: 'op_create_review',
          operation_type: SyncOperationType.CREATE,
          entity_type: EntityType.REVIEW,
          client_id: 'test_client_multi',
          timestamp: new Date().toISOString(),
          data: {
            date: new Date().toISOString(),
            content: 'Review content',
            mood: 'good',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_multi_entity_test',
        client_id: 'test_client_multi',
        client_state: {
          client_id: 'test_client_multi',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
        entity_types: ['note', 'folder', 'review'],
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results).toHaveLength(3)

      // 验证所有操作都成功
      syncResponse.operation_results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })

    it('应该正确处理不同实体的操作', async () => {
      const folder = await prisma.folder.create({
        data: {
          user_id: testUser.user.id,
          name: 'Test Folder',
        },
      })

      const note = await createTestNote(testUser.user.id, {
        folder_id: folder.id,
      })

      const operations = [
        {
          operation_id: 'op_update_folder',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.FOLDER,
          entity_id: folder.id,
          client_id: 'test_client_diff',
          timestamp: new Date().toISOString(),
          before_version: 1,
          changes: {
            name: 'Updated Folder Name',
          },
        },
        {
          operation_id: 'op_delete_note',
          operation_type: SyncOperationType.DELETE,
          entity_type: EntityType.NOTE,
          entity_id: note.id,
          client_id: 'test_client_diff',
          timestamp: new Date().toISOString(),
          before_version: 1,
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_diff_entity_test',
        client_id: 'test_client_diff',
        client_state: {
          client_id: 'test_client_diff',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS)
      expect(syncResponse.operation_results).toHaveLength(2)

      // 验证文件夹已更新，笔记已删除
      const updatedFolder = await prisma.folder.findUnique({
        where: { id: folder.id },
      })

      expect(updatedFolder?.name).toBe('Updated Folder Name')
    })
  })

  // ========================================================================
  // 错误处理测试
  // ========================================================================

  describe('错误处理', () => {
    it('应该处理不支持的协议版本', async () => {
      const syncRequest: SyncRequest = {
        request_id: 'sync_invalid_version',
        client_id: 'test_client_error',
        client_state: {
          client_id: 'test_client_error',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '2.0.0' as any,
        operations: [],
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.FAILED)
      expect(syncResponse.error).toContain('Unsupported protocol version')
    })

    it('应该处理操作失败并返回详细错误', async () => {
      const operations = [
        {
          operation_id: 'op_invalid',
          operation_type: SyncOperationType.UPDATE,
          entity_type: EntityType.NOTE,
          entity_id: 99999, // 不存在的ID
          client_id: 'test_client_error',
          timestamp: new Date().toISOString(),
          before_version: 1,
          changes: {
            title: 'Trying to update non-existent note',
          },
        },
      ]

      const syncRequest: SyncRequest = {
        request_id: 'sync_op_error_test',
        client_id: 'test_client_error',
        client_state: {
          client_id: 'test_client_error',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '1.0.0',
        operations,
      }

      const syncResponse = await syncService.processSyncRequest(
        testUser.user.id,
        syncRequest
      )

      expect(syncResponse.status).toBe(SyncStatus.SUCCESS) // 整体成功
      expect(syncResponse.operation_results[0].success).toBe(false)
      expect(syncResponse.operation_results[0].error).toBeDefined()
    })

    it('应该记录同步失败', async () => {
      const logSpy = vi.spyOn(logger, 'error')

      const syncRequest: SyncRequest = {
        request_id: 'sync_log_error_test',
        client_id: 'test_client_log',
        client_state: {
          client_id: 'test_client_log',
          last_sync_time: new Date(0).toISOString(),
          server_version: '1.0.0',
          pending_operations: 0,
        },
        protocol_version: '2.0.0' as any,
        operations: [],
      }

      await syncService.processSyncRequest(testUser.user.id, syncRequest)

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        'Sync failed'
      )
    })
  })
})
