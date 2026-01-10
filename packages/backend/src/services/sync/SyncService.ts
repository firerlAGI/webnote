/**
 * T3项目同步服务核心类
 * 负责处理所有数据同步逻辑
 */

import { PrismaClient } from '@prisma/client'
import {
  SyncRequest,
  SyncResponse,
  SyncOperation,
  SyncOperationType,
  EntityType,
  Conflict,
  ConflictResolution,
  ConflictResolutionResult,
  ConflictType,
  ConflictResolutionStrategy,
  SyncStatus,
  ClientSyncState,
  ServerUpdate,
  OperationResult,
  Version
} from '@webnote/shared/types/sync'
import { SyncStatusDetail,
  QueuedSyncOperation,
  EntityDiff,
  GetDataDiffRequest,
  PollingResponse,
  PollingPriority
} from './types'
import { WebSocket } from '@fastify/websocket'
import crypto from 'crypto'
import { Logger } from 'pino'
import {
  FallbackManager,
  ConnectionHealthConfig,
  HTTPPollingConfig
} from './fallback'

// ============================================================================
// 同步服务配置
// ============================================================================

/**
 * 同步服务配置
 */
export interface SyncServiceConfig {
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
  /** 批次大小 */
  defaultBatchSize: number
  /** 同步超时时间（毫秒） */
  syncTimeout: number
  /** 冲突解决超时时间（毫秒） */
  conflictResolutionTimeout: number
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number
  /** 心跳超时（毫秒） */
  heartbeatTimeout: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SyncServiceConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  defaultBatchSize: 100,
  syncTimeout: 60000, // 1分钟
  conflictResolutionTimeout: 30000, // 30秒
  heartbeatInterval: 30000, // 30秒
  heartbeatTimeout: 60000 // 60秒
}

// ============================================================================
// WebSocket 连接信息
// ============================================================================

/**
 * WebSocket 连接信息
 */
export interface WebSocketConnection {
  /** 连接ID */
  connection_id: string
  /** WebSocket 实例 */
  socket: WebSocket
  /** 用户ID */
  user_id: number
  /** 客户端ID */
  client_id: string
  /** 设备ID */
  device_id: string
  /** 连接状态 */
  status: 'connected' | 'authenticated' | 'disconnected'
  /** 最后心跳时间 */
  last_heartbeat: string
  /** 连接时间 */
  connected_at: string
  /** 错过的心跳次数 */
  missed_heartbeats: number
  /** 认证超时时间 */
  auth_timeout: NodeJS.Timeout | null
}

// ============================================================================
// 同步服务类
// ============================================================================

/**
 * 同步服务核心类
 */
export class SyncService {
  private prisma: PrismaClient
  private logger: Logger
  private config: SyncServiceConfig
  private activeConnections: Map<string, WebSocketConnection>
  private activeSyncs: Map<string, SyncStatusDetail>
  private syncQueue: Map<string, QueuedSyncOperation[]>
  private heartbeatTimers: Map<string, NodeJS.Timeout>
  private fallbackManager: FallbackManager | null = null

  constructor(prisma: PrismaClient, logger: Logger, config: Partial<SyncServiceConfig> = {}) {
    this.prisma = prisma
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.activeConnections = new Map()
    this.activeSyncs = new Map()
    this.syncQueue = new Map()
    this.heartbeatTimers = new Map()

    this.startHeartbeatCheck()
  }

  /**
   * 初始化降级管理器
   */
  initializeFallbackManager(
    healthConfig?: Partial<ConnectionHealthConfig>,
    pollingConfig?: Partial<HTTPPollingConfig>
  ): void {
    if (!this.fallbackManager) {
      this.fallbackManager = FallbackManager.getInstance(
        this.logger,
        this.prisma,
        healthConfig,
        pollingConfig
      )
      this.logger.info('FallbackManager initialized')
    }
  }

  /**
   * 获取降级管理器
   */
  getFallbackManager(): FallbackManager | null {
    return this.fallbackManager
  }

  // ============================================================================
  // WebSocket 连接管理
  // ============================================================================

  /**
   * 处理 WebSocket 连接
   */
  async handleConnection(socket: WebSocket): Promise<string> {
    const connection_id = this.generateId('conn')
    const connection: WebSocketConnection = {
      connection_id,
      socket,
      user_id: 0,
      client_id: '',
      device_id: '',
      status: 'connected',
      last_heartbeat: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      missed_heartbeats: 0,
      auth_timeout: null
    }

    this.activeConnections.set(connection_id, connection)
    this.logger.info({ connection_id }, 'WebSocket connection established')

    return connection_id
  }

