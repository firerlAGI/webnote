/**
 * T3项目同步服务集成示例
 * 展示如何在主服务器中集成同步服务
 */

import { FastifyInstance } from 'fastify'
import { SyncService } from './SyncService.js'
import { QueueService } from './QueueService.js'
import { ConflictService } from './ConflictService.js'
import { registerSyncRoutes } from './routes.js'

/**
 * 初始化同步服务
 *
 * @param app - Fastify应用实例
 * @param logger - 日志记录器
 * @returns 同步服务实例
 */
export function initializeSyncService(app: FastifyInstance, logger: any): { syncService: SyncService; queueService: QueueService; conflictService: ConflictService } {
  // 创建队列服务实例
  const queueService = new QueueService(
    (app as any).prisma,
    logger,
    {
      maxQueueSize: 1000,
      defaultMaxRetries: 3,
      retentionDays: 30,
      batchSize: 20,
      processingTimeout: 30000,
      alertThreshold: 100,
      cleanupInterval: 3600000, // 1小时
      alertCheckInterval: 60000 // 1分钟
    }
  )

  // 创建冲突服务实例
  const conflictService = new ConflictService(
    (app as any).prisma,
    logger
  )

  // 创建同步服务实例
  const syncService = new SyncService(
    (app as any).prisma,
    logger,
    {
      maxRetries: 3,
      retryDelay: 1000,
      defaultBatchSize: 100,
      syncTimeout: 60000,
      conflictResolutionTimeout: 30000,
      heartbeatInterval: 30000,
      heartbeatTimeout: 60000
    }
  )

  // 初始化冲突服务
  syncService.initializeConflictService()

  // 初始化降级管理器
  syncService.initializeFallbackManager(
    {
      // 连接健康配置
      timeoutThreshold: 5000, // 5秒超时
      disconnectThreshold: 3,  // 1分钟内断开3次
      disconnectTimeWindow: 60000, // 1分钟时间窗口
      autoRecoveryDelay: 30000, // 30秒自动恢复
      healthCheckInterval: 10000 // 10秒健康检查
    },
    {
      // HTTP轮询配置
      normalInterval: 5000,      // 正常5秒
      highPriorityInterval: 1000, // 高优先级1秒
      maxInterval: 30000,       // 最大30秒
      minInterval: 1000,        // 最小1秒
      maxRetries: 3,
      retryDelay: 1000
    }
  )

  // 注册同步路由
  registerSyncRoutes(app, syncService, conflictService, queueService)

  // 注册WebSocket路由
  app.get('/api/sync/ws', {
    websocket: true
  }, async (connection: { socket: any }, request: any) => {
    const { handleWebSocketConnection } = await import('./routes')
    handleWebSocketConnection(connection.socket, request, syncService)
  })

  // 添加队列告警回调
  queueService.addAlertCallback((alert) => {
    logger.warn({
      alert_id: alert.alert_id,
      alert_type: alert.alert_type,
      message: alert.message,
      severity: alert.severity,
      user_id: alert.user_id,
      data: alert.data
    }, 'Queue alert triggered')
  })

  logger.info('Sync service initialized successfully')

  return { syncService, queueService, conflictService }
}

/**
 * 优雅关闭同步服务
 *
 * @param services - 服务对象
 * @param logger - 日志记录器
 */
export async function shutdownSyncService(services: { syncService: SyncService; queueService: QueueService; conflictService: ConflictService }, logger: any): Promise<void> {
  try {
    // 关闭队列服务
    await services.queueService.shutdown()
    logger.info('Queue service shutdown successfully')

    // 关闭同步服务
    await services.syncService.shutdown()
    logger.info('Sync service shutdown successfully')
  } catch (error) {
    logger.error('Error shutting down sync service:', error)
    throw error
  }
}

/**
 * 集成到主服务器的完整示例
 */
export const SYNC_INTEGRATION_EXAMPLE = `
// 在 src/server.ts 中集成同步服务

import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { routes } from './api/routes'
import { initializeSyncService, shutdownSyncService } from './services/sync/integration'

const prisma = new PrismaClient()
const app = Fastify({
  logger: true
})

// 初始化其他插件和中间件
// ...

// 初始化同步服务
const syncService = initializeSyncService(app, app.log)

// 注册其他路由
app.register(routes, { prefix: '/api' })

// 优雅关闭处理
const gracefulShutdown = async (signal: string) => {
  app.log.info(\`\${signal} signal received: starting graceful shutdown\`)

  try {
    // 关闭同步服务
    await shutdownSyncService(syncService, app.log)

    // 关闭服务器
    await app.close()

    // 断开数据库连接
    await prisma.$disconnect()

    app.log.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    app.log.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// 监听关闭信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// 启动服务器
const PORT = process.env.PORT || 3000
app.listen({ port: Number(PORT) }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(\`Server listening on port \${PORT}\`)
})

export { app, prisma, syncService }
`
