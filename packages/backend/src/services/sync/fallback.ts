/**
 * WebSocket HTTP降级机制
 * 当WebSocket连接不稳定时自动降级到HTTP轮询
 */

import { Logger } from 'pino'
import { ServerUpdate } from '@webnote/shared/types/sync'
import { PrismaClient } from '@prisma/client'

// ============================================================================
// 连接健康状态配置
// ============================================================================

/**
 * 连接健康配置
 */
export interface ConnectionHealthConfig {
  /** 超时阈值（毫秒） */
  timeoutThreshold: number
  /** 断开次数阈值（1分钟内） */
  disconnectThreshold: number
  /** 断开次数时间窗口（毫秒） */
  disconnectTimeWindow: number
  /** 自动恢复延迟（毫秒） */
  autoRecoveryDelay: number
  /** 健康检查间隔（毫秒） */
  healthCheckInterval: number
}

/**
 * 默认配置
 */
const DEFAULT_HEALTH_CONFIG: ConnectionHealthConfig = {
  timeoutThreshold: 5000, // 5秒
  disconnectThreshold: 3,  // 1分钟内断开3次
  disconnectTimeWindow: 60000, // 1分钟
  autoRecoveryDelay: 30000, // 30秒
  healthCheckInterval: 10000 // 10秒
}

// ============================================================================
// 连接健康状态
// ============================================================================

/**
 * 连接健康状态
 */
export enum ConnectionHealthStatus {
  /** 健康 */
  HEALTHY = 'healthy',
  /** 降级中 */
  DEGRADED = 'degraded',
  /** 恢复中 */
  RECOVERING = 'recovering'
}

/**
 * 连接健康信息
 */
export interface ConnectionHealthInfo {
  /** 状态 */
  status: ConnectionHealthStatus
  /** 最后一次健康检查时间 */
  last_check_time: string
  /** 最后一次连接时间 */
  last_connection_time?: string
  /** 最后一次断开时间 */
  last_disconnect_time?: string
  /** 最后一次超时时间 */
  last_timeout_time?: string
  /** 超时次数 */
  timeout_count: number
  /** 断开次数历史（带时间戳） */
  disconnect_history: Array<{ timestamp: string }>
  /** 平均响应时间（毫秒） */
  average_response_time?: number
  /** 是否需要降级 */
  needs_fallback: boolean
  /** 降级原因 */
  fallback_reason?: string
}

// ============================================================================
// 连接健康跟踪器
// ============================================================================

/**
 * 连接健康跟踪器
 */
export class ConnectionHealthTracker {
  private logger: Logger
  private config: ConnectionHealthConfig
  private healthInfo: Map<string, ConnectionHealthInfo>
  private connectionTimers: Map<string, NodeJS.Timeout>
  private responseTimes: Map<string, number[]>

