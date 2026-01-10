/**
 * T3项目同步API接口类型定义
 * 包含WebSocket和REST API的请求/响应类型
 */

import {
  SyncRequest,
  SyncResponse,
  Conflict,
  ConflictResolution,
  ConflictResolutionResult,
  SyncStatus,
  EntityType,
  SyncOperationType,
  Version,
  ClientSyncState
} from '@webnote/shared/types/sync'

// ============================================================================
// WebSocket 消息类型
// ============================================================================

/**
 * WebSocket 消息类型
 */
export enum WebSocketMessageType {
  /** 连接握手 */
  HANDSHAKE = 'handshake',
  /** 认证 */
  AUTH = 'auth',
  /** 心跳 */
  PING = 'ping',
  /** 心跳响应 */
  PONG = 'pong',
  /** 同步请求 */
  SYNC = 'sync',
  /** 同步响应 */
  SYNC_RESPONSE = 'sync_response',
  /** 服务器推送更新 */
  SERVER_UPDATE = 'server_update',
  /** 冲突通知 */
  CONFLICT = 'conflict',
  /** 同步状态变更 */
  STATUS_CHANGE = 'status_change',
  /** 错误 */
  ERROR = 'error',
  /** 连接关闭 */
  CLOSE = 'close'
}

/**
 * WebSocket 基础消息
 */
export interface BaseWebSocketMessage {
  /** 消息类型 */
  type: WebSocketMessageType
  /** 消息ID（用于请求响应匹配） */
  message_id?: string
  /** 时间戳 */
  timestamp: string
}

/**
 * WebSocket 握手请求
 */
export interface WebSocketHandshakeRequest extends BaseWebSocketMessage {
  type: WebSocketMessageType.HANDSHAKE
  /** 客户端ID */
  client_id: string
  /** 客户端信息 */
  client_info: {
    /** 设备类型 */
    device_type: 'desktop' | 'mobile' | 'tablet'
    /** 操作系统 */
    os_name: string
    /** 操作系统版本 */
    os_version: string
    /** 应用版本 */
    app_version: string
  }
  /** 支持的协议版本 */
  protocol_version: Version
}

/**
 * WebSocket 握手响应
 */
