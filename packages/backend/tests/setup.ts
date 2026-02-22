/**
 * 测试环境设置
 * 提供测试所需的共享资源和工具
 */

import { PrismaClient } from '@prisma/client'
import pino from 'pino'
import { beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'

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
  // 使用事务确保清理的原子性
  await prisma.$transaction(async (tx) => {
    // 删除所有数据（不依赖外键约束）
    await tx.$executeRawUnsafe('DELETE FROM SyncQueue')
    await tx.$executeRawUnsafe('DELETE FROM SyncOperation')
    await tx.$executeRawUnsafe('DELETE FROM SyncSession')
    await tx.$executeRawUnsafe('DELETE FROM SyncStatistics')
    await tx.$executeRawUnsafe('DELETE FROM Backup')
    await tx.$executeRawUnsafe('DELETE FROM Review')
    await tx.$executeRawUnsafe('DELETE FROM Note')
    await tx.$executeRawUnsafe('DELETE FROM Folder')
    await tx.$executeRawUnsafe('DELETE FROM UserSettings')
    await tx.$executeRawUnsafe("DELETE FROM User WHERE email LIKE 'test_%'")
  })
}

// 在所有测试前清理数据库
beforeAll(async () => {
  await cleanupDatabase()
})

afterAll(async () => {
  await cleanupDatabase()
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
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const email = overrides.email || `test_${timestamp}_${random}@example.com`
  const username = overrides.username || `testuser_${timestamp}_${random}`
  const password = overrides.password || 'testpassword123'

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  
  if (!user) {
    throw new Error(`User with id ${userId} does not exist. Cannot create folder.`)
  }
  
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  
  if (!user) {
    throw new Error(`User with id ${userId} does not exist. Cannot create note.`)
  }
  
  const data: any = {
    user_id: userId,
    title: overrides.title || `Test Note ${Date.now()}`,
    content: overrides.content || `Test content ${Date.now()}`,
    is_pinned: overrides.is_pinned || false,
  }

  if (overrides.folder_id !== undefined) {
    const folder = await prisma.folder.findFirst({
      where: { id: overrides.folder_id, user_id: userId },
    })
    if (folder) {
      data.folder_id = overrides.folder_id
    }
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
  mood?: number
} = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  
  if (!user) {
    throw new Error(`User with id ${userId} does not exist. Cannot create review.`)
  }
  
  return prisma.review.create({
    data: {
      user_id: userId,
      date: overrides.date || new Date(),
      content: overrides.content || `Test review content ${Date.now()}`,
      mood: overrides.mood || 5, // 默认5分 (1-10分制)
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
    const noteData: any = {
      title: `Test Note ${i + 1}`,
      content: `Test content for note ${i + 1}`,
      is_pinned: i < 2, // 前两个笔记置顶
    }
    if (folder) {
      noteData.folder_id = folder.id
    }
    notes.push(await createTestNote(userId, noteData))
  }

  // 创建复盘记录
  const reviewCount = counts.reviews || 3
  for (let i = 0; i < reviewCount; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    reviews.push(await createTestReview(userId, {
      date,
      content: `Test review ${i + 1}`,
      mood: [8, 5, 3][i % 3], // 8=好, 5=一般, 3=差
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

  constructor(private _url: string) {}

  get CONNECTING() { return MockWebSocket.CONNECTING }
  get OPEN() { return MockWebSocket.OPEN }
  get CLOSING() { return MockWebSocket.CLOSING }
  get CLOSED() { return MockWebSocket.CLOSED }

  send(_: string | ArrayBuffer): void {
    void _;
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