  constructor(logger: Logger, config: Partial<ConnectionHealthConfig> = {}) {
    this.logger = logger
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config }
    this.healthInfo = new Map()
    this.connectionTimers = new Map()
    this.responseTimes = new Map()
  }

  /**
   * 初始化客户端健康跟踪
   */
  initializeClient(clientId: string): void {
    this.healthInfo.set(clientId, {
      status: ConnectionHealthStatus.HEALTHY,
      last_check_time: new Date().toISOString(),
      last_connection_time: new Date().toISOString(),
      timeout_count: 0,
      disconnect_history: [],
      needs_fallback: false
    })
    this.responseTimes.set(clientId, [])
    this.logger.debug({ client_id: clientId }, 'Connection health tracking initialized')
  }

  /**
   * 记录连接成功
   */
  recordConnection(clientId: string): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      this.initializeClient(clientId)
      return
    }

    info.last_connection_time = new Date().toISOString()
    info.status = ConnectionHealthStatus.HEALTHY
    info.needs_fallback = false
    info.fallback_reason = undefined

    this.clearConnectionTimer(clientId)
    this.logger.debug({ client_id: clientId }, 'Connection recorded')
  }

  /**
   * 记录连接断开
   */
  recordDisconnection(clientId: string, reason?: string): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      return
    }

    const now = new Date().toISOString()
    info.last_disconnect_time = now

    // 添加到断开历史
    info.disconnect_history.push({ timestamp: now })

    // 清理过期的断开记录（超过时间窗口）
    const cutoffTime = Date.now() - this.config.disconnectTimeWindow
    info.disconnect_history = info.disconnect_history.filter(
      d => new Date(d.timestamp).getTime() > cutoffTime
    )

    // 检查是否达到降级条件
    if (info.disconnect_history.length >= this.config.disconnectThreshold) {
      info.status = ConnectionHealthStatus.DEGRADED
      info.needs_fallback = true
      info.fallback_reason = `Too many disconnections (${info.disconnect_history.length}) in time window`
      this.logger.warn({
        client_id: clientId,
        disconnect_count: info.disconnect_history.length,
        reason
      }, 'Connection degraded, fallback needed')
    }

    this.logger.debug({
      client_id: clientId,
      disconnect_count: info.disconnect_history.length,
      reason
    }, 'Disconnection recorded')
  }

  /**
   * 记录超时
   */
  recordTimeout(clientId: string, duration: number): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      return
    }

    const now = new Date().toISOString()
    info.last_timeout_time = now
    info.timeout_count++

    // 记录响应时间
    const times = this.responseTimes.get(clientId) || []
    times.push(duration)
    // 只保留最近100次响应时间
    if (times.length > 100) {
      times.shift()
    }
    this.responseTimes.set(clientId, times)

    // 计算平均响应时间
    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length
    info.average_response_time = avgResponseTime

    // 检查是否达到降级条件
    if (duration > this.config.timeoutThreshold || avgResponseTime > this.config.timeoutThreshold) {
      info.status = ConnectionHealthStatus.DEGRADED
      info.needs_fallback = true
      info.fallback_reason = `Response timeout (${duration}ms) or average response time too high (${avgResponseTime.toFixed(0)}ms)`
      this.logger.warn({
        client_id: clientId,
        timeout_duration: duration,
        average_response_time: avgResponseTime.toFixed(0)
      }, 'Connection degraded due to timeout')
    }

    this.logger.debug({
      client_id: clientId,
      timeout_duration: duration,
      average_response_time: avgResponseTime.toFixed(0)
    }, 'Timeout recorded')
  }

  /**
   * 记录响应时间
   */
  recordResponseTime(clientId: string, duration: number): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      return
    }

    const times = this.responseTimes.get(clientId) || []
    times.push(duration)
    // 只保留最近100次响应时间
    if (times.length > 100) {
      times.shift()
    }
    this.responseTimes.set(clientId, times)

    // 计算平均响应时间
    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length
    info.average_response_time = avgResponseTime

    this.logger.debug({
      client_id: clientId,
      response_time: duration,
      average_response_time: avgResponseTime.toFixed(0)
    }, 'Response time recorded')
  }

  /**
   * 获取健康信息
   */
  getHealthInfo(clientId: string): ConnectionHealthInfo | undefined {
    return this.healthInfo.get(clientId)
  }

  /**
   * 检查是否需要降级
   */
  needsFallback(clientId: string): boolean {
    const info = this.healthInfo.get(clientId)
    return info ? info.needs_fallback : false
  }

  /**
   * 获取降级原因
   */
  getFallbackReason(clientId: string): string | undefined {
    const info = this.healthInfo.get(clientId)
    return info ? info.fallback_reason : undefined
  }

  /**
   * 重置健康状态
   */
  resetHealthStatus(clientId: string): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      return
    }

    info.status = ConnectionHealthStatus.RECOVERING
    info.needs_fallback = false
    info.fallback_reason = undefined
    info.timeout_count = 0
    info.disconnect_history = []
    this.responseTimes.set(clientId, [])

    this.logger.info({ client_id: clientId }, 'Health status reset')
  }

  /**
   * 标记恢复完成
   */
  markRecovered(clientId: string): void {
    const info = this.healthInfo.get(clientId)
    if (!info) {
      return
    }

    info.status = ConnectionHealthStatus.HEALTHY
    this.logger.info({ client_id: clientId }, 'Connection fully recovered')
  }

  /**
   * 清除连接计时器
   */
  private clearConnectionTimer(clientId: string): void {
    const timer = this.connectionTimers.get(clientId)
    if (timer) {
      clearTimeout(timer)
      this.connectionTimers.delete(clientId)
    }
  }

  /**
   * 清理客户端
   */
  cleanupClient(clientId: string): void {
    this.healthInfo.delete(clientId)
    this.responseTimes.delete(clientId)
    this.clearConnectionTimer(clientId)
    this.logger.debug({ client_id: clientId }, 'Client cleanup completed')
  }

  /**
   * 获取所有客户端的健康状态
   */
  getAllHealthStatus(): Map<string, ConnectionHealthInfo> {
    return new Map(this.healthInfo)
  }
}

