/**
 * 同步管理器
 * 负责管理前端缓存与服务器之间的数据同步
 * 支持离线操作、冲突检测与解决、批量同步等功能
 */

import { IFullCache } from './CacheAPI'
import {
  CacheKeys,
  SyncQueueItem,
  SyncStatus as CacheSyncStatus,
  Conflict,
} from './types'
import {
  SyncRequest,
  SyncResponse,
  SyncOperation,
  SyncOperationType,
  EntityType,
  Conflict as SyncConflict,
  ConflictResolutionStrategy,
  ConflictResolution,
  ConflictResolutionResult,
  ClientSyncState,
  ServerUpdate,
  OperationResult,
  SyncStatus,
  ConflictType,
} from '@webnote/shared/types/sync'
import { Note, Folder, Review } from '@webnote/shared/types'

// ============================================================================
// 同步配置
// ============================================================================

/**
 * 同步管理器配置
 */
export interface SyncManagerConfig {
  /** API基础URL */
  apiBaseUrl: string
  /** 同步间隔（毫秒） */
  syncInterval: number
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
  /** 批量同步大小 */
  batchSize: number
  /** 冲突解决策略 */
  defaultConflictStrategy: ConflictResolutionStrategy
  /** 是否启用自动同步 */
  autoSync: boolean
  /** 是否启用实时同步 */
  enableRealtime: boolean
  /** 离线超时（毫秒） */
  offlineTimeout: number
}

/**
 * 默认同步配置
 */
export const DEFAULT_SYNC_CONFIG: SyncManagerConfig = {
  apiBaseUrl: '/api',
  syncInterval: 30 * 1000, // 30秒
  maxRetries: 3,
  retryDelay: 5000, // 5秒
  batchSize: 50,
  defaultConflictStrategy: ConflictResolutionStrategy.LATEST_WINS,
  autoSync: true,
  enableRealtime: true,
  offlineTimeout: 60 * 1000, // 1分钟
}

// ============================================================================
// 同步事件
// ============================================================================

/**
 * 同步事件类型
 */
export type SyncEventType =
  | 'sync_start'
  | 'sync_progress'
  | 'sync_complete'
  | 'sync_error'
  | 'sync_conflict'
  | 'sync_conflict_resolved'
  | 'offline_mode'
  | 'online_mode'
  | 'queue_updated'
  | 'status_changed'

/**
 * 同步事件
 */
export interface SyncEvent {
  type: SyncEventType
  timestamp: number
  data?: any
  error?: Error
}

/**
 * 同步事件监听器
 */
export type SyncEventListener = (event: SyncEvent) => void

// ============================================================================
// 同步管理器核心类
// ============================================================================

/**
 * 同步管理器
 * 负责管理前端缓存与服务器之间的数据同步
 */
export class SyncManager {
  private cache: IFullCache
  private config: SyncManagerConfig
  private eventListeners: Map<SyncEventType, Set<SyncEventListener>>
  private syncTimer: number | null = null
  private isSyncing: boolean = false
  private isOnline: boolean = true
  private clientId: string
  private currentSyncId: string | null = null

  // 同步状态
  private syncStatus: CacheSyncStatus = {
    lastSyncTime: 0,
    isSyncing: false,
    pendingItems: 0,
    failedItems: 0,
    conflictItems: 0,
    syncMode: 'realtime',
    connectionStatus: 'connected',
  }

  constructor(cache: IFullCache, config?: Partial<SyncManagerConfig>) {
    this.cache = cache
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    this.eventListeners = new Map()
    this.clientId = this.generateClientId()

    // 初始化
    this.initialize()
  }

  // ========================================================================
  // 初始化方法
  // ========================================================================

  /**
   * 初始化同步管理器
   */
  private async initialize(): Promise<void> {
    // 加载客户端状态
    await this.loadClientState()

    // 设置网络监听
    this.setupNetworkListeners()

    // 启动自动同步
    if (this.config.autoSync) {
      this.startAutoSync()
    }

    // 加载待同步队列
    await this.loadSyncQueue()
  }

