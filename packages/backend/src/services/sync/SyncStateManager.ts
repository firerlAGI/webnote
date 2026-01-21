/**
 * T3项目同步状态管理器
 * 负责同步状态的跟踪、持久化和查询
 */

import { PrismaClient } from '@prisma/client'
import { Logger } from 'pino'
import { EventEmitter } from 'events'
import crypto from 'crypto'

// ============================================================================
// 同步状态数据结构
// ============================================================================

/**
 * 同步状态详情
 */
export interface SyncStatusDetail {
  sync_id: string
  user_id: number
  device_id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  phase: 'init' | 'pull' | 'push' | 'conflict_resolution' | 'cleanup'
  progress: {
    total: number
    completed: number
    failed: number
    percentage: number
  }
  current_operation?: string
  error_message?: string
  started_at: Date
  updated_at: Date
  completed_at?: Date
  operations: SyncOperationRecord[]
  conflicts: any[]
  statistics: {
    notes_created: number
    notes_updated: number
    notes_deleted: number
    folders_created: number
    folders_updated: number
    folders_deleted: number
    reviews_created: number
    reviews_updated: number
    reviews_deleted: number
  }
}

/**
 * 同步操作记录
 */
export interface SyncOperationRecord {
  id: string
  type: 'create' | 'update' | 'delete'
  entity_type: 'note' | 'folder' | 'review'
  entity_id?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  created_at: Date
  completed_at?: Date
}

/**
 * 同步历史记录
 */
export interface SyncHistory {
  sync_id: string
  user_id: number
  device_id: string
  status: 'completed' | 'failed'
  started_at: Date
  completed_at: Date
  duration: number
  statistics: {
    notes_created: number
    notes_updated: number
    notes_deleted: number
    folders_created: number
    folders_updated: number
    folders_deleted: number
    reviews_created: number
    reviews_updated: number
    reviews_deleted: number
  }
  error_message?: string
}

/**
 * 同步统计信息
 */
export interface SyncStatistics {
  total_syncs: number
  successful_syncs: number
  failed_syncs: number
  last_sync_time?: Date
  total_notes_synced: number
  total_folders_synced: number
  total_reviews_synced: number
  average_sync_duration: number
}

/**
 * 同步状态管理器配置
 */
export interface SyncStateManagerConfig {
  /** 历史记录保留天数 */
  history_retention_days: number
  /** 状态更新通知阈值（进度百分比变化超过此值才通知） */
  progress_notification_threshold: number
  /** 状态清理间隔（毫秒） */
  cleanup_interval: number
  /** 是否启用状态持久化 */
  enable_persistence: boolean
  /** 状态恢复超时时间（毫秒） */
  recovery_timeout: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SyncStateManagerConfig = {
  history_retention_days: 30,
  progress_notification_threshold: 5,
  cleanup_interval: 3600000, // 1小时
  enable_persistence: true,
  recovery_timeout: 30000 // 30秒
}

// ============================================================================
// 同步状态管理器类
// ============================================================================

/**
 * 同步状态管理器
 * 负责跟踪、管理和查询同步状态
 */
export class SyncStateManager extends EventEmitter {
  private prisma: PrismaClient
  private logger: Logger
  private config: SyncStateManagerConfig
  private activeSyncs: Map<string, SyncStatusDetail>
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(prisma: PrismaClient, logger: Logger, config: Partial<SyncStateManagerConfig> = {}) {
    super()
    this.prisma = prisma
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.activeSyncs = new Map()

    if (this.config.enable_persistence) {
      this.startCleanupTimer()
      this.recoverActiveSyncs()
    }
  }

  // ============================================================================
  // 同步会话管理
  // ============================================================================

  /**
   * 创建新的同步会话
   */
  async createSyncSession(
    userId: number,
    deviceId: string,
    totalOperations: number = 0
  ): Promise<string> {
    const syncId = this.generateId('sync')

    const syncStatus: SyncStatusDetail = {
      sync_id: syncId,
      user_id: userId,
      device_id: deviceId,
      status: 'pending',
      phase: 'init',
      progress: {
        total: totalOperations,
        completed: 0,
        failed: 0,
        percentage: 0
      },
      started_at: new Date(),
      updated_at: new Date(),
      operations: [],
      conflicts: [],
      statistics: {
        notes_created: 0,
        notes_updated: 0,
        notes_deleted: 0,
        folders_created: 0,
        folders_updated: 0,
        folders_deleted: 0,
        reviews_created: 0,
        reviews_updated: 0,
        reviews_deleted: 0
      }
    }

    this.activeSyncs.set(syncId, syncStatus)

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(syncStatus)
    }