// ============================================================================
// HTTP轮询服务
// ============================================================================

/**
 * HTTP轮询配置
 */
export interface HTTPPollingConfig {
  /** 正常轮询间隔（毫秒） */
  normalInterval: number
  /** 高优先级轮询间隔（毫秒） */
  highPriorityInterval: number
  /** 最大轮询间隔（毫秒） */
  maxInterval: number
  /** 最小轮询间隔（毫秒） */
  minInterval: number
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
}

/**
 * 默认轮询配置
 */
const DEFAULT_POLLING_CONFIG: HTTPPollingConfig = {
  normalInterval: 5000,      // 5秒
  highPriorityInterval: 1000, // 1秒
  maxInterval: 30000,       // 30秒
  minInterval: 1000,        // 1秒
  maxRetries: 3,
  retryDelay: 1000
}

/**
 * 轮询优先级
 */
export enum PollingPriority {
  /** 正常 */
  NORMAL = 'normal',
  /** 高优先级 */
  HIGH = 'high'
}

/**
 * 轮询更新数据
 */
export interface PollingUpdate {
  /** 更新类型 */
  update_type: 'incremental' | 'full'
  /** 更新的实体类型 */
  entity_type: string
  /** 更新的实体ID */
  entity_id?: number
  /** 更新数据 */
  update_data: {
    operation_type: string
    version: number
    data?: Record<string, any>
    modified_at: string
    modified_by: number
  }
  /** 时间戳 */
  timestamp: string
}

/**
 * 轮询响应
 */
export interface PollingResponse {
  /** 是否成功 */
  success: boolean
  /** 更新列表 */
  updates: PollingUpdate[]
  /** 是否有更多数据 */
  has_more: boolean
  /** 服务器时间 */
  server_time: string
  /** 下一次建议的轮询间隔（毫秒） */
  suggested_interval: number
  /** 错误信息 */
  error?: string
}

/**
 * HTTP轮询服务
 */
export class HTTPPollingService {
  private logger: Logger
  private prisma: PrismaClient
  private config: HTTPPollingConfig
  private activePollers: Map<string, NodeJS.Timeout>
  private pollingIntervals: Map<string, number>
  private updateQueues: Map<string, PollingUpdate[]>
  private lastSyncTimes: Map<string, string>

  constructor(logger: Logger, prisma: PrismaClient, config: Partial<HTTPPollingConfig> = {}) {
    this.logger = logger
    this.prisma = prisma
    this.config = { ...DEFAULT_POLLING_CONFIG, ...config }
    this.activePollers = new Map()
    this.pollingIntervals = new Map()
    this.updateQueues = new Map()
    this.lastSyncTimes = new Map()
  }

  /**
   * 开始轮询
   */
  startPolling(
    clientId: string,
    userId: number,
    callback: (response: PollingResponse) => void,
    priority: PollingPriority = PollingPriority.NORMAL
  ): void {
    // 停止现有的轮询器
    this.stopPolling(clientId)

    // 设置轮询间隔
    const interval = priority === PollingPriority.HIGH
      ? this.config.highPriorityInterval
      : this.config.normalInterval
    this.pollingIntervals.set(clientId, interval)

    // 初始化更新队列
    if (!this.updateQueues.has(clientId)) {
      this.updateQueues.set(clientId, [])
    }

    // 设置最后同步时间
    if (!this.lastSyncTimes.has(clientId)) {
      this.lastSyncTimes.set(clientId, new Date().toISOString())
    }

    // 立即执行一次轮询
    this.executePoll(clientId, userId, callback).catch(error => {
      this.logger.error({ error, client_id: clientId }, 'Initial polling failed')
    })

    // 设置定时轮询
    const timer = setInterval(async () => {
      try {
        await this.executePoll(clientId, userId, callback)
      } catch (error) {
        this.logger.error({ error, client_id: clientId }, 'Polling execution failed')
      }
    }, interval)

    this.activePollers.set(clientId, timer)
    this.logger.info({
      client_id: clientId,
      interval,
      priority
    }, 'HTTP polling started')
  }

