import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { PrismaClient } from '@prisma/client'
import { routes } from './api/routes'

const prisma = new PrismaClient()
const app = Fastify({
  logger: true
})

// Register plugins
app.register(cors, {
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
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

// Register routes
app.register(routes, { prefix: '/api' })


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


// Start server
const PORT = process.env.PORT || 3000
app.listen({ port: Number(PORT) }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`Server listening on port ${PORT}`)
})

export { app, prisma }