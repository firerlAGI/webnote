/**
 * T3项目同步数据格式定义
 * 包含客户端与服务器之间的数据同步机制
 */

// ============================================================================
// 版本控制相关类型
// ============================================================================

/**
 * 数据版本号
 * 使用语义化版本控制：主版本.次版本.修订版本
 * - 主版本：数据结构发生不兼容变更
 * - 次版本：新增字段，向后兼容
 * - 修订版本：Bug修复
 */
export type Version = `${number}.${number}.${number}`

/**
 * 当前同步协议版本
 */
export const SYNC_PROTOCOL_VERSION: Version = '1.0.0'

/**
 * 数据实体类型
 */
export type EntityType = 'note' | 'folder' | 'review' | 'user'

/**
 * 同步操作类型
 */
export enum SyncOperationType {
  /** 创建新记录 */
  CREATE = 'create',
  /** 更新现有记录 */
  UPDATE = 'update',
  /** 删除记录 */
  DELETE = 'delete',
  /** 读取数据 */
  READ = 'read',
  /** 冲突解决 */
  RESOLVE = 'resolve'
}

/**
 * 冲突类型
 */
export enum ConflictType {
  /** 内容冲突：同一记录被多方修改 */
  CONTENT = 'content',
  /** 版本冲突：本地版本与服务器版本不一致 */
  VERSION = 'version',
  /** 删除冲突：一方删除，另一方修改 */
  DELETE = 'delete',
  /** 父级冲突：父记录不存在或被删除 */
  PARENT = 'parent',
  /** 唯一性冲突：重复的唯一键 */
  UNIQUE = 'unique'
}

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  /** 使用服务器版本 */
  SERVER_WINS = 'server_wins',
  /** 使用客户端版本 */
  CLIENT_WINS = 'client_wins',
  /** 合并版本 */
  MERGE = 'merge',
  /** 手动解决 */
  MANUAL = 'manual',
  /** 基于时间戳，最新的版本胜出 */
  LATEST_WINS = 'latest_wins'
}

/**
 * 同步状态
 */
export enum SyncStatus {
  /** 等待同步 */
  PENDING = 'pending',
  /** 同步中 */
  SYNCING = 'syncing',
  /** 同步成功 */
  SUCCESS = 'success',
  /** 同步失败 */
  FAILED = 'failed',
  /** 存在冲突 */
  CONFLICT = 'conflict',
  /** 已取消 */
  CANCELLED = 'cancelled'
}

// ============================================================================
// 数据实体版本信息
// ============================================================================

/**
 * 数据实体版本信息
 * 用于跟踪每个数据记录的修改历史
 */
export interface EntityVersion {
  /** 实体ID */
  id: number
  /** 实体类型 */
  entity_type: EntityType
  /** 版本号（递增） */
  version: number
  /** 客户端版本标识（用于离线场景） */
  client_version: string
  /** 最后修改时间 */
  last_modified: string
  /** 最后修改的用户ID */
  modified_by: number
  /** 哈希值（用于快速检测变更） */
  hash: string
  /** 是否已删除 */
  is_deleted: boolean
  /** 删除时间（如果已删除） */
  deleted_at?: string
}

/**
 * 客户端同步状态
 * 记录客户端的同步状态信息
 */
export interface ClientSyncState {
  /** 客户端唯一标识 */
  client_id: string
  /** 上次同步时间 */
  last_sync_time: string
  /** 服务器版本号 */
  server_version: Version
  /** 待同步的操作计数 */
  pending_operations: number
  /** 最后成功的同步ID */
  last_sync_id?: string
}

// ============================================================================
// 同步操作
// ============================================================================

/**
 * 同步操作基类
 */
export interface BaseSyncOperation {
  /** 操作ID */
  operation_id: string
  /** 操作类型 */
  operation_type: SyncOperationType
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID（如果是更新或删除） */
  entity_id?: number
  /** 临时ID（客户端创建时的临时ID） */
  temp_id?: string
  /** 客户端ID */
  client_id: string
  /** 操作时间戳 */
  timestamp: string
  /** 操作前的版本号 */
  before_version?: number
  /** 操作后的版本号 */
  after_version?: number
  /** 数据哈希（用于冲突检测） */
  data_hash?: string
}

