/**
 * Cache Consistency Manager
 * Handles synchronization between local cache and server data
 */

import type { Note, Folder, Review } from '@webnote/shared'
import { CacheService } from './CacheService'
import type {
  CachedNote,
  CachedFolder,
  CachedReview,
  SyncQueueItem
} from './types'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Base interface for cached entities
 */
export interface CachedEntity {
  id: number
  user_id: number
  updated_at: string
  _cachedAt: number
  _dirty: boolean
}

/**
 * Base interface for server entities
 */
export interface ServerEntity {
  id: number
  user_id: number
  updated_at: string
}

/**
 * Result of version comparison between local and server data
 */
export interface VersionComparison {
  /** Local version number */
  localVersion: number
  /** Server version number */
  serverVersion: number
  /** Local last update timestamp */
  localUpdatedAt: string
  /** Server last update timestamp */
  serverUpdatedAt: string
  /** Whether local data needs update from server */
  needsUpdate: boolean
  /** Whether there is a conflict between versions */
  conflict: boolean
}

/**
 * Result of a merge operation
 */
export interface MergeResult<T> {
  /** Newly created items */
  created: T[]
  /** Updated items */
  updated: T[]
  /** Deleted items */
  deleted: T[]
  /** Conflicts that need resolution */
  conflicts: ConflictInfo[]
}

/**
 * Information about a detected conflict
 */
export interface ConflictInfo {
  /** Type of entity */
  entityType: 'note' | 'folder' | 'review'
  /** Entity ID */
  entityId: number
  /** Local data snapshot */
  localData: Record<string, unknown>
  /** Server data snapshot */
  serverData: Record<string, unknown>
  /** Fields that have conflicting values */
  conflictFields: string[]
  /** Suggested resolution strategy */
  suggestedResolution: 'local' | 'server' | 'merge'
}

/**
 * Result of conflict resolution
 */
export interface ResolvedEntity {
  /** Entity type */
  entityType: 'note' | 'folder' | 'review'
  /** Resolved data */
  data: CachedNote | CachedFolder | CachedReview
  /** Resolution strategy used */
  strategy: 'local' | 'server' | 'merge'
}

/**
 * Current sync state
 */
export interface SyncState {
  /** Last successful sync time */
  lastSyncTime: string | null
  /** Number of pending changes in queue */
  pendingChanges: number
  /** Current unresolved conflicts */
  conflicts: ConflictInfo[]
}

/**
 * Local cache data bundle
 */
export interface LocalCacheData {
  notes: CachedNote[]
  folders: CachedFolder[]
  reviews: CachedReview[]
}

/**
 * Server data bundle
 */
export interface ServerData {
  notes: Note[]
  folders: Folder[]
  reviews: Review[]
}

/**
 * Result of a full sync operation
 */
export interface SyncResult {
  /** Merge result for notes */
  notes: MergeResult<CachedNote>
  /** Merge result for folders */
  folders: MergeResult<CachedFolder>
  /** Merge result for reviews */
  reviews: MergeResult<CachedReview>
  /** Total number of changes */
  totalChanges: number
  /** Total number of conflicts */
  totalConflicts: number
}

// ============================================================================
// Cache Consistency Error
// ============================================================================

/**
 * Error class for cache consistency operations
 */
export class CacheConsistencyError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'CacheConsistencyError'
  }
}

// ============================================================================
// Cache Consistency Manager Class
// ============================================================================

/**
 * Manages cache consistency between local storage and server
 *
 * Features:
 * - Version comparison and conflict detection
 * - Incremental merge operations
 * - Multiple conflict resolution strategies
 * - Content hash computation
 * - Sync state tracking
 *
 * @example
 * ```typescript
 * const consistencyManager = CacheConsistency.getInstance()
 *
 * // Compare versions
 * const comparison = consistencyManager.compareVersions(localNote, serverNote)
 *
 * // Merge notes
 * const result = consistencyManager.mergeNotes(localNotes, serverNotes)
 *
 * // Resolve conflicts
 * if (result.conflicts.length > 0) {
 *   const resolved = consistencyManager.autoResolve(result.conflicts[0])
 * }
 * ```
 */
