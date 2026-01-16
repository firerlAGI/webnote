/**
 * T3项目冲突检测与解决服务
 * 负责检测和解决同步过程中的数据冲突
 */

import { PrismaClient } from '@prisma/client'
import { Logger } from 'pino'
import {
  Conflict,
  ConflictResolution,
  ConflictResolutionResult,
  ConflictType,
  ConflictResolutionStrategy,
  SyncOperation,
  SyncOperationType,
  EntityType
} from '@webnote/shared/types/sync'

// ============================================================================
// 冲突类型定义
// ============================================================================

/**
 * 扩展的冲突类型（支持更详细的冲突分类）
 */
export enum ExtendedConflictType {
  /** 并发更新冲突：两个客户端同时更新同一笔记 */
  CONCURRENT_UPDATE = 'concurrent_update',
  /** 删除-更新冲突：客户端A删除笔记，客户端B更新笔记 */
  DELETE_UPDATE = 'delete_update',
  /** 更新-删除冲突：客户端A更新笔记，客户端B删除笔记 */
  UPDATE_DELETE = 'update_delete',
  /** 重命名冲突：两个客户端重命名同一笔记 */
  RENAME_CONFLICT = 'rename_conflict',
  /** 文件夹移动冲突：两个客户端将同一笔记移到不同文件夹 */
  FOLDER_MOVE_CONFLICT = 'folder_move_conflict',
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
 * 冲突解决策略配置
 */
export interface ConflictResolutionStrategyConfig {
  /** 并发更新冲突解决策略 */
  concurrentUpdate: 'timestamp' | 'manual' | 'merge'
  /** 删除-更新冲突解决策略 */
  deleteUpdate: 'delete_wins' | 'update_wins' | 'manual'
  /** 更新-删除冲突解决策略 */
  updateDelete: 'timestamp' | 'manual'
  /** 重命名冲突解决策略 */
  renameConflict: 'append_suffix' | 'manual' | 'merge'
  /** 文件夹移动冲突解决策略 */
  folderMoveConflict: 'timestamp' | 'manual'
}

/**
 * 版本向量（用于检测并发更新）
 */
export interface VersionVector {
  /** 客户端ID到版本号的映射 */
  [clientId: string]: number
}

/**
 * 数据依赖关系
 */
export interface DataDependency {
  /** 依赖的实体ID */
  depends_on: number[]
  /** 被依赖的实体ID */
  depended_by: number[]
  /** 循环依赖标记 */
  has_cycle: boolean
}

/**
 * 冲突记录
 */
export interface ConflictRecord {
  /** 冲突ID */
  conflict_id: string
  /** 用户ID */
  user_id: number
  /** 冲突类型 */
  conflict_type: ExtendedConflictType
  /** 实体类型 */
  entity_type: EntityType
  /** 实体ID */
  entity_id: number
  /** 操作ID */
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
  /** 冲突状态 */
  status: 'unresolved' | 'resolved' | 'ignored'
  /** 冲突时间戳 */
  timestamp: string
  /** 解决时间 */
  resolved_at?: string
  /** 解决策略 */
  resolution_strategy?: ConflictResolutionStrategy
  /** 解决后的数据 */
  resolved_data?: Record<string, any>
}

// ============================================================================
// 冲突服务配置
// ============================================================================

/**
 * 冲突服务配置
 */
export interface ConflictServiceConfig {
  /** 最大冲突记录数 */
  maxConflictRecords: number
  /** 冲突记录保留天数 */
  conflictRetentionDays: number
  /** 冲突解决超时时间（毫秒） */
  resolutionTimeout: number
  /** 默认解决策略配置 */
  defaultResolutionConfig: ConflictResolutionStrategyConfig
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ConflictServiceConfig = {
  maxConflictRecords: 1000,
  conflictRetentionDays: 30,
  resolutionTimeout: 30000, // 30秒
  defaultResolutionConfig: {
    concurrentUpdate: 'timestamp',
    deleteUpdate: 'delete_wins',
    updateDelete: 'timestamp',
    renameConflict: 'append_suffix',
    folderMoveConflict: 'timestamp'
  }
}

// ============================================================================
// 冲突服务类
// ============================================================================

/**
 * 冲突检测与解决服务
 */
export class ConflictService {
  private prisma: PrismaClient
  private logger: Logger
  private config: ConflictServiceConfig
  private conflictRecords: Map<string, ConflictRecord>
  private versionVectors: Map<string, VersionVector>
  private dataDependencies: Map<string, DataDependency>

