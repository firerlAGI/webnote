/**
 * T3-BE-05: 同步队列管理测试
 * 测试队列服务的各项功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { QueueService, QueuePriority, QueueOperationStatus } from '../../src/services/sync/QueueService'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// 测试配置
// ============================================================================

const TEST_USER_ID = 999999
const TEST_DEVICE_ID = 'test-device-001'
const TEST_CLIENT_ID = 'test-client-001'

// ============================================================================
// 测试套件
// ============================================================================

describe('QueueService', () => {
  let queueService: QueueService

  beforeAll(async () => {
    // 创建队列服务实例（使用最小配置）
    queueService = new QueueService(prisma, console as any, {
      maxQueueSize: 100,
      defaultMaxRetries: 3,
      retentionDays: 1,
      batchSize: 5,
      processingTimeout: 5000,
      alertThreshold: 10,
      cleanupInterval: 60000,
      alertCheckInterval: 60000
    })
  })

  afterAll(async () => {
    await queueService.shutdown()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 清理测试数据
    await prisma.$executeRaw`
      DELETE FROM "SyncQueue"
      WHERE user_id = ${TEST_USER_ID}
    `
  })

  // ============================================================================
  // 队列操作测试
  // ============================================================================

  describe('enqueue', () => {
    it('should successfully enqueue operations', async () => {
      const result = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          {
            type: 'create',
            entity_type: 'note',
            data: { title: 'Test Note', content: 'Test Content' }
          }
        ],
        priority: 'high'
      })

      expect(result.success).toBe(true)
      expect(result.queue_ids).toHaveLength(1)
      expect(result.queue_ids[0]).toBeDefined()
    })

    it('should reject enqueue when queue is full', async () => {
      const largeService = new QueueService(prisma, console as any, {
        maxQueueSize: 2,
        defaultMaxRetries: 3,
        retentionDays: 1,
        batchSize: 5,
        processingTimeout: 5000,
        alertThreshold: 10,
        cleanupInterval: 60000,
        alertCheckInterval: 60000
      })

      // 填充队列
      await largeService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'medium'
      })

      // 尝试添加更多操作
      const result = await largeService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 3' } }
        ],
        priority: 'medium'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Queue is full')

      await largeService.shutdown()
    })

    it('should handle multiple operations in a single enqueue', async () => {
      const result = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'update', entity_type: 'note', data: { title: 'Note 2' }, entity_id: 1 },
          { type: 'delete', entity_type: 'note', data: {}, entity_id: 2 }
        ],
        priority: 'medium'
      })

      expect(result.success).toBe(true)
      expect(result.queue_ids).toHaveLength(3)
    })
  })

  describe('dequeue', () => {
    it('should return operations in priority order (high first)', async () => {
      // 添加不同优先级的操作
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Low Priority' } }],
        priority: 'low'
      })

      await new Promise(resolve => setTimeout(resolve, 10)) // 确保时间差

      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'High Priority' } }],
        priority: 'high'
      })

      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Medium Priority' } }],
        priority: 'medium'
      })

      // 取出操作
      const operations = await queueService.dequeue(TEST_USER_ID, 3)

      expect(operations).toHaveLength(3)
      expect(operations[0].priority).toBe('high')
      expect(operations[1].priority).toBe('medium')
      expect(operations[2].priority).toBe('low')

      // 检查状态是否更新为processing
      for (const op of operations) {
        expect(op.status).toBe('processing')
      }
    })

    it('should return empty array when queue is empty', async () => {
      const operations = await queueService.dequeue(TEST_USER_ID, 5)
      expect(operations).toHaveLength(0)
    })

    it('should respect the limit parameter', async () => {
      // 添加多个操作
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: Array.from({ length: 10 }, (_, i) => ({
          type: 'create' as const,
          entity_type: 'note' as const,
          data: { title: `Note ${i}` }
        })),
        priority: 'medium'
      })

      // 只取出3个
      const operations = await queueService.dequeue(TEST_USER_ID, 3)
      expect(operations).toHaveLength(3)
    })
  })

  describe('markAsCompleted', () => {
    it('should mark operation as completed', async () => {
      // 入队操作
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Test' } }],
        priority: 'high'
      })

      // 出队操作
      const operations = await queueService.dequeue(TEST_USER_ID, 1)
      expect(operations).toHaveLength(1)

      // 标记为完成
      await queueService.markAsCompleted(operations[0].id)

      // 验证状态
      const { operations: completedOps } = await queueService.queryQueue(TEST_USER_ID, {
        status: 'completed'
      })
      expect(completedOps).toHaveLength(1)
      expect(completedOps[0].status).toBe('completed')
      expect(completedOps[0].completed_at).toBeDefined()
    })
  })

  describe('markAsFailed', () => {
    it('should mark operation as failed when max retries exceeded', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Test' } }],
        priority: 'high'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 1)
      const operation = operations[0]

      // 设置重试次数为最大值
      await prisma.$executeRaw`
        UPDATE "SyncQueue" SET retry_count = 2 WHERE id = ${operation.id}
      `

      // 标记为失败
      await queueService.markAsFailed(operation.id, 'Test error')

      // 验证状态为failed
      const { operations: failedOps } = await queueService.queryQueue(TEST_USER_ID, {
        status: 'failed'
      })
      expect(failedOps).toHaveLength(1)
      expect(failedOps[0].status).toBe('failed')
      expect(failedOps[0].retry_count).toBe(3)
      expect(failedOps[0].error).toBe('Test error')
    })

    it('should re-queue operation when retries remain', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Test' } }],
        priority: 'high'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 1)
      const operation = operations[0]

      // 标记为失败（还有重试次数）
      await queueService.markAsFailed(operation.id, 'Temporary error')

      // 验证状态重新变为pending
      const { operations: pendingOps } = await queueService.queryQueue(TEST_USER_ID, {
        status: 'pending'
      })
      expect(pendingOps).toHaveLength(1)
      expect(pendingOps[0].retry_count).toBe(1)
    })
  })

  describe('removeFromQueue', () => {
    it('should remove operation from queue', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Test' } }],
        priority: 'high'
      })

      const success = await queueService.removeFromQueue(queue_ids[0], TEST_USER_ID)
      expect(success).toBe(true)

      // 验证操作已被删除
      const { total } = await queueService.queryQueue(TEST_USER_ID)
      expect(total).toBe(0)
    })

    it('should return false when operation not found', async () => {
      const success = await queueService.removeFromQueue('non-existent-id', TEST_USER_ID)
      expect(success).toBe(false)
    })
  })

  describe('clearQueue', () => {
    it('should clear all operations for user', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: Array.from({ length: 5 }, (_, i) => ({
          type: 'create' as const,
          entity_type: 'note' as const,
          data: { title: `Note ${i}` }
        })),
        priority: 'medium'
      })

      const deletedCount = await queueService.clearQueue(TEST_USER_ID)
      expect(deletedCount).toBe(5)

      // 验证队列为空
      const { total } = await queueService.queryQueue(TEST_USER_ID)
      expect(total).toBe(0)
    })
  })

  // ============================================================================
  // 队列查询测试
  // ============================================================================

  describe('getQueueStatus', () => {
    it('should return correct queue statistics', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'high'
      })

      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 3' } }
        ],
        priority: 'medium'
      })

      const status = await queueService.getQueueStatus(TEST_USER_ID)

      expect(status.user_id).toBe(TEST_USER_ID)
      expect(status.total_operations).toBe(3)
      expect(status.pending_operations).toBe(3)
      expect(status.high_priority_count).toBe(2)
      expect(status.medium_priority_count).toBe(1)
      expect(status.low_priority_count).toBe(0)
      expect(status.oldest_pending_operation).toBeDefined()
      expect(status.newest_pending_operation).toBeDefined()
    })
  })

  describe('queryQueue', () => {
    it('should filter operations by status', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'medium'
      })

      // 标记第一个操作为完成
      await queueService.markAsCompleted(queue_ids[0])

      // 查询待处理操作
      const { operations: pendingOps } = await queueService.queryQueue(TEST_USER_ID, {
        status: 'pending'
      })
      expect(pendingOps).toHaveLength(1)

      // 查询已完成操作
      const { operations: completedOps } = await queueService.queryQueue(TEST_USER_ID, {
        status: 'completed'
      })
      expect(completedOps).toHaveLength(1)
    })

    it('should filter operations by entity type', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note' } },
          { type: 'create', entity_type: 'folder', data: { name: 'Folder' } },
          { type: 'create', entity_type: 'review', data: { content: 'Review' } }
        ],
        priority: 'medium'
      })

      const { operations: noteOps } = await queueService.queryQueue(TEST_USER_ID, {
        entity_type: 'note'
      })
      expect(noteOps).toHaveLength(1)
      expect(noteOps[0].entity_type).toBe('note')
    })

    it('should support pagination', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: Array.from({ length: 10 }, (_, i) => ({
          type: 'create' as const,
          entity_type: 'note' as const,
          data: { title: `Note ${i}` }
        })),
        priority: 'medium'
      })

      const { operations: page1, total } = await queueService.queryQueue(TEST_USER_ID, {
        limit: 3,
        offset: 0
      })
      expect(page1).toHaveLength(3)
      expect(total).toBe(10)

      const { operations: page2 } = await queueService.queryQueue(TEST_USER_ID, {
        limit: 3,
        offset: 3
      })
      expect(page2).toHaveLength(3)
    })
  })

  describe('getPerformanceStats', () => {
    it('should return performance statistics', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'medium'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 2)

      // 标记第一个为完成
      await queueService.markAsCompleted(operations[0].id)

      // 标记第二个为失败
      await queueService.markAsFailed(operations[1].id, 'Test error')

      const stats = await queueService.getPerformanceStats(TEST_USER_ID)

      expect(stats.total_processed).toBe(2)
      expect(stats.total_success).toBe(1)
      expect(stats.total_failed).toBe(1)
      expect(stats.success_rate).toBe(0.5)
      expect(stats.avg_processing_time).toBeGreaterThanOrEqual(0)
    })
  })

  // ============================================================================
  // 处理队列测试
  // ============================================================================

  describe('processQueue', () => {
    it('should process queued operations', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'medium'
      })

      const result = await queueService.processQueue(TEST_USER_ID, async (operation) => {
        // 模拟处理
        await new Promise(resolve => setTimeout(resolve, 10))
        return { success: true }
      })

      expect(result.processed_count).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(result.results[0].status).toBe('completed')
      expect(result.results[1].status).toBe('completed')
    })

    it('should handle processing errors', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } }
        ],
        priority: 'medium'
      })

      const result = await queueService.processQueue(TEST_USER_ID, async (operation) => {
        throw new Error('Processing error')
      })

      expect(result.processed_count).toBe(1)
      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toBeDefined()
    })
  })

  // ============================================================================
  // 持久化和恢复测试
  // ============================================================================

  describe('recoverQueue', () => {
    it('should recover operations from database', async () => {
      await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'high'
      })

      const recovered = await queueService.recoverQueue(TEST_USER_ID)
      expect(recovered).toHaveLength(2)
      expect(recovered[0].status).toBe('pending')
    })

    it('should reset timed-out operations', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Note 1' } }],
        priority: 'high'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 1)

      // 手动设置started_at为很久以前
      await prisma.$executeRaw`
        UPDATE "SyncQueue"
        SET started_at = NOW() - INTERVAL '1 minute'
        WHERE id = ${operations[0].id}
      `

      // 使用短超时的服务恢复队列
      const shortTimeoutService = new QueueService(prisma, console as any, {
        maxQueueSize: 100,
        defaultMaxRetries: 3,
        retentionDays: 1,
        batchSize: 5,
        processingTimeout: 1000, // 1秒超时
        alertThreshold: 10,
        cleanupInterval: 60000,
        alertCheckInterval: 60000
      })

      const recovered = await shortTimeoutService.recoverQueue(TEST_USER_ID)
      expect(recovered).toHaveLength(1)
      expect(recovered[0].status).toBe('pending')
      expect(recovered[0].retry_count).toBe(1)

      await shortTimeoutService.shutdown()
    })
  })

  // ============================================================================
  // 清理测试
  // ============================================================================

  describe('cleanupOldOperations', () => {
    it('should remove old completed and failed operations', async () => {
      // 添加并完成操作
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [
          { type: 'create', entity_type: 'note', data: { title: 'Note 1' } },
          { type: 'create', entity_type: 'note', data: { title: 'Note 2' } }
        ],
        priority: 'medium'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 2)
      await queueService.markAsCompleted(operations[0].id)
      await queueService.markAsFailed(operations[1].id, 'Test error')

      // 手动设置completed_at为很久以前
      await prisma.$executeRaw`
        UPDATE "SyncQueue"
        SET completed_at = NOW() - INTERVAL '2 days'
        WHERE user_id = ${TEST_USER_ID}
      `

      // 清理1天前的操作
      const deletedCount = await queueService.cleanupOldOperations(1)
      expect(deletedCount).toBe(2)

      // 验证操作已被删除
      const { total } = await queueService.queryQueue(TEST_USER_ID)
      expect(total).toBe(0)
    })

    it('should not remove recent operations', async () => {
      const { queue_ids } = await queueService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: [{ type: 'create', entity_type: 'note', data: { title: 'Note 1' } }],
        priority: 'medium'
      })

      const operations = await queueService.dequeue(TEST_USER_ID, 1)
      await queueService.markAsCompleted(operations[0].id)

      // 清理30天前的操作（不会影响最近的操作）
      const deletedCount = await queueService.cleanupOldOperations(30)
      expect(deletedCount).toBe(0)

      // 验证操作仍然存在
      const { total } = await queueService.queryQueue(TEST_USER_ID)
      expect(total).toBe(1)
    })
  })

  // ============================================================================
  // 告警测试
  // ============================================================================

  describe('alert callbacks', () => {
    it('should trigger alert callback when threshold exceeded', async () => {
      const alertThresholdService = new QueueService(prisma, console as any, {
        maxQueueSize: 100,
        defaultMaxRetries: 3,
        retentionDays: 1,
        batchSize: 5,
        processingTimeout: 5000,
        alertThreshold: 2, // 低阈值
        cleanupInterval: 60000,
        alertCheckInterval: 60000
      })

      let alertTriggered = false
      let alertMessage = ''

      alertThresholdService.addAlertCallback((alert) => {
        if (alert.alert_type === 'high_pending_count') {
          alertTriggered = true
          alertMessage = alert.message
        }
      })

      // 添加超过阈值的操作
      await alertThresholdService.enqueue({
        user_id: TEST_USER_ID,
        device_id: TEST_DEVICE_ID,
        client_id: TEST_CLIENT_ID,
        operations: Array.from({ length: 5 }, (_, i) => ({
          type: 'create' as const,
          entity_type: 'note' as const,
          data: { title: `Note ${i}` }
        })),
        priority: 'medium'
      })

      // 手动触发告警检查
      await alertThresholdService.checkAlertThreshold(TEST_USER_ID)

      expect(alertTriggered).toBe(true)
      expect(alertMessage).toContain('High pending operation count')

      await alertThresholdService.shutdown()
    })
  })
})