  /**
   * 停止轮询
   */
  stopPolling(clientId: string): void {
    const timer = this.activePollers.get(clientId)
    if (timer) {
      clearInterval(timer)
      this.activePollers.delete(clientId)
      this.logger.debug({ client_id: clientId }, 'HTTP polling stopped')
    }
  }

  /**
   * 执行轮询
   */
  private async executePoll(
    clientId: string,
    userId: number,
    callback: (response: PollingResponse) => void
  ): Promise<void> {
    const startTime = Date.now()
    const lastSyncTime = this.lastSyncTimes.get(clientId) || new Date(Date.now() - 60000).toISOString()

    try {
      // 获取服务器端的更新
      const updates = await this.getServerUpdates(userId, lastSyncTime)

      // 更新最后同步时间
      this.lastSyncTimes.set(clientId, new Date().toISOString())

      // 构建响应
      const response: PollingResponse = {
        success: true,
        updates,
        has_more: false,
        server_time: new Date().toISOString(),
        suggested_interval: this.pollingIntervals.get(clientId) || this.config.normalInterval
      }

      // 调用回调
      callback(response)

      // 记录响应时间
      const duration = Date.now() - startTime
      this.logger.debug({
        client_id: clientId,
        update_count: updates.length,
        duration
      }, 'Polling completed')

    } catch (error) {
      const response: PollingResponse = {
        success: false,
        updates: [],
        has_more: false,
        server_time: new Date().toISOString(),
        suggested_interval: this.config.normalInterval,
        error: (error as Error).message
      }

      callback(response)

      this.logger.error({
        error,
        client_id: clientId
      }, 'Polling failed')
    }
  }