  constructor(prisma: PrismaClient, logger: Logger, config: Partial<ConflictServiceConfig> = {}) {
    this.prisma = prisma
    this.logger = logger
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.conflictRecords = new Map()
    this.versionVectors = new Map()
    this.dataDependencies = new Map()

    this.startConflictCleanup()
  }

  // ============================================================================
  // 冲突检测算法
  // ============================================================================

  /**
   * 检测冲突（主入口）
   */
  async detectConflict(
    userId: number,
    operation: SyncOperation,
    currentRecord: any | null
  ): Promise<ConflictRecord | null> {
    try {
      // 如果是创建操作，不需要检测冲突
      if (operation.operation_type === SyncOperationType.CREATE) {
        return null
      }

      // 如果记录不存在，检测删除冲突
      if (!currentRecord) {
        return this.detectDeleteConflict(userId, operation)
      }

      // 检测版本向量冲突
      const vectorConflict = await this.detectVersionVectorConflict(userId, operation, currentRecord)
      if (vectorConflict) {
        return vectorConflict
      }

      // 检测操作冲突
      const operationConflict = await this.detectOperationConflict(userId, operation, currentRecord)
      if (operationConflict) {
        return operationConflict
      }

      // 检测数据依赖冲突
      const dependencyConflict = await this.detectDependencyConflict(userId, operation, currentRecord)
      if (dependencyConflict) {
        return dependencyConflict
      }

      return null

    } catch (error) {
      this.logger.error({ error, operation_id: operation.operation_id }, 'Error detecting conflict')
      return null
    }
  }

  /**
   * 检测删除冲突
   */
  private detectDeleteConflict(userId: number, operation: SyncOperation): ConflictRecord | null {
    const conflictRecord: ConflictRecord = {
      conflict_id: this.generateId('conflict'),
      user_id: userId,
      conflict_type: ExtendedConflictType.DELETE_UPDATE,
      entity_type: operation.entity_type,
      entity_id: operation.entity_id || 0,
      operation_id: operation.operation_id,
      server_data: {
        version: 0,
        data: {},
        modified_at: new Date().toISOString(),
        modified_by: 0
      },
      client_data: {
        version: operation.before_version || 0,
        data: (operation as any).data || {},
        modified_at: operation.timestamp,
        operation_type: operation.operation_type
      },
      conflict_fields: [],
      suggested_strategy: this.getSuggestedStrategy(ExtendedConflictType.DELETE_UPDATE),
      status: 'unresolved',
      timestamp: new Date().toISOString()
    }

    this.saveConflictRecord(conflictRecord)
    this.logger.info({
      conflict_id: conflictRecord.conflict_id,
      operation_id: operation.operation_id
    }, 'Delete-update conflict detected')

    return conflictRecord
  }

  /**
   * 检测版本向量冲突
   */
  private async detectVersionVectorConflict(
    userId: number,
    operation: SyncOperation,
    currentRecord: any
  ): Promise<ConflictRecord | null> {
    const currentVersion = currentRecord.version || 1
    const clientVersion = operation.before_version || 0

    // 如果客户端版本小于当前版本，存在冲突
    if (clientVersion < currentVersion) {
      const conflictType = this.classifyConflictType(operation, currentRecord)

      const conflictRecord: ConflictRecord = {
        conflict_id: this.generateId('conflict'),
        user_id: userId,
        conflict_type: conflictType,
        entity_type: operation.entity_type,
        entity_id: operation.entity_id!,
        operation_id: operation.operation_id,
        server_data: {
          version: currentVersion,
          data: currentRecord,
          modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
          modified_by: currentRecord.user_id
        },
        client_data: {
          version: clientVersion,
          data: (operation as any).data || (operation as any).changes || {},
          modified_at: operation.timestamp,
          operation_type: operation.operation_type
        },
        conflict_fields: this.getConflictFields(currentRecord, (operation as any).data || {}),
        suggested_strategy: this.getSuggestedStrategy(conflictType),
        status: 'unresolved',
        timestamp: new Date().toISOString()
      }

      this.saveConflictRecord(conflictRecord)
      this.logger.info({
        conflict_id: conflictRecord.conflict_id,
        conflict_type: conflictType,
        operation_id: operation.operation_id
      }, 'Version vector conflict detected')

      return conflictRecord
    }

    return null
  }