/**
 * 创建操作
 */
export interface CreateOperation extends BaseSyncOperation {
  operation_type: SyncOperationType.CREATE
  /** 实体数据 */
  data: Record<string, any>
}

/**
 * 更新操作
 */
export interface UpdateOperation extends BaseSyncOperation {
  operation_type: SyncOperationType.UPDATE
  /** 实体ID（必填） */
  entity_id: number
  /** 更新的字段 */
  changes: Record<string, any>
  /** 完整数据（可选，用于冲突解决） */
  full_data?: Record<string, any>
}

/**
 * 删除操作
 */
export interface DeleteOperation extends BaseSyncOperation {
  operation_type: SyncOperationType.DELETE
  /** 实体ID（必填） */
  entity_id: number
  /** 删除前的版本号 */
  before_version: number
}

/**
 * 读取操作
 */
export interface ReadOperation extends BaseSyncOperation {
  operation_type: SyncOperationType.READ
  /** 实体ID（可选，不提供则读取所有） */
  entity_id?: number
  /** 过滤条件 */
  filters?: Record<string, any>
  /** 上次同步时间（用于增量同步） */
  since?: string
}

/**
 * 同步操作联合类型
 */
export type SyncOperation = CreateOperation | UpdateOperation | DeleteOperation | ReadOperation

// ============================================================================
// 冲突检测与解决
// ============================================================================

/**
 * 冲突信息
 */
export interface Conflict {
  /** 冲突ID */
  conflict_id: string
  /** 冲突类型 */
  conflict_type: ConflictType
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID */
  entity_id: number
  /** 冲突的操作ID */
  operation_id: string
  /** 服务器端数据 */
  server_data: {
    version: number
    data: Record<string, any>
    modified_at: string
    modified_by: number
  }
  /** 客户端数据 */
  client_data: {
    version: number
    data: Record<string, any>
    modified_at: string
    operation_type: SyncOperationType
  }
  /** 冲突的字段 */
  conflict_fields: string[]
  /** 推荐的解决策略 */
  suggested_strategy: ConflictResolutionStrategy
  /** 冲突时间戳 */
  timestamp: string
}

/**
 * 冲突解决请求
 */
export interface ConflictResolution {
  /** 冲突ID */
  conflict_id: string
  /** 解决策略 */
  strategy: ConflictResolutionStrategy
  /** 解决后的数据（如果选择手动解决或合并） */
  resolved_data?: Record<string, any>
  /** 是否自动解决 */
  auto_resolve: boolean
}

/**
 * 冲突解决结果
 */
export interface ConflictResolutionResult {
  /** 冲突ID */
  conflict_id: string
  /** 是否成功解决 */
  success: boolean
  /** 解决后的实体数据 */
  resolved_data?: Record<string, any>
  /** 新版本号 */
  new_version?: number
  /** 错误信息（如果解决失败） */
  error?: string
}

// ============================================================================
// 同步请求与响应
// ============================================================================

/**
 * 同步请求
 */
export interface SyncRequest {
  /** 请求ID（唯一标识本次同步会话） */
  request_id: string
  /** 客户端ID */
  client_id: string
  /** 客户端同步状态 */
  client_state: ClientSyncState
  /** 同步协议版本 */
  protocol_version: Version
  /** 要执行的操作列表 */
  operations: SyncOperation[]
  /** 冲突解决策略（全局） */
  default_resolution_strategy?: ConflictResolutionStrategy
  /** 是否要求增量同步 */
  incremental?: boolean
  /** 批次大小（用于分批同步） */
  batch_size?: number
  /** 批次索引（从0开始） */
  batch_index?: number
  /** 是否是最后一个批次 */
  is_last_batch?: boolean
}

/**
 * 同步响应中的操作结果
 */