  /**
   * 获取服务器更新
   */
  private async getServerUpdates(userId: number, since: string): Promise<PollingUpdate[]> {
    const updates: PollingUpdate[] = []
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
            data: record.deleted_at ? undefined : this.sanitizeRecord(record),
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
   * 获取自指定时间以来的记录
   */
  private async getRecordsSince(userId: number, entityType: string, since: Date): Promise<any[]> {
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

  /**
   * 清理记录数据（移除敏感信息）
   */
  private sanitizeRecord(record: any): any {
    const sanitized = { ...record }
    // 移除不需要发送给客户端的字段
    delete sanitized.user_id
    return sanitized
  }

  /**
   * 更改轮询优先级
   */
  changePriority(clientId: string, priority: PollingPriority): void {
    const newInterval = priority === PollingPriority.HIGH
      ? this.config.highPriorityInterval
      : this.config.normalInterval

    this.pollingIntervals.set(clientId, newInterval)
    this.logger.debug({
      client_id: clientId,
      new_interval: newInterval,
      priority
    }, 'Polling priority changed')
  }

  /**
   * 添加更新到队列
   */
  addUpdateToQueue(clientId: string, update: PollingUpdate): void {
    const queue = this.updateQueues.get(clientId)
    if (queue) {
      queue.push(update)
      // 限制队列大小
      if (queue.length > 100) {
        queue.shift()
      }
    }
  }

  /**
   * 清理客户端
   */
  cleanupClient(clientId: string): void {
    this.stopPolling(clientId)
    this.pollingIntervals.delete(clientId)
    this.updateQueues.delete(clientId)
    this.lastSyncTimes.delete(clientId)
    this.logger.debug({ client_id: clientId }, 'Polling client cleanup completed')
  }

  /**
   * 获取活动轮询器数量
   */
  getActivePollerCount(): number {
    return this.activePollers.size
  }

  /**
   * 获取轮询状态
   */
  getPollingStatus(clientId: string): {
    active: boolean
    interval: number
    last_sync_time?: string
    queue_size: number
  } | undefined {
    const active = this.activePollers.has(clientId)
    const interval = this.pollingIntervals.get(clientId)
    const lastSyncTime = this.lastSyncTimes.get(clientId)
    const queue = this.updateQueues.get(clientId)

    return {
      active,
      interval: interval || this.config.normalInterval,
      last_sync_time: lastSyncTime,
      queue_size: queue ? queue.length : 0
    }
  }
}

// ============================================================================
// 降级控制器
// ============================================================================

/**
 * 降级控制器
 */
export class FallbackController {
  private logger: Logger
  private healthTracker: ConnectionHealthTracker
  private pollingService: HTTPPollingService
  private fallbackState: Map<string, boolean>
  private recoveryTimers: Map<string, NodeJS.Timeout>

  constructor(
    logger: Logger,
    healthTracker: ConnectionHealthTracker,
    pollingService: HTTPPollingService
  ) {
    this.logger = logger
    this.healthTracker = healthTracker
    this.pollingService = pollingService
    this.fallbackState = new Map()
    this.recoveryTimers = new Map()
  }

  /**
   * 检查是否需要降级
   */
  checkFallbackNeeded(clientId: string): boolean {
    return this.healthTracker.needsFallback(clientId)
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
    if (this.isInFallback(clientId)) {
      // 已经在降级模式，只需更新优先级
      this.pollingService.changePriority(clientId, priority)
      return
    }

    const reason = this.healthTracker.getFallbackReason(clientId)
    this.logger.warn({
      client_id: clientId,
      user_id: userId,
      reason
    }, 'Executing fallback to HTTP polling')

    // 开始HTTP轮询
    this.pollingService.startPolling(clientId, userId, callback, priority)

    // 标记为降级状态
    this.fallbackState.set(clientId, true)

    // 设置自动恢复计时器
    this.scheduleRecovery(clientId)
  }

  /**
   * 退出降级
   */
  async exitFallback(clientId: string): Promise<void> {
    if (!this.isInFallback(clientId)) {
      return
    }

    this.logger.info({ client_id: clientId }, 'Exiting fallback mode')

    // 停止HTTP轮询
    this.pollingService.stopPolling(clientId)

    // 取消恢复计时器
    const recoveryTimer = this.recoveryTimers.get(clientId)
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      this.recoveryTimers.delete(clientId)
    }

    // 重置健康状态
    this.healthTracker.markRecovered(clientId)

    // 清除降级状态
    this.fallbackState.delete(clientId)
  }

  /**
   * 尝试恢复WebSocket连接
   */
  async attemptRecovery(clientId: string): Promise<boolean> {
    this.logger.info({ client_id: clientId }, 'Attempting WebSocket recovery')

    // 重置健康状态
    this.healthTracker.resetHealthStatus(clientId)

    // 清除降级状态
    this.fallbackState.delete(clientId)

    // 停止HTTP轮询
    this.pollingService.stopPolling(clientId)

    // 取消恢复计时器
    const recoveryTimer = this.recoveryTimers.get(clientId)
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      this.recoveryTimers.delete(clientId)
    }

    // 返回true表示客户端应该尝试重新连接
    return true
  }

  /**
   * 检查是否在降级状态
   */
  isInFallback(clientId: string): boolean {
    return this.fallbackState.get(clientId) || false
  }

  /**
   * 获取降级状态
   */
  getFallbackStatus(clientId: string): {
    in_fallback: boolean
    polling_active: boolean
    health_status?: ConnectionHealthStatus
    fallback_reason?: string
  } {
    const healthInfo = this.healthTracker.getHealthInfo(clientId)
    const pollingStatus = this.pollingService.getPollingStatus(clientId)

    return {
      in_fallback: this.isInFallback(clientId),
      polling_active: pollingStatus?.active || false,
      health_status: healthInfo?.status,
      fallback_reason: healthInfo?.fallback_reason
    }
  }

  /**
   * 调度恢复
   */
  private scheduleRecovery(clientId: string): void {
    const config = this.healthTracker['config'] as ConnectionHealthConfig
    const delay = config.autoRecoveryDelay

    const timer = setTimeout(async () => {
      this.logger.info({
        client_id: clientId,
        delay
      }, 'Auto-recovery timer triggered')

      // 尝试恢复
      await this.attemptRecovery(clientId)

    }, delay)

    this.recoveryTimers.set(clientId, timer)
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
    this.logger.warn({ client_id: clientId }, 'Forcing fallback to HTTP polling')

    // 开始HTTP轮询
    this.pollingService.startPolling(clientId, userId, callback, priority)

    // 标记为降级状态
    this.fallbackState.set(clientId, true)
  }

  /**
   * 清理客户端
   */
  cleanupClient(clientId: string): void {
    this.pollingService.cleanupClient(clientId)
    this.healthTracker.cleanupClient(clientId)
    this.fallbackState.delete(clientId)

    const recoveryTimer = this.recoveryTimers.get(clientId)
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      this.recoveryTimers.delete(clientId)
    }