  /**
   * 检测操作冲突
   */
  private async detectOperationConflict(
    userId: number,
    operation: SyncOperation,
    currentRecord: any
  ): Promise<ConflictRecord | null> {
    const operationType = operation.operation_type
    const changes = (operation as any).changes || {}

    // 检测更新-删除冲突
    if (operationType === SyncOperationType.UPDATE && currentRecord.deleted_at) {
      const conflictRecord: ConflictRecord = {
        conflict_id: this.generateId('conflict'),
        user_id: userId,
        conflict_type: ExtendedConflictType.UPDATE_DELETE,
        entity_type: operation.entity_type,
        entity_id: operation.entity_id!,
        operation_id: operation.operation_id,
        server_data: {
          version: currentRecord.version || 1,
          data: currentRecord,
          modified_at: currentRecord.deleted_at.toISOString(),
          modified_by: currentRecord.user_id
        },
        client_data: {
          version: operation.before_version || 0,
          data: changes || {},
          modified_at: operation.timestamp,
          operation_type: operation.operation_type
        },
        conflict_fields: [],
        suggested_strategy: this.getSuggestedStrategy(ExtendedConflictType.UPDATE_DELETE),
        status: 'unresolved',
        timestamp: new Date().toISOString()
      }

      this.saveConflictRecord(conflictRecord)
      this.logger.info({
        conflict_id: conflictRecord.conflict_id,
        operation_id: operation.operation_id
      }, 'Update-delete conflict detected')

      return conflictRecord
    }

    // 检测重命名冲突
    if (operationType === SyncOperationType.UPDATE) {
      if (changes.title && currentRecord.title !== changes.title) {
        // 检查是否有其他客户端也修改了标题
        const hasConcurrentTitleChange = await this.checkConcurrentFieldChange(
          userId,
          operation.entity_id!,
          'title'
        )

        if (hasConcurrentTitleChange) {
          const conflictRecord: ConflictRecord = {
            conflict_id: this.generateId('conflict'),
            user_id: userId,
            conflict_type: ExtendedConflictType.RENAME_CONFLICT,
            entity_type: operation.entity_type,
            entity_id: operation.entity_id!,
            operation_id: operation.operation_id,
            server_data: {
              version: currentRecord.version || 1,
              data: currentRecord,
              modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
              modified_by: currentRecord.user_id
            },
            client_data: {
              version: operation.before_version || 0,
              data: changes,
              modified_at: operation.timestamp,
              operation_type: operation.operation_type
            },
            conflict_fields: ['title'],
            suggested_strategy: this.getSuggestedStrategy(ExtendedConflictType.RENAME_CONFLICT),
            status: 'unresolved',
            timestamp: new Date().toISOString()
          }

          this.saveConflictRecord(conflictRecord)
          this.logger.info({
            conflict_id: conflictRecord.conflict_id,
            operation_id: operation.operation_id
          }, 'Rename conflict detected')

          return conflictRecord
        }
      }
    }

    // 检测文件夹移动冲突
    if (operationType === SyncOperationType.UPDATE && changes?.folder_id !== undefined) {
      const hasConcurrentFolderChange = await this.checkConcurrentFieldChange(
        userId,
        operation.entity_id!,
        'folder_id'
      )

      if (hasConcurrentFolderChange && currentRecord.folder_id !== changes.folder_id) {
        const conflictRecord: ConflictRecord = {
          conflict_id: this.generateId('conflict'),
          user_id: userId,
          conflict_type: ExtendedConflictType.FOLDER_MOVE_CONFLICT,
          entity_type: operation.entity_type,
          entity_id: operation.entity_id!,
          operation_id: operation.operation_id,
          server_data: {
            version: currentRecord.version || 1,
            data: currentRecord,
            modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
            modified_by: currentRecord.user_id
          },
          client_data: {
            version: operation.before_version || 0,
            data: changes,
            modified_at: operation.timestamp,
            operation_type: operation.operation_type
          },
          conflict_fields: ['folder_id'],
          suggested_strategy: this.getSuggestedStrategy(ExtendedConflictType.FOLDER_MOVE_CONFLICT),
          status: 'unresolved',
          timestamp: new Date().toISOString()
        }

        this.saveConflictRecord(conflictRecord)
        this.logger.info({
          conflict_id: conflictRecord.conflict_id,
          operation_id: operation.operation_id
        }, 'Folder move conflict detected')

        return conflictRecord
      }
    }

    return null
  }