export interface OperationResult {
  /** 操作ID */
  operation_id: string
  /** 操作类型 */
  operation_type: SyncOperationType
  /** 实体类型 */
  entity_type: EntityType
  /** 是否成功 */
  success: boolean
  /** 实体ID（服务器分配的ID） */
  entity_id?: number
  /** 新版本号 */
  new_version?: number
  /** 操作后的数据 */
  data?: Record<string, any>
  /** 错误信息 */
  error?: string
  /** 错误代码 */
  error_code?: string
}

/**
 * 服务器端更新操作
 * 用于将服务器的变更推送到客户端
 */
export interface ServerUpdate {
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID */
  entity_id: number
  /** 操作类型 */
  operation_type: SyncOperationType.CREATE | SyncOperationType.UPDATE | SyncOperationType.DELETE
  /** 版本号 */
  version: number
  /** 数据 */
  data?: Record<string, any>
  /** 变更的字段 */
  changed_fields?: string[]
  /** 修改时间 */
  modified_at: string
  /** 修改者ID */
  modified_by: number
}

/**
 * 同步响应
 */
export interface SyncResponse {
  /** 响应对应的请求ID */
  request_id: string
  /** 服务器时间 */
  server_time: string
  /** 同步协议版本 */
  protocol_version: Version
  /** 同步状态 */
  status: SyncStatus
  /** 操作结果列表 */
  operation_results: OperationResult[]
  /** 服务器端更新（需要应用到客户端） */
  server_updates: ServerUpdate[]
  /** 检测到的冲突列表 */
  conflicts: Conflict[]
  /** 新的客户端同步状态 */
  new_client_state: ClientSyncState
  /** 是否需要更多批次 */
  has_more?: boolean
  /** 下一批次索引 */
  next_batch_index?: number
  /** 错误信息（全局错误） */
  error?: string
  /** 警告信息 */
  warnings?: string[]
}

// ============================================================================
// 同步元数据
// ============================================================================

/**
 * 同步元数据
 * 用于辅助同步过程的附加信息
 */
export interface SyncMetadata {
  /** 设备信息 */
  device_info: {
    device_type: 'desktop' | 'mobile' | 'tablet'
    os_name: string
    os_version: string
    app_version: string
  }
  /** 网络信息 */
  network_info: {
    type: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
    is_online: boolean
  }
  /** 同步选项 */
  sync_options: {
    /** 是否自动解决冲突 */
    auto_resolve_conflicts: boolean
    /** 默认冲突解决策略 */
    default_resolution_strategy: ConflictResolutionStrategy
    /** 最大重试次数 */
    max_retries: number
    /** 超时时间（毫秒） */
    timeout: number
  }
}

/**
 * 增强的同步请求（包含元数据）
 */
export interface SyncRequestWithMetadata extends SyncRequest {
  /** 同步元数据 */
  metadata: SyncMetadata
}

// ============================================================================
// 同步统计信息
// ============================================================================

/**
 * 同步统计信息
 */
export interface SyncStats {
  /** 总操作数 */
  total_operations: number
  /** 成功操作数 */
  successful_operations: number
  /** 失败操作数 */
  failed_operations: number
  /** 冲突数 */
  conflicts_count: number
  /** 已解决冲突数 */
  resolved_conflicts: number
  /** 创建的记录数 */
  created_count: number
  /** 更新的记录数 */
  updated_count: number
  /** 删除的记录数 */
  deleted_count: number
  /** 同步开始时间 */
  start_time: string
  /** 同步结束时间 */
  end_time: string
  /** 同步耗时（毫秒） */
  duration: number
  /** 传输数据量（字节） */
  bytes_transferred: number
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 哈希生成函数签名
 */
export type HashFunction = (data: Record<string, any>) => string

/**
 * 版本比较函数签名
 */
export type VersionCompareFunction = (v1: Version, v2: Version) => -1 | 0 | 1

/**
 * 冲突检测函数签名
 */
export type ConflictDetectionFunction = (
  serverData: Record<string, any>,
  clientData: Record<string, any>
) => Conflict | null

/**
 * 数据合并函数签名
 */
export type DataMergeFunction = (
  serverData: Record<string, any>,
  clientData: Record<string, any>
) => Record<string, any>