    this.logger.info({ sync_id: syncId, user_id: userId, device_id: deviceId }, 'Sync session created')
    this.emit('sync_session_created', syncStatus)

    return syncId
  }

  /**
   * 获取同步会话状态
   */
  async getSyncSession(syncId: string): Promise<SyncStatusDetail | null> {
    // 先从内存中查找
    const activeSync = this.activeSyncs.get(syncId)
    if (activeSync) {
      return activeSync
    }

    // 从数据库中查找
    if (this.config.enable_persistence) {
      return await this.loadSyncSession(syncId)
    }

    return null
  }

  /**
   * 更新同步会话状态
   */
  async updateSyncSession(
    syncId: string,
    updates: Partial<SyncStatusDetail>
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    const oldProgress = sync.progress.percentage
    const oldStatus = sync.status

    // 更新字段
    if (updates.status) sync.status = updates.status
    if (updates.phase) sync.phase = updates.phase
    if (updates.progress) sync.progress = updates.progress
    if (updates.current_operation) sync.current_operation = updates.current_operation
    if (updates.error_message) sync.error_message = updates.error_message
    if (updates.completed_at) sync.completed_at = updates.completed_at
    if (updates.statistics) {
      Object.assign(sync.statistics, updates.statistics)
    }
    if (updates.operations) sync.operations = updates.operations
    if (updates.conflicts) sync.conflicts = updates.conflicts

    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    // 检查是否需要发送通知
    const progressDelta = Math.abs(sync.progress.percentage - oldProgress)
    const statusChanged = oldStatus !== sync.status

    if (statusChanged || progressDelta >= this.config.progress_notification_threshold) {
      this.emit('sync_status_updated', {
        sync_id: syncId,
        old_status: oldStatus,
        new_status: sync.status,
        progress: sync.progress.percentage
      })
    }

    return true
  }

  /**
   * 完成同步会话
   */
  async completeSyncSession(
    syncId: string,
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    sync.status = status
    sync.completed_at = new Date()
    sync.updated_at = new Date()

    if (errorMessage) {
      sync.error_message = errorMessage
    }

    // 更新统计信息
    if (status === 'completed') {
      await this.updateSyncStatistics(sync)
    }

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    // 从活跃同步中移除
    this.activeSyncs.delete(syncId)

    this.emit('sync_session_completed', sync)

    return true
  }

  /**
   * 取消同步会话
   */
  async cancelSyncSession(syncId: string): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    sync.status = 'paused'
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    this.emit('sync_session_cancelled', sync)

