import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { PrismaClient } from '@prisma/client'
import { routes } from './api/routes'
import { initializeSyncService, shutdownSyncService } from './services/sync/integration'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const app = Fastify({
  logger: true
})

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

// Ensure JWT secret is set
if (!process.env.JWT_SECRET) {
  app.log.error('JWT_SECRET environment variable is not set')
  process.exit(1)
}

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
const syncService = initializeSyncService(app, app.log)

// Health check
app.get('/health', async () => {
  return { status: 'ok' }
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
    // Shutdown sync service
    await shutdownSyncService(syncService, app.log)

    // Close server
    await app.close()

    // Disconnect database
    await prisma.$disconnect()

    app.log.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    app.log.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Start server
const PORT = process.env.PORT || 3000
app.listen({ port: Number(PORT) }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`Server listening on port ${PORT}`)
})

export { app, prisma, syncService }