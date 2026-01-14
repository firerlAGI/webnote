/**
 * T3项目同步队列管理服务
 * 负责同步操作的队列管理、优先级处理、持久化和监控
 */

import { PrismaClient } from '@prisma/client'
import { Logger } from 'pino'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 优先级类型
 */
export type QueuePriority = 'high' | 'medium' | 'low'

/**
 * 队列操作状态
 */
export type QueueOperationStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * 队列中的同步操作
 */
export interface QueuedSyncOperation {
  /** 操作ID */
  id: string
  /** 用户ID */
  user_id: number
  /** 设备ID */
  device_id: string
  /** 客户端ID */
  client_id: string
  /** 操作类型 */
  operation_type: 'create' | 'update' | 'delete'
  /** 实体类型 */
  entity_type: 'note' | 'folder' | 'review'
  /** 实体数据 */
  entity_data: Record<string, any>
  /** 实体ID（更新和删除时需要） */
  entity_id?: number
  /** 优先级 */
  priority: QueuePriority
  /** 重试次数 */
  retry_count: number
  /** 最大重试次数 */
  max_retries: number
  /** 状态 */
  status: QueueOperationStatus
  /** 错误信息 */
  error?: string
  /** 创建时间 */
  created_at: Date
  /** 更新时间 */
  updated_at: Date
  /** 预定执行时间 */
  scheduled_at?: Date
  /** 完成时间 */
  completed_at?: Date
  /** 处理开始时间 */
  started_at?: Date
}

/**
 * 队列状态统计
 */
export interface SyncQueueStatus {
  /** 用户ID */
  user_id: number
  /** 总操作数 */
  total_operations: number
  /** 待处理操作数 */
  pending_operations: number
  /** 处理中操作数 */
  processing_operations: number
  /** 已完成操作数 */
  completed_operations: number
  /** 失败操作数 */
  failed_operations: number
  /** 高优先级操作数 */
  high_priority_count: number
  /** 中优先级操作数 */
  medium_priority_count: number
  /** 低优先级操作数 */
  low_priority_count: number
  /** 最老的待处理操作时间 */
  oldest_pending_operation?: Date
  /** 最新的待处理操作时间 */
  newest_pending_operation?: Date
}

/**
 * 队列性能统计
 */
export interface QueuePerformanceStats {
  /** 平均处理时间（毫秒） */
  avg_processing_time: number
  /** 成功率 */
  success_rate: number
  /** 平均重试次数 */
  avg_retry_count: number
  /** 总处理操作数 */
  total_processed: number
  /** 总成功操作数 */
  total_success: number
  /** 总失败操作数 */
  total_failed: number
  /** 处理中的操作数 */
  processing_count: number
}

/**
 * 队列配置
 */