  /**
   * 处理 WebSocket 连接（带客户端ID）
   */
  async handleConnectionWithClientId(socket: WebSocket, clientId: string): Promise<string> {
    const connection_id = this.generateId('conn')
    const connection: WebSocketConnection = {
      connection_id,
      socket,
      user_id: 0,
      client_id: clientId,
      device_id: '',
      status: 'connected',
      last_heartbeat: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      missed_heartbeats: 0,
      auth_timeout: null
    }

    this.activeConnections.set(connection_id, connection)

    // 初始化降级管理器
    if (this.fallbackManager) {
      this.fallbackManager.initializeClient(clientId)
      this.fallbackManager.handleWebSocketConnection(clientId)
    }

    this.logger.info({ connection_id, client_id: clientId }, 'WebSocket connection established')

    return connection_id
  }

  /**
   * 处理 WebSocket 断开连接
   */
  async handleDisconnection(connection_id: string): Promise<void> {
    const connection = this.activeConnections.get(connection_id)
    if (connection) {
      const clientId = connection.client_id

      this.activeConnections.delete(connection_id)
      this.clearHeartbeatTimer(connection_id)

      // 通知降级管理器
      if (this.fallbackManager && clientId) {
        this.fallbackManager.handleWebSocketDisconnection(clientId, 'WebSocket connection closed')
      }

      this.logger.info({ connection_id, client_id: connection.client_id }, 'WebSocket connection closed')
    }
  }

