/**
 * T3项目同步API路由
 * 定义WebSocket和REST API端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WebSocket } from '@fastify/websocket'
import { SyncService } from './SyncService'
import { prisma } from '../../server'
import {
  SyncRequest,
  SyncStatus
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
  PollingPriority
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
  const connectionId = Date.now().toString()

  // 设置消息处理器
  socket.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())
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
      socket.send(JSON.stringify(errorMessage))
    }
  })

  // 设置关闭处理器
  socket.on('close', async () => {
    await syncService.handleDisconnection(connectionId)
  })

  // 设置错误处理器
  socket.on('error', (error) => {
    console.error('WebSocket error:', error)
  })

  // 发送握手响应
  const handshakeResponse: WebSocketHandshakeResponse = {
    type: WebSocketMessageType.HANDSHAKE,
    message_id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    success: true,
    server_id: process.env.SERVER_ID || 'server-1',
    protocol_version: '1.0.0',
    connection_id: connectionId
  }
  socket.send(JSON.stringify(handshakeResponse))
}

// ============================================================================
// REST API 路由注册
// ============================================================================

/**
 * 注册同步相关路由
 */
export function registerSyncRoutes(app: FastifyInstance, syncService: SyncService) {
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
   * GET /api/sync/queue
   * 获取同步队列
   */
  app.get('/sync/queue', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { queue_type, entity_type, page, limit } = request.query as any

    try {
      const response = await syncService.getSyncQueue(userId, queue_type || 'all')
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
   * POST /api/sync/retry
   * 重试失败的同步
   */
  app.post('/sync/retry', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { sync_id, operation_ids } = request.body as RetrySyncRequest

    try {
      // 实现重试逻辑
      const response: RetrySyncResponse = {
        success: true,
        sync_id,
        retried_count: operation_ids?.length || 0
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
  // 冲突解决路由
  // ============================================================================

  /**
   * POST /api/sync/resolve-conflict
   * 解决单个冲突
   */
  app.post('/sync/resolve-conflict', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { conflict_id, resolution } = request.body as ResolveConflictRequest

    try {
      // 实现冲突解决逻辑
      const response: ResolveConflictResponse = {
        success: true,
        data: {
          conflict_id,
          success: true,
          new_version: 1
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
   * 批量解决冲突
   */
  app.post('/sync/resolve-conflicts', {
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { resolutions } = request.body as BatchResolveConflictRequest

    try {
      // 实现批量冲突解决逻辑
      const results = resolutions.map(res => ({
        conflict_id: res.conflict_id,
        success: true,
        new_version: 1
      }))

      const response: BatchResolveConflictResponse = {
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
}

// ============================================================================
// 导出类型和函数
// ============================================================================

export {
  authenticate,
  getUserId
}
