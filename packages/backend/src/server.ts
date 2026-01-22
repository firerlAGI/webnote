import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { PrismaClient } from '@prisma/client'
import { routes } from './api/routes.js'
import { initializeSyncService, shutdownSyncService } from './services/sync/integration.js'
import { initializeBackupService, shutdownBackupService } from './services/backup/integration.js'
import { databaseMonitor, createPrismaMiddleware } from './utils/databaseMonitor.js'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  errorFormat: 'pretty'
})

// 添加 Prisma 中间件用于性能监控
prisma.$use(createPrismaMiddleware())
const app = Fastify({
  logger: true
})

// Attach prisma to app instance for use in services
;(app as any).prisma = prisma

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Register plugins
app.register(cors, {
  origin: (origin, callback) => {
    // Get allowed origins from environment variable or use development defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000']

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }

    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
})

// Get server configuration
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

// Ensure JWT secret is set
if (!process.env.JWT_SECRET) {
  app.log.error('========================================')
  app.log.error('ERROR: JWT_SECRET environment variable is not set')
  app.log.error('========================================')
  app.log.error('Please set JWT_SECRET in your .env file')
  app.log.error('Example: JWT_SECRET=your-secret-key-here')
  app.log.error('For production, use a strong random string (at least 32 characters)')
  app.log.error('You can generate one with: openssl rand -base64 32')
  app.log.error('========================================')
  process.exit(1)
}

// Verify database URL
if (!process.env.DATABASE_URL) {
  app.log.error('========================================')
  app.log.error('ERROR: DATABASE_URL environment variable is not set')
  app.log.error('========================================')
  app.log.error('Please set DATABASE_URL in your .env file')
  app.log.error('Examples:')
  app.log.error('  SQLite: DATABASE_URL=file:./dev.db')
  app.log.error('  PostgreSQL: DATABASE_URL=postgresql://user:password@localhost:5432/mydb')
  app.log.error('========================================')
  process.exit(1)
}

// Log important configuration (without sensitive data)
app.log.info('Server configuration:')
app.log.info(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
app.log.info(`  - PORT: ${PORT}`)
app.log.info(`  - HOST: ${HOST}`)
app.log.info(`  - JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Not set'}`)
app.log.info(`  - DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Not set'}`)
app.log.info(`  - ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || 'Not set'}`)

app.register(jwt, {
  secret: process.env.JWT_SECRET
})

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

app.register(websocket)

// Register multipart plugin for file uploads
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file per upload
  }
})

// Register static file serving for uploaded images
app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
  cacheControl: false,
  list: false
})

// Register routes
app.register(routes, { prefix: '/api' })

// Initialize sync service
const { syncService, queueService, conflictService } = initializeSyncService(app, app.log)

// Initialize backup service
const { backupService, scheduler } = initializeBackupService(app, app.log)

// Health check
app.get('/health', async () => {
  return { status: 'ok' }
})

// Database performance stats (admin only)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.get('/admin/database/stats', async (_req, _res) => {
  // TODO: 添加管理员认证
  const stats = databaseMonitor.getDatabaseStats()
  return stats
})

// Database performance report (admin only)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.get('/admin/database/report', async (_req, _res) => {
  // TODO: 添加管理员认证
  databaseMonitor.printPerformanceReport()
  return { success: true, message: 'Performance report printed to console' }
})

// Clear database logs (admin only)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.delete('/admin/database/logs', async (_req, _res) => {
  // TODO: 添加管理员认证
  databaseMonitor.clearLogs()
  return { success: true, message: 'Database logs cleared' }
})

// Error handling
app.setErrorHandler((error, _, reply) => {
  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message
  })
})


// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  app.log.info(`${signal} signal received: starting graceful shutdown`)

  try {
    // Shutdown backup service
    await shutdownBackupService({ backupService, scheduler }, app.log)

    // Shutdown sync service
    await shutdownSyncService({ syncService, queueService, conflictService }, app.log)

    // Close server
    await app.close()

    // Disconnect database
    await prisma.$disconnect()

    app.log.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    app.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error during graceful shutdown')
    process.exit(1)
  }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: Number(PORT), host: HOST }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
    app.log.info(`Server listening on http://${HOST}:${PORT}`)
  })
}

export { app, prisma, syncService, queueService, conflictService, backupService, scheduler }