    this.logger.debug({ client_id: clientId }, 'Fallback controller cleanup completed')
  }

  /**
   * 获取所有降级状态
   */
  getAllFallbackStatus(): Map<string, {
    in_fallback: boolean
    polling_active: boolean
    health_status?: ConnectionHealthStatus
    fallback_reason?: string
  }> {
    const result = new Map()

    for (const clientId of this.fallbackState.keys()) {
      result.set(clientId, this.getFallbackStatus(clientId))
    }

    return result
  }
}

// ============================================================================
// 统一的降级管理器
// ============================================================================

/**
 * 降级管理器
 */
export class FallbackManager {
  private static instance: FallbackManager | null = null
  private healthTracker: ConnectionHealthTracker
  private pollingService: HTTPPollingService
  private fallbackController: FallbackController
  private logger: Logger

  private constructor(
    logger: Logger,
    prisma: PrismaClient,
    healthConfig?: Partial<ConnectionHealthConfig>,
    pollingConfig?: Partial<HTTPPollingConfig>
  ) {
    this.logger = logger

    // 初始化子服务
    this.healthTracker = new ConnectionHealthTracker(logger, healthConfig)
    this.pollingService = new HTTPPollingService(logger, prisma, pollingConfig)
    this.fallbackController = new FallbackController(logger, this.healthTracker, this.pollingService)

    this.logger.info('FallbackManager initialized')
  }

  /**
   * 获取单例实例
   */
  static getInstance(
    logger: Logger,
    prisma: PrismaClient,
    healthConfig?: Partial<ConnectionHealthConfig>,
    pollingConfig?: Partial<HTTPPollingConfig>
  ): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager(logger, prisma, healthConfig, pollingConfig)
    }
    return FallbackManager.instance
  }

  /**
   * 获取健康跟踪器
   */
  getHealthTracker(): ConnectionHealthTracker {
    return this.healthTracker
  }

  /**
   * 获取轮询服务
   */
  getPollingService(): HTTPPollingService {
    return this.pollingService
  }

  /**
   * 获取降级控制器
   */
  getFallbackController(): FallbackController {
    return this.fallbackController
  }

  /**
   * 初始化客户端
   */
  initializeClient(clientId: string): void {
    this.healthTracker.initializeClient(clientId)
  }

  /**
   * 处理WebSocket连接
   */
  handleWebSocketConnection(clientId: string): void {
    this.healthTracker.recordConnection(clientId)
    // 如果客户端之前在降级状态，现在尝试恢复
    if (this.fallbackController.isInFallback(clientId)) {
      this.logger.info({ client_id: clientId }, 'WebSocket reconnected, attempting to exit fallback')
      this.fallbackController.exitFallback(clientId)
    }
  }

  /**
   * 处理WebSocket断开
   */
  handleWebSocketDisconnection(clientId: string, reason?: string): void {
    this.healthTracker.recordDisconnection(clientId, reason)

    // 检查是否需要降级
    if (this.fallbackController.checkFallbackNeeded(clientId)) {
      this.logger.warn({ client_id: clientId }, 'Fallback needed after disconnection')
    }
  }

  /**
   * 处理WebSocket超时
   */
  handleWebSocketTimeout(clientId: string, duration: number): void {
    this.healthTracker.recordTimeout(clientId, duration)

    // 检查是否需要降级
    if (this.fallbackController.checkFallbackNeeded(clientId)) {
      this.logger.warn({ client_id: clientId, duration }, 'Fallback needed after timeout')
    }
  }

  /**
   * 清理客户端
   */
  cleanupClient(clientId: string): void {
    this.fallbackController.cleanupClient(clientId)
  }

  /**
   * 关闭管理器
   */
  shutdown(): void {
    this.logger.info('Shutting down FallbackManager')

    // 清理所有客户端
    const allClients = new Set([
      ...this.healthTracker.getAllHealthStatus().keys(),
      ...this.fallbackController.getAllFallbackStatus().keys()
    ])

    for (const clientId of allClients) {
      this.cleanupClient(clientId)
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  DEFAULT_HEALTH_CONFIG,
  DEFAULT_POLLING_CONFIG
}