    return true
  }

  /**
   * 获取用户的所有活跃同步会话
   */
  getActiveSyncsForUser(userId: number): SyncStatusDetail[] {
    return Array.from(this.activeSyncs.values())
      .filter(sync => sync.user_id === userId)
  }

  // ============================================================================
  // 同步进度跟踪
  // ============================================================================

  /**
   * 更新同步进度
   */
  async updateSyncProgress(
    syncId: string,
    completed: number,
    failed: number = 0
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    sync.progress.completed = completed
    sync.progress.failed = failed
    sync.progress.percentage = Math.round((completed / sync.progress.total) * 100)
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    this.emit('sync_progress_updated', {
      sync_id: syncId,
      progress: sync.progress
    })

    return true
  }

  /**
   * 增加同步进度
   */
  async incrementSyncProgress(
    syncId: string,
    increment: number = 1,
    failed: boolean = false
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    if (failed) {
      sync.progress.failed += increment
    } else {
      sync.progress.completed += increment
    }

    sync.progress.percentage = Math.round((sync.progress.completed / sync.progress.total) * 100)
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    this.emit('sync_progress_updated', {
      sync_id: syncId,
      progress: sync.progress
    })

    return true
  }

  /**
   * 设置当前操作
   */
  async setCurrentOperation(
    syncId: string,
    operation: string
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    sync.current_operation = operation
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    return true
  }

  /**
   * 更新同步阶段
   */
  async updateSyncPhase(
    syncId: string,
    phase: 'init' | 'pull' | 'push' | 'conflict_resolution' | 'cleanup'
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    sync.phase = phase
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
    }

    this.emit('sync_phase_changed', {
      sync_id: syncId,
      phase
    })

    return true
  }

  /**
   * 添加操作记录
   */
  async addOperationRecord(
    syncId: string,
    record: Omit<SyncOperationRecord, 'id' | 'created_at'>
  ): Promise<string | null> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return null
    }

    const operationRecord: SyncOperationRecord = {
      ...record,
      id: this.generateId('op'),
      created_at: new Date()
    }

    sync.operations.push(operationRecord)
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
      await this.persistSyncOperation(syncId, operationRecord)
    }

    return operationRecord.id
  }

  /**
   * 更新操作记录状态
   */
  async updateOperationRecord(
    syncId: string,
    operationId: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<boolean> {
    const sync = this.activeSyncs.get(syncId)
    if (!sync) {
      return false
    }

    const operation = sync.operations.find(op => op.id === operationId)
    if (!operation) {
      return false
    }

    operation.status = status
    operation.error = error
    operation.completed_at = new Date()
    sync.updated_at = new Date()

    // 持久化到数据库
    if (this.config.enable_persistence) {
      await this.persistSyncSession(sync)
      await this.updateSyncOperationInDatabase(operationId, status, error)
    }

    return true
  }

  // ============================================================================
  // 同步历史记录
  // ============================================================================

  /**
   * 获取同步历史记录
   */
  async getSyncHistory(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ records: SyncHistory[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit

    // 从数据库获取历史记录
    const sessions = await this.prisma.syncSession.findMany({
      where: {
        user_id: userId,
        status: {
          in: ['completed', 'failed']
        }
      },
      orderBy: {
        started_at: 'desc'
      },
      skip,
      take: limit
    })

    const total = await this.prisma.syncSession.count({
      where: {
        user_id: userId,
        status: {
          in: ['completed', 'failed']
        }
      }
    })

    const records: SyncHistory[] = sessions.map(session => ({
      sync_id: session.id,
      user_id: session.user_id,
      device_id: session.device_id,
      status: session.status as 'completed' | 'failed',
      started_at: session.started_at,
      completed_at: session.completed_at!,
      duration: session.completed_at
        ? session.completed_at.getTime() - session.started_at.getTime()
        : 0,
      statistics: {
        notes_created: session.notes_created,
        notes_updated: session.notes_updated,
        notes_deleted: session.notes_deleted,
        folders_created: session.folders_created,
        folders_updated: session.folders_updated,
        folders_deleted: session.folders_deleted,
        reviews_created: session.reviews_created,
        reviews_updated: session.reviews_updated,
        reviews_deleted: session.reviews_deleted
      },
      error_message: session.error_message || undefined
    }))

    return { records, total, page, limit }
  }

  /**
   * 获取同步历史详情
   */
  async getSyncHistoryDetail(syncId: string): Promise<SyncStatusDetail | null> {
    // 从数据库获取完整信息
    const session = await this.prisma.syncSession.findUnique({
      where: { id: syncId }
    })

    if (!session) {
      return null
    }

    // 获取操作记录
    const operations = await this.prisma.syncOperation.findMany({
      where: { sync_session_id: syncId }
    })

    const operationRecords: SyncOperationRecord[] = operations.map(op => ({
      id: op.id,
      type: op.type as 'create' | 'update' | 'delete',
      entity_type: op.entity_type as 'note' | 'folder' | 'review',
      entity_id: op.entity_id || undefined,
      status: op.status as 'pending' | 'processing' | 'completed' | 'failed',
      error: op.error || undefined,
      created_at: op.created_at,
      completed_at: op.completed_at || undefined
    }))

    return {
      sync_id: session.id,
      user_id: session.user_id,
      device_id: session.device_id,
      status: session.status as 'pending' | 'running' | 'paused' | 'completed' | 'failed',
      phase: session.phase as 'init' | 'pull' | 'push' | 'conflict_resolution' | 'cleanup',
      progress: {
        total: session.progress_total,
        completed: session.progress_completed,
        failed: session.progress_failed,
        percentage: session.progress_percentage
      },
      current_operation: session.current_operation || undefined,
      error_message: session.error_message || undefined,
      started_at: session.started_at,
      updated_at: session.updated_at,
      completed_at: session.completed_at || undefined,
      operations: operationRecords,
      conflicts: Array.isArray(session.conflicts)
        ? (session.conflicts as unknown as any[])
        : [],
      statistics: {
        notes_created: session.notes_created,
        notes_updated: session.notes_updated,
        notes_deleted: session.notes_deleted,
        folders_created: session.folders_created,
        folders_updated: session.folders_updated,
        folders_deleted: session.folders_deleted,
        reviews_created: session.reviews_created,
        reviews_updated: session.reviews_updated,
        reviews_deleted: session.reviews_deleted
      }
    }
  }

  // ============================================================================
  // 同步统计信息
  // ============================================================================

  /**
   * 获取用户同步统计信息
   */
  async getSyncStatistics(userId: number): Promise<SyncStatistics> {
    // 从数据库获取统计信息
    let stats = await this.prisma.syncStatistics.findUnique({
      where: { user_id: userId }
    })

    if (!stats) {
      // 创建默认统计信息
      stats = await this.prisma.syncStatistics.create({
        data: {
          user_id: userId,
          total_syncs: 0,
          successful_syncs: 0,
          failed_syncs: 0,
          last_sync_time: null,
          total_notes_synced: 0,
          total_folders_synced: 0,
          total_reviews_synced: 0,
          total_bytes_transferred: BigInt(0),
          average_sync_duration: 0
        }
      })
    }

    return {
      total_syncs: stats.total_syncs,
      successful_syncs: stats.successful_syncs,
      failed_syncs: stats.failed_syncs,
      last_sync_time: stats.last_sync_time || undefined,
      total_notes_synced: stats.total_notes_synced,
      total_folders_synced: stats.total_folders_synced,
      total_reviews_synced: stats.total_reviews_synced,
      average_sync_duration: stats.average_sync_duration
    }
  }

  /**
   * 更新同步统计信息
   */
  private async updateSyncStatistics(sync: SyncStatusDetail): Promise<void> {
    const avgDuration = await this.calculateAverageDuration(sync.user_id, sync)

    await this.prisma.syncStatistics.upsert({
      where: { user_id: sync.user_id },
      update: {
        total_syncs: { increment: 1 },
        successful_syncs: sync.status === 'completed' ? { increment: 1 } : undefined,
        failed_syncs: sync.status === 'failed' ? { increment: 1 } : undefined,
        last_sync_time: sync.completed_at || new Date(),
        total_notes_synced: {
          increment: sync.statistics.notes_created + sync.statistics.notes_updated + sync.statistics.notes_deleted
        },
        total_folders_synced: {
          increment: sync.statistics.folders_created + sync.statistics.folders_updated + sync.statistics.folders_deleted
        },
        total_reviews_synced: {
          increment: sync.statistics.reviews_created + sync.statistics.reviews_updated + sync.statistics.reviews_deleted
        },
        average_sync_duration: avgDuration
      },
      create: {
        user_id: sync.user_id,
        total_syncs: 1,
        successful_syncs: sync.status === 'completed' ? 1 : 0,
        failed_syncs: sync.status === 'failed' ? 1 : 0,
        last_sync_time: sync.completed_at || new Date(),
        total_notes_synced: sync.statistics.notes_created + sync.statistics.notes_updated + sync.statistics.notes_deleted,
        total_folders_synced: sync.statistics.folders_created + sync.statistics.folders_updated + sync.statistics.folders_deleted,
        total_reviews_synced: sync.statistics.reviews_created + sync.statistics.reviews_updated + sync.statistics.reviews_deleted,
        total_bytes_transferred: BigInt(0),
        average_sync_duration: 0
      }
    })
  }

  /**
   * 计算平均同步时长
   */
  private async calculateAverageDuration(userId: number, currentSync: SyncStatusDetail): Promise<number> {
    const duration = currentSync.completed_at
      ? currentSync.completed_at.getTime() - currentSync.started_at.getTime()
      : 0

    const stats = await this.prisma.syncStatistics.findUnique({
      where: { user_id: userId }
    })

    if (!stats || stats.total_syncs === 0) {
      return duration
    }

    // 计算移动平均
    const totalDuration = stats.average_sync_duration * stats.total_syncs
    return (totalDuration + duration) / (stats.total_syncs + 1)
  }

  // ============================================================================
  // 状态持久化
  // ============================================================================

  /**
   * 持久化同步会话到数据库
   */
  private async persistSyncSession(sync: SyncStatusDetail): Promise<void> {
    try {
      await this.prisma.syncSession.upsert({
        where: { id: sync.sync_id },
        update: {
          status: sync.status,
          phase: sync.phase,
          progress_total: sync.progress.total,
          progress_completed: sync.progress.completed,
          progress_failed: sync.progress.failed,
          progress_percentage: sync.progress.percentage,
          current_operation: sync.current_operation,
          error_message: sync.error_message,
          updated_at: sync.updated_at,
          completed_at: sync.completed_at,
          operations: sync.operations as any,
          conflicts: sync.conflicts as any,
          notes_created: sync.statistics.notes_created,
          notes_updated: sync.statistics.notes_updated,
          notes_deleted: sync.statistics.notes_deleted,
          folders_created: sync.statistics.folders_created,
          folders_updated: sync.statistics.folders_updated,
          folders_deleted: sync.statistics.folders_deleted,
          reviews_created: sync.statistics.reviews_created,
          reviews_updated: sync.statistics.reviews_updated,
          reviews_deleted: sync.statistics.reviews_deleted
        },
        create: {
          id: sync.sync_id,
          user_id: sync.user_id,
          device_id: sync.device_id,
          status: sync.status,
          phase: sync.phase,
          progress_total: sync.progress.total,
          progress_completed: sync.progress.completed,
          progress_failed: sync.progress.failed,
          progress_percentage: sync.progress.percentage,
          current_operation: sync.current_operation,
          error_message: sync.error_message,
          started_at: sync.started_at,
          updated_at: sync.updated_at,
          completed_at: sync.completed_at,
          operations: sync.operations as any,
          conflicts: sync.conflicts as any,
          notes_created: sync.statistics.notes_created,
          notes_updated: sync.statistics.notes_updated,
          notes_deleted: sync.statistics.notes_deleted,
          folders_created: sync.statistics.folders_created,
          folders_updated: sync.statistics.folders_updated,
          folders_deleted: sync.statistics.folders_deleted,
          reviews_created: sync.statistics.reviews_created,
          reviews_updated: sync.statistics.reviews_updated,
          reviews_deleted: sync.statistics.reviews_deleted
        }
      })
    } catch (error) {
      this.logger.error({ error, sync_id: sync.sync_id }, 'Failed to persist sync session')
    }
  }

  /**
   * 从数据库加载同步会话
   */
  private async loadSyncSession(syncId: string): Promise<SyncStatusDetail | null> {
    try {
      const session = await this.prisma.syncSession.findUnique({
        where: { id: syncId }
      })

      if (!session) {
        return null
      }

      return {
        sync_id: session.id,
        user_id: session.user_id,
        device_id: session.device_id,
        status: session.status as 'pending' | 'running' | 'paused' | 'completed' | 'failed',
        phase: session.phase as 'init' | 'pull' | 'push' | 'conflict_resolution' | 'cleanup',
        progress: {
          total: session.progress_total,
          completed: session.progress_completed,
          failed: session.progress_failed,
          percentage: session.progress_percentage
        },
        current_operation: session.current_operation || undefined,
        error_message: session.error_message || undefined,
        started_at: session.started_at,
        updated_at: session.updated_at,
        completed_at: session.completed_at || undefined,
        operations: Array.isArray(session.operations)
          ? (session.operations as unknown as SyncOperationRecord[])
          : [],
        conflicts: Array.isArray(session.conflicts)
          ? (session.conflicts as unknown as any[])
          : [],
        statistics: {
          notes_created: session.notes_created,
          notes_updated: session.notes_updated,
          notes_deleted: session.notes_deleted,
          folders_created: session.folders_created,
          folders_updated: session.folders_updated,
          folders_deleted: session.folders_deleted,
          reviews_created: session.reviews_created,
          reviews_updated: session.reviews_updated,
          reviews_deleted: session.reviews_deleted
        }
      }
    } catch (error) {
      this.logger.error({ error, sync_id: syncId }, 'Failed to load sync session')
      return null
    }
  }

  /**
   * 持久化同步操作
   */
  private async persistSyncOperation(syncId: string, operation: SyncOperationRecord): Promise<void> {
    try {
      await this.prisma.syncOperation.create({
        data: {
          id: operation.id,
          sync_session_id: syncId,
          user_id: 0, // 从sync session获取
          type: operation.type,
          entity_type: operation.entity_type,
          entity_id: operation.entity_id,
          status: operation.status,
          error: operation.error,
          created_at: operation.created_at,
          completed_at: operation.completed_at
        }
      })
    } catch (error) {
      this.logger.error({ error, operation_id: operation.id }, 'Failed to persist sync operation')
    }
  }

  /**
   * 更新数据库中的同步操作
   */
  private async updateSyncOperationInDatabase(
    operationId: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.syncOperation.update({
        where: { id: operationId },
        data: {
          status,
          error,
          completed_at: new Date()
        }
      })
    } catch (err) {
      this.logger.error({ error: err, operation_id: operationId }, 'Failed to update sync operation')
    }
  }

  // ============================================================================
  // 状态清理机制
  // ============================================================================

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupOldSessions()
      await this.cleanupOldOperations()
    }, this.config.cleanup_interval)

    this.logger.info('Cleanup timer started')
  }

  /**
   * 清理旧的同步会话
   */
  private async cleanupOldSessions(): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.history_retention_days)

    try {
      const deleted = await this.prisma.syncSession.deleteMany({
        where: {
          status: { in: ['completed', 'failed'] },
          completed_at: { lt: cutoffDate }
        }
      })

      if (deleted.count > 0) {
        this.logger.info({ count: deleted.count }, 'Old sync sessions cleaned up')
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup old sessions')
    }
  }

  /**
   * 清理旧的同步操作
   */
  private async cleanupOldOperations(): Promise<void> {
    // 清理已完成且超过保留期的操作记录
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.history_retention_days)

    try {
      // 先找到对应的session ids
      const oldSessions = await this.prisma.syncSession.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          completed_at: { lt: cutoffDate }
        },
        select: { id: true }
      })

      const sessionIds = oldSessions.map(s => s.id)

      if (sessionIds.length > 0) {
        const deleted = await this.prisma.syncOperation.deleteMany({
          where: {
            sync_session_id: { in: sessionIds }
          }
        })

        if (deleted.count > 0) {
          this.logger.info({ count: deleted.count }, 'Old sync operations cleaned up')
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup old operations')
    }
  }

  /**
   * 手动清理指定用户的同步历史
   */
  async cleanupUserHistory(userId: number, retainDays?: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - (retainDays || this.config.history_retention_days))

    try {
      const deleted = await this.prisma.syncSession.deleteMany({
        where: {
          user_id: userId,
          status: { in: ['completed', 'failed'] },
          completed_at: { lt: cutoffDate }
        }
      })

      this.logger.info({ user_id: userId, count: deleted.count }, 'User sync history cleaned up')

      return deleted.count
    } catch (error) {
      this.logger.error({ error, user_id: userId }, 'Failed to cleanup user history')
      return 0
    }
  }

  // ============================================================================
  // 状态恢复机制
  // ============================================================================

  /**
   * 恢复活跃的同步会话
   */
  private async recoverActiveSyncs(): Promise<void> {
    this.logger.info('Starting recovery of active syncs')

    try {
      const pendingSyncs = await this.prisma.syncSession.findMany({
        where: {
          status: { in: ['pending', 'running'] },
          updated_at: {
            gte: new Date(Date.now() - this.config.recovery_timeout)
          }
        },
        orderBy: {
          started_at: 'desc'
          }
      })

      for (const session of pendingSyncs) {
        // 将未完成的同步标记为失败
        await this.prisma.syncSession.update({
          where: { id: session.id },
          data: {
            status: 'failed',
            error_message: 'Sync session interrupted during server restart',
            completed_at: new Date()
          }
        })

        this.logger.info({ sync_id: session.id }, 'Interrupted sync session marked as failed')
      }

      this.logger.info('Recovery of active syncs completed')
    } catch (error) {
      this.logger.error({ error }, 'Failed to recover active syncs')
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36)
    const random = crypto.randomBytes(8).toString('hex')
    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * 获取活跃同步会话数量
   */
  getActiveSyncCount(): number {
    return this.activeSyncs.size
  }

  /**
   * 获取指定用户的活跃同步会话数量
   */
  getActiveSyncCountForUser(userId: number): number {
    return Array.from(this.activeSyncs.values())
      .filter(sync => sync.user_id === userId)
      .length
  }

  /**
   * 关闭状态管理器
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SyncStateManager')

    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 移除所有监听器
    this.removeAllListeners()

    this.logger.info('SyncStateManager shut down')
  }
}