  /**
   * 检测数据依赖冲突
   */
  private async detectDependencyConflict(
    userId: number,
    operation: SyncOperation,
    currentRecord: any
  ): Promise<ConflictRecord | null> {
    const entityKey = `${operation.entity_type}:${operation.entity_id}`

    // 获取数据依赖关系
    const dependency = await this.analyzeDataDependencies(userId, operation.entity_type, operation.entity_id!)

    // 检查是否存在循环依赖
    if (dependency.has_cycle) {
      const conflictRecord: ConflictRecord = {
        conflict_id: this.generateId('conflict'),
        user_id: userId,
        conflict_type: ExtendedConflictType.PARENT,
        entity_type: operation.entity_type,
        entity_id: operation.entity_id!,
        operation_id: operation.operation_id,
        server_data: {
          version: currentRecord.version || 1,
          data: currentRecord,
          modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
          modified_by: currentRecord.user_id
        },
        client_data: {
          version: operation.before_version || 0,
          data: (operation as any).data || {},
          modified_at: operation.timestamp,
          operation_type: operation.operation_type
        },
        conflict_fields: [],
        suggested_strategy: ConflictResolutionStrategy.MANUAL,
        status: 'unresolved',
        timestamp: new Date().toISOString()
      }

      this.saveConflictRecord(conflictRecord)
      this.logger.info({
        conflict_id: conflictRecord.conflict_id,
        operation_id: operation.operation_id
      }, 'Dependency conflict detected (circular dependency)')

      return conflictRecord
    }

    // 检查父记录是否存在
    if (dependency.depends_on.length > 0) {
      for (const parentId of dependency.depends_on) {
        const parentExists = await this.checkRecordExists(operation.entity_type, parentId, userId)
        if (!parentExists) {
          const conflictRecord: ConflictRecord = {
            conflict_id: this.generateId('conflict'),
            user_id: userId,
            conflict_type: ExtendedConflictType.PARENT,
            entity_type: operation.entity_type,
            entity_id: operation.entity_id!,
            operation_id: operation.operation_id,
            server_data: {
              version: currentRecord.version || 1,
              data: currentRecord,
              modified_at: currentRecord.updated_at?.toISOString() || new Date().toISOString(),
              modified_by: currentRecord.user_id
            },
            client_data: {
              version: operation.before_version || 0,
              data: (operation as any).data || {},
              modified_at: operation.timestamp,
              operation_type: operation.operation_type
            },
            conflict_fields: ['parent_id'],
            suggested_strategy: ConflictResolutionStrategy.MANUAL,
            status: 'unresolved',
            timestamp: new Date().toISOString()
          }

          this.saveConflictRecord(conflictRecord)
          this.logger.info({
            conflict_id: conflictRecord.conflict_id,
            parent_id: parentId,
            operation_id: operation.operation_id
          }, 'Dependency conflict detected (parent missing)')

          return conflictRecord
        }
      }
    }

    return null
  }

  // ============================================================================
  // 冲突解决策略
  // ============================================================================

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflict: ConflictRecord,
    resolution: ConflictResolution,
    userId: number
  ): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: false
    }

