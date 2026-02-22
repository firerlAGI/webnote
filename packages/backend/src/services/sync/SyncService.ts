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
  ConflictResolutionResult,
  ConflictType,
  ConflictResolutionStrategy,
  SyncStatus,
  ClientSyncState,
  ServerUpdate,
  OperationResult
} from '@webnote/shared/types/sync'
import { SyncStatusDetail,
  QueuedSyncOperation,
  EntityDiff,
  GetDataDiffRequest,
  PollingResponse,
  PollingPriority
} from './types.js'
import { SyncStateManager } from './SyncStateManager.js'
import { WebSocket } from '@fastify/websocket'
import { ConflictService } from './ConflictService.js'
import crypto from 'crypto'
import { Logger } from 'pino'
import {
  FallbackManager,
  ConnectionHealthConfig,
  HTTPPollingConfig
} from './fallback.js'

// ============================================================================
// 补充类型定义
// ============================================================================

interface GetSyncStatusResponse {
  success: boolean
  data: {
    active_syncs: SyncStatusDetail[]
    sync_history: any[]
  }
}

interface GetSyncQueueResponse {
  success: boolean
  data: {
    operations: QueuedSyncOperation[]
    total: number
    pagination: {
      page: number
      limit: number
      total_pages: number
    }
    stats: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
  }
}

interface FieldDiff {
  field_name: string
  client_value: any
  server_value: any
  diff_type: 'added' | 'removed' | 'modified'
}

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
  /** 最大错过心跳次数 */
  maxMissedHeartbeats: number
  /** 认证超时时间（毫秒） */
  authTimeout: number
  /** 连接清理超时时间（毫秒） */
  connectionCleanupTimeout: number
  /** 每用户最大连接数 */
  maxConnectionsPerUser: number
  /** 每设备最大连接数 */
  maxConnectionsPerDevice: number
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
  heartbeatTimeout: 60000, // 60秒
  maxMissedHeartbeats: 2, // 允许错过2次心跳
  authTimeout: 5000, // 5秒
  connectionCleanupTimeout: 60000, // 60秒
  maxConnectionsPerUser: 1, // 每用户1个连接
  maxConnectionsPerDevice: 1 // 每设备1个连接
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
  status: 'connecting' | 'connected' | 'authenticated' | 'disconnected'
  /** 最后心跳时间 */
  last_heartbeat: string
  /** 连接时间 */
  connected_at: string
  /** 错过的心跳次数 */
  missed_heartbeats: number
  /** 认证超时定时器 */
  auth_timeout: NodeJS.Timeout | null
  /** 连接清理定时器 */
  cleanup_timeout: NodeJS.Timeout | null
  /** 连接统计 */
  stats: {
    /** 发送的消息数 */
    messages_sent: number
    /** 接收的消息数 */
    messages_received: number
    /** 发送的字节数 */
    bytes_sent: number
    /** 接收的字节数 */
    bytes_received: number
  }
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
  private conflictService: ConflictService | null = null
  private stateManager: SyncStateManager | null = null

  constructor(prisma: PrismaClient, logger: Logger, config: Partial<SyncServiceConfig> = {}) {
    this.prisma = prisma
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.activeConnections = new Map()
    this.activeSyncs = new Map()
    this.syncQueue = new Map()
    this.heartbeatTimers = new Map()
    this.fallbackManager = null
    this.conflictService = null
    this.stateManager = null

    this.startHeartbeatCheck()
  }

  /**
   * 初始化状态管理器
   */
  initializeStateManager(): void {
    if (!this.stateManager) {
      this.stateManager = new SyncStateManager(this.prisma, this.logger)
      this.logger.info('SyncStateManager initialized')
    }
  }

  /**
   * 获取状态管理器
   */
  getStateManager(): SyncStateManager | null {
    return this.stateManager
  }

  /**
   * 初始化冲突服务
   */
  initializeConflictService(): void {
    if (!this.conflictService) {
      this.conflictService = new ConflictService(this.prisma, this.logger)
      this.logger.info('ConflictService initialized')
    }
  }

  /**
   * 获取冲突服务
   */
  getConflictService(): ConflictService | null {
    return this.conflictService
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
    status: 'connecting',
    last_heartbeat: new Date().toISOString(),
    connected_at: new Date().toISOString(),
    missed_heartbeats: 0,
    auth_timeout: null,
    cleanup_timeout: null,
    stats: {
      messages_sent: 0,
      messages_received: 0,
      bytes_sent: 0,
      bytes_received: 0
    }
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
    status: 'connecting',
    last_heartbeat: new Date().toISOString(),
    connected_at: new Date().toISOString(),
    missed_heartbeats: 0,
    auth_timeout: null,
    cleanup_timeout: null,
    stats: {
      messages_sent: 0,
      messages_received: 0,
      bytes_sent: 0,
      bytes_received: 0
    }
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

    // 清除定时器
    this.clearAuthTimer(connection_id)
    this.clearHeartbeatTimer(connection_id)
    this.clearCleanupTimer(connection_id)

    // 更新连接状态
    connection.status = 'disconnected'
    this.broadcastConnectionStatusChange(connection, 'disconnected')

    this.activeConnections.delete(connection_id)

    // 通知降级管理器
    if (this.fallbackManager && clientId) {
      this.fallbackManager.handleWebSocketDisconnection(clientId, 'WebSocket connection closed')
    }

    this.logger.info({
      connection_id,
      client_id: connection.client_id,
      user_id: connection.user_id,
      stats: connection.stats
    }, 'WebSocket connection closed')
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

  // 更新统计信息
  const messageString = JSON.stringify(message)
  connection.stats.messages_received++
  connection.stats.bytes_received += messageString.length

  try {
    switch (message.type) {
      case 'auth':
        return await this.handleAuth(connection, message)
      case 'sync':
        return await this.handleSync(connection, message)
      case 'ping':
        return await this.handlePing(connection)
      case 'pong':
        return await this.handlePong(connection)
      default:
        throw new Error(`Unknown message type: ${message.type}`)
    }
  } catch (error) {
    this.logger.error({ error, connection_id, message_type: message.type }, 'Error handling WebSocket message')
    throw error
  }
}

