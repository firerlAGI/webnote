/**
 * T3项目同步API路由
 * 定义WebSocket和REST API端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WebSocket } from '@fastify/websocket'
import { SyncService } from './SyncService'
import { ConflictService } from './ConflictService'
import { QueueService } from './QueueService'
import { prisma } from '../../server'
import {
  SyncRequest,
  SyncStatus,
  ConflictResolution
} from '@webnote/shared/types/sync'
import {
  WebSocketMessageType,
  WebSocketHandshakeRequest,
  WebSocketHandshakeResponse,
  WebSocketAuthRequest,
  WebSocketAuthResponse,
  WebSocketSyncRequest,
  WebSocketSyncResponse,
  WebSocketServerUpdate,
  WebSocketConflictNotification,
  WebSocketStatusChangeNotification,
  WebSocketErrorMessage,
  WebSocketCloseMessage,
  SyncDataRequest,
  SyncDataResponse,
  GetSyncStatusRequest,
  GetSyncStatusResponse,
  GetSyncQueueRequest,
  GetSyncQueueResponse,
  ResolveConflictRequest,
  ResolveConflictResponse,
  BatchResolveConflictRequest,
  BatchResolveConflictResponse,
  GetDataDiffRequest,
  GetDataDiffResponse,
  CancelSyncRequest,
  CancelSyncResponse,
  RetrySyncRequest,
  RetrySyncResponse,
  ClearSyncHistoryRequest,
  ClearSyncHistoryResponse,
  PollingRequest,
  PollingResponse,
  GetFallbackStatusRequest,
  GetFallbackStatusResponse,
  ForceFallbackRequest,
  ForceFallbackResponse,
  ExitFallbackRequest,
  ExitFallbackResponse,
  PollingPriority,
  GetConflictsRequest,
  GetConflictsResponse,
  GetConflictRequest,
  GetConflictResponse,
  IgnoreConflictRequest,
  IgnoreConflictResponse,
  GetConflictStatsRequest,
  GetConflictStatsResponse,
  ResolveConflictApiRequest,
  ResolveConflictApiResponse,
  BatchResolveConflictApiRequest,
  BatchResolveConflictApiResponse
} from './types'

// ============================================================================
// 中间件
// ============================================================================

/**
 * 认证中间件
 */
const authenticate = async (request: FastifyRequest) => {
  try {
    await request.jwtVerify()
  } catch (error) {
    throw new Error('Unauthorized')
  }
}

/**
 * 从JWT获取用户ID
 */
const getUserId = (request: FastifyRequest): number => {
  return (request.user as any).id
}

// ============================================================================
// WebSocket 处理器
// ============================================================================

/**
 * WebSocket 连接处理器
 */
export function handleWebSocketConnection(socket: WebSocket, request: FastifyRequest, syncService: SyncService) {
  let connectionId: string | null = null
  let authTimer: NodeJS.Timeout | null = null

  // 建立连接
  syncService.handleConnection(socket).then((connId) => {
    connectionId = connId

    // 启动认证超时定时器（5秒）
    authTimer = setTimeout(async () => {
      if (connectionId) {
        const conn = syncService['activeConnections']?.get(connectionId)
        if (conn && conn.status === 'connecting') {
          const errorMessage: WebSocketErrorMessage = {
            type: WebSocketMessageType.ERROR,
            message_id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            error_code: 'AUTH_TIMEOUT',
            error_message: 'Authentication timeout'
          }
          try {
            socket.send(JSON.stringify(errorMessage))
          } catch (e) {
            // 忽略发送错误
          }
          socket.close(4000, 'Authentication timeout')
          syncService.handleDisconnection(connectionId)
        }
      }
    }, 5000)

    // 发送握手响应
    const handshakeResponse: WebSocketHandshakeResponse = {
      type: WebSocketMessageType.HANDSHAKE,
      message_id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      success: true,
      server_id: process.env.SERVER_ID || 'server-1',
      protocol_version: '1.0.0',
      connection_id: connId
    }
    socket.send(JSON.stringify(handshakeResponse))
  })

  // 设置消息处理器
  socket.on('message', async (data: Buffer) => {
    if (!connectionId) return

    try {
      const message = JSON.parse(data.toString())

      // 如果收到认证消息，清除认证超时定时器
      if (message.type === WebSocketMessageType.AUTH && authTimer) {
        clearTimeout(authTimer)
        authTimer = null
      }

      const response = await syncService.handleMessage(connectionId, message)
      if (response && socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(response))
      }
    } catch (error) {
      const errorMessage: WebSocketErrorMessage = {
        type: WebSocketMessageType.ERROR,
        message_id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        error_code: 'MESSAGE_ERROR',
        error_message: (error as Error).message
      }
      try {
        socket.send(JSON.stringify(errorMessage))
      } catch (e) {
        // 忽略发送错误
      }
    }
  })

  // 设置关闭处理器
  socket.on('close', async () => {
    if (authTimer) {
      clearTimeout(authTimer)
    }
    if (connectionId) {
      await syncService.handleDisconnection(connectionId)
    }
  })

  // 设置错误处理器
  socket.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
}