  /**
   * 生成客户端唯一ID
   */
  private generateClientId(): string {
    const stored = localStorage.getItem('client_id')
    if (stored) return stored

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('client_id', clientId)
    return clientId
  }

  /**
   * 设置网络状态监听器
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncStatus.connectionStatus = 'connected'
      this.emit({ type: 'online_mode', timestamp: Date.now() })
      this.syncStatus.syncMode = 'realtime'

      // 恢复在线时立即同步
      if (this.config.autoSync) {
        this.sync()
      }
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.syncStatus.connectionStatus = 'disconnected'
      this.emit({ type: 'offline_mode', timestamp: Date.now() })
      this.syncStatus.syncMode = 'offline'
    })
  }

  // ========================================================================
  // 核心同步方法
  // ========================================================================

  /**
   * 开始自动同步
   */
  startAutoSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.sync()
      }
    }, this.config.syncInterval)
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * 执行完整同步
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.warn('Sync already in progress')
      return
    }

    this.isSyncing = true
    this.syncStatus.isSyncing = true
    this.emit({ type: 'sync_start', timestamp: Date.now() })

    try {
      // 生成同步ID
      this.currentSyncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 构建同步请求
      const request = await this.buildSyncRequest()

      // 执行同步
      const response = await this.sendSyncRequest(request)

      // 处理同步响应
      await this.processSyncResponse(response)

      // 更新同步状态
      this.syncStatus.lastSyncTime = Date.now()
      this.syncStatus.pendingItems = await this.getPendingCount()
      this.syncStatus.failedItems = await this.getFailedCount()
      this.syncStatus.conflictItems = await this.getConflictCount()

      this.emit({ type: 'sync_complete', timestamp: Date.now(), data: response })
    } catch (error) {
      console.error('Sync failed:', error)
      this.emit({ type: 'sync_error', timestamp: Date.now(), error: error as Error })

      // 标记失败的队列项
      await this.markFailedItems(error as Error)
    } finally {
      this.isSyncing = false
      this.syncStatus.isSyncing = false
      this.currentSyncId = null
      this.emit({ type: 'status_changed', timestamp: Date.now(), data: this.syncStatus })
    }
  }

  /**
   * 构建同步请求
   */
  private async buildSyncRequest(): Promise<SyncRequest> {
    // 获取客户端状态
    const clientState = await this.getClientState()

    // 获取待同步的操作
    const operations = await this.getPendingOperations()

    return {
      request_id: this.currentSyncId!,
      client_id: this.clientId,
      client_state,
      protocol_version: '1.0.0' as any,
      operations,
      default_resolution_strategy: this.config.defaultConflictStrategy,
      incremental: true,
      batch_size: this.config.batchSize,
      batch_index: 0,
      is_last_batch: true,
    }
  }

  /**
   * 获取待同步的操作
   */
  private async getPendingOperations(): Promise<SyncOperation[]> {
    const queue = await this.getSyncQueue()
    const pendingItems = queue.filter((item) => item.status === 'pending')

    const operations: SyncOperation[] = []

    for (const item of pendingItems.slice(0, this.config.batchSize)) {
      const operation = this.queueItemToOperation(item)
      operations.push(operation)
    }

    return operations
  }

  /**
   * 将队列项转换为同步操作
   */
  private queueItemToOperation(item: SyncQueueItem): SyncOperation {
    const baseOperation = {
      operation_id: item.id,
      entity_type: item.entity as EntityType,
      client_id: this.clientId,
      timestamp: new Date(item.timestamp).toISOString(),
      before_version: item.beforeVersion,
    }

    switch (item.type) {
      case 'create':
        return {
          ...baseOperation,
          operation_type: SyncOperationType.CREATE,
          data: item.data,
        }

      case 'update':
        return {
          ...baseOperation,
          operation_type: SyncOperationType.UPDATE,
          entity_id: item.entityId,
          changes: item.data,
          full_data: item.data,
        }

      case 'delete':
        return {
          ...baseOperation,
          operation_type: SyncOperationType.DELETE,
          entity_id: item.entityId!,
          before_version: item.beforeVersion!,
        }

      default:
        throw new Error(`Unknown operation type: ${item.type}`)
    }
  }

  /**
   * 发送同步请求到服务器
   */
  private async sendSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    const response = await fetch(`${this.config.apiBaseUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Sync request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * 处理同步响应
   */
  private async processSyncResponse(response: SyncResponse): Promise<void> {
    // 处理操作结果
    for (const result of response.operation_results) {
      await this.processOperationResult(result)
    }

    // 处理服务器更新
    for (const update of response.server_updates) {
      await this.processServerUpdate(update)
    }

    // 处理冲突
    for (const conflict of response.conflicts) {
      await this.handleConflict(conflict)
    }

    // 更新客户端状态
    await this.saveClientState(response.new_client_state)
  }

  /**
   * 处理操作结果
   */
  private async processOperationResult(result: OperationResult): Promise<void> {
    const queue = await this.getSyncQueue()
    const itemIndex = queue.findIndex((item) => item.id === result.operation_id)

    if (itemIndex === -1) {
      return
    }

    const item = queue[itemIndex]

    if (result.success) {
      // 操作成功，从队列中移除
      queue.splice(itemIndex, 1)

      // 如果是创建操作，更新临时ID
      if (item.type === 'create' && result.entity_id && item.tempId) {
        await this.updateTempId(item.tempId, result.entity_id, item.entity)
      }
    } else {
      // 操作失败，更新状态
      item.status = 'failed'
      item.retryCount++
      item.errorMessage = result.error

      // 如果重试次数超过限制，标记为已解决
      if (item.retryCount >= this.config.maxRetries) {
        item.status = 'resolved'
      }
    }

    await this.saveSyncQueue(queue)
  }

  /**
   * 更新临时ID
   */
  private async updateTempId(
    tempId: string,
    entityId: number,
    entityType: 'note' | 'folder' | 'review'
  ): Promise<void> {
    switch (entityType) {
      case 'note':
        const note = await this.cache.getNote(parseInt(tempId))
        if (note) {
          note.id = entityId
          await this.cache.setNote(note)
        }
        break

      case 'folder':
        const folder = await this.cache.getFolder(parseInt(tempId))
        if (folder) {
          folder.id = entityId
          await this.cache.setFolder(folder)
        }
        break

      case 'review':
        const review = await this.cache.getReview(parseInt(tempId))
        if (review) {
          review.id = entityId
          await this.cache.setReview(review)
        }
        break
    }
  }

  /**
   * 处理服务器更新
   */
  private async processServerUpdate(update: ServerUpdate): Promise<void> {
    switch (update.operation_type) {
      case SyncOperationType.CREATE:
        await this.applyServerCreate(update)
        break

      case SyncOperationType.UPDATE:
        await this.applyServerUpdate(update)
        break

      case SyncOperationType.DELETE:
        await this.applyServerDelete(update)
        break
    }
  }

  /**
   * 应用服务器创建操作
   */
  private async applyServerCreate(update: ServerUpdate): Promise<void> {
    if (update.entity_type === 'note' && update.data) {
      await this.cache.setNote(update.data as Note)
    } else if (update.entity_type === 'folder' && update.data) {
      await this.cache.setFolder(update.data as Folder)
    } else if (update.entity_type === 'review' && update.data) {
      await this.cache.setReview(update.data as Review)
    }
  }

  /**
   * 应用服务器更新操作
   */
  private async applyServerUpdate(update: ServerUpdate): Promise<void> {
    if (update.entity_type === 'note') {
      const note = await this.cache.getNote(update.entity_id)
      if (note && update.data) {
        const updatedNote = { ...note, ...update.data }
        await this.cache.setNote(updatedNote)
      }
    } else if (update.entity_type === 'folder') {
      const folder = await this.cache.getFolder(update.entity_id)
      if (folder && update.data) {
        const updatedFolder = { ...folder, ...update.data }
        await this.cache.setFolder(updatedFolder)
      }
    } else if (update.entity_type === 'review') {
      const review = await this.cache.getReview(update.entity_id)
      if (review && update.data) {
        const updatedReview = { ...review, ...update.data }
        await this.cache.setReview(updatedReview)
      }
    }
  }

  /**
   * 应用服务器删除操作
   */
  private async applyServerDelete(update: ServerUpdate): Promise<void> {
    if (update.entity_type === 'note') {
      await this.cache.deleteNote(update.entity_id)
    } else if (update.entity_type === 'folder') {
      await this.cache.deleteFolder(update.entity_id)
    } else if (update.entity_type === 'review') {
      await this.cache.deleteReview(update.entity_id)
    }
  }

  /**
   * 处理冲突
   */
  private async handleConflict(conflict: SyncConflict): Promise<void> {
    // 保存冲突信息
    await this.saveConflict(conflict)

    // 自动解决冲突
    if (this.config.defaultConflictStrategy !== ConflictResolutionStrategy.MANUAL) {
      await this.resolveConflict(conflict.conflict_id, this.config.defaultConflictStrategy)
    } else {
      // 发送冲突事件，等待手动解决
      this.emit({
        type: 'sync_conflict',
        timestamp: Date.now(),
        data: conflict,
      })
    }
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    resolvedData?: Record<string, any>
  ): Promise<ConflictResolutionResult> {
    const conflict = await this.getConflict(conflictId)
    if (!conflict) {
      return {
        conflict_id: conflictId,
        success: false,
        error: 'Conflict not found',
      }
    }

    try {
      let finalData: Record<string, any>

      switch (strategy) {
        case ConflictResolutionStrategy.SERVER_WINS:
          finalData = conflict.server_data.data
          break

        case ConflictResolutionStrategy.CLIENT_WINS:
          finalData = conflict.client_data.data
          break

        case ConflictResolutionStrategy.LATEST_WINS:
          const serverTime = new Date(conflict.server_data.modified_at).getTime()
          const clientTime = new Date(conflict.client_data.modified_at || conflict.localTimestamp.toString()).getTime()
          finalData = serverTime > clientTime ? conflict.server_data.data : conflict.client_data.data
          break

        case ConflictResolutionStrategy.MERGE:
          finalData = this.mergeData(conflict.server_data.data, conflict.client_data.data)
          break

        case ConflictResolutionStrategy.MANUAL:
          if (!resolvedData) {
            return {
              conflict_id: conflictId,
              success: false,
              error: 'Resolved data required for manual resolution',
            }
          }
          finalData = resolvedData
          break

        default:
          return {
            conflict_id: conflictId,
            success: false,
            error: 'Unknown conflict resolution strategy',
          }
      }

      // 应用解决后的数据
      await this.applyResolvedData(conflict, finalData)

      // 标记冲突为已解决
      await this.markConflictResolved(conflictId, strategy)

      this.emit({
        type: 'sync_conflict_resolved',
        timestamp: Date.now(),
        data: { conflictId, strategy, data: finalData },
      })

      return {
        conflict_id: conflictId,
        success: true,
        resolved_data: finalData,
      }
    } catch (error) {
      return {
        conflict_id: conflictId,
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * 合并数据
   */
  private mergeData(
    serverData: Record<string, any>,
    clientData: Record<string, any>
  ): Record<string, any> {
    const merged: Record<string, any> = { ...serverData }

    for (const key in clientData) {
      if (serverData[key] !== undefined) {
        // 如果两边都有这个字段，选择更新的
        const serverTime = this.extractTimestamp(serverData)
        const clientTime = this.extractTimestamp(clientData)
        merged[key] = serverTime > clientTime ? serverData[key] : clientData[key]
      } else {
        // 只有客户端有这个字段
        merged[key] = clientData[key]
      }
    }

    return merged
  }

  /**
   * 提取时间戳
   */
  private extractTimestamp(data: Record<string, any>): number {
    return new Date(data.updated_at || data.modified_at || Date.now()).getTime()
  }

  /**
   * 应用解决后的数据
   */
  private async applyResolvedData(
    conflict: SyncConflict,
    data: Record<string, any>
  ): Promise<void> {
    if (conflict.entity_type === 'note') {
      const note = await this.cache.getNote(conflict.entity_id)
      if (note) {
        const updatedNote = { ...note, ...data }
        await this.cache.setNote(updatedNote)
      }
    } else if (conflict.entity_type === 'folder') {
      const folder = await this.cache.getFolder(conflict.entity_id)
      if (folder) {
        const updatedFolder = { ...folder, ...data }
        await this.cache.setFolder(updatedFolder)
      }
    } else if (conflict.entity_type === 'review') {
      const review = await this.cache.getReview(conflict.entity_id)
      if (review) {
        const updatedReview = { ...review, ...data }
        await this.cache.setReview(updatedReview)
      }
    }
  }

  // ========================================================================
  // 同步队列操作
  // ========================================================================

  /**
   * 添加操作到同步队列
   */
  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    }

    const queue = await this.getSyncQueue()
    queue.push(queueItem)
    await this.saveSyncQueue(queue)

    this.syncStatus.pendingItems = queue.filter((item) => item.status === 'pending').length
    this.emit({ type: 'queue_updated', timestamp: Date.now(), data: queueItem })

    return queueItem.id
  }

  /**
   * 从同步队列移除操作
   */
  async removeFromQueue(itemId: string): Promise<void> {
    const queue = await this.getSyncQueue()
    const index = queue.findIndex((item) => item.id === itemId)
    if (index > -1) {
      queue.splice(index, 1)
      await this.saveSyncQueue(queue)
      this.syncStatus.pendingItems = queue.filter((item) => item.status === 'pending').length
    }
  }

  /**
   * 重试失败的操作
   */
  async retryFailedItem(itemId: string): Promise<void> {
    const queue = await this.getSyncQueue()
    const item = queue.find((item) => item.id === itemId)

    if (item) {
      item.status = 'pending'
      item.retryCount = 0
      item.errorMessage = undefined
      await this.saveSyncQueue(queue)
      this.syncStatus.pendingItems = queue.filter((item) => item.status === 'pending').length
      this.syncStatus.failedItems = queue.filter((item) => item.status === 'failed').length
    }
  }

  /**
   * 重试所有失败的操作
   */
  async retryAllFailed(): Promise<void> {
    const queue = await this.getSyncQueue()
    let updated = false

    for (const item of queue) {
      if (item.status === 'failed') {
        item.status = 'pending'
        item.retryCount = 0
        item.errorMessage = undefined
        updated = true
      }
    }

    if (updated) {
      await this.saveSyncQueue(queue)
      this.syncStatus.pendingItems = queue.filter((item) => item.status === 'pending').length
      this.syncStatus.failedItems = queue.filter((item) => item.status === 'failed').length
    }
  }

  /**
   * 清空同步队列
   */
  async clearQueue(): Promise<void> {
    await this.cache.delete(CacheKeys.SYNC_QUEUE)
    this.syncStatus.pendingItems = 0
    this.syncStatus.failedItems = 0
    this.emit({ type: 'queue_updated', timestamp: Date.now(), data: [] })
  }

  /**
   * 获取同步队列
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const item = await this.cache.get<SyncQueueItem[]>(CacheKeys.SYNC_QUEUE)
    return item?.data || []
  }

  /**
   * 保存同步队列
   */
  private async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
    await this.cache.set(CacheKeys.SYNC_QUEUE, queue, {
      persist: true,
      ttl: 30 * 24 * 60 * 60 * 1000, // 30天
    })
  }

  /**
   * 加载同步队列
   */
  private async loadSyncQueue(): Promise<void> {
    await this.getSyncQueue()
    this.syncStatus.pendingItems = await this.getPendingCount()
    this.syncStatus.failedItems = await this.getFailedCount()
  }

  /**
   * 获取待同步操作数量
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getSyncQueue()
    return queue.filter((item) => item.status === 'pending').length
  }

  /**
   * 获取失败操作数量
   */
  async getFailedCount(): Promise<number> {
    const queue = await this.getSyncQueue()
    return queue.filter((item) => item.status === 'failed').length
  }

  /**
   * 获取冲突数量
   */
  async getConflictCount(): Promise<number> {
    const conflicts = await this.getConflicts()
    return conflicts.filter((c) => !c.resolved).length
  }

  /**
   * 标记失败项
   */
  private async markFailedItems(error: Error): Promise<void> {
    const queue = await this.getSyncQueue()
    let updated = false

    for (const item of queue) {
      if (item.status === 'syncing') {
        item.status = 'failed'
        item.retryCount++
        item.errorMessage = error.message
        updated = true
      }
    }

    if (updated) {
      await this.saveSyncQueue(queue)
      this.syncStatus.failedItems = queue.filter((item) => item.status === 'failed').length
    }
  }

  // ========================================================================
  // 冲突管理
  // ========================================================================

  /**
   * 保存冲突
   */
  private async saveConflict(conflict: SyncConflict): Promise<void> {
    const conflicts = await this.getConflicts()
    conflicts.push({
      id: conflict.conflict_id,
      type: conflict.entity_type,
      entityId: conflict.entity_id,
      localVersion: conflict.client_data.data,
      remoteVersion: conflict.server_data.data,
      localTimestamp: new Date(conflict.client_data.modified_at || Date.now()).getTime(),
      remoteTimestamp: new Date(conflict.server_data.modified_at).getTime(),
      resolved: false,
      conflictFields: conflict.conflict_fields,
    })

    await this.cache.set(CacheKeys.SYNC_CONFLICTS, conflicts, {
      persist: true,
    })

    this.syncStatus.conflictItems = conflicts.filter((c) => !c.resolved).length
  }

  /**
   * 获取所有冲突
   */
  async getConflicts(): Promise<Conflict[]> {
    const item = await this.cache.get<Conflict[]>(CacheKeys.SYNC_CONFLICTS)
    return item?.data || []
  }

  /**
   * 获取指定冲突
   */
  async getConflict(conflictId: string): Promise<Conflict | null> {
    const conflicts = await this.getConflicts()
    return conflicts.find((c) => c.id === conflictId) || null
  }

  /**
   * 标记冲突为已解决
   */
  private async markConflictResolved(
    conflictId: string,
    strategy: ConflictResolutionStrategy
  ): Promise<void> {
    const conflicts = await this.getConflicts()
    const conflict = conflicts.find((c) => c.id === conflictId)

    if (conflict) {
      conflict.resolved = true
      conflict.resolution = strategy === ConflictResolutionStrategy.CLIENT_WINS ? 'local' :
                            strategy === ConflictResolutionStrategy.SERVER_WINS ? 'remote' : 'merge'

      await this.cache.set(CacheKeys.SYNC_CONFLICTS, conflicts, {
        persist: true,
      })

      this.syncStatus.conflictItems = conflicts.filter((c) => !c.resolved).length
    }
  }

  /**
   * 清除所有冲突
   */
  async clearConflicts(): Promise<void> {
    await this.cache.delete(CacheKeys.SYNC_CONFLICTS)
    this.syncStatus.conflictItems = 0
  }

  // ========================================================================
  // 同步状态管理
  // ========================================================================

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<CacheSyncStatus> {
    return { ...this.syncStatus }
  }

  /**
   * 更新同步进度
   */
  private updateSyncProgress(current: number, total: number): void {
    this.syncStatus.progress = { current, total }
    this.emit({
      type: 'sync_progress',
      timestamp: Date.now(),
      data: { current, total },
    })
  }

  /**
   * 获取客户端状态
   */
  private async getClientState(): Promise<ClientSyncState> {
    const item = await this.cache.get<ClientSyncState>(CacheKeys.SYNC_STATUS)
    const storedState = item?.data

    return {
      client_id: this.clientId,
      last_sync_time: storedState?.lastSyncTime || new Date(0).toISOString(),
      server_version: storedState?.serverVersion || '1.0.0',
      pending_operations: await this.getPendingCount(),
      last_sync_id: this.currentSyncId || undefined,
    }
  }

  /**
   * 保存客户端状态
   */
  private async saveClientState(state: ClientSyncState): Promise<void> {
    const syncStatus: CacheSyncStatus = {
      lastSyncTime: new Date(state.last_sync_time).getTime(),
      isSyncing: false,
      pendingItems: state.pending_operations,
      failedItems: await this.getFailedCount(),
      conflictItems: await this.getConflictCount(),
      syncMode: this.syncStatus.syncMode,
      connectionStatus: this.syncStatus.connectionStatus,
      serverVersion: state.server_version,
    }

    this.syncStatus = syncStatus
    await this.cache.set(CacheKeys.SYNC_STATUS, syncStatus, {
      persist: true,
    })
  }

  /**
   * 加载客户端状态
   */
  private async loadClientState(): Promise<void> {
    const item = await this.cache.get<CacheSyncStatus>(CacheKeys.SYNC_STATUS)
    if (item?.data) {
      this.syncStatus = item.data
    }
  }

  // ========================================================================
  // 实体同步操作（便捷方法）
  // ========================================================================

  /**
   * 同步笔记
   */
  async syncNote(note: Note, operation: 'create' | 'update' | 'delete'): Promise<string> {
    const beforeVersion = operation === 'update' || operation === 'delete'
      ? await this.cache.getVersion(CacheKeys.NOTE(note.id))
      : undefined

    return this.addToQueue({
      type: operation,
      entity: 'note',
      entityId: note.id,
      data: note,
      beforeVersion,
    })
  }

  /**
   * 同步文件夹
   */
  async syncFolder(folder: Folder, operation: 'create' | 'update' | 'delete'): Promise<string> {
    const beforeVersion = operation === 'update' || operation === 'delete'
      ? await this.cache.getVersion(CacheKeys.FOLDER(folder.id))
      : undefined

    return this.addToQueue({
      type: operation,
      entity: 'folder',
      entityId: folder.id,
      data: folder,
      beforeVersion,
    })
  }

  /**
   * 同步复盘记录
   */
  async syncReview(review: Review, operation: 'create' | 'update' | 'delete'): Promise<string> {
    const beforeVersion = operation === 'update' || operation === 'delete'
      ? await this.cache.getVersion(CacheKeys.REVIEW(review.id))
      : undefined

    return this.addToQueue({
      type: operation,
      entity: 'review',
      entityId: review.id,
      data: review,
      beforeVersion,
    })
  }

  /**
   * 创建离线笔记
   */
  async createOfflineNote(note: Partial<Note>): Promise<number> {
    const tempId = Date.now()
    const offlineNote: Note = {
      id: tempId,
      user_id: note.user_id!,
      title: note.title!,
      content: note.content || '',
      folder_id: note.folder_id,
      is_pinned: note.is_pinned || false,
      last_accessed_at: new Date().toISOString(),
      content_hash: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await this.cache.setNote(offlineNote)

    // 添加到同步队列
    await this.addToQueue({
      type: 'create',
      entity: 'note',
      tempId: tempId.toString(),
      data: offlineNote,
    })

    return tempId
  }

  /**
   * 创建离线文件夹
   */
  async createOfflineFolder(folder: Partial<Folder>): Promise<number> {
    const tempId = Date.now()
    const offlineFolder: Folder = {
      id: tempId,
      user_id: folder.user_id!,
      name: folder.name!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await this.cache.setFolder(offlineFolder)

    // 添加到同步队列
    await this.addToQueue({
      type: 'create',
      entity: 'folder',
      tempId: tempId.toString(),
      data: offlineFolder,
    })

    return tempId
  }

  /**
   * 创建离线复盘记录
   */
  async createOfflineReview(review: Partial<Review>): Promise<number> {
    const tempId = Date.now()
    const offlineReview: Review = {
      id: tempId,
      user_id: review.user_id!,
      date: review.date!,
      content: review.content || '',
      mood: review.mood,
      achievements: review.achievements,
      improvements: review.improvements,
      plans: review.plans,
      template_id: review.template_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await this.cache.setReview(offlineReview)

    // 添加到同步队列
    await this.addToQueue({
      type: 'create',
      entity: 'review',
      tempId: tempId.toString(),
      data: offlineReview,
    })

    return tempId
  }

  // ========================================================================
  // 数据差异操作
  // ========================================================================

  /**
   * 计算数据差异
   */
  async computeDiff(
    localData: Record<string, any>,
    remoteData: Record<string, any>
  ): Promise<{
    added: Record<string, any>
    removed: Record<string, any>
    modified: Record<string, { local: any; remote: any }>
    unchanged: Record<string, any>
  }> {
    const result = {
      added: {} as Record<string, any>,
      removed: {} as Record<string, any>,
      modified: {} as Record<string, { local: any; remote: any }>,
      unchanged: {} as Record<string, any>,
    }

    const allKeys = new Set([
      ...Object.keys(localData),
      ...Object.keys(remoteData),
    ])

    for (const key of allKeys) {
      const localValue = localData[key]
      const remoteValue = remoteData[key]

      if (localValue === undefined && remoteValue !== undefined) {
        // 仅远程有
        result.removed[key] = remoteValue
      } else if (localValue !== undefined && remoteValue === undefined) {
        // 仅本地有
        result.added[key] = localValue
      } else if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        // 两边都有但值不同
        result.modified[key] = { local: localValue, remote: remoteValue }
      } else {
        // 值相同
        result.unchanged[key] = localValue
      }
    }

    return result
  }

  /**
   * 检测数据冲突
   */
  async detectConflict(
    localData: Record<string, any>,
    remoteData: Record<string, any>,
    localVersion: number,
    remoteVersion: number
  ): Promise<boolean> {
    // 版本号相同，无冲突
    if (localVersion === remoteVersion) {
      return false
    }

    // 计算差异
    const diff = await this.computeDiff(localData, remoteData)

    // 如果有修改的字段，则存在冲突
    return Object.keys(diff.modified).length > 0
  }

  /**
   * 应用补丁
   */
  async applyPatch(
    baseData: Record<string, any>,
    patch: Record<string, any>
  ): Promise<Record<string, any>> {
    return { ...baseData, ...patch }
  }

  /**
   * 生成补丁
   */
  async generatePatch(
    before: Record<string, any>,
    after: Record<string, any>
  ): Promise<Record<string, any>> {
    const patch: Record<string, any> = {}

    for (const key in after) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        patch[key] = after[key]
      }
    }

    return patch
  }

  // ========================================================================
  // 事件系统
  // ========================================================================

  /**
   * 添加事件监听器
   */
  on(event: SyncEventType, listener: SyncEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: SyncEventType, listener: SyncEventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach((listener) => listener(event))
    }
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void {
    this.eventListeners.clear()
  }

  // ========================================================================
  // 工具方法
  // ========================================================================

  /**
   * 获取当前时间戳
   */
  private getCurrentTimestamp(): number {
    return Date.now()
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopAutoSync()
    this.removeAllListeners()
  }
}

// ============================================================================
// 同步管理器工厂
// ============================================================================

/**
 * 同步管理器工厂
 */
export class SyncManagerFactory {
  /**
   * 创建同步管理器实例
   */
  static create(cache: IFullCache, config?: Partial<SyncManagerConfig>): SyncManager {
    return new SyncManager(cache, config)
  }
}