/**
 * 处理客户端pong响应
 */
private async handlePong(connection: WebSocketConnection): Promise<any> {
  const now = new Date().toISOString()
  connection.last_heartbeat = now
  connection.missed_heartbeats = 0

  this.logger.debug({
    connection_id: connection.connection_id,
    user_id: connection.user_id,
    timestamp: now
  }, 'Pong received')

  return {
    type: 'ack',
    timestamp: now
  }
}

  /**
 * 处理认证
 */
private async handleAuth(connection: WebSocketConnection, message: any): Promise<any> {
  try {
    // 清除认证超时定时器
    this.clearAuthTimer(connection.connection_id)

    let userId: number
    let deviceId: string | undefined

    // 支持两种认证方式：
    // 1. JWT token（生产环境）
    // 2. 直接传递 user_id（测试环境）
    if (message.token) {
      // 验证JWT token
      const authResult = await this.verifyJWT(message.token)
      if (!authResult) {
        throw new Error('Invalid or expired JWT token')
      }
      userId = authResult.userId
      deviceId = authResult.deviceId
    } else if (message.user_id) {
      // 测试环境：直接使用 user_id
      userId = message.user_id
      deviceId = message.device_id
    } else {
      throw new Error('Missing authentication credentials')
    }

    // 更新连接信息
    connection.user_id = userId
    connection.device_id = deviceId || message.device_id || ''
    connection.client_id = message.client_id || ''

    // 验证设备ID
    if (connection.device_id) {
      const deviceValid = await this.validateDevice(userId, connection.device_id)
      if (!deviceValid) {
        throw new Error('Invalid device ID')
      }
    }

    // 执行连接限制
    await this.enforceConnectionLimits(connection)

    // 更新连接状态
    await this.broadcastConnectionStatusChange(connection, 'authenticated')

    // 启动心跳
    this.startHeartbeatTimer(connection.connection_id)

    this.logger.info({
      connection_id: connection.connection_id,
      user_id: connection.user_id,
      device_id: connection.device_id,
      client_id: connection.client_id
    }, 'WebSocket connection authenticated')

    return {
      type: 'auth',
      success: true,
      user_id: connection.user_id,
      device_id: connection.device_id,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    this.logger.error({
      error,
      connection_id: connection.connection_id
    }, 'Authentication failed')

    return {
      type: 'auth',
      success: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 验证JWT token
 */
private async verifyJWT(token: string): Promise<{ userId: number; deviceId?: string } | null> {
  try {
    // 在实际实现中，这里应该使用Fastify的JWT验证
    // 这里简化处理
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return {
      userId: decoded.id || decoded.userId || 0,
      deviceId: decoded.deviceId
    }
  } catch (error) {
    this.logger.error({ error }, 'JWT verification failed')
    return null
  }
}

/**
 * 验证设备ID
 */
private async validateDevice(userId: number, deviceId: string): Promise<boolean> {
  try {
    // 在实际实现中，这里应该从数据库验证设备ID
    // 这里简化处理，总是返回true
    return true
  } catch (error) {
    this.logger.error({ error, userId, deviceId }, 'Device validation failed')
    return false
  }
}

/**
 * 检查并清理重复连接
 */
private async enforceConnectionLimits(connection: WebSocketConnection): Promise<void> {
    const { user_id, device_id } = connection

    // 检查用户的现有连接
  const userConnections: Array<{ id: string; conn: WebSocketConnection }> = []
  for (const [id, conn] of this.activeConnections.entries()) {
    if (conn.user_id === user_id && conn.connection_id !== connection.connection_id) {
      userConnections.push({ id, conn })
    }
  }

  // 如果超过每用户最大连接数，关闭旧连接
  if (userConnections.length >= this.config.maxConnectionsPerUser) {
    for (const { id, conn } of userConnections) {
      this.logger.warn({
        user_id,
        old_connection_id: id,
        new_connection_id: connection.connection_id
      }, 'Closing old connection due to user connection limit')

      // 通知旧连接被替换
      await this.sendToClient(id, {
        type: 'error',
        error_code: 'CONNECTION_REPLACED',
        error_message: 'A new connection has been established',
        timestamp: new Date().toISOString()
      })

      conn.socket.close(1000, 'Connection replaced by new connection')
      await this.handleDisconnection(id)
    }
  }

  // 检查设备的现有连接
  if (device_id) {
    const deviceConnections: Array<{ id: string; conn: WebSocketConnection }> = []
    for (const [id, conn] of this.activeConnections.entries()) {
      if (conn.device_id === device_id && conn.connection_id !== connection.connection_id) {
        deviceConnections.push({ id, conn })
      }
    }

    // 如果超过每设备最大连接数，关闭旧连接
    if (deviceConnections.length >= this.config.maxConnectionsPerDevice) {
      for (const { id, conn } of deviceConnections) {
        this.logger.warn({
          device_id,
          old_connection_id: id,
          new_connection_id: connection.connection_id
        }, 'Closing old connection due to device connection limit')

        // 通知旧连接被替换
        await this.sendToClient(id, {
          type: 'error',
          error_code: 'CONNECTION_REPLACED',
          error_message: 'A new connection has been established',
          timestamp: new Date().toISOString()
        })

        conn.socket.close(1000, 'Connection replaced by new connection')
        await this.handleDisconnection(id)
      }
    }
  }
}

/**
 * 启动认证超时定时器
 */
private startAuthTimer(connection_id: string): void {
  const connection = this.activeConnections.get(connection_id)
  if (!connection) return

  this.clearAuthTimer(connection_id)

  connection.auth_timeout = setTimeout(async () => {
    const conn = this.activeConnections.get(connection_id)
    if (conn && conn.status === 'connecting') {
      this.logger.warn({ connection_id }, 'Authentication timeout, closing connection')

      await this.sendToClient(connection_id, {
        type: 'error',
        error_code: 'AUTH_TIMEOUT',
        error_message: 'Authentication timeout',
        timestamp: new Date().toISOString()
      })

      conn.socket.close(4000, 'Authentication timeout')
      await this.handleDisconnection(connection_id)
    }
  }, this.config.authTimeout)
}

/**
 * 清除认证超时定时器
 */
private clearAuthTimer(connection_id: string): void {
  const connection = this.activeConnections.get(connection_id)
  if (connection?.auth_timeout) {
    clearTimeout(connection.auth_timeout)
    connection.auth_timeout = null
  }
}

/**
 * 清除连接清理定时器
 */
private clearCleanupTimer(connection_id: string): void {
  const connection = this.activeConnections.get(connection_id)
  if (connection?.cleanup_timeout) {
    clearTimeout(connection.cleanup_timeout)
    connection.cleanup_timeout = null
  }
}

/**
 * 广播连接状态变更
 */
private async broadcastConnectionStatusChange(
  connection: WebSocketConnection,
  newStatus: 'connecting' | 'connected' | 'authenticated' | 'disconnected'
): Promise<void> {
  const oldStatus = connection.status
  connection.status = newStatus

  this.logger.info({
    connection_id: connection.connection_id,
    user_id: connection.user_id,
    client_id: connection.client_id,
    old_status: oldStatus,
    new_status: newStatus
  }, 'Connection status changed')

  // 通知该用户的其他连接
  for (const [id, conn] of this.activeConnections.entries()) {
    if (conn.user_id === connection.user_id &&
        conn.connection_id !== connection.connection_id &&
        conn.status === 'authenticated') {
      await this.sendToClient(id, {
        type: 'status_change',
        connection_id: connection.connection_id,
        old_status: oldStatus,
        new_status: newStatus,
        timestamp: new Date().toISOString()
      })
    }
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
  const now = new Date().toISOString()
  connection.last_heartbeat = now
  connection.missed_heartbeats = 0

  this.logger.debug({
    connection_id: connection.connection_id,
    user_id: connection.user_id,
    timestamp: now
  }, 'Heartbeat received')

  return {
    type: 'pong',
    timestamp: now,
    server_time: now
  }
}

  /**
 * 发送消息到客户端
 */
async sendToClient(connection_id: string, message: any): Promise<void> {
  const connection = this.activeConnections.get(connection_id)
  if (connection && connection.socket.readyState === connection.socket.OPEN) {
    const messageString = JSON.stringify(message)
    connection.socket.send(messageString)

    // 更新统计信息
    connection.stats.messages_sent++
    connection.stats.bytes_sent += messageString.length
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

    // 检查心跳超时
    if (elapsed > this.config.heartbeatTimeout) {
      connection.missed_heartbeats++

      this.logger.warn({
        connection_id,
        user_id: connection.user_id,
        elapsed,
        missed_heartbeats: connection.missed_heartbeats,
        max_missed: this.config.maxMissedHeartbeats
      }, 'Heartbeat timeout detected')

      // 检查是否超过最大允许错过心跳次数
      if (connection.missed_heartbeats >= this.config.maxMissedHeartbeats) {
        this.logger.error({
          connection_id,
          user_id: connection.user_id,
          missed_heartbeats: connection.missed_heartbeats
        }, 'Maximum missed heartbeats reached, closing connection')

        // 发送重连通知
        await this.sendToClient(connection_id, {
          type: 'error',
          error_code: 'HEARTBEAT_TIMEOUT',
          error_message: 'Heartbeat timeout, please reconnect',
          timestamp: now.toISOString(),
          should_reconnect: true
        })

        // 关闭连接
        try {
          connection.socket.close(4000, 'Heartbeat timeout')
        } catch (error) {
          this.logger.error({ error, connection_id }, 'Error closing connection after heartbeat timeout')
        }

        await this.handleDisconnection(connection_id)
        return
      }
    }

    // 发送心跳
    try {
      await this.sendToClient(connection_id, {
        type: 'ping',
        timestamp: now.toISOString(),
        server_time: now.toISOString()
      })

      this.logger.debug({
        connection_id,
        user_id: connection.user_id,
        timestamp: now.toISOString()
      }, 'Heartbeat sent')
    } catch (error) {
      this.logger.error({ error, connection_id }, 'Error sending heartbeat')
      connection.missed_heartbeats++

      // 如果发送心跳失败，也检查是否需要关闭连接
      if (connection.missed_heartbeats >= this.config.maxMissedHeartbeats) {
        await this.handleDisconnection(connection_id)
      }
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

    // 记录连接统计
    this.logConnectionStats()
  }, 60000)

  // 启动连接清理检查（每30秒）
  setInterval(() => {
    this.cleanupInactiveConnections()
  }, 30000)
}

  // ============================================================================
  // 同步处理核心逻辑
  // ============================================================================

  /**
   * 处理同步请求
   */
  async processSyncRequest(user_id: number, request: SyncRequest): Promise<SyncResponse> {
    // 使用状态管理器创建同步会话
    const device_id = (request as any).device_id || 'unknown'
    let syncId: string = ''

    if (this.stateManager) {
      syncId = await this.stateManager.createSyncSession(user_id, device_id, request.operations.length)
      await this.stateManager.updateSyncSession(syncId, { status: 'running', phase: 'init' })
    } else {
      // 回退到旧的同步状态创建方式
      syncId = this.generateId('sync')
      const syncStatus: SyncStatusDetail = {
        sync_id: syncId,
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
        entity_types: request.operations.map((op: any) => op.entity_type)
      }
      this.activeSyncs.set(syncId, syncStatus)
    }

    try {
      // 验证协议版本
      if (request.protocol_version !== '1.0.0') {
        throw new Error(`Unsupported protocol version: ${request.protocol_version}`)
      }

      if (this.stateManager) {
        await this.stateManager.updateSyncSession(syncId, { phase: 'push' })
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

            // 尝试自动解决冲突
            const resolutionResult = await this.resolveConflict(
              conflict,
              request.default_resolution_strategy || ConflictResolutionStrategy.LATEST_WINS
            )

            if (resolutionResult.success && resolutionResult.resolved_data) {
              const resolvedOperation: SyncOperation = {
                ...operation,
                data: resolutionResult.resolved_data,
                changes: resolutionResult.resolved_data
              }
              const result = await this.executeOperation(user_id, resolvedOperation)
              operationResults.push(result)

              if (result.success) {
                const serverUpdate = this.createServerUpdate(operation, result)
                serverUpdates.push(serverUpdate)
              }

              if (this.stateManager) {
                await this.stateManager.incrementSyncProgress(syncId, 1, !result.success)
              }
            } else {
              if (this.stateManager) {
                await this.stateManager.incrementSyncProgress(syncId, 1, true)
              }
            }

            if (this.stateManager) {
              await this.stateManager.updateSyncSession(syncId, {
                conflicts: conflicts as any[]
              })
            }
          } else {
            // 执行操作
            const result = await this.executeOperation(user_id, operation)
            operationResults.push(result)

          // 更新统计信息
          if (this.stateManager) {
            await this.stateManager.updateSyncSession(syncId, {
              statistics: {
                notes_created: operation.entity_type === 'note' && operation.operation_type === SyncOperationType.CREATE ? 1 : 0,
                notes_updated: operation.entity_type === 'note' && operation.operation_type === SyncOperationType.UPDATE ? 1 : 0,
                notes_deleted: operation.entity_type === 'note' && operation.operation_type === SyncOperationType.DELETE ? 1 : 0,
                folders_created: operation.entity_type === 'folder' && operation.operation_type === SyncOperationType.CREATE ? 1 : 0,
                folders_updated: operation.entity_type === 'folder' && operation.operation_type === SyncOperationType.UPDATE ? 1 : 0,
                folders_deleted: operation.entity_type === 'folder' && operation.operation_type === SyncOperationType.DELETE ? 1 : 0,
                reviews_created: operation.entity_type === 'review' && operation.operation_type === SyncOperationType.CREATE ? 1 : 0,
                reviews_updated: operation.entity_type === 'review' && operation.operation_type === SyncOperationType.UPDATE ? 1 : 0,
                reviews_deleted: operation.entity_type === 'review' && operation.operation_type === SyncOperationType.DELETE ? 1 : 0
              }
            })
          }

            if (result.success) {
              // 生成服务器更新
              const serverUpdate = this.createServerUpdate(operation, result)
              serverUpdates.push(serverUpdate)
            }

            // 更新进度
            if (this.stateManager) {
              await this.stateManager.incrementSyncProgress(syncId, 1, !result.success)
            }
          }

        } catch (error) {
          this.logger.error({ error, operation_id: operation.operation_id }, 'Error processing operation')
          if (this.stateManager) {
            await this.stateManager.incrementSyncProgress(syncId, 1, true)
          }
        }
      }

      // 获取服务器端的更新
      const serverSideUpdates = await this.getServerUpdates(
        user_id,
        request.client_state.last_sync_time,
        ['note', 'folder', 'review'] as const
      )

      // 更新客户端状态
      const newClientState: ClientSyncState = {
        client_id: request.client_id,
        last_sync_time: new Date().toISOString(),
        server_version: request.protocol_version,
        pending_operations: 0,
        last_sync_id: syncId
      }

      // 完成同步会话
      const finalStatus = conflicts.length > 0 ? 'failed' : 'completed'
      if (this.stateManager) {
        await this.stateManager.completeSyncSession(
          syncId,
          finalStatus,
          conflicts.length > 0 ? 'Some conflicts could not be resolved' : undefined
        )
      }

      // 构建响应
      const response: SyncResponse = {
        request_id: request.request_id,
        server_time: new Date().toISOString(),
        protocol_version: request.protocol_version,
        status: finalStatus === 'completed' ? SyncStatus.SUCCESS : SyncStatus.CONFLICT,
        operation_results: operationResults,
        server_updates: [...serverUpdates, ...serverSideUpdates],
        conflicts,
        new_client_state: newClientState,
        warnings: conflicts.length > 0
          ? ['Some conflicts could not be auto-resolved']
          : undefined
      }

      return response

    } catch (error) {
      this.logger.error({ error, sync_id: syncId }, 'Sync failed')

      if (this.stateManager) {
        await this.stateManager.completeSyncSession(syncId, 'failed', (error as Error).message)
      }

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
      this.activeSyncs.delete(syncId)
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
      const opType = operation.operation_type as string
      
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
          result.error = `Unknown operation type: ${opType}`
          return result
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
        case 'note': {
          let folderId = operation.data.folder_id
          if (folderId) {
            const folder = await this.prisma.folder.findFirst({
              where: { id: folderId, user_id }
            })
            if (!folder) {
              folderId = null
            }
          }
          createdRecord = await this.prisma.note.create({
            data: {
              user_id,
              title: operation.data.title,
              content: operation.data.content,
              folder_id: folderId,
              is_pinned: operation.data.is_pinned || false,
              content_hash: this.generateHash(operation.data)
            }
          })
          break
        }
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
              achievements: operation.data.achievements ? JSON.stringify(operation.data.achievements) : null,
              improvements: operation.data.improvements ? JSON.stringify(operation.data.improvements) : null,
              plans: operation.data.plans ? JSON.stringify(operation.data.plans) : null
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
   * 检测冲突（使用ConflictService）
   */
  private async detectConflict(user_id: number, operation: SyncOperation): Promise<Conflict | null> {
    if (!this.conflictService) {
      // 如果冲突服务未初始化，使用旧的简单检测逻辑
      return this.detectConflictLegacy(user_id, operation)
    }

    // 对于更新和删除操作，需要检测版本冲突
    if (operation.operation_type === SyncOperationType.UPDATE ||
        operation.operation_type === SyncOperationType.DELETE) {

      const currentRecord = await this.getRecord(operation.entity_type, operation.entity_id!, user_id)

      // 使用ConflictService检测冲突
      const conflictRecord = await this.conflictService.detectConflict(user_id, operation, currentRecord)

      if (conflictRecord) {
        // 将ConflictRecord转换为Conflict类型
        return {
          conflict_id: conflictRecord.conflict_id,
          conflict_type: conflictRecord.conflict_type as any,
          entity_type: conflictRecord.entity_type,
          entity_id: conflictRecord.entity_id,
          operation_id: conflictRecord.operation_id,
          server_data: conflictRecord.server_data,
          client_data: conflictRecord.client_data,
          conflict_fields: conflictRecord.conflict_fields,
          suggested_strategy: conflictRecord.suggested_strategy as any,
          timestamp: conflictRecord.timestamp
        }
      }
    }

    return null
  }

  /**
   * 检测冲突（旧版逻辑，当ConflictService未初始化时使用）
   */
  private async detectConflictLegacy(user_id: number, operation: SyncOperation): Promise<Conflict | null> {
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
          conflict_fields: this.getConflictFields(currentRecord, (operation as any).data || (operation as any).changes || {}),
          suggested_strategy: ConflictResolutionStrategy.LATEST_WINS,
          timestamp: new Date().toISOString()
        }
      }
    }

    return null
  }

  /**
   * 解决冲突（使用ConflictService）
   */
  async resolveConflict(
    conflict: Conflict,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    if (!this.conflictService) {
      // 如果冲突服务未初始化，使用旧的简单解决逻辑
      return this.resolveConflictLegacy(conflict, strategy)
    }

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

        case ConflictResolutionStrategy.LATEST_WINS: {
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
        }

        case ConflictResolutionStrategy.MERGE: {
          const mergedData = this.mergeData(conflict.server_data.data, conflict.client_data.data)
          result.success = true
          result.resolved_data = mergedData
          result.new_version = conflict.server_data.version + 1
          break
        }

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
   * 解决冲突（旧版逻辑，当ConflictService未初始化时使用）
   */
  private resolveConflictLegacy(
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

        case ConflictResolutionStrategy.LATEST_WINS: {
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
        }

        case ConflictResolutionStrategy.MERGE: {
          const mergedData = this.mergeData(conflict.server_data.data, conflict.client_data.data)
          result.success = true
          result.resolved_data = mergedData
          result.new_version = conflict.server_data.version + 1
          break
        }

        case ConflictResolutionStrategy.MANUAL:
          // 手动解决需要等待用户输入
          result.success = false
          result.error = 'Manual resolution required'
          break

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`)
      }

      return Promise.resolve(result)

    } catch (error) {
      result.error = (error as Error).message
      return Promise.resolve(result)
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

    const activeSyncsArray = Array.from(this.activeSyncs.values())
      .filter(sync => sync.user_id === user_id)

    return {
      success: true,
      data: {
        active_syncs: activeSyncsArray,
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
    const operations: QueuedSyncOperation[] = []

    for (const ops of this.syncQueue.values()) {
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
      const clientRecord = (request as any).client_data

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
    void clientId;
    void entityType;
    void entityId;
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

  // ============================================================================
  // 连接统计和清理
  // ============================================================================

  /**
   * 记录连接统计
   */
  private logConnectionStats(): void {
    const stats = {
      total_connections: this.activeConnections.size,
      by_status: {
        connecting: 0,
        connected: 0,
        authenticated: 0,
        disconnected: 0
      },
      total_messages_sent: 0,
      total_messages_received: 0,
      total_bytes_sent: 0,
      total_bytes_received: 0
    }

    for (const conn of this.activeConnections.values()) {
      stats.by_status[conn.status]++
      stats.total_messages_sent += conn.stats.messages_sent
      stats.total_messages_received += conn.stats.messages_received
      stats.total_bytes_sent += conn.stats.bytes_sent
      stats.total_bytes_received += conn.stats.bytes_received
    }

    this.logger.info(stats, 'Connection statistics')
  }

  /**
   * 清理不活跃连接
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now()
    const toCleanup: string[] = []

    for (const [connection_id, connection] of this.activeConnections.entries()) {
      if (connection.status === 'disconnected') {
        continue
      }

      const lastHeartbeat = new Date(connection.last_heartbeat).getTime()
      const inactiveTime = now - lastHeartbeat

      // 如果连接超过清理超时时间，标记为需要清理
      if (inactiveTime > this.config.connectionCleanupTimeout) {
        toCleanup.push(connection_id)

        this.logger.warn({
          connection_id,
          user_id: connection.user_id,
          inactive_time: inactiveTime,
          cleanup_timeout: this.config.connectionCleanupTimeout
        }, 'Connection inactive, scheduling cleanup')
      }
    }

    // 清理不活跃连接
    for (const connection_id of toCleanup) {
      const connection = this.activeConnections.get(connection_id)
      if (connection) {
        // 发送清理通知
        this.sendToClient(connection_id, {
          type: 'error',
          error_code: 'CONNECTION_CLEANUP',
          error_message: 'Connection inactive and being cleaned up',
          timestamp: new Date().toISOString()
        }).catch(() => {
          // 忽略发送错误，连接可能已经关闭
        })

        // 关闭连接
        try {
          connection.socket.close(4000, 'Connection cleanup')
        } catch (error) {
          // 忽略关闭错误
        }

        this.handleDisconnection(connection_id)
      }
    }

    if (toCleanup.length > 0) {
      this.logger.info({ cleaned_connections: toCleanup.length }, 'Connection cleanup completed')
    }
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats(): {
    total_connections: number
    by_status: Record<string, number>
    total_messages_sent: number
    total_messages_received: number
    total_bytes_sent: number
    total_bytes_received: number
  } {
    const stats = {
      total_connections: this.activeConnections.size,
      by_status: {
        connecting: 0,
        connected: 0,
        authenticated: 0,
        disconnected: 0
      },
      total_messages_sent: 0,
      total_messages_received: 0,
      total_bytes_sent: 0,
      total_bytes_received: 0
    }

    for (const conn of this.activeConnections.values()) {
      stats.by_status[conn.status]++
      stats.total_messages_sent += conn.stats.messages_sent
      stats.total_messages_received += conn.stats.messages_received
      stats.total_bytes_sent += conn.stats.bytes_sent
      stats.total_bytes_received += conn.stats.bytes_received
    }

    return stats
  }

  /**
   * 获取特定连接的统计信息
   */
  getConnectionStatsById(connection_id: string): {
    connection_id: string
    user_id: number
    client_id: string
    device_id: string
    status: string
    connected_at: string
    last_heartbeat: string
    missed_heartbeats: number
    messages_sent: number
    messages_received: number
    bytes_sent: number
    bytes_received: number
  } | null {
    const connection = this.activeConnections.get(connection_id)
    if (!connection) {
      return null
    }

    return {
      connection_id: connection.connection_id,
      user_id: connection.user_id,
      client_id: connection.client_id,
      device_id: connection.device_id,
      status: connection.status,
      connected_at: connection.connected_at,
      last_heartbeat: connection.last_heartbeat,
      missed_heartbeats: connection.missed_heartbeats,
      messages_sent: connection.stats.messages_sent,
      messages_received: connection.stats.messages_received,
      bytes_sent: connection.stats.bytes_sent,
      bytes_received: connection.stats.bytes_received
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
    for (const timer of this.heartbeatTimers.values()) {
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

    // const pollingService = this.fallbackManager.getPollingService()
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