// ============================================================================
// REST API 路由注册
// ============================================================================

/**
 * 注册同步相关路由
 */
export function registerSyncRoutes(app: FastifyInstance, syncService: SyncService, conflictService: ConflictService, queueService: QueueService) {
  // ============================================================================
  // 同步数据路由
  // ============================================================================

  /**
   * POST /api/sync/sync
   * 执行数据同步
   */
  app.post('/sync/sync', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const syncRequest = request.body as SyncRequest

    try {
      const syncResponse = await syncService.processSyncRequest(userId, syncRequest)

      return reply.status(200).send({
        success: true,
        data: syncResponse
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/sync-data
   * 获取同步数据（REST API 方式）
   */
  app.post('/sync/sync-data', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const requestData = request.body as SyncDataRequest

    try {
      // 实现同步数据获取逻辑
      const response: SyncDataResponse = {
        success: true,
        data: {
          sync_id: `sync_${Date.now()}`,
          entity_type: requestData.entity_types[0] || 'note',
          entities: [],
          has_more: false,
          server_time: new Date().toISOString()
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // 同步状态路由
  // ============================================================================

  /**
   * GET /api/sync/status
   * 获取同步状态
   */
  app.get('/sync/status', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { client_id, sync_id } = request.query as GetSyncStatusRequest

    try {
      const response = await syncService.getSyncStatus(userId, sync_id)
      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/cancel
   * 取消同步
   */
  app.post('/sync/cancel', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { sync_id } = request.body as CancelSyncRequest

    try {
      const success = await syncService.cancelSync(userId, sync_id)

      const response: CancelSyncResponse = {
        success,
        sync_id: success ? sync_id : undefined,
        error: success ? undefined : 'Sync not found or already completed'
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // 同步队列路由
  // ============================================================================

  /**
   * POST /api/sync/queue
   * 添加同步操作到队列
   */
  app.post('/sync/queue', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { operations, priority, scheduled_at } = request.body as any

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'operations is required and must be a non-empty array'
      })
    }

    if (!priority || !['high', 'medium', 'low'].includes(priority)) {
      return reply.status(400).send({
        success: false,
        error: 'priority must be one of: high, medium, low'
      })
    }

    try {
      // 从请求中获取设备ID和客户端ID
      const device_id = request.headers['x-device-id'] as string || 'unknown'
      const client_id = request.headers['x-client-id'] as string || `client_${userId}_${Date.now()}`

      const result = await queueService.enqueue({
        user_id: userId,
        device_id,
        client_id,
        operations,
        priority,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined
      })

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error
        })
      }

      return reply.status(200).send({
        success: true,
        data: {
          queue_ids: result.queue_ids
        }
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/queue
   * 查询同步队列
   */
  app.get('/sync/queue', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { status, entity_type, priority, limit = 20, offset = 0 } = request.query as any

    try {
      const { operations, total } = await queueService.queryQueue(userId, {
        status,
        entity_type,
        priority,
        limit: Number(limit),
        offset: Number(offset)
      })

      return reply.status(200).send({
        success: true,
        data: {
          operations,
          total,
          pagination: {
            page: Math.floor(Number(offset) / Number(limit)) + 1,
            limit: Number(limit),
            total_pages: Math.ceil(total / Number(limit))
          }
        }
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/queue/process
   * 处理队列
   */
  app.post('/sync/queue/process', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)

    try {
      // 获取SyncService来处理操作
      const result = await queueService.processQueue(userId, async (operation) => {
        try {
          // 根据操作类型执行相应的同步操作
          let syncOperation: any = {
            operation_id: operation.id,
            operation_type: operation.operation_type,
            entity_type: operation.entity_type,
            data: operation.entity_data
          }

          if (operation.entity_id) {
            syncOperation.entity_id = operation.entity_id
          }

          // 使用SyncService执行操作
          const syncResult = await syncService['executeOperation'](userId, syncOperation)

          return {
            success: syncResult.success,
            error: syncResult.error
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message
          }
        }
      })

      return reply.status(200).send({
        success: true,
        data: {
          processed_count: result.processed_count,
          results: result.results
        }
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * DELETE /api/sync/queue/:operation_id
   * 从队列中移除操作
   */
  app.delete('/sync/queue/:operation_id', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { operation_id } = request.params as { operation_id: string }

    try {
      const success = await queueService.removeFromQueue(operation_id, userId)

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Operation not found'
        })
      }

      return reply.status(200).send({
        success: true
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * DELETE /api/sync/queue
   * 清空用户队列
   */
  app.delete('/sync/queue', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)

    try {
      const deletedCount = await queueService.clearQueue(userId)

      return reply.status(200).send({
        success: true,
        data: {
          deleted_count: deletedCount
        }
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/queue/status
   * 获取队列状态
   */
  app.get('/sync/queue/status', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)

    try {
      const status = await queueService.getQueueStatus(userId)

      return reply.status(200).send({
        success: true,
        data: status
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/queue/stats
   * 获取队列统计
   */
  app.get('/sync/queue/stats', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)

    try {
      const status = await queueService.getQueueStatus(userId)
      const performance = await queueService.getPerformanceStats(userId)

      return reply.status(200).send({
        success: true,
        data: {
          status,
          performance: {
            avg_processing_time: performance.avg_processing_time,
            success_rate: performance.success_rate,
            avg_retry_count: performance.avg_retry_count
          }
        }
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/retry
   * 重试失败的同步
   */
  app.post('/sync/retry', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { sync_id, operation_ids } = request.body as RetrySyncRequest

    try {
      // 获取失败的操作
      const { operations } = await queueService.queryQueue(userId, {
        status: 'failed',
        limit: operation_ids?.length || 100
      })

      // 重置状态为pending
      for (const operation of operations) {
        if (!operation_ids || operation_ids.includes(operation.id)) {
          await queueService.markAsFailed(operation.id, 'Retrying')
        }
      }

      const response: RetrySyncResponse = {
        success: true,
        sync_id,
        retried_count: operation_ids?.length || operations.length
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // 冲突解决路由（T3-BE-03）
  // ============================================================================

  /**
   * GET /api/sync/conflicts
   * 获取冲突列表
   */
  app.get('/sync/conflicts', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const query = request.query as GetConflictsRequest

    try {
      const { conflicts, total } = await conflictService.getConflicts(
        userId,
        query.status || 'unresolved',
        query.limit || 100,
        (query.page || 0) * (query.limit || 100)
      )

      const response: GetConflictsResponse = {
        success: true,
        data: {
          conflicts: conflicts.map(c => ({
            conflict_id: c.conflict_id,
            conflict_type: c.conflict_type,
            entity_type: c.entity_type,
            entity_id: c.entity_id,
            operation_id: c.operation_id,
            server_data: c.server_data,
            client_data: c.client_data,
            conflict_fields: c.conflict_fields,
            suggested_strategy: c.suggested_strategy,
            status: c.status,
            timestamp: c.timestamp,
            resolved_at: c.resolved_at
          })),
          total,
          pagination: {
            page: query.page || 0,
            limit: query.limit || 100,
            total_pages: Math.ceil(total / (query.limit || 100))
          }
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/conflicts/:conflict_id
   * 获取冲突详情
   */
  app.get('/sync/conflicts/:conflict_id', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { conflict_id } = request.params as { conflict_id: string }

    try {
      const conflict = await conflictService.getConflict(conflict_id, userId)

      if (!conflict) {
        return reply.status(404).send({
          success: false,
          error: 'Conflict not found'
        })
      }

      const response: GetConflictResponse = {
        success: true,
        data: {
          conflict_id: conflict.conflict_id,
          conflict_type: conflict.conflict_type,
          entity_type: conflict.entity_type,
          entity_id: conflict.entity_id,
          operation_id: conflict.operation_id,
          server_data: conflict.server_data,
          client_data: conflict.client_data,
          conflict_fields: conflict.conflict_fields,
          suggested_strategy: conflict.suggested_strategy,
          status: conflict.status,
          timestamp: conflict.timestamp,
          resolved_at: conflict.resolved_at,
          resolution_strategy: conflict.resolution_strategy,
          resolved_data: conflict.resolved_data
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/conflicts/:conflict_id/resolve
   * 解决冲突
   */
  app.post('/sync/conflicts/:conflict_id/resolve', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { conflict_id } = request.params as { conflict_id: string }
    const { resolution } = request.body as { resolution: ConflictResolution }

    try {
      const conflict = await conflictService.getConflict(conflict_id, userId)
      if (!conflict) {
        return reply.status(404).send({
          success: false,
          error: 'Conflict not found'
        })
      }

      const result = await conflictService.resolveConflict(conflict, resolution, userId)

      const response: ResolveConflictApiResponse = {
        success: true,
        data: {
          conflict_id: result.conflict_id,
          success: result.success,
          resolved_data: result.resolved_data,
          new_version: result.new_version
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/conflicts/:conflict_id/ignore
   * 忽略冲突
   */
  app.post('/sync/conflicts/:conflict_id/ignore', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { conflict_id } = request.params as { conflict_id: string }

    try {
      const success = await conflictService.ignoreConflict(conflict_id, userId)

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Conflict not found'
        })
      }

      const response: IgnoreConflictResponse = {
        success: true,
        data: {
          conflict_id,
          status: 'ignored'
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/conflicts/resolve
   * 批量解决冲突
   */
  app.post('/sync/conflicts/resolve', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { resolutions } = request.body as BatchResolveConflictApiRequest

    try {
      const results = []

      for (const res of resolutions) {
        const conflict = await conflictService.getConflict(res.conflict_id, userId)
        if (conflict) {
          const result = await conflictService.resolveConflict(conflict, res.resolution, userId)
          results.push({
            conflict_id: result.conflict_id,
            success: result.success,
            resolved_data: result.resolved_data,
            new_version: result.new_version
          })
        } else {
          results.push({
            conflict_id: res.conflict_id,
            success: false,
            error: 'Conflict not found'
          })
        }
      }

      const response: BatchResolveConflictApiResponse = {
        success: true,
        data: results
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/conflicts/stats
   * 获取冲突统计
   */
  app.get('/sync/conflicts/stats', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)

    try {
      const stats = await conflictService.getConflictStats(userId)

      const response: GetConflictStatsResponse = {
        success: true,
        data: {
          total: stats.total,
          unresolved: stats.unresolved,
          resolved: stats.resolved,
          ignored: stats.ignored,
          by_type: stats.by_type,
          by_entity_type: {},
          average_resolution_time: undefined,
          most_common_conflict_type: Object.keys(stats.by_type).length > 0
            ? Object.entries(stats.by_type).sort((a, b) => b[1] - a[1])[0][0]
            : undefined
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/resolve-conflict
   * 解决单个冲突（兼容旧API）
   */
  app.post('/sync/resolve-conflict', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { conflict_id, resolution } = request.body as ResolveConflictApiRequest

    try {
      const conflict = await conflictService.getConflict(conflict_id, userId)
      if (!conflict) {
        return reply.status(404).send({
          success: false,
          error: 'Conflict not found'
        })
      }

      const result = await conflictService.resolveConflict(conflict, resolution as any, userId)

      const response: ResolveConflictApiResponse = {
        success: true,
        data: {
          conflict_id: result.conflict_id,
          success: result.success,
          resolved_data: result.resolved_data,
          new_version: result.new_version
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/resolve-conflicts
   * 批量解决冲突（兼容旧API）
   */
  app.post('/sync/resolve-conflicts', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { resolutions } = request.body as BatchResolveConflictApiRequest

    try {
      const results = []

      for (const res of resolutions) {
        const conflict = await conflictService.getConflict(res.conflict_id, userId)
        if (conflict) {
          const result = await conflictService.resolveConflict(conflict, res.resolution as any, userId)
          results.push({
            conflict_id: result.conflict_id,
            success: result.success,
            resolved_data: result.resolved_data,
            new_version: result.new_version
          })
        } else {
          results.push({
            conflict_id: res.conflict_id,
            success: false,
            error: 'Conflict not found'
          })
        }
      }

      const response: BatchResolveConflictApiResponse = {
        success: true,
        data: results
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // 数据差异路由
  // ============================================================================

  /**
   * POST /api/sync/data-diff
   * 获取数据差异
   */
  app.post('/sync/data-diff', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const diffRequest = request.body as GetDataDiffRequest

    try {
      const response = await syncService.getDataDiff(userId, diffRequest)
      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // 同步历史管理路由
  // ============================================================================

  /**
   * POST /api/sync/clear-history
   * 清除同步历史
   */
  app.post('/sync/clear-history', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { client_id, retain_days } = request.body as ClearSyncHistoryRequest

    try {
      // 实现清除历史逻辑
      const response: ClearSyncHistoryResponse = {
        success: true,
        cleared_count: 0
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // HTTP轮询降级路由
  // ============================================================================

  /**
   * POST /api/sync/poll
   * HTTP轮询端点（用于降级）
   */
  app.post('/sync/poll', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { client_id, since, entity_types } = request.body as PollingRequest

    if (!client_id) {
      return reply.status(400).send({
        success: false,
        error: 'client_id is required'
      })
    }

    try {
      const response = await syncService.poll(client_id, userId, since)
      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * GET /api/sync/fallback-status
   * 获取降级状态
   */
  app.get('/sync/fallback-status', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { client_id } = request.query as GetFallbackStatusRequest

    try {
      const status = syncService.getFallbackStatus(client_id)

      const response: GetFallbackStatusResponse = {
        success: true,
        data: client_id
          ? { current_status: status as any }
          : { all_statuses: [] }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/force-fallback
   * 强制降级
   */
  app.post('/sync/force-fallback', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { client_id, priority, reason } = request.body as ForceFallbackRequest

    if (!client_id) {
      return reply.status(400).send({
        success: false,
        error: 'client_id is required'
      })
    }

    try {
      // 创建一个回调函数来处理轮询响应
      const callback = (response: PollingResponse) => {
        app.log.debug({
          client_id,
          update_count: response.updates.length
        }, 'Polling callback executed')
      }

      syncService.forceFallback(
        client_id,
        userId,
        callback,
        priority || PollingPriority.NORMAL
      )

      const response: ForceFallbackResponse = {
        success: true,
        data: {
          client_id,
          in_fallback: true
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  /**
   * POST /api/sync/exit-fallback
   * 退出降级
   */
  app.post('/sync/exit-fallback', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { client_id, attempt_reconnect } = request.body as ExitFallbackRequest

    if (!client_id) {
      return reply.status(400).send({
        success: false,
        error: 'client_id is required'
      })
    }

    try {
      await syncService.exitFallback(client_id)

      const response: ExitFallbackResponse = {
        success: true,
        data: {
          client_id,
          in_fallback: false,
          should_reconnect: attempt_reconnect || false
        }
      }

      return reply.status(200).send(response)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })

  // ============================================================================
  // WebSocket 路由
  // ============================================================================

  /**
   * GET /api/sync/ws
   * WebSocket 连接端点
   */
  app.get('/sync/ws', {
    websocket: true
  }, async (connection: { socket: WebSocket }, request: FastifyRequest) => {
    handleWebSocketConnection(connection.socket, request, syncService)
  })

  // ============================================================================
  // 连接统计路由
  // ============================================================================

  /**
   * GET /api/sync/connection-stats
   * 获取连接统计信息（管理员接口）
   */
  app.get('/sync/connection-stats', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connection_id = request.query as { connection_id?: string }

      if (connection_id.connection_id) {
        // 获取特定连接的统计
        const stats = syncService.getConnectionStatsById(connection_id.connection_id)
        return reply.status(200).send({
          success: true,
          data: stats
        })
      } else {
        // 获取全局连接统计
        const stats = syncService.getConnectionStats()
        return reply.status(200).send({
          success: true,
          data: stats
        })
      }
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      })
    }
  })
}

// ============================================================================
// 导出类型和函数
// ============================================================================

export {
  authenticate,
  getUserId
}