  /**
   * 处理 WebSocket 消息
   */
  async handleMessage(connection_id: string, message: any): Promise<any> {
    const connection = this.activeConnections.get(connection_id)
    if (!connection) {
      throw new Error('Connection not found')
    }

    try {
      switch (message.type) {
        case 'auth':
          return await this.handleAuth(connection, message)
        case 'sync':
          return await this.handleSync(connection, message)
        case 'ping':
          return await this.handlePing(connection)
        default:
          throw new Error(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      this.logger.error({ error, connection_id, message_type: message.type }, 'Error handling WebSocket message')
      throw error
    }
  }

  /**
   * 处理认证
   */
  private async handleAuth(connection: WebSocketConnection, message: any): Promise<any> {
    // 实现认证逻辑
    // 验证 JWT token
    // 更新连接状态
    connection.status = 'authenticated'
    connection.user_id = message.user_id
    connection.client_id = message.client_id

    this.startHeartbeatTimer(connection.connection_id)

    return {
      type: 'auth',
      success: true,
      user_id: connection.user_id
    }
  }

  /**
   * 处理同步请求
   */
  private async handleSync(connection: WebSocketConnection, message: any): Promise<any> {
    const syncRequest = message.data as SyncRequest
    const syncResponse = await this.processSyncRequest(connection.user_id, syncRequest)

    return {
      type: 'sync_response',
      request_id: syncRequest.request_id,
      data: syncResponse
    }
  }

  /**
   * 处理心跳
   */
  private async handlePing(connection: WebSocketConnection): Promise<any> {
    connection.last_heartbeat = new Date().toISOString()
    return { type: 'pong', timestamp: new Date().toISOString() }
  }

  /**
   * 发送消息到客户端
   */
  async sendToClient(connection_id: string, message: any): Promise<void> {
    const connection = this.activeConnections.get(connection_id)
    if (connection && connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.send(JSON.stringify(message))
    }
  }

  /**
   * 广播消息到用户的所有连接
   */
  async broadcastToUser(user_id: number, message: any): Promise<void> {
    for (const [connection_id, connection] of this.activeConnections.entries()) {
      if (connection.user_id === user_id && connection.status === 'authenticated') {
        await this.sendToClient(connection_id, message)
      }
    }
  }

  // ============================================================================
  // 心跳管理
  // ============================================================================

  /**
   * 启动心跳计时器
   */
  private startHeartbeatTimer(connection_id: string): void {
    this.clearHeartbeatTimer(connection_id)

    const timer = setInterval(async () => {
      const connection = this.activeConnections.get(connection_id)
      if (!connection) {
        this.clearHeartbeatTimer(connection_id)
        return
      }

      const now = new Date()
      const lastHeartbeat = new Date(connection.last_heartbeat)
      const elapsed = now.getTime() - lastHeartbeat.getTime()

      if (elapsed > this.config.heartbeatTimeout) {
        this.logger.warn({ connection_id, elapsed }, 'Heartbeat timeout, closing connection')
        connection.socket.close()
        this.handleDisconnection(connection_id)
        return
      }

      // 发送心跳
      try {
        await this.sendToClient(connection_id, {
          type: 'ping',
          timestamp: now.toISOString()
        })
      } catch (error) {
        this.logger.error({ error, connection_id }, 'Error sending heartbeat')
      }
    }, this.config.heartbeatInterval)

    this.heartbeatTimers.set(connection_id, timer)
  }

  /**
   * 清除心跳计时器
   */
  private clearHeartbeatTimer(connection_id: string): void {
    const timer = this.heartbeatTimers.get(connection_id)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(connection_id)
    }
  }

  /**
   * 启动心跳检查
   */
  private startHeartbeatCheck(): void {
    setInterval(() => {
      this.logger.debug({
        active_connections: this.activeConnections.size,
        active_syncs: this.activeSyncs.size
      }, 'Heartbeat check')
    }, 60000)
  }

  // ============================================================================
  // 同步处理核心逻辑
  // ============================================================================

  /**
   * 处理同步请求
   */
  async processSyncRequest(user_id: number, request: SyncRequest): Promise<SyncResponse> {
    const sync_id = this.generateId('sync')

    // 创建同步状态
    const syncStatus: SyncStatusDetail = {
      sync_id,
      client_id: request.client_id,
      user_id,
      status: SyncStatus.SYNCING,
      start_time: new Date().toISOString(),
      total_operations: request.operations.length,
      completed_operations: 0,
      successful_operations: 0,
      failed_operations: 0,
      conflicts_count: 0,
      resolved_conflicts: 0,
      progress: 0,
      entity_types: request.operations.map(op => op.entity_type)
    }

    this.activeSyncs.set(sync_id, syncStatus)

    try {
      // 验证协议版本
      if (request.protocol_version !== '1.0.0') {
        throw new Error(`Unsupported protocol version: ${request.protocol_version}`)
      }

      // 处理每个操作
      const operationResults: OperationResult[] = []
      const conflicts: Conflict[] = []
      const serverUpdates: ServerUpdate[] = []

      for (const operation of request.operations) {
        try {
          // 检测冲突
          const conflict = await this.detectConflict(user_id, operation)
          if (conflict) {
            conflicts.push(conflict)
            syncStatus.conflicts_count++

            // 尝试自动解决冲突
            const resolution = await this.resolveConflict(
              conflict,
              request.default_resolution_strategy || ConflictResolutionStrategy.LATEST_WINS
            )

            if (resolution.success) {
              syncStatus.resolved_conflicts++
            }
          } else {
            // 执行操作
            const result = await this.executeOperation(user_id, operation)
            operationResults.push(result)

            if (result.success) {
              syncStatus.successful_operations++
              // 生成服务器更新
              const serverUpdate = this.createServerUpdate(operation, result)
              serverUpdates.push(serverUpdate)
            } else {
              syncStatus.failed_operations++
            }
          }

          syncStatus.completed_operations++
          syncStatus.progress = Math.round((syncStatus.completed_operations / syncStatus.total_operations) * 100)

        } catch (error) {
          this.logger.error({ error, operation_id: operation.operation_id }, 'Error processing operation')
          syncStatus.failed_operations++
        }
      }

      // 获取服务器端的更新
      const serverSideUpdates = await this.getServerUpdates(
        user_id,
        request.client_state.last_sync_time,
        request.entity_types || ['note', 'folder', 'review']
      )

      // 更新客户端状态
      const newClientState: ClientSyncState = {
        client_id: request.client_id,
        last_sync_time: new Date().toISOString(),
        server_version: request.protocol_version,
        pending_operations: 0,
        last_sync_id: sync_id
      }

      // 保存同步状态
      await this.saveSyncStatus(syncStatus)

      // 更新同步状态为成功
      syncStatus.status = conflicts.length > syncStatus.resolved_conflicts
        ? SyncStatus.CONFLICT
        : SyncStatus.SUCCESS
      syncStatus.end_time = new Date().toISOString()

      // 构建响应
      const response: SyncResponse = {
        request_id: request.request_id,
        server_time: new Date().toISOString(),
        protocol_version: request.protocol_version,
        status: syncStatus.status,
        operation_results: operationResults,
        server_updates: [...serverUpdates, ...serverSideUpdates],
        conflicts,
        new_client_state: newClientState,
        warnings: conflicts.length > syncStatus.resolved_conflicts
          ? ['Some conflicts could not be auto-resolved']
          : undefined
      }

      return response

    } catch (error) {
      this.logger.error({ error, sync_id }, 'Sync failed')

      syncStatus.status = SyncStatus.FAILED
      syncStatus.end_time = new Date().toISOString()

      return {
        request_id: request.request_id,
        server_time: new Date().toISOString(),
        protocol_version: request.protocol_version,
        status: SyncStatus.FAILED,
        operation_results: [],
        server_updates: [],
        conflicts: [],
        new_client_state: request.client_state,
        error: (error as Error).message
      }
    } finally {
      this.activeSyncs.delete(sync_id)
    }
  }

  /**
   * 执行同步操作
   */
  private async executeOperation(user_id: number, operation: SyncOperation): Promise<OperationResult> {
    const result: OperationResult = {
      operation_id: operation.operation_id,
      operation_type: operation.operation_type,
      entity_type: operation.entity_type,
      success: false
    }

    try {
      switch (operation.operation_type) {
        case SyncOperationType.CREATE:
          return await this.executeCreate(user_id, operation as any)
        case SyncOperationType.UPDATE:
          return await this.executeUpdate(user_id, operation as any)
        case SyncOperationType.DELETE:
          return await this.executeDelete(user_id, operation as any)
        case SyncOperationType.READ:
          return await this.executeRead(user_id, operation as any)
        default:
          throw new Error(`Unknown operation type: ${operation.operation_type}`)
      }
    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 执行创建操作
   */
  private async executeCreate(user_id: number, operation: any): Promise<OperationResult> {
    const result: OperationResult = {
      operation_id: operation.operation_id,
      operation_type: SyncOperationType.CREATE,
      entity_type: operation.entity_type,
      success: false
    }

    try {
      let createdRecord: any = null

      switch (operation.entity_type) {
        case 'note':
          createdRecord = await this.prisma.note.create({
            data: {
              user_id,
              title: operation.data.title,
              content: operation.data.content,
              folder_id: operation.data.folder_id,
              is_pinned: operation.data.is_pinned || false,
              content_hash: this.generateHash(operation.data)
            }
          })
          break
        case 'folder':
          createdRecord = await this.prisma.folder.create({
            data: {
              user_id,
              name: operation.data.name
            }
          })
          break
        case 'review':
          createdRecord = await this.prisma.review.create({
            data: {
              user_id,
              date: new Date(operation.data.date),
              content: operation.data.content,
              mood: operation.data.mood,
              achievements: operation.data.achievements ? { type: 'json', value: JSON.stringify(operation.data.achievements) } : null,
              improvements: operation.data.improvements ? { type: 'json', value: JSON.stringify(operation.data.improvements) } : null,
              plans: operation.data.plans ? { type: 'json', value: JSON.stringify(operation.data.plans) } : null
            }
          })
          break
        default:
          throw new Error(`Unknown entity type: ${operation.entity_type}`)
      }

      result.success = true
      result.entity_id = createdRecord.id
      result.new_version = 1
      result.data = createdRecord

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 执行更新操作
   */
  private async executeUpdate(user_id: number, operation: any): Promise<OperationResult> {
    const result: OperationResult = {
      operation_id: operation.operation_id,
      operation_type: SyncOperationType.UPDATE,
      entity_type: operation.entity_type,
      success: false
    }

    try {
      let updatedRecord: any = null

      switch (operation.entity_type) {
        case 'note':
          updatedRecord = await this.prisma.note.update({
            where: { id: operation.entity_id, user_id },
            data: {
              ...operation.changes,
              content_hash: operation.changes.content ? this.generateHash(operation.changes) : undefined,
              updated_at: new Date()
            }
          })
          break
        case 'folder':
          updatedRecord = await this.prisma.folder.update({
            where: { id: operation.entity_id, user_id },
            data: {
              ...operation.changes,
              updated_at: new Date()
            }
          })
          break
        case 'review':
          updatedRecord = await this.prisma.review.update({
            where: { id: operation.entity_id, user_id },
            data: {
              ...operation.changes,
              date: operation.changes.date ? new Date(operation.changes.date) : undefined,
              updated_at: new Date()
            }
          })
          break
        default:
          throw new Error(`Unknown entity type: ${operation.entity_type}`)
      }

      result.success = true
      result.entity_id = updatedRecord.id
      result.new_version = (updatedRecord.version || 0) + 1
      result.data = updatedRecord

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 执行删除操作
   */
  private async executeDelete(user_id: number, operation: any): Promise<OperationResult> {
    const result: OperationResult = {
      operation_id: operation.operation_id,
      operation_type: SyncOperationType.DELETE,
      entity_type: operation.entity_type,
      success: false
    }

    try {
      switch (operation.entity_type) {
        case 'note':
          await this.prisma.note.delete({
            where: { id: operation.entity_id, user_id }
          })
          break
        case 'folder':
          await this.prisma.folder.delete({
            where: { id: operation.entity_id, user_id }
          })
          break
        case 'review':
          await this.prisma.review.delete({
            where: { id: operation.entity_id, user_id }
          })
          break
        default:
          throw new Error(`Unknown entity type: ${operation.entity_type}`)
      }

      result.success = true
      result.entity_id = operation.entity_id

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 执行读取操作
   */
  private async executeRead(user_id: number, operation: any): Promise<OperationResult> {
    const result: OperationResult = {
      operation_id: operation.operation_id,
      operation_type: SyncOperationType.READ,
      entity_type: operation.entity_type,
      success: false
    }

    try {
      let records: any[] = []

      switch (operation.entity_type) {
        case 'note':
          records = await this.prisma.note.findMany({
            where: {
              user_id,
              ...(operation.entity_id && { id: operation.entity_id }),
              ...(operation.since && { updated_at: { gte: new Date(operation.since) } })
            }
          })
          break
        case 'folder':
          records = await this.prisma.folder.findMany({
            where: {
              user_id,
              ...(operation.entity_id && { id: operation.entity_id }),
              ...(operation.since && { updated_at: { gte: new Date(operation.since) } })
            }
          })
          break
        case 'review':
          records = await this.prisma.review.findMany({
            where: {
              user_id,
              ...(operation.entity_id && { id: operation.entity_id }),
              ...(operation.since && { updated_at: { gte: new Date(operation.since) } })
            }
          })
          break
        default:
          throw new Error(`Unknown entity type: ${operation.entity_type}`)
      }

      result.success = true
      result.data = records

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  // ============================================================================
  // 冲突检测与解决
  // ============================================================================

  /**
   * 检测冲突
   */
  private async detectConflict(user_id: number, operation: SyncOperation): Promise<Conflict | null> {
    // 如果是创建操作，不需要检测冲突
    if (operation.operation_type === SyncOperationType.CREATE) {
      return null
    }

    // 对于更新和删除操作，需要检测版本冲突
    if (operation.operation_type === SyncOperationType.UPDATE ||
        operation.operation_type === SyncOperationType.DELETE) {

      const currentRecord = await this.getRecord(operation.entity_type, operation.entity_id!, user_id)

      if (!currentRecord) {
        // 记录不存在，可能已被删除
        return {
          conflict_id: this.generateId('conflict'),
          conflict_type: ConflictType.DELETE,
          entity_type: operation.entity_type,
          entity_id: operation.entity_id!,
          operation_id: operation.operation_id,
          server_data: {
            version: 0,
            data: {},
            modified_at: new Date().toISOString(),
            modified_by: 0
          },
          client_data: {
            version: operation.before_version || 0,
            data: (operation as any).data || {},
            modified_at: operation.timestamp,
            operation_type: operation.operation_type
          },
          conflict_fields: [],
          suggested_strategy: ConflictResolutionStrategy.CLIENT_WINS,
          timestamp: new Date().toISOString()
        }
      }

      // 检查版本是否匹配
      const currentVersion = currentRecord.version || 1
      const clientVersion = operation.before_version || 0

      if (clientVersion < currentVersion) {
        // 版本不匹配，存在冲突
        return {
          conflict_id: this.generateId('conflict'),
          conflict_type: ConflictType.VERSION,
          entity_type: operation.entity_type,
          entity_id: operation.entity_id!,
          operation_id: operation.operation_id,
          server_data: {
            version: currentVersion,
            data: currentRecord,
            modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
            modified_by: currentRecord.user_id
          },
          client_data: {
            version: clientVersion,
            data: (operation as any).data || (operation as any).changes || {},
            modified_at: operation.timestamp,
            operation_type: operation.operation_type
          },
          conflict_fields: this.getConflictFields(currentRecord, (operation as any).data || {}),
          suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
          timestamp: new Date().toISOString()
        }
      }
    }

    return null
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflict: Conflict,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: false
    }

    try {
      switch (strategy) {
        case ConflictResolutionStrategy.SERVER_WINS:
          result.success = true
          result.resolved_data = conflict.server_data.data
          result.new_version = conflict.server_data.version
          break

        case ConflictResolutionStrategy.CLIENT_WINS:
          result.success = true
          result.resolved_data = conflict.client_data.data
          result.new_version = conflict.server_data.version + 1
          break

        case ConflictResolutionStrategy.LATEST_WINS:
          const serverTime = new Date(conflict.server_data.modified_at).getTime()
          const clientTime = new Date(conflict.client_data.modified_at).getTime()

          if (clientTime >= serverTime) {
            result.resolved_data = conflict.client_data.data
            result.new_version = conflict.server_data.version + 1
          } else {
            result.resolved_data = conflict.server_data.data
            result.new_version = conflict.server_data.version
          }
          result.success = true
          break

        case ConflictResolutionStrategy.MERGE:
          const mergedData = this.mergeData(conflict.server_data.data, conflict.client_data.data)
          result.success = true
          result.resolved_data = mergedData
          result.new_version = conflict.server_data.version + 1
          break

        case ConflictResolutionStrategy.MANUAL:
          // 手动解决需要等待用户输入
          result.success = false
          result.error = 'Manual resolution required'
          break

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`)
      }

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 获取冲突字段
   */
  private getConflictFields(serverData: any, clientData: any): string[] {
    const conflictFields: string[] = []

    const serverKeys = Object.keys(serverData)
    const clientKeys = Object.keys(clientData)

    // 检查修改的字段
    for (const key of clientKeys) {
      if (serverKeys.includes(key)) {
        if (JSON.stringify(serverData[key]) !== JSON.stringify(clientData[key])) {
          conflictFields.push(key)
        }
      } else {
        // 客户端添加的字段
        conflictFields.push(key)
      }
    }

    return conflictFields
  }

  /**
   * 合并数据
   */
  private mergeData(serverData: any, clientData: any): any {
    const merged: any = { ...serverData }

    for (const key in clientData) {
      if (!merged[key] || JSON.stringify(merged[key]) !== JSON.stringify(clientData[key])) {
        merged[key] = clientData[key]
      }
    }

    return merged
  }

  // ============================================================================
  // 获取服务器更新
  // ============================================================================

  /**
   * 获取服务器端的更新
   */
  private async getServerUpdates(
    user_id: number,
    since: string,
    entityTypes: EntityType[]
  ): Promise<ServerUpdate[]> {
    const updates: ServerUpdate[] = []
    const sinceDate = new Date(since)

    for (const entityType of entityTypes) {
      const records = await this.getRecordsSince(user_id, entityType, sinceDate)

      for (const record of records) {
        updates.push({
          entity_type: entityType,
          entity_id: record.id,
          operation_type: record.deleted_at ? SyncOperationType.DELETE : SyncOperationType.UPDATE,
          version: record.version || 1,
          data: record.deleted_at ? undefined : record,
          modified_at: record.updated_at?.toISOString() || new Date().toISOString(),
          modified_by: record.user_id
        })
      }
    }

    return updates
  }

  /**
   * 获取记录
   */
  private async getRecord(entityType: EntityType, entityId: number, userId: number): Promise<any> {
    switch (entityType) {
      case 'note':
        return await this.prisma.note.findFirst({
          where: { id: entityId, user_id: userId }
        })
      case 'folder':
        return await this.prisma.folder.findFirst({
          where: { id: entityId, user_id: userId }
        })
      case 'review':
        return await this.prisma.review.findFirst({
          where: { id: entityId, user_id: userId }
        })
      default:
        return null
    }
  }

  /**
   * 获取自指定时间以来的记录
   */
  private async getRecordsSince(userId: number, entityType: EntityType, since: Date): Promise<any[]> {
    switch (entityType) {
      case 'note':
        return await this.prisma.note.findMany({
          where: {
            user_id: userId,
            updated_at: { gte: since }
          }
        })
      case 'folder':
        return await this.prisma.folder.findMany({
          where: {
            user_id: userId,
            updated_at: { gte: since }
          }
        })
      case 'review':
        return await this.prisma.review.findMany({
          where: {
            user_id: userId,
            updated_at: { gte: since }
          }
        })
      default:
        return []
    }
  }

  // ============================================================================
  // 同步状态管理
  // ============================================================================

  /**
   * 获取同步状态
   */
  async getSyncStatus(user_id: number, sync_id?: string): Promise<GetSyncStatusResponse> {
    if (sync_id) {
      const sync = this.activeSyncs.get(sync_id)
      if (sync && sync.user_id === user_id) {
        return {
          success: true,
          data: {
            active_syncs: [sync],
            sync_history: []
          }
        }
      }
    }

    const activeSyncs = Array.from(this.activeSyncs.values())
      .filter(sync => sync.user_id === user_id)

    return {
      success: true,
      data: {
        active_syncs,
        sync_history: []
      }
    }
  }

  /**
   * 取消同步
   */
  async cancelSync(user_id: number, sync_id: string): Promise<boolean> {
    const sync = this.activeSyncs.get(sync_id)
    if (!sync || sync.user_id !== user_id) {
      return false
    }

    sync.status = SyncStatus.CANCELLED
    sync.end_time = new Date().toISOString()

    return true
  }

  /**
   * 保存同步状态
   */
  private async saveSyncStatus(syncStatus: SyncStatusDetail): Promise<void> {
    // 在实际实现中，这里应该将同步状态保存到数据库
    // 目前只是内存存储
    this.logger.debug({ sync_id: syncStatus.sync_id }, 'Sync status saved')
  }

  // ============================================================================
  // 同步队列管理
  // ============================================================================

  /**
   * 获取同步队列
   */
  async getSyncQueue(user_id: number, queueType: string = 'all'): Promise<GetSyncQueueResponse> {
    let operations: QueuedSyncOperation[] = []

    for (const [clientId, ops] of this.syncQueue.entries()) {
      for (const op of ops) {
        if (op.user_id === user_id) {
          if (queueType === 'all' || op.status === queueType) {
            operations.push(op)
          }
        }
      }
    }

    const stats = {
      pending: operations.filter(op => op.status === 'pending').length,
      processing: operations.filter(op => op.status === 'processing').length,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length
    }

    return {
      success: true,
      data: {
        operations,
        total: operations.length,
        pagination: {
          page: 1,
          limit: operations.length,
          total_pages: 1
        },
        stats
      }
    }
  }

  /**
   * 添加操作到队列
   */
  async addToQueue(operation: QueuedSyncOperation): Promise<void> {
    const clientId = operation.client_id

    if (!this.syncQueue.has(clientId)) {
      this.syncQueue.set(clientId, [])
    }

    this.syncQueue.get(clientId)!.push(operation)
  }

  // ============================================================================
  // 数据差异分析
  // ============================================================================

  /**
   * 获取数据差异
   */
  async getDataDiff(user_id: number, request: GetDataDiffRequest): Promise<any> {
    const diffs: EntityDiff[] = []

    if (request.entity_id) {
      // 获取特定实体的差异
      const serverRecord = await this.getRecord(request.entity_type, request.entity_id, user_id)
      const clientRecord = request.client_data

      if (serverRecord && clientRecord) {
        const diff = this.calculateEntityDiff(request.entity_type, request.entity_id, serverRecord, clientRecord)
        diffs.push(diff)
      }
    } else {
      // 获取所有实体的差异
      const serverRecords = await this.getAllRecords(user_id, request.entity_type)

      for (const serverRecord of serverRecords) {
        const clientRecord = await this.getClientRecord(request.client_id, request.entity_type, serverRecord.id)

        if (clientRecord) {
          const diff = this.calculateEntityDiff(
            request.entity_type,
            serverRecord.id,
            serverRecord,
            clientRecord.data
          )
          diffs.push(diff)
        }
      }
    }

    return {
      success: true,
      data: {
        diffs,
        total_diffs: diffs.length,
        conflicts_count: diffs.filter(d => d.has_conflict).length,
        server_time: new Date().toISOString()
      }
    }
  }

  /**
   * 计算实体差异
   */
  private calculateEntityDiff(
    entityType: EntityType,
    entityId: number,
    serverData: any,
    clientData: any
  ): EntityDiff {
    const fieldDiffs: FieldDiff[] = []
    const serverKeys = Object.keys(serverData)
    const clientKeys = Object.keys(clientData)

    // 检查所有字段
    const allKeys = new Set([...serverKeys, ...clientKeys])

    for (const key of allKeys) {
      const serverValue = serverData[key]
      const clientValue = clientData[key]

      if (!clientKeys.includes(key)) {
        // 服务器有，客户端没有
        fieldDiffs.push({
          field_name: key,
          client_value: undefined,
          server_value: serverValue,
          diff_type: 'removed'
        })
      } else if (!serverKeys.includes(key)) {
        // 客户端有，服务器没有
        fieldDiffs.push({
          field_name: key,
          client_value: clientValue,
          server_value: undefined,
          diff_type: 'added'
        })
      } else if (JSON.stringify(serverValue) !== JSON.stringify(clientValue)) {
        // 两者都有但值不同
        fieldDiffs.push({
          field_name: key,
          client_value: clientValue,
          server_value: serverValue,
          diff_type: 'modified'
        })
      }
    }

    const hasConflict = fieldDiffs.some(diff => diff.diff_type === 'modified')

    return {
      entity_id: entityId,
      entity_type: entityType,
      client_version: clientData.version || 0,
      server_version: serverData.version || 1,
      client_data: clientData,
      server_data: serverData,
      field_diffs: fieldDiffs,
      diff_type: hasConflict ? 'conflict' : 'update',
      has_conflict: hasConflict
    }
  }

  /**
   * 获取所有记录
   */
  private async getAllRecords(userId: number, entityType: EntityType): Promise<any[]> {
    switch (entityType) {
      case 'note':
        return await this.prisma.note.findMany({ where: { user_id: userId } })
      case 'folder':
        return await this.prisma.folder.findMany({ where: { user_id: userId } })
      case 'review':
        return await this.prisma.review.findMany({ where: { user_id: userId } })
      default:
        return []
    }
  }

  /**
   * 获取客户端记录（模拟）
   */
  private async getClientRecord(clientId: string, entityType: EntityType, entityId: number): Promise<any> {
    // 在实际实现中，这里应该从客户端缓存或数据库获取
    // 目前返回null表示需要客户端提供
    return null
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * 生成哈希值
   */
  private generateHash(data: any): string {
    const dataString = JSON.stringify(data)
    return crypto.createHash('sha256').update(dataString).digest('hex')
  }

  /**
   * 创建服务器更新
   */
  private createServerUpdate(operation: SyncOperation, result: OperationResult): ServerUpdate {
    return {
      entity_type: operation.entity_type,
      entity_id: result.entity_id!,
      operation_type: operation.operation_type as any,
      version: result.new_version!,
      data: result.data,
      modified_at: new Date().toISOString(),
      modified_by: 0 // 从操作中获取
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SyncService')

    // 关闭降级管理器
    if (this.fallbackManager) {
      this.fallbackManager.shutdown()
    }

    // 清除所有心跳计时器
    for (const [connection_id, timer] of this.heartbeatTimers.entries()) {
      clearInterval(timer)
    }
    this.heartbeatTimers.clear()

    // 关闭所有连接
    for (const [connection_id, connection] of this.activeConnections.entries()) {
      try {
        connection.socket.close()
      } catch (error) {
        this.logger.error({ error, connection_id }, 'Error closing connection')
      }
    }
    this.activeConnections.clear()

    this.activeSyncs.clear()
    this.syncQueue.clear()
  }

  // ============================================================================
  // HTTP轮询降级相关方法
  // ============================================================================

  /**
   * 执行HTTP轮询
   */
  async poll(clientId: string, userId: number, since?: string): Promise<PollingResponse> {
    if (!this.fallbackManager) {
      return {
        success: false,
        updates: [],
        has_more: false,
        server_time: new Date().toISOString(),
        suggested_interval: 5000,
        error: 'Fallback manager not initialized'
      }
    }

    const pollingService = this.fallbackManager.getPollingService()
    const healthTracker = this.fallbackManager.getHealthTracker()

    try {
      // 获取服务器更新
      const updates = await this.getServerUpdatesForPolling(
        userId,
        since || new Date(Date.now() - 60000).toISOString()
      )

      // 检查健康状态
      const healthInfo = healthTracker.getHealthInfo(clientId)
      const suggestedInterval = healthInfo?.average_response_time
        ? Math.max(1000, Math.min(30000, healthInfo.average_response_time * 2))
        : 5000

      return {
        success: true,
        updates,
        has_more: false,
        server_time: new Date().toISOString(),
        suggested_interval: suggestedInterval
      }
    } catch (error) {
      this.logger.error({ error, client_id: clientId }, 'Polling failed')
      return {
        success: false,
        updates: [],
        has_more: false,
        server_time: new Date().toISOString(),
        suggested_interval: 5000,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取服务器更新（用于轮询）
   */
  private async getServerUpdatesForPolling(
    userId: number,
    since: string
  ): Promise<any[]> {
    const updates: any[] = []
    const sinceDate = new Date(since)
    const entityTypes = ['note', 'folder', 'review'] as const

    for (const entityType of entityTypes) {
      const records = await this.getRecordsSince(userId, entityType, sinceDate)

      for (const record of records) {
        updates.push({
          update_type: 'incremental',
          entity_type: entityType,
          entity_id: record.id,
          update_data: {
            operation_type: record.deleted_at ? 'DELETE' : 'UPDATE',
            version: record.version || 1,
            data: record.deleted_at ? undefined : this.sanitizeRecordForPolling(record),
            modified_at: record.updated_at?.toISOString() || new Date().toISOString(),
            modified_by: record.user_id
          },
          timestamp: record.updated_at?.toISOString() || new Date().toISOString()
        })
      }
    }

    return updates
  }

  /**
   * 清理记录数据（用于轮询）
   */
  private sanitizeRecordForPolling(record: any): any {
    const sanitized = { ...record }
    delete sanitized.user_id
    return sanitized
  }

  /**
   * 执行降级
   */
  async executeFallback(
    clientId: string,
    userId: number,
    callback: (response: PollingResponse) => void,
    priority: PollingPriority = PollingPriority.NORMAL
  ): Promise<void> {
    if (!this.fallbackManager) {
      throw new Error('Fallback manager not initialized')
    }

    await this.fallbackManager.getFallbackController().executeFallback(
      clientId,
      userId,
      callback,
      priority
    )
  }

  /**
   * 退出降级
   */
  async exitFallback(clientId: string): Promise<void> {
    if (!this.fallbackManager) {
      throw new Error('Fallback manager not initialized')
    }

    await this.fallbackManager.getFallbackController().exitFallback(clientId)
  }

  /**
   * 获取降级状态
   */
  getFallbackStatus(clientId?: string): {
    in_fallback: boolean
    polling_active: boolean
    health_status?: string
    fallback_reason?: string
  } {
    if (!this.fallbackManager) {
      return {
        in_fallback: false,
        polling_active: false
      }
    }

    const controller = this.fallbackManager.getFallbackController()

    if (clientId) {
      return controller.getFallbackStatus(clientId)
    }

    // 返回总体状态
    const allStatuses = controller.getAllFallbackStatus()
    let anyFallback = false
    let anyPolling = false

    for (const status of allStatuses.values()) {
      if (status.in_fallback) anyFallback = true
      if (status.polling_active) anyPolling = true
    }

    return {
      in_fallback: anyFallback,
      polling_active: anyPolling
    }
  }

  /**
   * 强制降级
   */
  forceFallback(
    clientId: string,
    userId: number,
    callback: (response: PollingResponse) => void,
    priority: PollingPriority = PollingPriority.NORMAL
  ): void {
    if (!this.fallbackManager) {
      throw new Error('Fallback manager not initialized')
    }

    this.fallbackManager.getFallbackController().forceFallback(
      clientId,
      userId,
      callback,
      priority
    )
  }

  /**
   * 尝试恢复
   */
  async attemptRecovery(clientId: string): Promise<boolean> {
    if (!this.fallbackManager) {
      return false
    }

    return await this.fallbackManager.getFallbackController().attemptRecovery(clientId)
  }

  /**
   * 获取健康信息
   */
  getHealthInfo(clientId: string): any {
    if (!this.fallbackManager) {
      return undefined
    }

    return this.fallbackManager.getHealthTracker().getHealthInfo(clientId)
  }
}