export interface QueueServiceConfig {
  /** 最大队列长度 */
  maxQueueSize: number
  /** 默认最大重试次数 */
  defaultMaxRetries: number
  /** 清理保留天数 */
  retentionDays: number
  /** 批次大小 */
  batchSize: number
  /** 处理超时时间（毫秒） */
  processingTimeout: number
  /** 告警阈值 - 待处理操作数 */
  alertThreshold: number
  /** 自动清理间隔（毫秒） */
  cleanupInterval: number
  /** 告警检查间隔（毫秒） */
  alertCheckInterval: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: QueueServiceConfig = {
  maxQueueSize: 1000,
  defaultMaxRetries: 3,
  retentionDays: 30,
  batchSize: 20,
  processingTimeout: 30000,
  alertThreshold: 100,
  cleanupInterval: 3600000, // 1小时
  alertCheckInterval: 60000 // 1分钟
}

/**
 * 添加到队列请求
 */
export interface EnqueueRequest {
  /** 用户ID */
  user_id: number
  /** 设备ID */
  device_id: string
  /** 客户端ID */
  client_id: string
  /** 操作列表 */
  operations: Array<{
    /** 操作类型 */
    type: 'create' | 'update' | 'delete'
    /** 实体类型 */
    entity_type: 'note' | 'folder' | 'review'
    /** 实体数据 */
    data: Record<string, any>
    /** 实体ID（更新和删除时需要） */
    entity_id?: number
  }>
  /** 优先级 */
  priority: QueuePriority
  /** 预定执行时间（可选） */
  scheduled_at?: Date | string
}

/**
 * 处理队列响应
 */
export interface ProcessQueueResponse {
  /** 处理的操作数量 */
  processed_count: number
  /** 处理结果 */
  results: Array<{
    /** 操作ID */
    operation_id: string
    /** 状态 */
    status: 'completed' | 'failed'
    /** 错误信息 */
    error?: string
  }>
}

/**
 * 队列告警
 */
export interface QueueAlert {
  /** 告警ID */
  alert_id: string
  /** 告警类型 */
  alert_type: 'queue_full' | 'high_pending_count' | 'high_failure_rate' | 'processing_timeout'
  /** 告警消息 */
  message: string
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** 时间戳 */
  timestamp: Date
  /** 用户ID（可选，特定用户告警） */
  user_id?: number
  /** 相关数据 */
  data: Record<string, any>
}

/**
 * 告警回调
 */
export type AlertCallback = (alert: QueueAlert) => void

// ============================================================================
// 队列服务类
// ============================================================================

/**
 * 同步队列管理服务
 */
export class QueueService {
  private prisma: PrismaClient
  private logger: Logger
  private config: QueueServiceConfig
  private alertCallbacks: Set<AlertCallback>
  private cleanupTimer: NodeJS.Timeout | null = null
  private alertCheckTimer: NodeJS.Timeout | null = null
  private processingSet: Set<string>

  constructor(prisma: PrismaClient, logger: Logger, config: Partial<QueueServiceConfig> = {}) {
    this.prisma = prisma
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.alertCallbacks = new Set()
    this.processingSet = new Set()

    this.startCleanupTimer()
    this.startAlertCheckTimer()

    this.logger.info('QueueService initialized', { config: this.config })
  }

  // ============================================================================
  // 优先级处理
  // ============================================================================

  /**
   * 获取优先级权重（用于排序）
   */
  private getPriorityWeight(priority: QueuePriority): number {
    switch (priority) {
      case 'high': return 3
      case 'medium': return 2
      case 'low': return 1
      default: return 0
    }
  }

  /**
   * 根据优先级和创建时间排序
   */
  private sortOperations(operations: QueuedSyncOperation[]): QueuedSyncOperation[] {
    return operations.sort((a, b) => {
      // 先按优先级排序（高优先级在前）
      const priorityDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority)
      if (priorityDiff !== 0) return priorityDiff

      // 相同优先级按创建时间排序（旧操作在前）
      return a.created_at.getTime() - b.created_at.getTime()
    })
  }

  // ============================================================================
  // 队列操作
  // ============================================================================

  /**
   * 添加操作到队列
   */
  async enqueue(request: EnqueueRequest): Promise<{ success: boolean; queue_ids: string[]; error?: string }> {
    const { user_id, device_id, client_id, operations, priority, scheduled_at } = request
    const queue_ids: string[] = []

    try {
      // 检查当前队列大小
      const currentSize = await this.getQueueSize(user_id)
      if (currentSize + operations.length > this.config.maxQueueSize) {
        this.logger.warn({
          user_id,
          current_size: currentSize,
          new_operations: operations.length,
          max_size: this.config.maxQueueSize
        }, 'Queue is full')

        // 发送队列已满告警
        this.triggerAlert({
          alert_id: uuidv4(),
          alert_type: 'queue_full',
          message: `Queue is full for user ${user_id}. Current size: ${currentSize}, new operations: ${operations.length}`,
          severity: 'critical',
          timestamp: new Date(),
          user_id,
          data: { current_size: currentSize, new_operations: operations.length }
        })

        return {
          success: false,
          queue_ids: [],
          error: `Queue is full (max size: ${this.config.maxQueueSize})`
        }
      }

      // 批量创建操作
      const now = new Date()
      for (const op of operations) {
        const operationId = uuidv4()
        queue_ids.push(operationId)

        await this.prisma.$executeRaw`
          INSERT INTO "SyncQueue" (
            id, user_id, device_id, client_id,
            operation_type, entity_type, entity_data, entity_id,
            priority, retry_count, max_retries, status,
            created_at, updated_at, scheduled_at
          ) VALUES (
            ${operationId}, ${user_id}, ${device_id}, ${client_id},
            ${op.type}, ${op.entity_type}, ${JSON.stringify(op.data)}::jsonb, ${op.entity_id || null},
            ${priority}, 0, ${this.config.defaultMaxRetries}, 'pending',
            ${now}, ${now}, ${scheduled_at || null}
          )
        `
      }

      this.logger.info({
        user_id,
        client_id,
        operation_count: operations.length,
        priority
      }, 'Operations added to queue')

      // 检查是否需要告警
      await this.checkAlertThreshold(user_id)

      return { success: true, queue_ids }
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to enqueue operations')
      return {
        success: false,
        queue_ids: [],
        error: (error as Error).message
      }
    }
  }

