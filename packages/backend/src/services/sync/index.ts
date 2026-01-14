/**
 * T3项目同步服务入口
 * 导出所有同步相关的模块和类型
 */

export { SyncService, type SyncServiceConfig, type WebSocketConnection } from './SyncService'
export {
  registerSyncRoutes,
  handleWebSocketConnection,
  authenticate,
  getUserId
} from './routes'

// 导出所有类型
export * from './types'
