/**
 * Recovery Sync Service
 * Handles offline recovery and synchronization for the WebNote application
 */

import { OfflineQueue, OfflineQueueError } from './OfflineQueue'
import { NetworkMonitor, type NetworkState } from './NetworkMonitor'
import { CacheService, CacheServiceError } from '../cache/CacheService'
import { CacheConsistency, type ConflictInfo } from '../cache/CacheConsistency'
import type { SyncQueueItem, SyncEntityType, SyncOperationType } from '../cache/types'
import api from '../../api'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Merge strategy for conflict resolution
 */
export type MergeStrategy = 'local_wins' | 'server_wins' | 'latest_wins' | 'manual'

/**
 * Result of processing the offline queue
 */
export interface RecoveryResult {
  /** Number of operations processed */
  processed: number
  /** Number of operations that succeeded */
  succeeded: number
  /** Number of operations that failed */
  failed: number
  /** Conflicts detected during processing */
  conflicts: ConflictInfo[]
}

/**
 * Result of batch upload operation
 */
export interface BatchUploadResult {
  /** IDs of succeeded operations */
  succeeded: string[]
  /** Failed operations with error details */
  failed: Array<{ id: string; error: string }>
  /** Conflicts detected during upload */
  conflicts: ConflictInfo[]
}

/**
 * Result of full recovery sync operation
 */
export interface RecoverySyncResult {
  /** Number of operations uploaded to server */
  uploadedOperations: number
  /** Number of updates downloaded from server */
  downloadedUpdates: number
  /** Conflicts detected during sync */
  conflicts: ConflictInfo[]
  /** Errors encountered during sync */
  errors: string[]
}

/**
 * Progress information for recovery sync
 */
export interface RecoveryProgress {
  /** Current phase of recovery */
  phase: 'uploading' | 'downloading' | 'merging' | 'completed'
  /** Total items to process */
  total: number
  /** Number of items processed */
  processed: number
  /** Percentage complete (0-100) */
  percentage: number
}

/**
 * Callback function for recovery progress updates
 */
export type RecoveryProgressCallback = (progress: RecoveryProgress) => void

/**
 * Callback function for recovery completion
 */
export type RecoveryCallback = (result: RecoverySyncResult) => void

/**
 * Configuration options for recovery sync
 */
export interface RecoverySyncConfig {
  /** Number of operations to upload in a single batch */
  batchSize: number
  /** Maximum number of retry attempts for failed operations */
  maxRetries: number
  /** Delay between retry attempts in milliseconds */
  retryDelay: number
  /** Whether to automatically start recovery when network becomes available */
  autoRecover: boolean
  /** Default conflict resolution strategy */
  conflictStrategy: MergeStrategy
  /** Enable debug logging */
  debug: boolean
}

/**
 * Server response for sync operations
 */
interface ServerSyncResponse {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  conflicts?: Array<{
    entity_type: SyncEntityType
    entity_id: number
    local_data: Record<string, unknown>
    server_data: Record<string, unknown>
    conflict_fields: string[]
  }>
}

/**
 * Server update data for downloading
 */
interface ServerUpdate {
  notes?: Array<Record<string, unknown>>
  folders?: Array<Record<string, unknown>>
  reviews?: Array<Record<string, unknown>>
  last_sync_time: string
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Recovery sync error
 */
export class RecoverySyncError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'RecoverySyncError'
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default recovery sync configuration
 */
export const DEFAULT_RECOVERY_SYNC_CONFIG: RecoverySyncConfig = {
  batchSize: 10,
  maxRetries: 3,
  retryDelay: 1000,
  autoRecover: true,
  conflictStrategy: 'latest_wins',
  debug: false
}

// ============================================================================
// Recovery Sync Class
// ============================================================================

/**
 * Recovery Sync Service
 *
 * Handles offline recovery and synchronization when network becomes available.
 * Manages the upload of offline operations, download of server updates,
 * and conflict resolution.
 *
 * Features:
 * - Batch upload of offline operations
 * - Incremental sync with server
 * - Conflict detection and resolution
 * - Progress notifications
 * - Automatic recovery on network restore
 * - Retry handling for failed operations
 *
 * @example
 * ```typescript
 * const recoverySync = RecoverySync.getInstance()
 *
 * // Subscribe to progress updates
 * const unsubscribe = recoverySync.onProgress((progress) => {
 *   console.log(`Recovery progress: ${progress.percentage}%`)
 * })
 *
 * // Subscribe to recovery completion
 * recoverySync.onRecovery((result) => {
 *   console.log('Recovery completed:', result)
 * })
 *
 * // Start listening for network recovery
 * recoverySync.startListening()
 *
 * // Manually trigger recovery sync
 * const result = await recoverySync.performRecoverySync(userId)
 *
 * // Clean up
 * unsubscribe()
 * recoverySync.stopListening()
 * ```
 */
export class RecoverySync {
  // ============================================================================
  // Singleton Instance
  // ============================================================================