export class CacheConsistency {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private static instance: CacheConsistency | null = null
  private cacheService: CacheService
  private currentConflicts: ConflictInfo[] = []

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.cacheService = CacheService.getInstance()
  }

  // ============================================================================
  // Public Static Methods
  // ============================================================================

  /**
   * Get the singleton instance of CacheConsistency
   * @returns CacheConsistency instance
   */
  static getInstance(): CacheConsistency {
    if (!CacheConsistency.instance) {
      CacheConsistency.instance = new CacheConsistency()
    }
    return CacheConsistency.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    CacheConsistency.instance = null
  }

  // ============================================================================
  // Version Comparison
  // ============================================================================

  /**
   * Compare versions between local and server entities
   * @param local - Local cached entity
   * @param server - Server entity
   * @returns Version comparison result
   */
  compareVersions(local: CachedEntity, server: ServerEntity): VersionComparison {
    const localVersion = this.extractVersion(local)
    const serverVersion = this.extractVersion(server)
    const localUpdatedAt = local.updated_at
    const serverUpdatedAt = server.updated_at

    // Check if there is a conflict (both modified)
    const conflict = local._dirty && localUpdatedAt !== serverUpdatedAt

    // Check if local needs update from server
    const needsUpdate = !local._dirty && (
      serverVersion > localVersion ||
      new Date(serverUpdatedAt) > new Date(localUpdatedAt)
    )

    return {
      localVersion,
      serverVersion,
      localUpdatedAt,
      serverUpdatedAt,
      needsUpdate,
      conflict
    }
  }

  /**
   * Extract version number from entity
   * @param entity - Entity to extract version from
   * @returns Version number
   */
  private extractVersion(entity: CachedEntity | ServerEntity): number {
    if ('version' in entity && typeof entity.version === 'number') {
      return entity.version
    }
    // Use timestamp as version fallback
    return new Date(entity.updated_at).getTime()
  }

  // ============================================================================
  // Merge Operations
  // ============================================================================

  /**
   * Merge local and server notes
   * @param local - Local cached notes
   * @param server - Server notes
   * @returns Merge result
   */
  mergeNotes(local: CachedNote[], server: Note[]): MergeResult<CachedNote> {
    return this.mergeEntities(
      local,
      server,
      'note',
      this.convertServerNoteToCached.bind(this),
      this.getNoteComparisonFields()
    )
  }

  /**
   * Merge local and server folders
   * @param local - Local cached folders
   * @param server - Server folders
   * @returns Merge result
   */
  mergeFolders(local: CachedFolder[], server: Folder[]): MergeResult<CachedFolder> {
    return this.mergeEntities(
      local,
      server,
      'folder',
      this.convertServerFolderToCached.bind(this),
      this.getFolderComparisonFields()
    )
  }

  /**
   * Merge local and server reviews
   * @param local - Local cached reviews
   * @param server - Server reviews
   * @returns Merge result
   */
  mergeReviews(local: CachedReview[], server: Review[]): MergeResult<CachedReview> {
    return this.mergeEntities(
      local,
      server,
      'review',
      this.convertServerReviewToCached.bind(this),
      this.getReviewComparisonFields()
    )
  }

  /**
   * Generic merge operation for entities
   */
  private mergeEntities<T extends CachedEntity, S extends ServerEntity>(
    local: T[],
    server: S[],
    entityType: 'note' | 'folder' | 'review',
    converter: (server: S, existing?: T) => T,
    comparisonFields: string[]
  ): MergeResult<T> {
    const result: MergeResult<T> = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: []
    }

    const localMap = new Map(local.map(item => [item.id, item]))
    const serverMap = new Map(server.map(item => [item.id, item]))

    // Find created items (server has, local doesn't)
    for (const serverItem of server) {
      if (!localMap.has(serverItem.id)) {
        result.created.push(converter(serverItem))
      }
    }

    // Find deleted items (local has, server doesn't)
    for (const localItem of local) {
      if (!serverMap.has(localItem.id)) {
        // Only delete if not dirty (not locally modified)
        if (!localItem._dirty) {
          result.deleted.push(localItem)
        }
      }
    }

    // Find updated items and conflicts
    for (const serverItem of server) {
      const localItem = localMap.get(serverItem.id)
      if (localItem) {
        const comparison = this.compareVersions(localItem, serverItem)

        if (comparison.conflict) {
          // Detect specific conflict
          const conflict = this.detectConflict(
            localItem,
            serverItem,
            entityType,
            comparisonFields
          )
          if (conflict) {
            result.conflicts.push(conflict)
            this.currentConflicts.push(conflict)
          }
        } else if (comparison.needsUpdate) {
          // Server has newer version, update local
          result.updated.push(converter(serverItem, localItem))
        }
      }
    }

    return result
  }

  // ============================================================================
  // Conflict Detection
  // ============================================================================

  /**
   * Detect conflict between local and server entities
   * @param local - Local cached entity
   * @param server - Server entity
   * @param entityType - Type of entity
   * @param comparisonFields - Fields to compare
   * @returns Conflict info or null if no conflict
   */
  detectConflict(
    local: CachedEntity,
    server: ServerEntity,
    entityType: 'note' | 'folder' | 'review',
    comparisonFields: string[]
  ): ConflictInfo | null {
    const conflictFields: string[] = []

    for (const field of comparisonFields) {
      const localValue = (local as Record<string, unknown>)[field]
      const serverValue = (server as Record<string, unknown>)[field]

      if (!this.areValuesEqual(localValue, serverValue)) {
        conflictFields.push(field)
      }
    }

    if (conflictFields.length === 0) {
      return null
    }

    // Determine suggested resolution
    const suggestedResolution = this.suggestResolution(local, server)

    return {
      entityType,
      entityId: local.id,
      localData: { ...local } as Record<string, unknown>,
      serverData: { ...server } as Record<string, unknown>,
      conflictFields,
      suggestedResolution
    }
  }

  /**
   * Check if two values are equal
   */
  private areValuesEqual(a: unknown, b: unknown): boolean {
    // Handle null/undefined
    if (a == null && b == null) return true
    if (a == null || b == null) return false

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, idx) => this.areValuesEqual(val, b[idx]))
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>
      const bObj = b as Record<string, unknown>
      const aKeys = Object.keys(aObj)
      const bKeys = Object.keys(bObj)
      if (aKeys.length !== bKeys.length) return false
      return aKeys.every(key => this.areValuesEqual(aObj[key], bObj[key]))
    }

    // Handle primitives
    return a === b
  }

  /**
   * Suggest resolution strategy based on entity state
   */
  private suggestResolution(local: CachedEntity, server: ServerEntity): 'local' | 'server' | 'merge' {
    const localTime = new Date(local.updated_at).getTime()
    const serverTime = new Date(server.updated_at).getTime()

    // If server is significantly newer, prefer server
    if (serverTime > localTime + 60000) { // 1 minute tolerance
      return 'server'
    }

    // If local is significantly newer, prefer local
    if (localTime > serverTime + 60000) {
      return 'local'
    }

    // Otherwise, suggest merge
    return 'merge'
  }

  // ============================================================================
  // Conflict Resolution
  // ============================================================================

  /**
   * Resolve a conflict using specified strategy
   * @param conflict - Conflict to resolve
   * @param strategy - Resolution strategy
   * @returns Resolved entity
   */
  resolveConflict(
    conflict: ConflictInfo,
    strategy: 'local' | 'server' | 'merge'
  ): ResolvedEntity {
    let resolvedData: CachedNote | CachedFolder | CachedReview

    switch (strategy) {
      case 'local':
        resolvedData = this.createResolvedEntity(conflict, conflict.localData)
        break
      case 'server':
        resolvedData = this.createResolvedEntity(conflict, conflict.serverData)
        break
      case 'merge':
        resolvedData = this.mergeEntityData(conflict)
        break
      default:
        throw new CacheConsistencyError(
          `Unknown resolution strategy: ${strategy}`,
          'UNKNOWN_STRATEGY'
        )
    }

    // Remove from current conflicts
    this.currentConflicts = this.currentConflicts.filter(
      c => c.entityId !== conflict.entityId || c.entityType !== conflict.entityType
    )

    return {
      entityType: conflict.entityType,
      data: resolvedData,
      strategy
    }
  }

  /**
   * Auto-resolve conflict using "latest wins" strategy
   * @param conflict - Conflict to resolve
   * @returns Resolved entity
   */
  autoResolve(conflict: ConflictInfo): ResolvedEntity {
    const localTime = new Date(conflict.localData.updated_at as string).getTime()
    const serverTime = new Date(conflict.serverData.updated_at as string).getTime()

    // Use the latest version
    const strategy = serverTime >= localTime ? 'server' : 'local'
    return this.resolveConflict(conflict, strategy)
  }

  /**
   * Create resolved entity from data
   */
  private createResolvedEntity(
    conflict: ConflictInfo,
    data: Record<string, unknown>
  ): CachedNote | CachedFolder | CachedReview {
    const now = Date.now()

    const baseEntity = {
      ...data,
      _cachedAt: now,
      _dirty: false
    }

    switch (conflict.entityType) {
      case 'note':
        return baseEntity as CachedNote
      case 'folder':
        return baseEntity as CachedFolder
      case 'review':
        return baseEntity as CachedReview
      default:
        throw new CacheConsistencyError(
          `Unknown entity type: ${conflict.entityType}`,
          'UNKNOWN_ENTITY_TYPE'
        )
    }
  }

  /**
   * Merge entity data from local and server
   */
  private mergeEntityData(conflict: ConflictInfo): CachedNote | CachedFolder | CachedReview {
    const merged: Record<string, unknown> = {}
    const allFields = new Set([
      ...Object.keys(conflict.localData),
      ...Object.keys(conflict.serverData)
    ])

    for (const field of allFields) {
      if (field.startsWith('_')) {
        // Skip internal fields
        continue
      }

      const localValue = conflict.localData[field]
      const serverValue = conflict.serverData[field]

      // For conflicting fields, prefer non-null or more recent
      if (conflict.conflictFields.includes(field)) {
        merged[field] = this.mergeFieldValue(localValue, serverValue)
      } else {
        // Use whichever has the value
        merged[field] = localValue !== undefined ? localValue : serverValue
      }
    }

    // Add metadata
    merged._cachedAt = Date.now()
    merged._dirty = false

    return this.createResolvedEntity(conflict, merged)
  }

  /**
   * Merge individual field values
   */
  private mergeFieldValue(localValue: unknown, serverValue: unknown): unknown {
    // Prefer non-null values
    if (localValue == null && serverValue != null) return serverValue
    if (serverValue == null && localValue != null) return localValue

    // For arrays, merge unique values
    if (Array.isArray(localValue) && Array.isArray(serverValue)) {
      return [...new Set([...localValue, ...serverValue])]
    }

    // For strings, prefer longer content
    if (typeof localValue === 'string' && typeof serverValue === 'string') {
      return localValue.length >= serverValue.length ? localValue : serverValue
    }

    // Default to server value
    return serverValue
  }

  // ============================================================================
  // Content Hash
  // ============================================================================

  /**
   * Compute hash for data content
   * Uses a simple but effective hash algorithm
   * @param data - Data to hash
   * @returns Hash string
   */
  computeHash(data: unknown): string {
    const str = JSON.stringify(data, Object.keys(data as object).sort())

    // Simple hash implementation (djb2 algorithm)
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i)
    }

    // Convert to hex string
    return (hash >>> 0).toString(16).padStart(8, '0')
  }

  /**
   * Check if content has changed between local and server
   * @param local - Local cached entity
   * @param server - Server entity
   * @returns Whether content has changed
   */
  hasContentChanged(local: CachedEntity, server: ServerEntity): boolean {
    const localHash = this.computeHash(this.getContentData(local))
    const serverHash = this.computeHash(this.getContentData(server))

    return localHash !== serverHash
  }

  /**
   * Extract content data for hash computation
   */
  private getContentData(entity: CachedEntity | ServerEntity): Record<string, unknown> {
    const content: Record<string, unknown> = {}
    const excludeFields = ['_cachedAt', '_dirty', 'created_at', 'updated_at']

    for (const [key, value] of Object.entries(entity)) {
      if (!excludeFields.includes(key) && !key.startsWith('_')) {
        content[key] = value
      }
    }

    return content
  }

  // ============================================================================
  // Sync State
  // ============================================================================

  /**
   * Get current sync state
   * @returns Promise resolving to sync state
   */
  async getSyncState(): Promise<SyncState> {
    const lastSyncTime = await this.cacheService.getLastSyncTime()

    // Get pending queue items count
    const userId = await this.getCurrentUserId()
    const pendingItems: SyncQueueItem[] = userId
      ? await this.cacheService.getQueue(userId, 'pending')
      : []

    return {
      lastSyncTime,
      pendingChanges: pendingItems.length,
      conflicts: [...this.currentConflicts]
    }
  }

  /**
   * Get current user ID from cache metadata
   */
  private async getCurrentUserId(): Promise<number | null> {
    try {
      const metadata = await this.cacheService.getMetadata('userId')
      return metadata ? (metadata.value as number) : null
    } catch {
      return null
    }
  }

  // ============================================================================
  // Full Sync
  // ============================================================================

  /**
   * Perform full synchronization between local and server data
   * @param localData - Local cache data bundle
   * @param serverData - Server data bundle
   * @returns Sync result
   */
  performFullSync(localData: LocalCacheData, serverData: ServerData): SyncResult {
    // Reset current conflicts
    this.currentConflicts = []

    // Merge each entity type
    const notesResult = this.mergeNotes(localData.notes, serverData.notes)
    const foldersResult = this.mergeFolders(localData.folders, serverData.folders)
    const reviewsResult = this.mergeReviews(localData.reviews, serverData.reviews)

    // Calculate totals
    const totalChanges =
      notesResult.created.length +
      notesResult.updated.length +
      notesResult.deleted.length +
      foldersResult.created.length +
      foldersResult.updated.length +
      foldersResult.deleted.length +
      reviewsResult.created.length +
      reviewsResult.updated.length +
      reviewsResult.deleted.length

    const totalConflicts =
      notesResult.conflicts.length +
      foldersResult.conflicts.length +
      reviewsResult.conflicts.length

    return {
      notes: notesResult,
      folders: foldersResult,
      reviews: reviewsResult,
      totalChanges,
      totalConflicts
    }
  }

  // ============================================================================
  // Entity Converters
  // ============================================================================

  /**
   * Convert server note to cached note
   */
  private convertServerNoteToCached(server: Note, existing?: CachedNote): CachedNote {
    return {
      id: server.id,
      user_id: server.user_id,
      title: server.title,
      content: server.content,
      folder_id: server.folder_id ?? null,
      is_pinned: server.is_pinned,
      updated_at: server.updated_at,
      content_hash: server.content_hash,
      version: existing?.version ?? 1,
      _cachedAt: Date.now(),
      _dirty: false
    }
  }

  /**
   * Convert server folder to cached folder
   */
  private convertServerFolderToCached(server: Folder, existing?: CachedFolder): CachedFolder {
    return {
      id: server.id,
      user_id: server.user_id,
      name: server.name,
      updated_at: server.updated_at,
      _cachedAt: Date.now(),
      _dirty: false
    }
  }

  /**
   * Convert server review to cached review
   */
  private convertServerReviewToCached(server: Review, existing?: CachedReview): CachedReview {
    return {
      id: server.id,
      user_id: server.user_id,
      date: server.date,
      content: server.content,
      mood: server.mood ?? null,
      achievements: server.achievements?.join('\n') ?? null,
      improvements: server.improvements?.join('\n') ?? null,
      plans: server.plans?.join('\n') ?? null,
      updated_at: server.updated_at,
      _cachedAt: Date.now(),
      _dirty: false
    }
  }

  // ============================================================================
  // Field Definitions
  // ============================================================================

  /**
   * Get fields to compare for notes
   */
  private getNoteComparisonFields(): string[] {
    return ['title', 'content', 'folder_id', 'is_pinned']
  }

  /**
   * Get fields to compare for folders
   */
  private getFolderComparisonFields(): string[] {
    return ['name']
  }

  /**
   * Get fields to compare for reviews
   */
  private getReviewComparisonFields(): string[] {
    return ['date', 'content', 'mood', 'achievements', 'improvements', 'plans']
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear all current conflicts
   */
  clearConflicts(): void {
    this.currentConflicts = []
  }

  /**
   * Get all current unresolved conflicts
   */
  getConflicts(): ConflictInfo[] {
    return [...this.currentConflicts]
  }

  /**
   * Check if there are any unresolved conflicts
   */
  hasConflicts(): boolean {
    return this.currentConflicts.length > 0
  }
}

// ============================================================================
// Exports
// ============================================================================

export default CacheConsistency
export { CacheConsistencyError }