export interface WebSocketHandshakeResponse extends BaseWebSocketMessage {
  type: WebSocketMessageType.HANDSHAKE
  /** 是否成功 */
  success: boolean
  /** 服务器ID */
  server_id: string
  /** 支持的协议版本 */
  protocol_version: Version
  /** 连接ID */
  connection_id: string
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * WebSocket 认证请求
 */
export interface WebSocketAuthRequest extends BaseWebSocketMessage {
  type: WebSocketMessageType.AUTH
  /** JWT Token */
  token: string
}

/**
 * WebSocket 认证响应
 */
export interface WebSocketAuthResponse extends BaseWebSocketMessage {
  type: WebSocketMessageType.AUTH
  /** 是否成功 */
  success: boolean
  /** 用户ID */
  user_id?: number
  /** 客户端当前同步状态 */
  current_state?: ClientSyncState
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * WebSocket 同步请求
 */
export interface WebSocketSyncRequest extends BaseWebSocketMessage {
  type: WebSocketMessageType.SYNC
  /** 同步请求数据 */
  data: SyncRequest
}

/**
 * WebSocket 同步响应
 */
export interface WebSocketSyncResponse extends BaseWebSocketMessage {
  type: WebSocketMessageType.SYNC_RESPONSE
  /** 对应的请求ID */
  request_id: string
  /** 同步响应数据 */
  data: SyncResponse
}

/**
 * WebSocket 服务器更新推送
 */
export interface WebSocketServerUpdate extends BaseWebSocketMessage {
  type: WebSocketMessageType.SERVER_UPDATE
  /** 更新类型 */
  update_type: 'incremental' | 'full'
  /** 更新的实体类型 */
  entity_type: EntityType
  /** 更新的实体ID */
  entity_id?: number
  /** 更新数据 */
  update_data: {
    operation_type: SyncOperationType
    version: number
    data?: Record<string, any>
    modified_at: string
    modified_by: number
  }
}

/**
 * WebSocket 冲突通知
 */
export interface WebSocketConflictNotification extends BaseWebSocketMessage {
  type: WebSocketMessageType.CONFLICT
  /** 冲突信息 */
  conflict: Conflict
  /** 是否需要手动解决 */
  requires_manual_resolution: boolean
}

/**
 * WebSocket 同步状态变更通知
 */
export interface WebSocketStatusChangeNotification extends BaseWebSocketMessage {
  type: WebSocketMessageType.STATUS_CHANGE
  /** 同步ID */
  sync_id: string
  /** 旧状态 */
  old_status: SyncStatus
  /** 新状态 */
  new_status: SyncStatus
  /** 进度（0-100） */
  progress?: number
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * WebSocket 错误消息
 */
export interface WebSocketErrorMessage extends BaseWebSocketMessage {
  type: WebSocketMessageType.ERROR
  /** 错误代码 */
  error_code: string
  /** 错误消息 */
  error_message: string
  /** 错误详情 */
  details?: Record<string, any>
}

/**
 * WebSocket 关闭消息
 */
export interface WebSocketCloseMessage extends BaseWebSocketMessage {
  type: WebSocketMessageType.CLOSE
  /** 关闭原因 */
  reason: string
  /** 关闭代码 */
  code: number
}

// ============================================================================
// REST API 请求/响应类型
// ============================================================================

/**
 * 同步数据请求
 */
export interface SyncDataRequest {
  /** 客户端ID */
  client_id: string
  /** 同步协议版本 */
  protocol_version: Version
  /** 要同步的实体类型 */
  entity_types: EntityType[]
  /** 上次同步时间（增量同步） */
  since?: string
  /** 是否要求完整同步 */
  full_sync?: boolean
  /** 批次大小 */
  batch_size?: number
  /** 批次索引 */
  batch_index?: number
  /** 是否是最后一个批次 */
  is_last_batch?: boolean
}

/**
 * 同步数据响应
 */
export interface SyncDataResponse {
  /** 是否成功 */
  success: boolean
  /** 同步数据 */
  data?: {
    /** 同步ID */
    sync_id: string
    /** 实体类型 */
    entity_type: EntityType
    /** 实体数据列表 */
    entities: Array<{
      id: number
      version: number
      data: Record<string, any>
      created_at: string
      updated_at: string
      deleted_at?: string
    }>
    /** 是否有更多数据 */
    has_more: boolean
    /** 下一批次索引 */
    next_batch_index?: number
    /** 服务器时间 */
    server_time: string
  }
  /** 错误信息 */
  error?: string
  /** 错误代码 */
  error_code?: string
}

/**
 * 获取同步状态请求
 */
export interface GetSyncStatusRequest {
  /** 客户端ID */
  client_id?: string
  /** 同步ID（可选，获取特定同步的状态） */
  sync_id?: string
}

/**
 * 同步状态详情
 */
export interface SyncStatusDetail {
  /** 同步ID */
  sync_id: string
  /** 客户端ID */
  client_id: string
  /** 用户ID */
  user_id: number
  /** 同步状态 */
  status: SyncStatus
  /** 开始时间 */
  start_time: string
  /** 结束时间 */
  end_time?: string
  /** 总操作数 */
  total_operations: number
  /** 已完成操作数 */
  completed_operations: number
  /** 成功操作数 */
  successful_operations: number
  /** 失败操作数 */
  failed_operations: number
  /** 冲突数 */
  conflicts_count: number
  /** 已解决冲突数 */
  resolved_conflicts: number
  /** 进度（0-100） */
  progress: number
  /** 当前同步的实体类型 */
  entity_types: EntityType[]
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * 获取同步状态响应
 */
export interface GetSyncStatusResponse {
  /** 是否成功 */
  success: boolean
  /** 同步状态列表 */
  data?: {
    /** 当前活跃的同步 */
    active_syncs: SyncStatusDetail[]
    /** 客户端最新同步状态 */
    client_state?: ClientSyncState
    /** 所有同步历史（最近N条） */
    sync_history: SyncStatusDetail[]
  }
  /** 错误信息 */
  error?: string
}

/**
 * 获取同步队列请求
 */
export interface GetSyncQueueRequest {
  /** 客户端ID */
  client_id?: string
  /** 队列类型 */
  queue_type?: 'pending' | 'processing' | 'failed' | 'all'
  /** 实体类型过滤 */
  entity_type?: EntityType
  /** 分页参数 */
  page?: number
  limit?: number
}

/**
 * 队列中的同步操作
 */
export interface QueuedSyncOperation {
  /** 操作ID */
  operation_id: string
  /** 同步ID */
  sync_id: string
  /** 客户端ID */
  client_id: string
  /** 用户ID */
  user_id: number
  /** 操作类型 */
  operation_type: SyncOperationType
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID */
  entity_id?: number
  /** 操作数据 */
  data?: Record<string, any>
  /** 队列状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 重试次数 */
  retry_count: number
  /** 创建时间 */
  created_at: string
  /** 预计处理时间 */
  estimated_processing_time?: string
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * 获取同步队列响应
 */
export interface GetSyncQueueResponse {
  /** 是否成功 */
  success: boolean
  /** 队列数据 */
  data?: {
    /** 队列中的操作 */
    operations: QueuedSyncOperation[]
    /** 总数 */
    total: number
    /** 分页信息 */
    pagination: {
      page: number
      limit: number
      total_pages: number
    }
    /** 队列统计 */
    stats: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
  }
  /** 错误信息 */
  error?: string
}

/**
 * 解决冲突请求
 */
export interface ResolveConflictRequest {
  /** 冲突ID */
  conflict_id: string
  /** 解决方案 */
  resolution: ConflictResolution
}

/**
 * 解决冲突响应
 */
export interface ResolveConflictResponse {
  /** 是否成功 */
  success: boolean
  /** 解决结果 */
  data?: ConflictResolutionResult
  /** 错误信息 */
  error?: string
}

/**
 * 批量解决冲突请求
 */
export interface BatchResolveConflictRequest {
  /** 冲突解决列表 */
  resolutions: Array<{
    conflict_id: string
    resolution: ConflictResolution
  }>
}

/**
 * 批量解决冲突响应
 */
export interface BatchResolveConflictResponse {
  /** 是否成功 */
  success: boolean
  /** 解决结果列表 */
  data?: ConflictResolutionResult[]
  /** 错误信息 */
  error?: string
}

/**
 * 获取数据差异请求
 */
export interface GetDataDiffRequest {
  /** 客户端ID */
  client_id: string
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID（可选，获取特定实体的差异） */
  entity_id?: number
  /** 客户端版本 */
  client_version?: number
  /** 服务器版本（可选，用于比较特定版本） */
  server_version?: number
}

/**
 * 字段差异
 */
export interface FieldDiff {
  /** 字段名 */
  field_name: string
  /** 客户端值 */
  client_value: any
  /** 服务器值 */
  server_value: any
  /** 差异类型 */
  diff_type: 'added' | 'removed' | 'modified' | 'same'
}

/**
 * 实体差异
 */
export interface EntityDiff {
  /** 实体ID */
  entity_id: number
  /** 实体类型 */
  entity_type: EntityType
  /** 客户端版本 */
  client_version: number
  /** 服务器版本 */
  server_version: number
  /** 客户端数据 */
  client_data?: Record<string, any>
  /** 服务器数据 */
  server_data?: Record<string, any>
  /** 字段差异列表 */
  field_diffs: FieldDiff[]
  /** 差异类型 */
  diff_type: 'conflict' | 'update' | 'delete' | 'create'
  /** 是否存在冲突 */
  has_conflict: boolean
}

/**
 * 获取数据差异响应
 */
export interface GetDataDiffResponse {
  /** 是否成功 */
  success: boolean
  /** 差异数据 */
  data?: {
    /** 差异列表 */
    diffs: EntityDiff[]
    /** 总差异数量 */
    total_diffs: number
    /** 冲突数量 */
    conflicts_count: number
    /** 服务器时间 */
    server_time: string
  }
  /** 错误信息 */
  error?: string
}

/**
 * 取消同步请求
 */
export interface CancelSyncRequest {
  /** 同步ID */
  sync_id: string
  /** 取消原因 */
  reason?: string
}

/**
 * 取消同步响应
 */
export interface CancelSyncResponse {
  /** 是否成功 */
  success: boolean
  /** 取消的同步ID */
  sync_id?: string
  /** 错误信息 */
  error?: string
}

/**
 * 重试失败的同步请求
 */
export interface RetrySyncRequest {
  /** 同步ID */
  sync_id: string
  /** 要重试的操作ID列表（可选，不提供则重试所有失败操作） */
  operation_ids?: string[]
}

/**
 * 重试失败的同步响应
 */
export interface RetrySyncResponse {
  /** 是否成功 */
  success: boolean
  /** 重试的同步ID */
  sync_id?: string
  /** 重试的操作数量 */
  retried_count?: number
  /** 错误信息 */
  error?: string
}

/**
 * 清除同步历史请求
 */
export interface ClearSyncHistoryRequest {
  /** 客户端ID */
  client_id?: string
  /** 保留的天数 */
  retain_days?: number
}

/**
 * 清除同步历史响应
 */
export interface ClearSyncHistoryResponse {
  /** 是否成功 */
  success: boolean
  /** 清除的记录数 */
  cleared_count?: number
  /** 错误信息 */
  error?: string
}

// ============================================================================
// HTTP轮询降级相关类型
// ============================================================================

/**
 * 连接健康状态
 */
export enum ConnectionHealthStatus {
  /** 健康 */
  HEALTHY = 'healthy',
  /** 降级中 */
  DEGRADED = 'degraded',
  /** 恢复中 */
  RECOVERING = 'recovering'
}

/**
 * 轮询优先级
 */
export enum PollingPriority {
  /** 正常 */
  NORMAL = 'normal',
  /** 高优先级 */
  HIGH = 'high'
}

/**
 * 轮询更新数据
 */
export interface PollingUpdate {
  /** 更新类型 */
  update_type: 'incremental' | 'full'
  /** 更新的实体类型 */
  entity_type: string
  /** 更新的实体ID */
  entity_id?: number
  /** 更新数据 */
  update_data: {
    operation_type: string
    version: number
    data?: Record<string, any>
    modified_at: string
    modified_by: number
  }
  /** 时间戳 */
  timestamp: string
}

/**
 * 轮询请求
 */
export interface PollingRequest {
  /** 客户端ID */
  client_id: string
  /** 上次同步时间（可选，用于增量同步） */
  since?: string
  /** 实体类型过滤（可选） */
  entity_types?: string[]
  /** 轮询优先级（可选） */
  priority?: PollingPriority
}

/**
 * 轮询响应
 */
export interface PollingResponse {
  /** 是否成功 */
  success: boolean
  /** 更新列表 */
  updates: PollingUpdate[]
  /** 是否有更多数据 */
  has_more: boolean
  /** 服务器时间 */
  server_time: string
  /** 下一次建议的轮询间隔（毫秒） */
  suggested_interval: number
  /** 错误信息 */
  error?: string
}

/**
 * 获取降级状态请求
 */
export interface GetFallbackStatusRequest {
  /** 客户端ID */
  client_id?: string
}

/**
 * 降级状态详情
 */
export interface FallbackStatusDetail {
  /** 客户端ID */
  client_id: string
  /** 是否在降级模式 */
  in_fallback: boolean
  /** 轮询是否活跃 */
  polling_active: boolean
  /** 连接健康状态 */
  health_status: ConnectionHealthStatus
  /** 降级原因（如果在降级模式） */
  fallback_reason?: string
  /** 最后一次连接时间 */
  last_connection_time?: string
  /** 最后一次断开时间 */
  last_disconnect_time?: string
  /** 断开次数（时间窗口内） */
  disconnect_count: number
  /** 超时次数 */
  timeout_count: number
  /** 平均响应时间（毫秒） */
  average_response_time?: number
}

/**
 * 获取降级状态响应
 */
export interface GetFallbackStatusResponse {
  /** 是否成功 */
  success: boolean
  /** 降级状态数据 */
  data?: {
    /** 当前客户端的降级状态（如果指定了client_id） */
    current_status?: FallbackStatusDetail
    /** 所有客户端的降级状态（如果未指定client_id） */
    all_statuses?: FallbackStatusDetail[]
  }
  /** 错误信息 */
  error?: string
}

/**
 * 强制降级请求
 */
export interface ForceFallbackRequest {
  /** 客户端ID */
  client_id: string
  /** 轮询优先级 */
  priority?: PollingPriority
  /** 降级原因 */
  reason?: string
}

/**
 * 强制降级响应
 */
export interface ForceFallbackResponse {
  /** 是否成功 */
  success: boolean
  /** 降级状态 */
  data?: {
    client_id: string
    in_fallback: boolean
  }
  /** 错误信息 */
  error?: string
}

/**
 * 退出降级请求
 */
export interface ExitFallbackRequest {
  /** 客户端ID */
  client_id: string
  /** 是否尝试重新连接 */
  attempt_reconnect?: boolean
}

/**
 * 退出降级响应
 */
export interface ExitFallbackResponse {
  /** 是否成功 */
  success: boolean
  /** 数据 */
  data?: {
    client_id: string
    in_fallback: boolean
    should_reconnect: boolean
  }
  /** 错误信息 */
  error?: string
}