  private static instance: RecoverySync | null = null

  // ============================================================================
  // Private Properties
  // ============================================================================

  private offlineQueue: OfflineQueue
  private networkMonitor: NetworkMonitor
  private cacheService: CacheService
  private cacheConsistency: CacheConsistency
  private config: RecoverySyncConfig
  private progressCallbacks: Set<RecoveryProgressCallback> = new Set()
  private recoveryCallbacks: Set<RecoveryCallback> = new Set()
  private isRecovering: boolean = false
  private networkUnsubscribe: (() => void) | null = null
  private deviceId: string

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new RecoverySync instance
   * @param config - Configuration options
   */
  private constructor(config: Partial<RecoverySyncConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_SYNC_CONFIG, ...config }
    this.offlineQueue = OfflineQueue.getInstance()
    this.networkMonitor = NetworkMonitor.getInstance()
    this.cacheService = CacheService.getInstance()
    this.cacheConsistency = CacheConsistency.getInstance()
    this.deviceId = this.getOrCreateDeviceId()

    this.log('RecoverySync initialized')
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  /**
   * Get the singleton instance of RecoverySync
   * @param config - Optional configuration (only used on first call)
   * @returns RecoverySync instance
   */
  static getInstance(config?: Partial<RecoverySyncConfig>): RecoverySync {
    if (!RecoverySync.instance) {
      RecoverySync.instance = new RecoverySync(config)
    }
    return RecoverySync.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (RecoverySync.instance) {
      RecoverySync.instance.stopListening()
      RecoverySync.instance = null
    }
  }

  // ============================================================================
  // Public Methods - Queue Processing
  // ============================================================================

  /**
   * Process all operations in the offline queue
   * @param userId - User ID to process queue for
   * @returns Promise resolving to recovery result
   */
  async processQueue(userId: number): Promise<RecoveryResult> {
    if (this.isRecovering) {
      throw new RecoverySyncError(
        'Recovery already in progress',
        'RECOVERY_IN_PROGRESS'
      )
    }

    this.isRecovering = true
    const result: RecoveryResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: []
    }