  /**
   * 从队列中取出操作（按优先级）
   */
  async dequeue(user_id: number, limit: number = this.config.batchSize): Promise<QueuedSyncOperation[]> {
    try {
      const operations = await this.prisma.$queryRaw<QueuedSyncOperation[]>`
        SELECT * FROM "SyncQueue"
        WHERE user_id = ${user_id}
          AND status = 'pending'
          AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC
        LIMIT ${limit}
      `

      // 标记为处理中
      if (operations.length > 0) {
        const operationIds = operations.map(op => op.id)
        await this.prisma.$executeRaw`
          UPDATE "SyncQueue"
          SET status = 'processing',
              updated_at = NOW(),
              started_at = NOW()
          WHERE id = ANY(${operationIds})
        `

        // 添加到处理集合
        operations.forEach(op => this.processingSet.add(op.id))

        this.logger.debug({
          user_id,
          operation_count: operations.length
        }, 'Operations dequeued')
      }

      return operations
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to dequeue operations')
      return []
    }
  }

  /**
   * 标记操作为已完成
   */
  async markAsCompleted(operationId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE "SyncQueue"
        SET status = 'completed',
            updated_at = NOW(),
            completed_at = NOW()
        WHERE id = ${operationId}
      `

      this.processingSet.delete(operationId)
      this.logger.debug({ operation_id: operationId }, 'Operation marked as completed')
    } catch (error) {
      this.logger.error({ error, operation_id: operationId }, 'Failed to mark operation as completed')
    }
  }

  /**
   * 标记操作为失败（带重试逻辑）
   */
  async markAsFailed(operationId: string, error: string): Promise<boolean> {
    try {
      // 获取操作信息
      const operation = await this.prisma.$queryRaw<Array<{ retry_count: number; max_retries: number }>>`
        SELECT retry_count, max_retries FROM "SyncQueue"
        WHERE id = ${operationId}
      `

      if (!operation || operation.length === 0) {
        this.logger.warn({ operation_id: operationId }, 'Operation not found')
        return false
      }

      const { retry_count, max_retries } = operation[0]
      const newRetryCount = retry_count + 1

      if (newRetryCount >= max_retries) {
        // 超过最大重试次数，标记为失败
        await this.prisma.$executeRaw`
          UPDATE "SyncQueue"
          SET status = 'failed',
              retry_count = ${newRetryCount},
              error = ${error},
              updated_at = NOW(),
              completed_at = NOW()
          WHERE id = ${operationId}
        `

        this.logger.warn({
          operation_id: operationId,
          retry_count: newRetryCount,
          error
        }, 'Operation marked as failed (max retries exceeded)')
      } else {
        // 重新入队
        await this.prisma.$executeRaw`
          UPDATE "SyncQueue"
          SET status = 'pending',
              retry_count = ${newRetryCount},
              error = ${error},
              updated_at = NOW()
          WHERE id = ${operationId}
        `

        this.logger.info({
          operation_id: operationId,
          retry_count: newRetryCount,
          error
        }, 'Operation re-queued for retry')
      }

      this.processingSet.delete(operationId)
      return true
    } catch (error) {
      this.logger.error({ error, operation_id: operationId }, 'Failed to mark operation as failed')
      return false
    }
  }

  /**
   * 从队列中移除操作
   */
  async removeFromQueue(operationId: string, userId: number): Promise<boolean> {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "SyncQueue"
        WHERE id = ${operationId} AND user_id = ${userId}
      `

      this.processingSet.delete(operationId)

      this.logger.info({
        operation_id: operationId,
        user_id: userId
      }, 'Operation removed from queue')

      return result > 0
    } catch (error) {
      this.logger.error({ error, operation_id: operationId, user_id: userId }, 'Failed to remove operation from queue')
      return false
    }
  }

  /**
   * 清空用户队列
   */
  async clearQueue(user_id: number): Promise<number> {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "SyncQueue"
        WHERE user_id = ${user_id}
      `

      this.logger.info({
        user_id,
        deleted_count: result
      }, 'Queue cleared for user')

      return result
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to clear queue')
      return 0
    }
  }

  // ============================================================================
  // 队列查询
  // ============================================================================

  /**
   * 获取队列大小
   */
  async getQueueSize(user_id: number): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "SyncQueue"
        WHERE user_id = ${user_id}
      `

      return Number(result[0]?.count || 0)
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to get queue size')
      return 0
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(user_id: number): Promise<SyncQueueStatus> {
    try {
      const result = await this.prisma.$queryRaw<Array<{
        total_operations: bigint
        pending_operations: bigint
        processing_operations: bigint
        completed_operations: bigint
        failed_operations: bigint
        high_priority_count: bigint
        medium_priority_count: bigint
        low_priority_count: bigint
        oldest_pending_operation: Date | null
        newest_pending_operation: Date | null
      }>>`
        SELECT
          COUNT(*) as total_operations,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_operations,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_operations,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_operations,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
          COUNT(*) FILTER (WHERE status = 'pending' AND priority = 'high') as high_priority_count,
          COUNT(*) FILTER (WHERE status = 'pending' AND priority = 'medium') as medium_priority_count,
          COUNT(*) FILTER (WHERE status = 'pending' AND priority = 'low') as low_priority_count,
          MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending_operation,
          MAX(created_at) FILTER (WHERE status = 'pending') as newest_pending_operation
        FROM "SyncQueue"
        WHERE user_id = ${user_id}
      `

      const row = result[0]

      return {
        user_id,
        total_operations: Number(row.total_operations),
        pending_operations: Number(row.pending_operations),
        processing_operations: Number(row.processing_operations),
        completed_operations: Number(row.completed_operations),
        failed_operations: Number(row.failed_operations),
        high_priority_count: Number(row.high_priority_count),
        medium_priority_count: Number(row.medium_priority_count),
        low_priority_count: Number(row.low_priority_count),
        oldest_pending_operation: row.oldest_pending_operation || undefined,
        newest_pending_operation: row.newest_pending_operation || undefined
      }
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to get queue status')
      throw error
    }
  }

  /**
   * 查询队列操作
   */
  async queryQueue(
    user_id: number,
    options: {
      status?: QueueOperationStatus
      entity_type?: 'note' | 'folder' | 'review'
      priority?: QueuePriority
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ operations: QueuedSyncOperation[]; total: number }> {
    const { status, entity_type, priority, limit = 20, offset = 0 } = options

    try {
      // 构建查询条件
      const conditions: string[] = ['user_id = $1']
      const params: any[] = [user_id]
      let paramIndex = 2

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      if (entity_type) {
        conditions.push(`entity_type = $${paramIndex++}`)
        params.push(entity_type)
      }

      if (priority) {
        conditions.push(`priority = $${paramIndex++}`)
        params.push(priority)
      }

      const whereClause = conditions.join(' AND ')

      // 查询总数
      const countResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "SyncQueue" WHERE ${whereClause}`,
        ...params
      )
      const total = Number(countResult[0]?.count || 0)

      // 查询操作列表
      params.push(limit, offset)
      const operations = await this.prisma.$queryRawUnsafe<QueuedSyncOperation[]>(
        `SELECT * FROM "SyncQueue"
         WHERE ${whereClause}
         ORDER BY
           CASE priority
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END,
           created_at ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        ...params
      )

      return { operations, total }
    } catch (error) {
      this.logger.error({ error, user_id, options }, 'Failed to query queue')
      return { operations: [], total: 0 }
    }
  }

  /**
   * 获取队列性能统计
   */
  async getPerformanceStats(user_id: number): Promise<QueuePerformanceStats> {
    try {
      const result = await this.prisma.$queryRaw<Array<{
        total_processed: bigint
        total_success: bigint
        total_failed: bigint
        avg_processing_time: number | null
        avg_retry_count: number | null
        processing_count: bigint
      }>>`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) as total_processed,
          COUNT(*) FILTER (WHERE status = 'completed') as total_success,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) FILTER (
            WHERE status = 'completed' AND completed_at IS NOT NULL AND started_at IS NOT NULL
          ) as avg_processing_time,
          AVG(retry_count) FILTER (WHERE status IN ('completed', 'failed')) as avg_retry_count,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_count
        FROM "SyncQueue"
        WHERE user_id = ${user_id}
      `

      const row = result[0]
      const totalProcessed = Number(row.total_processed)

      return {
        avg_processing_time: Number(row.avg_processing_time || 0),
        success_rate: totalProcessed > 0 ? Number(row.total_success) / totalProcessed : 0,
        avg_retry_count: Number(row.avg_retry_count || 0),
        total_processed: totalProcessed,
        total_success: Number(row.total_success),
        total_failed: Number(row.total_failed),
        processing_count: Number(row.processing_count)
      }
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to get performance stats')
      return {
        avg_processing_time: 0,
        success_rate: 0,
        avg_retry_count: 0,
        total_processed: 0,
        total_success: 0,
        total_failed: 0,
        processing_count: 0
      }
    }
  }

  // ============================================================================
  // 处理队列
  // ============================================================================

  /**
   * 处理队列操作
   */
  async processQueue(
    user_id: number,
    processor: (operation: QueuedSyncOperation) => Promise<{ success: boolean; error?: string }>
  ): Promise<ProcessQueueResponse> {
    const startTime = Date.now()
    const operations = await this.dequeue(user_id, this.config.batchSize)

    if (operations.length === 0) {
      return { processed_count: 0, results: [] }
    }

    this.logger.info({
      user_id,
      operation_count: operations.length
    }, 'Processing queue operations')

    const results: ProcessQueueResponse['results'] = []

    for (const operation of operations) {
      const processingTimeout = setTimeout(() => {
        this.triggerAlert({
          alert_id: uuidv4(),
          alert_type: 'processing_timeout',
          message: `Operation ${operation.id} processing timeout`,
          severity: 'warning',
          timestamp: new Date(),
          user_id,
          data: { operation_id: operation.id, timeout: this.config.processingTimeout }
        })
      }, this.config.processingTimeout)

      try {
        const result = await processor(operation)

        if (result.success) {
          await this.markAsCompleted(operation.id)
          results.push({ operation_id: operation.id, status: 'completed' })
        } else {
          await this.markAsFailed(operation.id, result.error || 'Unknown error')
          results.push({ operation_id: operation.id, status: 'failed', error: result.error })
        }
      } catch (error) {
        await this.markAsFailed(operation.id, (error as Error).message)
        results.push({ operation_id: operation.id, status: 'failed', error: (error as Error).message })
      } finally {
        clearTimeout(processingTimeout)
      }
    }

    const duration = Date.now() - startTime
    this.logger.info({
      user_id,
      processed_count: results.length,
      success_count: results.filter(r => r.status === 'completed').length,
      failed_count: results.filter(r => r.status === 'failed').length,
      duration
    }, 'Queue processing completed')

    return { processed_count: results.length, results }
  }

  // ============================================================================
  // 持久化和恢复
  // ============================================================================

  /**
   * 持久化队列到数据库
   */
  async persistQueue(user_id: number): Promise<void> {
    // 队列已经持久化到数据库，此方法用于确保一致性
    this.logger.debug({ user_id }, 'Queue persisted to database')
  }

  /**
   * 从数据库恢复队列
   */
  async recoverQueue(user_id: number): Promise<QueuedSyncOperation[]> {
    try {
      // 重置处理中但超时的操作
      const timeoutThreshold = new Date(Date.now() - this.config.processingTimeout)
      await this.prisma.$executeRaw`
        UPDATE "SyncQueue"
        SET status = 'pending',
            retry_count = retry_count + 1,
            updated_at = NOW(),
            started_at = NULL
        WHERE user_id = ${user_id}
          AND status = 'processing'
          AND started_at < ${timeoutThreshold}
      `

      // 获取所有待处理操作
      const operations = await this.prisma.$queryRaw<QueuedSyncOperation[]>`
        SELECT * FROM "SyncQueue"
        WHERE user_id = ${user_id}
          AND status = 'pending'
        ORDER BY
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC
      `

      this.logger.info({
        user_id,
        recovered_count: operations.length
      }, 'Queue recovered from database')

      return operations
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to recover queue')
      return []
    }
  }

  // ============================================================================
  // 清理和告警
  // ============================================================================

  /**
   * 清理旧的操作记录
   */
  async cleanupOldOperations(retentionDays: number = this.config.retentionDays): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await this.prisma.$executeRaw`
        DELETE FROM "SyncQueue"
        WHERE status IN ('completed', 'failed')
          AND completed_at < ${cutoffDate}
      `

      this.logger.info({
        retention_days: retentionDays,
        cutoff_date: cutoffDate,
        deleted_count: result
      }, 'Old queue operations cleaned up')

      return result
    } catch (error) {
      this.logger.error({ error, retentionDays }, 'Failed to cleanup old operations')
      return 0
    }
  }

  /**
   * 检查告警阈值
   */
  async checkAlertThreshold(user_id: number): Promise<void> {
    try {
      const status = await this.getQueueStatus(user_id)

      // 检查待处理操作数量告警
      if (status.pending_operations > this.config.alertThreshold) {
        this.triggerAlert({
          alert_id: uuidv4(),
          alert_type: 'high_pending_count',
          message: `High pending operation count for user ${user_id}: ${status.pending_operations}`,
          severity: 'warning',
          timestamp: new Date(),
          user_id,
          data: { pending_count: status.pending_operations, threshold: this.config.alertThreshold }
        })
      }

      // 检查失败率告警
      const totalProcessed = status.completed_operations + status.failed_operations
      if (totalProcessed > 10) {
        const failureRate = status.failed_operations / totalProcessed
        if (failureRate > 0.5) {
          this.triggerAlert({
            alert_id: uuidv4(),
            alert_type: 'high_failure_rate',
            message: `High failure rate for user ${user_id}: ${(failureRate * 100).toFixed(1)}%`,
            severity: 'error',
            timestamp: new Date(),
            user_id,
            data: {
              failure_rate: failureRate,
              failed_count: status.failed_operations,
              total_processed: totalProcessed
            }
          })
        }
      }
    } catch (error) {
      this.logger.error({ error, user_id }, 'Failed to check alert threshold')
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(alert: QueueAlert): void {
    this.logger.warn(alert, 'Queue alert triggered')

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert)
      } catch (error) {
        this.logger.error({ error, alert }, 'Alert callback error')
      }
    }
  }

  /**
   * 添加告警回调
   */
  addAlertCallback(callback: AlertCallback): void {
    this.alertCallbacks.add(callback)
  }

  /**
   * 移除告警回调
   */
  removeAlertCallback(callback: AlertCallback): void {
    this.alertCallbacks.delete(callback)
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanupOldOperations()
    }, this.config.cleanupInterval)
  }

  /**
   * 启动告警检查定时器
   */
  private startAlertCheckTimer(): void {
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer)
    }

    this.alertCheckTimer = setInterval(async () => {
      // 检查所有活跃用户的告警
      const users = await this.prisma.$queryRaw<Array<{ user_id: number }>>`
        SELECT DISTINCT user_id FROM "SyncQueue"
        WHERE status IN ('pending', 'processing')
      `

      for (const { user_id } of users) {
        await this.checkAlertThreshold(user_id)
      }
    }, this.config.alertCheckInterval)
  }

  // ============================================================================
  // 关闭服务
  // ============================================================================

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down QueueService')

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer)
      this.alertCheckTimer = null
    }

    this.alertCallbacks.clear()
    this.processingSet.clear()

    this.logger.info('QueueService shutdown completed')
  }
}
