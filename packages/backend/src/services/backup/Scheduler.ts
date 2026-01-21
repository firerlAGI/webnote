/**
 * 定时任务调度器
 * 负责调度自动备份和清理任务
 */

import { backupService } from './BackupService.js'
import type { BackupType } from '../../config/oss'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 定时任务配置
 */
export interface ScheduleConfig {
  /** 备份任务调度时间（cron表达式） */
  backupSchedule: {
    incremental: string // 增量备份时间，如 "0 2 * * *" 表示每天凌晨2点
    full: string // 全量备份时间，如 "0 3 * * 0" 表示每周日凌晨3点
  }
  /** 清理任务调度时间（cron表达式） */
  cleanupSchedule: string
  /** 任务超时时间（毫秒） */
  taskTimeout: number
  /** 是否启用调度器 */
  enabled: boolean
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ScheduleConfig = {
  backupSchedule: {
    incremental: '0 2 * * *', // 每天凌晨2点
    full: '0 3 * * 0' // 每周日凌晨3点
  },
  cleanupSchedule: '0 4 * * *', // 每天凌晨4点
  taskTimeout: 3600000, // 1小时
  enabled: true
}

/**
 * 任务执行结果
 */
interface TaskResult {
  taskId: string
  taskType: string
  success: boolean
  startTime: Date
  endTime: Date
  duration: number
  error?: string
  metadata?: any
}

/**
 * 任务信息
 */
interface ScheduledTask {
  id: string
  name: string
  type: 'backup_incremental' | 'backup_full' | 'cleanup'
  schedule: string
  lastRun?: Date
  nextRun?: Date
  enabled: boolean
  execute: () => Promise<void>
  logger: any
}

// ============================================================================
// 定时任务调度器类
// ============================================================================

/**
 * 定时任务调度器
 */
export class BackupScheduler {
  private logger: any
  private config: ScheduleConfig
  private tasks: Map<string, ScheduledTask>
  private timers: Map<string, NodeJS.Timeout>
  private runningTasks: Map<string, Promise<void>>
  private taskResults: TaskResult[] = []
  private isRunning: boolean = false

  constructor(logger: any, config: Partial<ScheduleConfig> = {}) {
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.tasks = new Map()
    this.timers = new Map()
    this.runningTasks = new Map()

    this.registerDefaultTasks()
  }

  // ============================================================================
  // 任务注册
  // ============================================================================

  /**
   * 注册默认任务
   */
  private registerDefaultTasks(): void {
    // 增量备份任务
    this.registerTask({
      id: 'backup_incremental',
      name: '增量备份',
      type: 'backup_incremental',
      schedule: this.config.backupSchedule.incremental,
      enabled: true,
      execute: async () => {
        await this.executeBackupTask('incremental')
      },
      logger: this.logger
    })

    // 全量备份任务
    this.registerTask({
      id: 'backup_full',
      name: '全量备份',
      type: 'backup_full',
      schedule: this.config.backupSchedule.full,
      enabled: true,
      execute: async () => {
        await this.executeBackupTask('full')
      },
      logger: this.logger
    })

    // 清理任务
    this.registerTask({
      id: 'cleanup',
      name: '清理过期备份',
      type: 'cleanup',
      schedule: this.config.cleanupSchedule,
      enabled: true,
      execute: async () => {
        await this.executeCleanupTask()
      },
      logger: this.logger
    })
  }