    try {
      // Get all pending operations
      const pendingOperations = await this.offlineQueue.getPendingOperations(userId)
      result.processed = pendingOperations.length

      if (pendingOperations.length === 0) {
        this.log('No pending operations to process')
        return result
      }

      this.log(`Processing ${pendingOperations.length} pending operations`)

      // Process in batches
      const batches = this.createBatches(pendingOperations, this.config.batchSize)
      let processedCount = 0

      for (const batch of batches) {
        // Notify progress
        this.notifyProgress({
          phase: 'uploading',
          total: pendingOperations.length,
          processed: processedCount,
          percentage: Math.round((processedCount / pendingOperations.length) * 100)
        })

        // Upload batch
        const batchResult = await this.uploadBatch(batch)

        // Update results
        result.succeeded += batchResult.succeeded.length
        result.failed += batchResult.failed.length
        result.conflicts.push(...batchResult.conflicts)

        // Mark completed operations
        for (const id of batchResult.succeeded) {
          await this.offlineQueue.markCompleted(id)
        }

        // Handle failed operations
        for (const { id, error } of batchResult.failed) {
          await this.offlineQueue.markFailed(id, error)
        }

        processedCount += batch.length
      }

      // Final progress notification
      this.notifyProgress({
        phase: 'uploading',
        total: pendingOperations.length,
        processed: pendingOperations.length,
        percentage: 100
      })

      this.log(
        `Queue processing complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.conflicts.length} conflicts`
      )

      return result
    } catch (error) {
      throw new RecoverySyncError(
        `Failed to process queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROCESS_QUEUE_ERROR',
        error
      )
    } finally {
      this.isRecovering = false
    }
  }

  /**
   * Upload a batch of operations to the server
   * @param operations - Operations to upload
   * @returns Promise resolving to batch upload result
   */
  async uploadBatch(operations: SyncQueueItem[]): Promise<BatchUploadResult> {
    const result: BatchUploadResult = {
      succeeded: [],
      failed: [],
      conflicts: []
    }

    for (const operation of operations) {
      try {
        // Mark as processing
        await this.offlineQueue.markProcessing(operation.id)

        // Execute the operation
        const response = await this.executeOperation(operation)

        if (response.success) {
          result.succeeded.push(operation.id)

          // Check for conflicts in response
          if (response.conflicts && response.conflicts.length > 0) {
            for (const conflict of response.conflicts) {
              const conflictInfo = this.detectUploadConflict(operation, conflict.server_data)
              if (conflictInfo) {
                result.conflicts.push(conflictInfo)
              }
            }
          }
        } else {
          result.failed.push({
            id: operation.id,
            error: response.error || 'Unknown error'
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.failed.push({
          id: operation.id,
          error: errorMessage
        })
        this.log(`Operation ${operation.id} failed:`, errorMessage)
      }
    }

    return result
  }

  // ============================================================================
  // Public Methods - Conflict Handling
  // ============================================================================

  /**
   * Detect conflict during upload operation
   * @param operation - Operation being uploaded
   * @param serverData - Current server data
   * @returns Conflict info or null if no conflict
   */
  detectUploadConflict(
    operation: SyncQueueItem,
    serverData: Record<string, unknown>
  ): ConflictInfo | null {
    // Skip conflict detection for CREATE operations
    if (operation.operation_type === 'CREATE') {
      return null
    }

    // Skip if no entity ID
    if (!operation.entity_id) {
      return null
    }

    const localData = operation.data
    const conflictFields: string[] = []

    // Compare fields
    for (const [key, localValue] of Object.entries(localData)) {
      const serverValue = serverData[key]

      if (!this.areValuesEqual(localValue, serverValue)) {
        conflictFields.push(key)
      }
    }

    if (conflictFields.length === 0) {
      return null
    }

    return {
      entityType: operation.entity_type,
      entityId: operation.entity_id,
      localData,
      serverData,
      conflictFields,
      suggestedResolution: this.suggestResolution(localData, serverData)
    }
  }

  /**
   * Merge local and server changes
   * @param localData - Local data
   * @param serverData - Server data
   * @param strategy - Merge strategy to use
   * @returns Merged data
   */
  mergeChanges(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    strategy: MergeStrategy
  ): Record<string, unknown> {
    switch (strategy) {
      case 'local_wins':
        return { ...serverData, ...localData }

      case 'server_wins':
        return { ...localData, ...serverData }

      case 'latest_wins': {
        const localTime = new Date((localData.updated_at as string) || 0).getTime()
        const serverTime = new Date((serverData.updated_at as string) || 0).getTime()
        return serverTime >= localTime
          ? { ...localData, ...serverData }
          : { ...serverData, ...localData }
      }

      case 'manual':
        // Return both for manual resolution
        return {
          _needsManualResolution: true,
          local: localData,
          server: serverData
        }

      default:
        return { ...serverData, ...localData }
    }
  }

  // ============================================================================
  // Public Methods - Full Recovery Sync
  // ============================================================================

  /**
   * Perform complete recovery synchronization
   * @param userId - User ID to sync
   * @returns Promise resolving to recovery sync result
   */
  async performRecoverySync(userId: number): Promise<RecoverySyncResult> {
    if (this.isRecovering) {
      throw new RecoverySyncError(
        'Recovery already in progress',
        'RECOVERY_IN_PROGRESS'
      )
    }

    this.isRecovering = true
    const result: RecoverySyncResult = {
      uploadedOperations: 0,
      downloadedUpdates: 0,
      conflicts: [],
      errors: []
    }

    try {
      this.log('Starting recovery sync for user:', userId)

      // Phase 1: Upload offline queue operations
      this.notifyProgress({
        phase: 'uploading',
        total: 100,
        processed: 0,
        percentage: 0
      })

      const queueResult = await this.processQueue(userId)
      result.uploadedOperations = queueResult.succeeded
      result.conflicts.push(...queueResult.conflicts)

      if (queueResult.failed > 0) {
        result.errors.push(`${queueResult.failed} operations failed to upload`)
      }

      this.notifyProgress({
        phase: 'uploading',
        total: 100,
        processed: 50,
        percentage: 50
      })

      // Phase 2: Download server updates
      this.notifyProgress({
        phase: 'downloading',
        total: 100,
        processed: 50,
        percentage: 50
      })

      const lastSyncTime = await this.cacheService.getLastSyncTime()
      const serverUpdates = await this.downloadServerUpdates(userId, lastSyncTime)

      this.notifyProgress({
        phase: 'downloading',
        total: 100,
        processed: 75,
        percentage: 75
      })

      // Phase 3: Merge and update local cache
      this.notifyProgress({
        phase: 'merging',
        total: 100,
        processed: 75,
        percentage: 75
      })

      const mergeResult = await this.mergeServerUpdates(userId, serverUpdates)
      result.downloadedUpdates = mergeResult.updatedCount
      result.conflicts.push(...mergeResult.conflicts)

      // Phase 4: Update last sync time
      await this.cacheService.setLastSyncTime(new Date().toISOString())

      // Complete
      this.notifyProgress({
        phase: 'completed',
        total: 100,
        processed: 100,
        percentage: 100
      })

      this.log(
        `Recovery sync complete: ${result.uploadedOperations} uploaded, ${result.downloadedUpdates} downloaded, ${result.conflicts.length} conflicts`
      )

      // Notify recovery callbacks
      this.notifyRecovery(result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(errorMessage)

      throw new RecoverySyncError(
        `Recovery sync failed: ${errorMessage}`,
        'RECOVERY_SYNC_ERROR',
        error
      )
    } finally {
      this.isRecovering = false
    }
  }

  // ============================================================================
  // Public Methods - Incremental Recovery
  // ============================================================================

  /**
   * Perform incremental sync since last sync time
   * @param userId - User ID to sync
   * @param lastSyncTime - Last sync timestamp
   * @returns Promise resolving to recovery sync result
   */
  async incrementalRecovery(
    userId: number,
    lastSyncTime: string
  ): Promise<RecoverySyncResult> {
    if (this.isRecovering) {
      throw new RecoverySyncError(
        'Recovery already in progress',
        'RECOVERY_IN_PROGRESS'
      )
    }

    this.isRecovering = true
    const result: RecoverySyncResult = {
      uploadedOperations: 0,
      downloadedUpdates: 0,
      conflicts: [],
      errors: []
    }

    try {
      this.log(`Starting incremental recovery since ${lastSyncTime}`)

      // Get pending operations created after last sync
      const allPending = await this.offlineQueue.getPendingOperations(userId)
      const pendingOperations = allPending.filter(
        op => new Date(op.timestamp) > new Date(lastSyncTime)
      )

      // Upload pending operations
      if (pendingOperations.length > 0) {
        const batches = this.createBatches(pendingOperations, this.config.batchSize)

        for (const batch of batches) {
          const batchResult = await this.uploadBatch(batch)
          result.uploadedOperations += batchResult.succeeded.length
          result.conflicts.push(...batchResult.conflicts)

          for (const id of batchResult.succeeded) {
            await this.offlineQueue.markCompleted(id)
          }

          for (const { id, error } of batchResult.failed) {
            await this.offlineQueue.markFailed(id, error)
          }
        }
      }

      // Download incremental updates
      const serverUpdates = await this.downloadServerUpdates(userId, lastSyncTime)
      const mergeResult = await this.mergeServerUpdates(userId, serverUpdates)
      result.downloadedUpdates = mergeResult.updatedCount
      result.conflicts.push(...mergeResult.conflicts)

      // Update last sync time
      await this.cacheService.setLastSyncTime(new Date().toISOString())

      this.log('Incremental recovery complete')

      return result
    } catch (error) {
      throw new RecoverySyncError(
        `Incremental recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INCREMENTAL_RECOVERY_ERROR',
        error
      )
    } finally {
      this.isRecovering = false
    }
  }

