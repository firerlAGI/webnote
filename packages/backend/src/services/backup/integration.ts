/**
 * 备份服务集成
 * 提供备份服务的初始化和关闭功能
 */

import { FastifyInstance } from 'fastify'
import { backupService } from './BackupService.js'
import { getScheduler, BackupScheduler } from './Scheduler.js'

/**
 * 初始化备份服务
 *
 * @param app - Fastify应用实例
 * @param logger - 日志记录器
 * @returns 备份服务和调度器实例
 */
export function initializeBackupService(
  app: FastifyInstance,
  logger: any
): { backupService: typeof backupService; scheduler: BackupScheduler } {
  // 初始化调度器
  const scheduler = getScheduler(logger, {
    enabled: process.env.BACKUP_SCHEDULER_ENABLED !== 'false', // 默认启用
    taskTimeout: 3600000, // 1小时
    backupSchedule: {
      incremental: process.env.BACKUP_INCREMENTAL_SCHEDULE || '0 2 * * *', // 每天凌晨2点
      full: process.env.BACKUP_FULL_SCHEDULE || '0 3 * * 0' // 每周日凌晨3点
    },
    cleanupSchedule: process.env.BACKUP_CLEANUP_SCHEDULE || '0 4 * * *' // 每天凌晨4点
  })

  // 启动调度器
  scheduler.start()

  logger.info('Backup service initialized successfully')

  return { backupService, scheduler }
}

/**
 * 优雅关闭备份服务
 *
 * @param services - 服务对象
 * @param logger - 日志记录器
 */
export async function shutdownBackupService(
  services: { backupService: typeof backupService; scheduler: BackupScheduler },
  logger: any
): Promise<void> {
  try {
    // 关闭调度器
    await services.scheduler.shutdown()
    logger.info('Backup scheduler shutdown successfully')

    // 备份服务是无状态的，不需要关闭
    logger.info('Backup service shutdown successfully')
  } catch (error) {
    logger.error('Error shutting down backup service:', error)
    throw error
  }
}

/**
 * 集成到主服务器的完整示例
 */
export const BACKUP_INTEGRATION_EXAMPLE = `
// 在 src/server.ts 中集成备份服务

import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { initializeBackupService, shutdownBackupService } from './services/backup/integration'

const prisma = new PrismaClient()
const app = Fastify({
  logger: true
})

// 初始化备份服务
const { backupService, scheduler } = initializeBackupService(app, app.log)

// 注册备份相关路由
// app.register(backupRoutes, { prefix: '/api/backup' })

// 优雅关闭处理
const gracefulShutdown = async (signal: string) => {
  app.log.info(\`\${signal} signal received: starting graceful shutdown\`)

  try {
    // 关闭备份服务
    await shutdownBackupService({ backupService, scheduler }, app.log)

    // 关闭其他服务
    // await shutdownSyncService(...)

    // 关闭服务器
    await app.close()

    // 断开数据库连接
    // eslint-disable-next-line no-useless-escape
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

export { app, prisma, backupService, scheduler }
`