  /**
   * 注册任务
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task)
    this.logger.info({ task_id: task.id, schedule: task.schedule }, 'Task registered')
  }

  /**
   * 取消注册任务
   */
  unregisterTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task) {
      this.stopTask(taskId)
      this.tasks.delete(taskId)
      this.logger.info({ task_id: taskId }, 'Task unregistered')
      return true
    }
    return false
  }

  // ============================================================================
  // 任务调度
  // ============================================================================

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running')
      return
    }

    if (!this.config.enabled) {
      this.logger.info('Scheduler is disabled in configuration')
      return
    }

    this.isRunning = true
    this.logger.info('Starting backup scheduler')

    // 为每个任务启动定时器
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    }

    this.logger.info({ task_count: this.tasks.size }, 'Backup scheduler started')
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.logger.info('Stopping backup scheduler')

    // 停止所有任务定时器
    for (const taskId of this.timers.keys()) {
      this.stopTask(taskId)
    }

    // 等待所有运行中的任务完成
    if (this.runningTasks.size > 0) {
      this.logger.info({ running_tasks: this.runningTasks.size }, 'Waiting for running tasks to complete...')
    }

    this.logger.info('Backup scheduler stopped')
  }

  /**
   * 调度单个任务
   */
  private scheduleTask(task: ScheduledTask): void {
    const now = new Date()
    const nextRun = this.getNextRunTime(task.schedule, now)
    task.nextRun = nextRun

    const delay = nextRun.getTime() - now.getTime()
    this.logger.info({
      task_id: task.id,
      task_name: task.name,
      schedule: task.schedule,
      next_run: nextRun.toISOString(),
      delay_ms: delay
    }, 'Task scheduled')

    const timer = setTimeout(async () => {
      await this.executeTask(task)
      // 重新调度任务
      if (this.isRunning && task.enabled) {
        this.scheduleTask(task)
      }
    }, delay)

    this.timers.set(task.id, timer)
  }

  /**
   * 停止单个任务
   */
  private stopTask(taskId: string): void {
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
      this.logger.debug({ task_id: taskId }, 'Task timer stopped')
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    if (this.runningTasks.has(task.id)) {
      this.logger.warn({
        task_id: task.id,
        task_name: task.name
      }, 'Task is already running, skipping')
      return
    }

    const startTime = new Date()
    const taskId = `${task.id}_${startTime.getTime()}`
    const result: TaskResult = {
      taskId,
      taskType: task.type,
      success: false,
      startTime,
      endTime: new Date(),
      duration: 0
    }

    this.logger.info({
      task_id: task.id,
      task_name: task.name,
      start_time: startTime.toISOString()
    }, 'Executing task')

    try {
      const taskPromise = task.execute()
        .then(() => {
          result.endTime = new Date()
          result.duration = result.endTime.getTime() - startTime.getTime()
          result.success = true
          this.logger.info({
            task_id: task.id,
            task_name: task.name,
            duration_ms: result.duration
          }, 'Task completed successfully')
        })
        .catch((error) => {
          result.endTime = new Date()
          result.duration = result.endTime.getTime() - startTime.getTime()
          result.success = false
          result.error = error instanceof Error ? error.message : String(error)
          this.logger.error({
            task_id: task.id,
            task_name: task.name,
            error: result.error,
            duration_ms: result.duration
          }, 'Task failed')
        })
        .finally(() => {
          this.taskResults.push(result)
          this.runningTasks.delete(task.id)

          // 限制结果历史长度
          if (this.taskResults.length > 100) {
            this.taskResults.shift()
          }
        })

      this.runningTasks.set(task.id, taskPromise)

      // 添加超时处理
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task timeout after ${this.config.taskTimeout}ms`))
        }, this.config.taskTimeout)
      })

      await Promise.race([taskPromise, timeoutPromise])

    } catch (error) {
      result.endTime = new Date()
      result.duration = result.endTime.getTime() - startTime.getTime()
      result.success = false
      result.error = error instanceof Error ? error.message : String(error)
      this.logger.error({
        task_id: task.id,
        task_name: task.name,
        error: result.error,
        duration_ms: result.duration
      }, 'Task execution failed')
    }

    task.lastRun = startTime
  }

  // ============================================================================
  // 备份任务
  // ============================================================================

  /**
   * 执行备份任务
   */
  private async executeBackupTask(backupType: 'incremental' | 'full'): Promise<void> {
    try {
      // 获取需要备份的用户列表
      const { prisma } = await import('../../server')
      const users = await prisma.user.findMany({
        select: { id: true, username: true },
        where: {
          // 只备份活跃用户（最近7天有活动）
          OR: [
            {
              notes: {
                some: {
                  updated_at: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            {
              folders: {
                some: {
                  updated_at: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            {
              reviews: {
                some: {
                  updated_at: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            }
          ]
        }
      })

      this.logger.info({
        backup_type: backupType,
        user_count: users.length
      }, 'Starting backup task')

      let successCount = 0
      let failedCount = 0

      for (const user of users) {
        try {
          const backupTypeParam: BackupType = backupType === 'full' ? 'full' : 'incremental'
          await backupService.createBackup(
            user.id,
            backupTypeParam,
            (progress) => {
              this.logger.debug({
                user_id: user.id,
                progress: progress.progress,
                step: progress.currentStep
              }, 'Backup progress')
            }
          )
          successCount++
        } catch (error) {
          failedCount++
          this.logger.error({
            user_id: user.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'Backup failed for user')
        }
      }

      this.logger.info({
        backup_type: backupType,
        success_count: successCount,
        failed_count: failedCount,
        total_count: users.length
      }, 'Backup task completed')

    } catch (error) {
      this.logger.error({
        backup_type: backupType,
        error: error instanceof Error ? error.message : String(error)
      }, 'Backup task failed')
      throw error
    }
  }

  // ============================================================================
  // 清理任务
  // ============================================================================

  /**
   * 执行清理任务
   */
  private async executeCleanupTask(): Promise<void> {
    try {
      this.logger.info('Starting cleanup task')

      const deletedCount = await backupService.cleanupExpiredBackups()

      this.logger.info({
        deleted_count: deletedCount
      }, 'Cleanup task completed')

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, 'Cleanup task failed')
      throw error
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 根据cron表达式计算下次运行时间
   * 简化实现，支持标准cron格式：分 时 日 月 周
   */
  private getNextRunTime(cronExpression: string, fromDate: Date = new Date()): Date {
    const parts = cronExpression.split(' ')
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpression}`)
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

    const nextRun = new Date(fromDate)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)

    // 解析分钟
    if (minute !== '*') {
      const minuteValue = parseInt(minute)
      if (!isNaN(minuteValue)) {
        if (nextRun.getMinutes() >= minuteValue) {
          nextRun.setHours(nextRun.getHours() + 1)
        }
        nextRun.setMinutes(minuteValue)
      }
    }

    // 解析小时
    if (hour !== '*') {
      const hourValue = parseInt(hour)
      if (!isNaN(hourValue)) {
        if (nextRun.getHours() >= hourValue) {
          nextRun.setDate(nextRun.getDate() + 1)
          nextRun.setHours(0)
          nextRun.setMinutes(0)
        }
        nextRun.setHours(hourValue)
      }
    }

    // 解析日
    if (dayOfMonth !== '*') {
      const dayValue = parseInt(dayOfMonth)
      if (!isNaN(dayValue)) {
        if (nextRun.getDate() >= dayValue) {
          nextRun.setMonth(nextRun.getMonth() + 1)
          nextRun.setDate(1)
          nextRun.setHours(0)
          nextRun.setMinutes(0)
        }
        nextRun.setDate(dayValue)
      }
    }

    // 解析月
    if (month !== '*') {
      const monthValue = parseInt(month) - 1 // 月份从0开始
      if (!isNaN(monthValue)) {
        if (nextRun.getMonth() >= monthValue) {
          nextRun.setFullYear(nextRun.getFullYear() + 1)
          nextRun.setMonth(0)
          nextRun.setDate(1)
          nextRun.setHours(0)
          nextRun.setMinutes(0)
        }
        nextRun.setMonth(monthValue)
      }
    }

    // 解析星期
    if (dayOfWeek !== '*') {
      const dayValue = parseInt(dayOfWeek)
      if (!isNaN(dayValue)) {
        const currentDayOfWeek = nextRun.getDay()
        if (currentDayOfWeek >= dayValue) {
          nextRun.setDate(nextRun.getDate() + (7 - currentDayOfWeek + dayValue))
        } else {
          nextRun.setDate(nextRun.getDate() + (dayValue - currentDayOfWeek))
        }
        nextRun.setHours(0)
        nextRun.setMinutes(0)
      }
    }

    return nextRun
  }

  // ============================================================================
  // 状态查询
  // ============================================================================

  /**
   * 获取所有任务状态
   */
  getTaskStatus(): Array<{
    taskId: string
    name: string
    type: string
    enabled: boolean
    lastRun?: Date
    nextRun?: Date
    isRunning: boolean
  }> {
    return Array.from(this.tasks.values()).map(task => ({
      taskId: task.id,
      name: task.name,
      type: task.type,
      enabled: task.enabled,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isRunning: this.runningTasks.has(task.id)
    }))
  }

  /**
   * 获取任务执行历史
   */
  getTaskHistory(limit: number = 50): TaskResult[] {
    return this.taskResults.slice(-limit)
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isRunning: boolean
    config: ScheduleConfig
    totalTasks: number
    enabledTasks: number
    runningTasks: number
    totalExecutions: number
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      totalTasks: this.tasks.size,
      enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
      runningTasks: this.runningTasks.size,
      totalExecutions: this.taskResults.length
    }
  }

  /**
   * 手动触发任务
   */
  async triggerTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    if (!task.enabled) {
      throw new Error(`Task is disabled: ${taskId}`)
    }

    this.logger.info({
      task_id: taskId,
      task_name: task.name
    }, 'Manually triggering task')

    await this.executeTask(task)

    // 如果调度器正在运行，重新调度任务
    if (this.isRunning) {
      this.scheduleTask(task)
    }
  }

  /**
   * 启用/禁用任务
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    task.enabled = enabled

    if (enabled && this.isRunning) {
      this.scheduleTask(task)
    } else {
      this.stopTask(taskId)
    }

    this.logger.info({
      task_id: taskId,
      task_name: task.name,
      enabled
    }, 'Task enabled/disabled')

    return true
  }

  /**
   * 关闭调度器
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down backup scheduler')

    this.stop()

    // 等待所有运行中的任务完成
    await Promise.allSettled(Array.from(this.runningTasks.values()))

    this.logger.info('Backup scheduler shut down')
  }
}

// 导出单例
let schedulerInstance: BackupScheduler | null = null

export function getScheduler(logger: any, config?: Partial<ScheduleConfig>): BackupScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new BackupScheduler(logger, config)
  }
  return schedulerInstance
}

export default BackupScheduler