  // ============================================================================
  // Public Methods - Progress Notifications
  // ============================================================================

  /**
   * Subscribe to recovery progress updates
   * @param callback - Function to call with progress updates
   * @returns Unsubscribe function
   */
  onProgress(callback: RecoveryProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    this.log('Subscribed to progress updates')

    return () => {
      this.progressCallbacks.delete(callback)
      this.log('Unsubscribed from progress updates')
    }
  }

  // ============================================================================
  // Public Methods - Error Handling
  // ============================================================================

  /**
   * Handle upload failure for an operation
   * @param operation - Failed operation
   * @param error - Error that occurred
   */
  async handleUploadFailure(
    operation: SyncQueueItem,
    error: Error
  ): Promise<void> {
    this.log(`Handling upload failure for operation ${operation.id}`)

    // Check if we should retry
    if (operation.retry_count < this.config.maxRetries) {
      // Wait before retry
      await this.delay(this.config.retryDelay * (operation.retry_count + 1))

      // Reset to pending for retry
      await this.offlineQueue.markFailed(operation.id, error.message)
    } else {
      // Max retries exceeded, mark as permanently failed
      await this.offlineQueue.markFailed(
        operation.id,
        `Max retries exceeded: ${error.message}`
      )
    }
  }

  /**
   * Retry all failed operations for a user
   * @param userId - User ID to retry operations for
   */
  async retryFailedOperations(userId: number): Promise<void> {
    this.log('Retrying failed operations for user:', userId)

    try {
      // Reset failed operations to pending
      await this.offlineQueue.retryFailed(userId)

      // Process the queue again
      await this.processQueue(userId)
    } catch (error) {
      throw new RecoverySyncError(
        `Failed to retry operations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RETRY_FAILED_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Public Methods - Network State Listening
  // ============================================================================

  /**
   * Start listening for network recovery events
   */
  startListening(): void {
    if (this.networkUnsubscribe) {
      this.log('Already listening for network events')
      return
    }

    this.networkUnsubscribe = this.networkMonitor.subscribe(
      async (state: NetworkState) => {
        this.log('Network state changed:', state.isOnline ? 'online' : 'offline')

        // Auto-recover when network comes back online
        if (state.isOnline && this.config.autoRecover && !this.isRecovering) {
          this.log('Network recovered, starting auto-recovery')

          try {
            // Get user ID from cache
            const userId = await this.getCurrentUserId()
            if (userId) {
              await this.performRecoverySync(userId)
            }
          } catch (error) {
            this.log('Auto-recovery failed:', error)
          }
        }
      }
    )

    this.log('Started listening for network events')
  }

  /**
   * Stop listening for network recovery events
   */
  stopListening(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe()
      this.networkUnsubscribe = null
      this.log('Stopped listening for network events')
    }
  }

  /**
   * Set callback for recovery completion
   * @param callback - Function to call when recovery completes
   */
  onRecovery(callback: RecoveryCallback): void {
    this.recoveryCallbacks.add(callback)
    this.log('Registered recovery callback')
  }

  /**
   * Remove recovery callback
   * @param callback - Callback to remove
   */
  offRecovery(callback: RecoveryCallback): void {
    this.recoveryCallbacks.delete(callback)
    this.log('Removed recovery callback')
  }

  // ============================================================================
  // Public Methods - Utility
  // ============================================================================

  /**
   * Check if recovery is currently in progress
   * @returns Whether recovery is in progress
   */
  isRecoveringNow(): boolean {
    return this.isRecovering
  }

  /**
   * Get current configuration
   * @returns Current configuration
   */
  getConfig(): RecoverySyncConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<RecoverySyncConfig>): void {
    this.config = { ...this.config, ...updates }
    this.log('Configuration updated')
  }

  // ============================================================================
  // Private Methods - Operation Execution
  // ============================================================================

  /**
   * Execute a single sync operation against the server
   * @param operation - Operation to execute
   * @returns Promise resolving to server response
   */
  private async executeOperation(
    operation: SyncQueueItem
  ): Promise<ServerSyncResponse> {
    const { operation_type, entity_type, entity_id, data } = operation

    try {
      let response

      switch (entity_type) {
        case 'note':
          response = await this.executeNoteOperation(
            operation_type,
            entity_id,
            data
          )
          break

        case 'folder':
          response = await this.executeFolderOperation(
            operation_type,
            entity_id,
            data
          )
          break

        case 'review':
          response = await this.executeReviewOperation(
            operation_type,
            entity_id,
            data
          )
          break

        default:
          throw new Error(`Unknown entity type: ${entity_type}`)
      }

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute note operation
   */
  private async executeNoteOperation(
    operationType: SyncOperationType,
    entityId: number | null,
    data: Record<string, unknown>
  ): Promise<ServerSyncResponse> {
    try {
      let response

      switch (operationType) {
        case 'CREATE':
          response = await api.post('/notes', data)
          break

        case 'UPDATE':
          if (!entityId) throw new Error('Entity ID required for UPDATE')
          response = await api.put(`/notes/${entityId}`, data)
          break

        case 'DELETE':
          if (!entityId) throw new Error('Entity ID required for DELETE')
          response = await api.delete(`/notes/${entityId}`)
          break

        default:
          throw new Error(`Unknown operation type: ${operationType}`)
      }

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute folder operation
   */
  private async executeFolderOperation(
    operationType: SyncOperationType,
    entityId: number | null,
    data: Record<string, unknown>
  ): Promise<ServerSyncResponse> {
    try {
      let response

      switch (operationType) {
        case 'CREATE':
          response = await api.post('/folders', data)
          break

        case 'UPDATE':
          if (!entityId) throw new Error('Entity ID required for UPDATE')
          response = await api.put(`/folders/${entityId}`, data)
          break

        case 'DELETE':
          if (!entityId) throw new Error('Entity ID required for DELETE')
          response = await api.delete(`/folders/${entityId}`)
          break

        default:
          throw new Error(`Unknown operation type: ${operationType}`)
      }

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute review operation
   */
  private async executeReviewOperation(
    operationType: SyncOperationType,
    entityId: number | null,
    data: Record<string, unknown>
  ): Promise<ServerSyncResponse> {
    try {
      let response

      switch (operationType) {
        case 'CREATE':
          response = await api.post('/reviews/detailed', data)
          break

        case 'UPDATE':
          if (!entityId) throw new Error('Entity ID required for UPDATE')
          response = await api.put(`/reviews/${entityId}`, data)
          break

        case 'DELETE':
          if (!entityId) throw new Error('Entity ID required for DELETE')
          response = await api.delete(`/reviews/${entityId}`)
          break

        default:
          throw new Error(`Unknown operation type: ${operationType}`)
      }

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // Private Methods - Server Updates
  // ============================================================================

  /**
   * Download updates from server since last sync
   * @param userId - User ID
   * @param lastSyncTime - Last sync timestamp
   * @returns Promise resolving to server updates
   */
  private async downloadServerUpdates(
    userId: number,
    lastSyncTime: string | null
  ): Promise<ServerUpdate> {
    try {
      const params: Record<string, string> = {}
      if (lastSyncTime) {
        params.since = lastSyncTime
      }

      const response = await api.get('/sync/incremental', { params })

      return {
        notes: response.data.notes || [],
        folders: response.data.folders || [],
        reviews: response.data.reviews || [],
        last_sync_time: response.data.last_sync_time || new Date().toISOString()
      }
    } catch (error) {
      // If incremental sync endpoint doesn't exist, fall back to full sync
      this.log('Incremental sync failed, falling back to full sync')

      const [notesRes, foldersRes, reviewsRes] = await Promise.all([
        api.get('/notes'),
        api.get('/folders'),
        api.get('/reviews')
      ])

      return {
        notes: notesRes.data.notes || notesRes.data || [],
        folders: foldersRes.data.folders || foldersRes.data || [],
        reviews: reviewsRes.data.reviews || reviewsRes.data || [],
        last_sync_time: new Date().toISOString()
      }
    }
  }

  /**
   * Merge server updates into local cache
   * @param userId - User ID
   * @param updates - Server updates to merge
   * @returns Promise resolving to merge result
   */
  private async mergeServerUpdates(
    userId: number,
    updates: ServerUpdate
  ): Promise<{ updatedCount: number; conflicts: ConflictInfo[] }> {
    const conflicts: ConflictInfo[] = []
    let updatedCount = 0

    // Get local data
    const [localNotes, localFolders, localReviews] = await Promise.all([
      this.cacheService.getNotes(userId),
      this.cacheService.getFolders(userId),
      this.cacheService.getReviews(userId)
    ])

    // Merge notes
    if (updates.notes && updates.notes.length > 0) {
      const notesResult = this.cacheConsistency.mergeNotes(
        localNotes,
        updates.notes as any[]
      )

      // Save created and updated notes
      for (const note of notesResult.created) {
        await this.cacheService.saveNote(note)
        updatedCount++
      }

      for (const note of notesResult.updated) {
        await this.cacheService.saveNote(note)
        updatedCount++
      }

      // Delete removed notes
      for (const note of notesResult.deleted) {
        await this.cacheService.deleteNote(note.id)
        updatedCount++
      }

      conflicts.push(...notesResult.conflicts)
    }

    // Merge folders
    if (updates.folders && updates.folders.length > 0) {
      const foldersResult = this.cacheConsistency.mergeFolders(
        localFolders,
        updates.folders as any[]
      )

      for (const folder of foldersResult.created) {
        await this.cacheService.saveFolder(folder)
        updatedCount++
      }

      for (const folder of foldersResult.updated) {
        await this.cacheService.saveFolder(folder)
        updatedCount++
      }

      for (const folder of foldersResult.deleted) {
        await this.cacheService.deleteFolder(folder.id)
        updatedCount++
      }

      conflicts.push(...foldersResult.conflicts)
    }

    // Merge reviews
    if (updates.reviews && updates.reviews.length > 0) {
      const reviewsResult = this.cacheConsistency.mergeReviews(
        localReviews,
        updates.reviews as any[]
      )

      for (const review of reviewsResult.created) {
        await this.cacheService.saveReview(review)
        updatedCount++
      }

      for (const review of reviewsResult.updated) {
        await this.cacheService.saveReview(review)
        updatedCount++
      }

      for (const review of reviewsResult.deleted) {
        await this.cacheService.deleteReview(review.id)
        updatedCount++
      }

      conflicts.push(...reviewsResult.conflicts)
    }

    // Auto-resolve conflicts if configured
    if (conflicts.length > 0 && this.config.conflictStrategy !== 'manual') {
      for (const conflict of conflicts) {
        const strategy = this.config.conflictStrategy === 'latest_wins'
          ? 'merge'
          : this.config.conflictStrategy === 'local_wins'
            ? 'local'
            : 'server'

        const resolved = this.cacheConsistency.resolveConflict(conflict, strategy)

        // Save resolved entity
        switch (resolved.entityType) {
          case 'note':
            await this.cacheService.saveNote(resolved.data as any)
            break
          case 'folder':
            await this.cacheService.saveFolder(resolved.data as any)
            break
          case 'review':
            await this.cacheService.saveReview(resolved.data as any)
            break
        }
      }
    }

    return { updatedCount, conflicts }
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Create batches from an array
   * @param items - Items to batch
   * @param batchSize - Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * Check if two values are equal
   */
  private areValuesEqual(a: unknown, b: unknown): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, idx) => this.areValuesEqual(val, b[idx]))
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>
      const bObj = b as Record<string, unknown>
      const aKeys = Object.keys(aObj)
      const bKeys = Object.keys(bObj)
      if (aKeys.length !== bKeys.length) return false
      return aKeys.every(key => this.areValuesEqual(aObj[key], bObj[key]))
    }

    return a === b
  }

  /**
   * Suggest conflict resolution based on data
   */
  private suggestResolution(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>
  ): 'local' | 'server' | 'merge' {
    const localTime = new Date((localData.updated_at as string) || 0).getTime()
    const serverTime = new Date((serverData.updated_at as string) || 0).getTime()

    if (serverTime > localTime + 60000) {
      return 'server'
    }

    if (localTime > serverTime + 60000) {
      return 'local'
    }

    return 'merge'
  }

  /**
   * Notify all progress callbacks
   * @param progress - Progress information
   */
  private notifyProgress(progress: RecoveryProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        this.log('Error in progress callback:', error)
      }
    })
  }

  /**
   * Notify all recovery callbacks
   * @param result - Recovery result
   */
  private notifyRecovery(result: RecoverySyncResult): void {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        this.log('Error in recovery callback:', error)
      }
    })
  }

  /**
   * Get current user ID from cache
   */
  private async getCurrentUserId(): Promise<number | null> {
    try {
      const metadata = await this.cacheService.getMetadata('userId')
      return metadata ? (metadata.value as number) : null
    } catch {
      return null
    }
  }

  /**
   * Get or create device ID
   */
  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem('webnote_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('webnote_device_id', deviceId)
    return deviceId
  }

  /**
   * Delay execution
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[RecoverySync] ${message}`, ...args)
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default RecoverySync