    try {
      const strategy = resolution.strategy || this.config.defaultResolutionConfig.concurrentUpdate

      switch (strategy) {
        case ConflictResolutionStrategy.SERVER_WINS:
          result.success = true
          result.resolved_data = conflict.server_data.data
          result.new_version = conflict.server_data.version
          break

        case ConflictResolutionStrategy.CLIENT_WINS:
          result.success = true
          result.resolved_data = conflict.client_data.data
          result.new_version = conflict.server_data.version + 1
          break

        case ConflictResolutionStrategy.LATEST_WINS: {
          const timestampResult = await this.resolveByTimestamp(conflict)
          Object.assign(result, timestampResult)
          break
        }

        case ConflictResolutionStrategy.MERGE: {
          const mergeResult = await this.resolveByMerge(conflict)
          Object.assign(result, mergeResult)
          break
        }

        case ConflictResolutionStrategy.MANUAL:
          result.success = false
          result.error = 'Manual resolution required'
          break

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`)
      }

      // 更新冲突记录状态
      if (result.success && strategy) {
        await this.updateConflictStatus(conflict.conflict_id, 'resolved', strategy as ConflictResolutionStrategy, result.resolved_data)
      }

      return result

    } catch (error) {
      result.error = (error as Error).message
      return result
    }
  }

  /**
   * 基于时间戳解决冲突
   */
  private async resolveByTimestamp(conflict: ConflictRecord): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: false
    }

    const serverTime = new Date(conflict.server_data.modified_at).getTime()
    const clientTime = new Date(conflict.client_data.modified_at).getTime()

    if (clientTime >= serverTime) {
      result.resolved_data = conflict.client_data.data
      result.new_version = conflict.server_data.version + 1
    } else {
      result.resolved_data = conflict.server_data.data
      result.new_version = conflict.server_data.version
    }
    result.success = true

    return result
  }

  /**
   * 基于优先级解决冲突
   */
  private async resolveByPriority(conflict: ConflictRecord): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: false
    }

    // 根据操作类型决定优先级
    const operationPriority: Partial<Record<SyncOperationType, number>> = {
      [SyncOperationType.DELETE]: 3, // 删除操作优先级最高
      [SyncOperationType.CREATE]: 2,
      [SyncOperationType.UPDATE]: 1,
      [SyncOperationType.READ]: 0,
      [SyncOperationType.RESOLVE]: 0.5 // 冲突解决操作优先级
    }

    const serverPriority = operationPriority[SyncOperationType.UPDATE]
    const clientPriority = operationPriority[conflict.client_data.operation_type]

    if (clientPriority > serverPriority) {
      result.resolved_data = conflict.client_data.data
      result.new_version = conflict.server_data.version + 1
    } else if (serverPriority > clientPriority) {
      result.resolved_data = conflict.server_data.data
      result.new_version = conflict.server_data.version
    } else {
      // 优先级相同，使用时间戳
      return await this.resolveByTimestamp(conflict)
    }
    result.success = true

    return result
  }

  /**
   * 基于操作类型解决冲突
   */
  private async resolveByOperationType(
    conflict: ConflictRecord,
    config: ConflictResolutionStrategyConfig
  ): Promise<ConflictResolutionResult> {
    let result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: false
    }

    switch (conflict.conflict_type) {
      case ExtendedConflictType.DELETE_UPDATE:
        if (config.deleteUpdate === 'delete_wins') {
          result.resolved_data = conflict.server_data.data
          result.new_version = conflict.server_data.version
        } else if (config.deleteUpdate === 'update_wins') {
          result.resolved_data = conflict.client_data.data
          result.new_version = conflict.server_data.version + 1
        } else {
          // manual
          result.success = false
          result.error = 'Manual resolution required'
          return result
        }
        break

      case ExtendedConflictType.UPDATE_DELETE:
        if (config.updateDelete === 'timestamp') {
          return await this.resolveByTimestamp(conflict)
        } else {
          // manual
          result.success = false
          result.error = 'Manual resolution required'
          return result
        }

      case ExtendedConflictType.RENAME_CONFLICT:
        if (config.renameConflict === 'append_suffix') {
          result.resolved_data = this.appendSuffix(conflict)
          result.new_version = conflict.server_data.version + 1
        } else if (config.renameConflict === 'merge') {
          return await this.resolveByMerge(conflict)
        } else {
          // manual
          result.success = false
          result.error = 'Manual resolution required'
          return result
        }
        break

      case ExtendedConflictType.FOLDER_MOVE_CONFLICT:
        if (config.folderMoveConflict === 'timestamp') {
          return await this.resolveByTimestamp(conflict)
        } else {
          // manual
          result.success = false
          result.error = 'Manual resolution required'
          return result
        }

      default:
        // 默认使用时间戳
        return await this.resolveByTimestamp(conflict)
    }

    result.success = true
    return result
  }

  /**
   * 基于合并解决冲突
   */
  private async resolveByMerge(conflict: ConflictRecord): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflict_id: conflict.conflict_id,
      success: true
    }

    result.resolved_data = this.mergeData(conflict.server_data.data, conflict.client_data.data)
    result.new_version = conflict.server_data.version + 1

    return result
  }

  /**
   * 手动解决冲突
   */
  async resolveManually(
    conflictId: string,
    resolvedData: Record<string, any>,
    userId: number
  ): Promise<ConflictResolutionResult> {
    const conflict = this.conflictRecords.get(conflictId)
    if (!conflict || conflict.user_id !== userId) {
      throw new Error('Conflict not found')
    }

    const result: ConflictResolutionResult = {
      conflict_id: conflictId,
      success: true,
      resolved_data: resolvedData,
      new_version: conflict.server_data.version + 1
    }

    await this.updateConflictStatus(conflictId, 'resolved', ConflictResolutionStrategy.MANUAL, resolvedData)

    return result
  }

  // ============================================================================
  // 冲突API接口
  // ============================================================================

  /**
   * 获取冲突列表
   */
  async getConflicts(
    userId: number,
    status: 'all' | 'unresolved' | 'resolved' = 'unresolved',
    limit: number = 100,
    offset: number = 0
  ): Promise<{ conflicts: ConflictRecord[]; total: number }> {
    const conflicts: ConflictRecord[] = []

    for (const [_, conflict] of this.conflictRecords) {
      if (conflict.user_id !== userId) continue
      if (status !== 'all' && conflict.status !== status) continue

      conflicts.push(conflict)
    }

    // 按时间戳倒序排序
    conflicts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const total = conflicts.length
    const paginatedConflicts = conflicts.slice(offset, offset + limit)

    return {
      conflicts: paginatedConflicts,
      total
    }
  }

  /**
   * 获取冲突详情
   */
  async getConflict(conflictId: string, userId: number): Promise<ConflictRecord | null> {
    const conflict = this.conflictRecords.get(conflictId)
    if (conflict && conflict.user_id === userId) {
      return conflict
    }
    return null
  }

  /**
   * 忽略冲突
   */
  async ignoreConflict(conflictId: string, userId: number): Promise<boolean> {
    const conflict = this.conflictRecords.get(conflictId)
    if (!conflict || conflict.user_id !== userId) {
      return false
    }

    await this.updateConflictStatus(conflictId, 'ignored')
    return true
  }

  /**
   * 获取冲突统计
   */
  async getConflictStats(userId: number): Promise<{
    total: number
    unresolved: number
    resolved: number
    ignored: number
    by_type: Record<string, number>
  }> {
    const stats = {
      total: 0,
      unresolved: 0,
      resolved: 0,
      ignored: 0,
      by_type: {} as Record<string, number>
    }

    for (const [_, conflict] of this.conflictRecords) {
      if (conflict.user_id !== userId) continue

      stats.total++
      stats[conflict.status]++

      const typeKey = conflict.conflict_type
      stats.by_type[typeKey] = (stats.by_type[typeKey] || 0) + 1
    }

    return stats
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 分类冲突类型
   */
  private classifyConflictType(operation: SyncOperation, currentRecord: any): ExtendedConflictType {
    if (operation.operation_type === SyncOperationType.DELETE && currentRecord.deleted_at) {
      return ExtendedConflictType.DELETE_UPDATE
    }

    const changes = (operation as any).changes || {}

    if (changes.title !== undefined && currentRecord.title !== changes.title) {
      return ExtendedConflictType.RENAME_CONFLICT
    }

    if (changes.folder_id !== undefined && currentRecord.folder_id !== changes.folder_id) {
      return ExtendedConflictType.FOLDER_MOVE_CONFLICT
    }

    return ExtendedConflictType.CONCURRENT_UPDATE
  }

  /**
   * 获取推荐的解决策略
   */
  private getSuggestedStrategy(conflictType: ExtendedConflictType): ConflictResolutionStrategy {
    const config = this.config.defaultResolutionConfig

    switch (conflictType) {
      case ExtendedConflictType.CONCURRENT_UPDATE:
        if (config.concurrentUpdate === 'timestamp') {
          return ConflictResolutionStrategy.LATEST_WINS
        } else if (config.concurrentUpdate === 'merge') {
          return ConflictResolutionStrategy.MERGE
        } else {
          return ConflictResolutionStrategy.MANUAL
        }

      case ExtendedConflictType.DELETE_UPDATE:
        if (config.deleteUpdate === 'delete_wins') {
          return ConflictResolutionStrategy.SERVER_WINS
        } else if (config.deleteUpdate === 'update_wins') {
          return ConflictResolutionStrategy.CLIENT_WINS
        } else {
          return ConflictResolutionStrategy.MANUAL
        }

      case ExtendedConflictType.UPDATE_DELETE:
        if (config.updateDelete === 'timestamp') {
          return ConflictResolutionStrategy.LATEST_WINS
        } else {
          return ConflictResolutionStrategy.MANUAL
        }

      case ExtendedConflictType.RENAME_CONFLICT:
        if (config.renameConflict === 'merge') {
          return ConflictResolutionStrategy.MERGE
        } else if (config.renameConflict === 'append_suffix') {
          return ConflictResolutionStrategy.LATEST_WINS
        } else {
          return ConflictResolutionStrategy.MANUAL
        }

      case ExtendedConflictType.FOLDER_MOVE_CONFLICT:
        if (config.folderMoveConflict === 'timestamp') {
          return ConflictResolutionStrategy.LATEST_WINS
        } else {
          return ConflictResolutionStrategy.MANUAL
        }

      default:
        return ConflictResolutionStrategy.LATEST_WINS
    }
  }

  /**
   * 获取冲突字段
   */
  private getConflictFields(serverData: any, clientData: any): string[] {
    const conflictFields: string[] = []

    const serverKeys = Object.keys(serverData)
    const clientKeys = Object.keys(clientData)

    // 检查修改的字段
    for (const key of clientKeys) {
      if (serverKeys.includes(key)) {
        if (JSON.stringify(serverData[key]) !== JSON.stringify(clientData[key])) {
          conflictFields.push(key)
        }
      } else {
        // 客户端添加的字段
        conflictFields.push(key)
      }
    }

    return conflictFields
  }

  /**
   * 合并数据
   */
  private mergeData(serverData: any, clientData: any): any {
    const merged: any = { ...serverData }

    for (const key in clientData) {
      if (!merged[key] || JSON.stringify(merged[key]) !== JSON.stringify(clientData[key])) {
        merged[key] = clientData[key]
      }
    }

    return merged
  }

  /**
   * 添加后缀（用于重命名冲突）
   */
  private appendSuffix(conflict: ConflictRecord): Record<string, any> {
    const resolvedData = { ...conflict.client_data.data }

    if (resolvedData.title && typeof resolvedData.title === 'string') {
      const timestamp = new Date().getTime()
      resolvedData.title = `${resolvedData.title} (${timestamp})`
    }

    return resolvedData
  }

  /**
   * 检查并发字段变更
   */
  private async checkConcurrentFieldChange(
    userId: number,
    entityId: number,
    fieldName: string
  ): Promise<boolean> {
    // 在实际实现中，这里应该检查是否有其他客户端也修改了同一字段
    // 目前简化处理，返回false表示没有并发变更
    return false
  }

  /**
   * 分析数据依赖关系
   */
  private async analyzeDataDependencies(
    userId: number,
    entityType: EntityType,
    entityId: number
  ): Promise<DataDependency> {
    const dependency: DataDependency = {
      depends_on: [],
      depended_by: [],
      has_cycle: false
    }

    try {
      let record: any = null

      switch (entityType) {
        case 'note':
          record = await this.prisma.note.findFirst({
            where: { id: entityId, user_id: userId }
          })
          if (record?.folder_id) {
            dependency.depends_on.push(record.folder_id)
          }
          break

        case 'folder':
          record = await this.prisma.folder.findFirst({
            where: { id: entityId, user_id: userId }
          })
          if (record?.parent_id) {
            dependency.depends_on.push(record.parent_id)
          }
          break

        case 'review':
          record = await this.prisma.review.findFirst({
            where: { id: entityId, user_id: userId }
          })
          break
      }

      // 检查循环依赖
      if (dependency.depends_on.length > 0) {
        dependency.has_cycle = await this.checkCircularDependency(
          userId,
          entityType,
          entityId,
          new Set()
        )
      }

    } catch (error) {
      this.logger.error({ error, entityType, entityId }, 'Error analyzing data dependencies')
    }

    return dependency
  }

  /**
   * 检查循环依赖
   */
  private async checkCircularDependency(
    userId: number,
    entityType: EntityType,
    entityId: number,
    visited: Set<number>
  ): Promise<boolean> {
    if (visited.has(entityId)) {
      return true
    }

    visited.add(entityId)

    try {
      let record: any = null
      let parentId: number | null = null

      switch (entityType) {
        case 'note':
          record = await this.prisma.note.findFirst({
            where: { id: entityId, user_id: userId }
          })
          parentId = record?.folder_id || null
          break

        case 'folder':
          record = await this.prisma.folder.findFirst({
            where: { id: entityId, user_id: userId }
          })
          parentId = record?.parent_id || null
          break
      }

      if (parentId && parentId !== entityId) {
        return await this.checkCircularDependency(userId, entityType, parentId, visited)
      }

    } catch (error) {
      this.logger.error({ error, entityType, entityId }, 'Error checking circular dependency')
    }

    return false
  }

  /**
   * 检查记录是否存在
   */
  private async checkRecordExists(entityType: EntityType, entityId: number, userId: number): Promise<boolean> {
    try {
      switch (entityType) {
        case 'note':
          const note = await this.prisma.note.findFirst({
            where: { id: entityId, user_id: userId }
          })
          return !!note

        case 'folder':
          const folder = await this.prisma.folder.findFirst({
            where: { id: entityId, user_id: userId }
          })
          return !!folder

        case 'review':
          const review = await this.prisma.review.findFirst({
            where: { id: entityId, user_id: userId }
          })
          return !!review

        default:
          return false
      }
    } catch (error) {
      this.logger.error({ error, entityType, entityId }, 'Error checking record existence')
      return false
    }
  }

  /**
   * 保存冲突记录
   */
  private saveConflictRecord(conflict: ConflictRecord): void {
    this.conflictRecords.set(conflict.conflict_id, conflict)

    // 检查是否超过最大记录数
    if (this.conflictRecords.size > this.config.maxConflictRecords) {
      this.cleanupOldConflictRecords()
    }
  }

  /**
   * 更新冲突状态
   */
  private async updateConflictStatus(
    conflictId: string,
    status: 'resolved' | 'ignored',
    strategy?: ConflictResolutionStrategy,
    resolvedData?: Record<string, any>
  ): Promise<void> {
    const conflict = this.conflictRecords.get(conflictId)
    if (!conflict) return

    conflict.status = status
    conflict.resolved_at = new Date().toISOString()
    if (strategy) {
      conflict.resolution_strategy = strategy
    }
    if (resolvedData) {
      conflict.resolved_data = resolvedData
    }
  }

  /**
   * 清理旧的冲突记录
   */
  private cleanupOldConflictRecords(): void {
    const now = Date.now()
    const retentionMs = this.config.conflictRetentionDays * 24 * 60 * 60 * 1000

    for (const [id, conflict] of this.conflictRecords) {
      const conflictTime = new Date(conflict.timestamp).getTime()
      if (now - conflictTime > retentionMs) {
        this.conflictRecords.delete(id)
      }
    }
  }

  /**
   * 启动冲突清理定时器
   */
  private startConflictCleanup(): void {
    // 每小时清理一次旧记录
    setInterval(() => {
      this.cleanupOldConflictRecords()
    }, 60 * 60 * 1000)
  }

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    return `${prefix}_${timestamp}_${random}`
  }
}
