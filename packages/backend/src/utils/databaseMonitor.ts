/**
 * 数据库性能监控工具
 * 用于监控数据库查询性能、记录慢查询、收集性能指标
 */

import { Prisma } from '@prisma/client'

export interface QueryLog {
  timestamp: Date
  query: string
  duration: number
  params?: any
  error?: Error
}

export interface PerformanceMetrics {
  totalQueries: number
  slowQueries: number
  avgQueryTime: number
  p95QueryTime: number
  p99QueryTime: number
  errorRate: number
}

export interface DatabaseStats {
  metrics: PerformanceMetrics
  recentQueries: QueryLog[]
  topSlowQueries: QueryLog[]
}

class DatabaseMonitor {
  private queryLogs: QueryLog[] = []
  private slowQueryThreshold: number = 1000 // 1秒
  private maxLogs: number = 1000

  /**
   * 记录查询日志
   */
  logQuery(query: string, duration: number, params?: any, error?: Error): void {
    const log: QueryLog = {
      timestamp: new Date(),
      query,
      duration,
      params,
      error
    }

    // 如果是慢查询，打印警告
    if (duration > this.slowQueryThreshold) {
      console.warn(`[SLOW QUERY] ${duration}ms:`, query)
      if (params) {
        console.warn('Params:', params)
      }
    }

    // 如果有错误，打印错误
    if (error) {
      console.error(`[QUERY ERROR]:`, error.message)
      console.error('Query:', query)
      if (params) {
        console.error('Params:', params)
      }
    }

    // 保存日志
    this.queryLogs.push(log)

    // 限制日志数量
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs = this.queryLogs.slice(-this.maxLogs)
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    if (this.queryLogs.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
        errorRate: 0
      }
    }

    const durations = this.queryLogs.map(log => log.duration)
    durations.sort((a, b) => a - b)

    const slowQueries = this.queryLogs.filter(log => log.duration > this.slowQueryThreshold)
    const errorQueries = this.queryLogs.filter(log => log.error)

    const totalQueries = this.queryLogs.length
    const avgQueryTime = durations.reduce((sum, d) => sum + d, 0) / totalQueries
    const p95Index = Math.floor(totalQueries * 0.95)
    const p99Index = Math.floor(totalQueries * 0.99)

    return {
      totalQueries,
      slowQueries: slowQueries.length,
      avgQueryTime,
      p95QueryTime: durations[p95Index] || 0,
      p99QueryTime: durations[p99Index] || 0,
      errorRate: errorQueries.length / totalQueries
    }
  }

  /**
   * 获取数据库统计
   */
  getDatabaseStats(): DatabaseStats {
    const metrics = this.getPerformanceMetrics()
    const recentQueries = this.queryLogs.slice(-100)
    const topSlowQueries = [...this.queryLogs]
      .filter(log => log.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      metrics,
      recentQueries,
      topSlowQueries
    }
  }

  /**
   * 获取慢查询日志
   */
  getSlowQueries(): QueryLog[] {
    return this.queryLogs
      .filter(log => log.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
  }

  /**
   * 获取错误查询
   */
  getErrorQueries(): QueryLog[] {
    return this.queryLogs.filter(log => log.error)
  }

  /**
   * 清除日志
   */
  clearLogs(): void {
    this.queryLogs = []
  }

  /**
   * 设置慢查询阈值
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold
  }

  /**
   * 获取慢查询阈值
   */
  getSlowQueryThreshold(): number {
    return this.slowQueryThreshold
  }

  /**
   * 打印性能报告
   */
  printPerformanceReport(): void {
    const metrics = this.getPerformanceMetrics()
    const slowQueries = this.getSlowQueries()

    console.log('\n=== 数据库性能报告 ===')
    console.log(`总查询数: ${metrics.totalQueries}`)
    console.log(`慢查询数: ${metrics.slowQueries}`)
    console.log(`平均查询时间: ${metrics.avgQueryTime.toFixed(2)}ms`)
    console.log(`P95 查询时间: ${metrics.p95QueryTime.toFixed(2)}ms`)
    console.log(`P99 查询时间: ${metrics.p99QueryTime.toFixed(2)}ms`)
    console.log(`错误率: ${(metrics.errorRate * 100).toFixed(2)}%`)

    if (slowQueries.length > 0) {
      console.log('\n=== 慢查询 Top 10 ===')
      slowQueries.slice(0, 10).forEach((log, index) => {
        console.log(`\n${index + 1}. ${log.duration}ms`)
        console.log(`   时间: ${log.timestamp.toISOString()}`)
        console.log(`   查询: ${log.query}`)
        if (log.params) {
          console.log(`   参数:`, log.params)
        }
      })
    }

    console.log('========================\n')
  }
}

// 创建单例实例
export const databaseMonitor = new DatabaseMonitor()

/**
 * Prisma 查询中间件
 * 用于记录所有查询的执行时间
 */
export function createPrismaMiddleware() {
  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    const startTime = Date.now()

    try {
      const result = await next(params)

      const duration = Date.now() - startTime

      // 记录查询
      databaseMonitor.logQuery(
        `${params.model}.${params.action}`,
        duration,
        params.args
      )

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // 记录错误查询
      databaseMonitor.logQuery(
        `${params.model}.${params.action}`,
        duration,
        params.args,
        error as Error
      )

      throw error
    }
  }
}

/**
 * 定时清理任务
 */
export function startCleanupTask(intervalMs: number = 3600000) { // 默认1小时
  setInterval(() => {
    // 只保留最近1000条记录
    if (databaseMonitor['queryLogs'].length > 1000) {
      databaseMonitor['queryLogs'] = databaseMonitor['queryLogs'].slice(-1000)
    }
  }, intervalMs)
}
