/**
 * 测试环境设置
 * 提供测试所需的共享资源和工具
 */

import { PrismaClient } from '@prisma/client'
import pino from 'pino'
import { beforeEach, afterEach } from 'vitest'

// ============================================================================
// 测试数据库客户端
// ============================================================================

export const prisma = new PrismaClient({
  log: process.env.TEST_LOG === 'true' ? ['query', 'error', 'warn'] : ['error'],
})

// ============================================================================
// 测试日志器
// ============================================================================

export const logger = pino({
  level: process.env.TEST_LOG === 'true' ? 'debug' : 'silent',
  transport: process.env.TEST_LOG === 'true' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  } : undefined,
})

// ============================================================================
// 测试数据清理
// ============================================================================

/**
 * 清理测试数据
 */
export async function cleanupDatabase() {
  // 按照外键依赖顺序删除
  await prisma.review.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.folder.deleteMany({})
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: 'test_',
      },
    },
  })
}

// 在每个测试前清理数据库
beforeEach(async () => {
  await cleanupDatabase()
})

// 在所有测试后关闭数据库连接
afterAll(async () => {
  await prisma.$disconnect()
})

// ============================================================================
// 测试用户创建
// ============================================================================

/**
 * 创建测试用户
 */
export async function createTestUser(overrides: {
  email?: string
  username?: string
  password?: string
} = {}) {
  const email = overrides.email || `test_${Date.now()}@example.com`
  const username = overrides.username || `testuser_${Date.now()}`
  const password = overrides.password || 'testpassword123'

  const hashedPassword = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10,
  })

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password_hash: hashedPassword,
    },
  })

  return {
    user,
    email,
    password,
  }
}

/**
 * 创建多个测试用户
 */
export async function createTestUsers(count: number) {
  const users = []

  for (let i = 0; i < count; i++) {
    users.push(await createTestUser({
      email: `test_multi_${i}_${Date.now()}@example.com`,
      username: `testuser_multi_${i}_${Date.now()}`,
    }))
  }

  return users
}

// ============================================================================
// 测试实体创建
// ============================================================================

/**
 * 创建测试文件夹
 */
export async function createTestFolder(userId: number, overrides: {
  name?: string
} = {}) {
  return prisma.folder.create({
    data: {
      user_id: userId,
      name: overrides.name || `Test Folder ${Date.now()}`,
    },
  })
}

/**
 * 创建测试笔记
 */
export async function createTestNote(userId: number, overrides: {
  title?: string
  content?: string
  folder_id?: number
  is_pinned?: boolean
} = {}) {
  const data: any = {
    user_id: userId,
    title: overrides.title || `Test Note ${Date.now()}`,
    content: overrides.content || `Test content ${Date.now()}`,
    is_pinned: overrides.is_pinned || false,
  }

  if (overrides.folder_id !== undefined) {
    data.folder_id = overrides.folder_id
  }

  return prisma.note.create({
    data,
  })
}

/**
 * 创建测试复盘记录
 */
export async function createTestReview(userId: number, overrides: {
  date?: Date
  content?: string
  mood?: string
} = {}) {
  return prisma.review.create({
    data: {
      user_id: userId,
      date: overrides.date || new Date(),
      content: overrides.content || `Test review content ${Date.now()}`,
      mood: overrides.mood || 'good',
    },
  })
}

/**
 * 批量创建测试数据
 */
export async function createTestData(userId: number, counts: {
  folders?: number
  notes?: number
  reviews?: number
} = {}) {
  const folders = []
  const notes = []
  const reviews = []

  // 创建文件夹
  const folderCount = counts.folders || 1
  for (let i = 0; i < folderCount; i++) {
    folders.push(await createTestFolder(userId, {
      name: `Test Folder ${i + 1}`,
    }))
  }

  // 创建笔记
  const noteCount = counts.notes || 5
  for (let i = 0; i < noteCount; i++) {
    const folder = folders.length > 0 ? folders[i % folders.length] : null
    notes.push(await createTestNote(userId, {
      title: `Test Note ${i + 1}`,
      content: `Test content for note ${i + 1}`,
      folder_id: folder?.id,
      is_pinned: i < 2, // 前两个笔记置顶
    }))
  }

  // 创建复盘记录
  const reviewCount = counts.reviews || 3
  for (let i = 0; i < reviewCount; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    reviews.push(await createTestReview(userId, {
      date,
      content: `Test review ${i + 1}`,
      mood: ['good', 'neutral', 'bad'][i % 3],
    }))
  }

  return {
    folders,
    notes,
    reviews,
  }
}

// ============================================================================
// 延迟工具
// ============================================================================

/**
 * 延迟指定毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await delay(interval)
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

// ============================================================================
// WebSocket模拟工具
// ============================================================================

/**
 * 创建模拟WebSocket连接
 */
export class MockWebSocket {
  private readyState: number = 0
  private messageHandlers: ((data: any) => void)[] = []
  private closeHandlers: (() => void)[] = []
  private errorHandler: ((error: Error) => void) | null = null
  private openHandler: (() => void) | null = null

  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(private url: string) {}

  get CONNECTING() { return MockWebSocket.CONNECTING }
  get OPEN() { return MockWebSocket.OPEN }
  get CLOSING() { return MockWebSocket.CLOSING }
  get CLOSED() { return MockWebSocket.CLOSED }

  send(data: string | ArrayBuffer): void {
    // 模拟发送消息
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.closeHandlers.forEach(handler => handler())
  }

  addEventListener(event: 'message' | 'close' | 'error' | 'open', handler: any): void {
    if (event === 'message') {
      this.messageHandlers.push(handler)
    } else if (event === 'close') {
      this.closeHandlers.push(handler)
    } else if (event === 'error') {
      this.errorHandler = handler
    } else if (event === 'open') {
      this.openHandler = handler
    }
  }

  removeEventListener(event: string, handler: any): void {
    if (event === 'message') {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
    } else if (event === 'close') {
      this.closeHandlers = this.closeHandlers.filter(h => h !== handler)
    }
  }

  // 测试辅助方法
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.openHandler?.()
  }

  simulateMessage(data: any): void {
    this.messageHandlers.forEach(handler => handler({ data }))
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.closeHandlers.forEach(handler => handler())
  }

  simulateError(error: Error): void {
    this.errorHandler?.(error)
  }
}
