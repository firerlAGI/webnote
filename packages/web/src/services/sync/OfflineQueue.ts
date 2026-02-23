/**
 * Offline Queue Service
 * Manages offline operations queue for the WebNote application
 */

import { CacheService, CacheServiceError } from '../cache/CacheService'
import { NetworkMonitor } from './NetworkMonitor'
import type {
  SyncQueueItem,
  SyncQueueStatus,
  SyncOperationType,
  SyncEntityType
} from '../cache/types'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Operation input for adding to queue (excludes auto-generated fields)
 */
export interface OperationInput {
  /** Owner user ID */
  user_id: number
  /** Operation type */
  operation_type: SyncOperationType
  /** Entity type */
  entity_type: SyncEntityType
  /** Entity ID (null for CREATE operations) */
  entity_id: number | null
  /** Operation data payload */
  data: Record<string, unknown>
}

/**
 * Queue status summary
 */
export interface QueueStatus {
  /** Number of pending operations */
  pending: number
  /** Number of processing operations */
  processing: number
  /** Number of completed operations */
  completed: number
  /** Number of failed operations */
  failed: number
  /** Total operations in queue */
  total: number
}

/**
 * Queue change event type
 */
export type QueueChangeType =
  | 'added'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cleaned'
  | 'cleared'

/**
 * Queue change event details
 */
export interface QueueChange {
  /** Type of change */
  type: QueueChangeType
  /** User ID affected */
  user_id: number
  /** Operation ID if applicable */
  operation_id?: string
  /** Additional details */
  details?: {
    count?: number
    error?: string
    entity_type?: SyncEntityType
    entity_id?: number | null
    operation_type?: SyncOperationType
  }
}

/**
 * Queue change callback function type
 */
export type QueueChangeCallback = (change: QueueChange) => void

/**
 * Offline queue configuration
 */
export interface OfflineQueueConfig {
  /** Maximum retry attempts for failed operations */
  maxRetries: number
  /** Maximum age of completed items in milliseconds before cleanup */
  completedItemMaxAge: number
  /** Maximum batch size for processing */
  maxBatchSize: number
  /** Enable debug logging */
  debug: boolean
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Offline queue error
 */
export class OfflineQueueError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'OfflineQueueError'
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default offline queue configuration
 */
export const DEFAULT_OFFLINE_QUEUE_CONFIG: OfflineQueueConfig = {
  maxRetries: 3,
  completedItemMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxBatchSize: 10,
  debug: false
}

// ============================================================================
// Offline Queue Class
// ============================================================================

/**
 * Offline Queue Service
 *
 * Manages offline operations queue for synchronization when network
 * becomes available.
 *
 * Features:
 * - Queue operations for offline execution
 * - Operation deduplication and merging
 * - Retry failed operations
 * - Batch processing support
 * - Event notifications for queue changes
 * - Automatic cleanup of completed operations
 *
 * @example
 * ```typescript
 * const queue = OfflineQueue.getInstance()
 *
 * // Add an operation to the queue
 * const operationId = await queue.addOperation({
 *   user_id: 1,
 *   operation_type: 'UPDATE',
 *   entity_type: 'note',
 *   entity_id: 123,
 *   data: { title: 'Updated Title' }
 * })
 *
 * // Subscribe to queue changes
 * const unsubscribe = queue.subscribe((change) => {
 *   console.log('Queue changed:', change)
 * })
 *
 * // Get pending operations
 * const pending = await queue.getPendingOperations(1)
 *
 * // Check queue status
 * const status = await queue.getStatus(1)
 * console.log('Queue status:', status)
 *
 * // Clean up when done
 * unsubscribe()
 * ```
 */
export class OfflineQueue {
  // ============================================================================
  // Singleton Instance
  // ============================================================================

  private static instance: OfflineQueue | null = null

  // ============================================================================
  // Private Properties
  // ============================================================================

  private cacheService: CacheService
  private networkMonitor: NetworkMonitor
  private config: OfflineQueueConfig
  private callbacks: Set<QueueChangeCallback> = new Set()
  private offlineMode: boolean = false

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new OfflineQueue instance
   * @param config - Configuration options
   */
  private constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_OFFLINE_QUEUE_CONFIG, ...config }
    this.cacheService = CacheService.getInstance()
    this.networkMonitor = NetworkMonitor.getInstance()
    this.offlineMode = !this.networkMonitor.isOnline()

    // Subscribe to network state changes
    this.networkMonitor.subscribe((state) => {
      this.offlineMode = !state.isOnline
      this.log('Network state changed, offline mode:', this.offlineMode)
    })

    this.log('OfflineQueue initialized')
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  /**
   * Get the singleton instance of OfflineQueue
   * @param config - Optional configuration (only used on first call)
   * @returns OfflineQueue instance
   */
  static getInstance(config?: Partial<OfflineQueueConfig>): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue(config)
    }
    return OfflineQueue.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    OfflineQueue.instance = null
  }

  // ============================================================================
  // Public Methods - Queue Operations
  // ============================================================================

  /**
   * Add an operation to the queue
   * @param operation - Operation to add
   * @returns Promise resolving to the operation ID
   */
  async addOperation(
    operation: Omit<SyncQueueItem, 'id' | 'timestamp' | 'status' | 'retry_count'>
  ): Promise<string> {
    try {
      // Check for duplicate operations
      const isDuplicate = await this.checkDuplicate(
        operation.user_id,
        operation.entity_type,
        operation.entity_id,
        operation.operation_type
      )

      if (isDuplicate && operation.operation_type === 'UPDATE') {
        // For UPDATE operations, try to merge with existing
        const existing = await this.findExistingOperation(
          operation.user_id,
          operation.entity_type,
          operation.entity_id,
          operation.operation_type
        )

        if (existing) {
          const merged = this.mergeOperations(existing, operation as SyncQueueItem)
          await this.cacheService.updateQueueItem(existing.id, {
            data: merged.data,
            timestamp: new Date().toISOString()
          })

          this.notifyChange({
            type: 'added',
            user_id: operation.user_id,
            operation_id: existing.id,
            details: {
              entity_type: operation.entity_type,
              entity_id: operation.entity_id,
              operation_type: operation.operation_type
            }
          })

          this.log('Merged duplicate operation:', existing.id)
          return existing.id
        }
      }

      // Generate unique ID
      const id = this.generateOperationId()

      // Create queue item
      const item: SyncQueueItem = {
        id,
        user_id: operation.user_id,
        operation_type: operation.operation_type,
        entity_type: operation.entity_type,
        entity_id: operation.entity_id,
        data: operation.data,
        timestamp: new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        error: operation.error
      }

      // Add to cache
      await this.cacheService.addToQueue(item)

      this.notifyChange({
        type: 'added',
        user_id: operation.user_id,
        operation_id: id,
        details: {
          entity_type: operation.entity_type,
          entity_id: operation.entity_id,
          operation_type: operation.operation_type
        }
      })

      this.log('Added operation to queue:', id)
      return id
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to add operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ADD_OPERATION_ERROR',
        error
      )
    }
  }

  /**
   * Get all pending operations for a user
   * @param userId - User ID
   * @returns Promise resolving to array of pending operations
   */
  async getPendingOperations(userId: number): Promise<SyncQueueItem[]> {
    try {
      const items = await this.cacheService.getQueue(userId, 'pending')
      return items
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to get pending operations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_PENDING_ERROR',
        error
      )
    }
  }

  /**
   * Mark an operation as processing
   * @param id - Operation ID
   */
  async markProcessing(id: string): Promise<void> {
    try {
      const item = await this.getQueueItemById(id)
      if (!item) {
        throw new OfflineQueueError(
          `Operation not found: ${id}`,
          'OPERATION_NOT_FOUND'
        )
      }

      await this.cacheService.updateQueueItem(id, { status: 'processing' })

      this.notifyChange({
        type: 'processing',
        user_id: item.user_id,
        operation_id: id
      })

      this.log('Marked operation as processing:', id)
    } catch (error) {
      if (error instanceof OfflineQueueError) {
        throw error
      }
      throw new OfflineQueueError(
        `Failed to mark operation as processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MARK_PROCESSING_ERROR',
        error
      )
    }
  }

  /**
   * Mark an operation as completed
   * @param id - Operation ID
   */
  async markCompleted(id: string): Promise<void> {
    try {
      const item = await this.getQueueItemById(id)
      if (!item) {
        throw new OfflineQueueError(
          `Operation not found: ${id}`,
          'OPERATION_NOT_FOUND'
        )
      }

      await this.cacheService.updateQueueItem(id, { status: 'completed' })

      this.notifyChange({
        type: 'completed',
        user_id: item.user_id,
        operation_id: id
      })

      this.log('Marked operation as completed:', id)
    } catch (error) {
      if (error instanceof OfflineQueueError) {
        throw error
      }
      throw new OfflineQueueError(
        `Failed to mark operation as completed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MARK_COMPLETED_ERROR',
        error
      )
    }
  }

  /**
   * Mark an operation as failed
   * @param id - Operation ID
   * @param error - Error message
   */
  async markFailed(id: string, error: string): Promise<void> {
    try {
      const item = await this.getQueueItemById(id)
      if (!item) {
        throw new OfflineQueueError(
          `Operation not found: ${id}`,
          'OPERATION_NOT_FOUND'
        )
      }

      const newRetryCount = item.retry_count + 1
      const shouldRetry = newRetryCount < this.config.maxRetries

      await this.cacheService.updateQueueItem(id, {
        status: shouldRetry ? 'pending' : 'failed',
        retry_count: newRetryCount,
        error
      })

      this.notifyChange({
        type: shouldRetry ? 'retrying' : 'failed',
        user_id: item.user_id,
        operation_id: id,
        details: {
          error,
          count: newRetryCount
        }
      })

      this.log(
        shouldRetry
          ? `Operation failed, will retry (${newRetryCount}/${this.config.maxRetries}): ${id}`
          : `Operation failed permanently: ${id}`
      )
    } catch (error) {
      if (error instanceof OfflineQueueError) {
        throw error
      }
      throw new OfflineQueueError(
        `Failed to mark operation as failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MARK_FAILED_ERROR',
        error
      )
    }
  }

  /**
   * Retry all failed operations for a user
   * @param userId - User ID
   */
  async retryFailed(userId: number): Promise<void> {
    try {
      const allItems = await this.cacheService.getQueue(userId)
      const failedItems = allItems.filter(item => item.status === 'failed')

      if (failedItems.length === 0) {
        this.log('No failed operations to retry')
        return
      }

      // Reset failed items to pending
      for (const item of failedItems) {
        await this.cacheService.updateQueueItem(item.id, {
          status: 'pending',
          retry_count: 0,
          error: undefined
        })
      }

      this.notifyChange({
        type: 'retrying',
        user_id: userId,
        details: {
          count: failedItems.length
        }
      })

      this.log(`Retrying ${failedItems.length} failed operations`)
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to retry failed operations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RETRY_FAILED_ERROR',
        error
      )
    }
  }

  /**
   * Clean up completed operations older than max age
   * @param maxAge - Maximum age in milliseconds (default from config)
   */
  async cleanupCompleted(maxAge?: number): Promise<void> {
    try {
      const age = maxAge ?? this.config.completedItemMaxAge
      const cutoffTime = Date.now() - age

      // Get all queue items (no user filter for cleanup)
      const db = await this.getDatabase()
      const transaction = db.transaction('syncQueue', 'readwrite')
      const store = transaction.objectStore('syncQueue')
      const request = store.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const items = request.result as SyncQueueItem[]
          const completedItems = items.filter(
            item => item.status === 'completed'
          )

          let cleanedCount = 0

          for (const item of completedItems) {
            const itemTime = new Date(item.timestamp).getTime()
            if (itemTime < cutoffTime) {
              await this.cacheService.removeFromQueue(item.id)
              cleanedCount++
            }
          }

          if (cleanedCount > 0) {
            this.notifyChange({
              type: 'cleaned',
              user_id: 0, // No specific user
              details: {
                count: cleanedCount
              }
            })
          }

          this.log(`Cleaned up ${cleanedCount} completed operations`)
          resolve()
        }

        request.onerror = () => {
          reject(new OfflineQueueError(
            `Failed to cleanup: ${request.error?.message}`,
            'CLEANUP_ERROR',
            request.error
          ))
        }
      })
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to cleanup completed operations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEANUP_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Public Methods - Serialization
  // ============================================================================

  /**
   * Serialize an operation to a string
   * @param operation - Operation to serialize
   * @returns Serialized string
   */
  serializeOperation(operation: SyncQueueItem): string {
    return JSON.stringify(operation)
  }

  /**
   * Deserialize a string to an operation
   * @param data - Serialized string
   * @returns Deserialized operation
   */
  deserializeOperation(data: string): SyncQueueItem {
    try {
      return JSON.parse(data) as SyncQueueItem
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to deserialize operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DESERIALIZE_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Public Methods - Deduplication
  // ============================================================================

  /**
   * Check if a duplicate operation exists
   * @param userId - User ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param operationType - Operation type
   * @returns Promise resolving to true if duplicate exists
   */
  async checkDuplicate(
    userId: number,
    entityType: string,
    entityId: number | null,
    operationType: string
  ): Promise<boolean> {
    try {
      const items = await this.cacheService.getQueue(userId, 'pending')
      return items.some(
        item =>
          item.entity_type === entityType &&
          item.entity_id === entityId &&
          item.operation_type === operationType
      )
    } catch (error) {
      this.log('Error checking for duplicates:', error)
      return false
    }
  }

  /**
   * Merge two operations (for UPDATE deduplication)
   * @param existing - Existing operation
   * @param new_ - New operation
   * @returns Merged operation
   */
  mergeOperations(existing: SyncQueueItem, new_: SyncQueueItem): SyncQueueItem {
    // For UPDATE operations, merge the data
    return {
      ...existing,
      data: {
        ...existing.data,
        ...new_.data
      },
      timestamp: new Date().toISOString()
    }
  }

  // ============================================================================
  // Public Methods - Queue Status
  // ============================================================================

  /**
   * Get queue status summary for a user
   * @param userId - User ID
   * @returns Promise resolving to queue status
   */
  async getStatus(userId: number): Promise<QueueStatus> {
    try {
      const items = await this.cacheService.getQueue(userId)

      const status: QueueStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: items.length
      }

      for (const item of items) {
        switch (item.status) {
          case 'pending':
            status.pending++
            break
          case 'processing':
            status.processing++
            break
          case 'completed':
            status.completed++
            break
          case 'failed':
            status.failed++
            break
        }
      }

      return status
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to get queue status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_STATUS_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Public Methods - Batch Processing
  // ============================================================================

  /**
   * Get the next batch of pending operations
   * @param userId - User ID
   * @param batchSize - Maximum batch size
   * @returns Promise resolving to array of operations
   */
  async getNextBatch(
    userId: number,
    batchSize?: number
  ): Promise<SyncQueueItem[]> {
    try {
      const size = batchSize ?? this.config.maxBatchSize
      const items = await this.cacheService.getQueue(userId, 'pending')
      return items.slice(0, size)
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to get next batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_BATCH_ERROR',
        error
      )
    }
  }

  /**
   * Batch update status for multiple operations
   * @param ids - Array of operation IDs
   * @param status - New status
   */
  async batchUpdateStatus(
    ids: string[],
    status: SyncQueueStatus
  ): Promise<void> {
    if (ids.length === 0) return

    try {
      for (const id of ids) {
        await this.cacheService.updateQueueItem(id, { status })
      }

      this.log(`Batch updated ${ids.length} operations to ${status}`)
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to batch update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_UPDATE_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Public Methods - Subscription
  // ============================================================================

  /**
   * Subscribe to queue changes
   * @param callback - Function to call when queue changes
   * @returns Unsubscribe function
   */
  subscribe(callback: QueueChangeCallback): () => void {
    this.callbacks.add(callback)
    this.log('Subscribed to queue changes')

    return () => {
      this.callbacks.delete(callback)
      this.log('Unsubscribed from queue changes')
    }
  }

  // ============================================================================
  // Public Methods - Offline Mode
  // ============================================================================

  /**
   * Check if currently in offline mode
   * @returns Offline mode status
   */
  isOffline(): boolean {
    return this.offlineMode
  }

  /**
   * Manually set offline mode
   * @param offline - Offline mode status
   */
  setOfflineMode(offline: boolean): void {
    this.offlineMode = offline
    this.log('Manually set offline mode:', offline)
  }

  // ============================================================================
  // Public Methods - Utility
  // ============================================================================

  /**
   * Clear all queue items for a user
   * @param userId - User ID
   */
  async clearQueue(userId: number): Promise<void> {
    try {
      await this.cacheService.clearQueue(userId)

      this.notifyChange({
        type: 'cleared',
        user_id: userId
      })

      this.log('Cleared queue for user:', userId)
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to clear queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEAR_QUEUE_ERROR',
        error
      )
    }
  }

  /**
   * Get a single queue item by ID
   * @param id - Operation ID
   * @returns Promise resolving to queue item or null
   */
  async getQueueItemById(id: string): Promise<SyncQueueItem | null> {
    try {
      const db = await this.getDatabase()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction('syncQueue', 'readonly')
        const store = transaction.objectStore('syncQueue')
        const request = store.get(id)

        request.onsuccess = () => {
          resolve(request.result || null)
        }

        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to get queue item: ${request.error?.message}`,
            'GET_QUEUE_ITEM_ERROR',
            request.error
          ))
        }
      })
    } catch (error) {
      throw new OfflineQueueError(
        `Failed to get queue item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_QUEUE_ITEM_ERROR',
        error
      )
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate a unique operation ID
   * @returns Unique ID string
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Find an existing operation matching the criteria
   * @param userId - User ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param operationType - Operation type
   * @returns Promise resolving to existing operation or null
   */
  private async findExistingOperation(
    userId: number,
    entityType: string,
    entityId: number | null,
    operationType: string
  ): Promise<SyncQueueItem | null> {
    const items = await this.cacheService.getQueue(userId, 'pending')
    return (
      items.find(
        item =>
          item.entity_type === entityType &&
          item.entity_id === entityId &&
          item.operation_type === operationType
      ) || null
    )
  }

  /**
   * Notify all registered callbacks of a queue change
   * @param change - Change details
   */
  private notifyChange(change: QueueChange): void {
    this.callbacks.forEach(callback => {
      try {
        callback(change)
      } catch (error) {
        this.log('Error in change callback:', error)
      }
    })
  }

  /**
   * Get the IndexedDB database instance
   * @returns Promise resolving to IDBDatabase
   */
  private async getDatabase(): Promise<IDBDatabase> {
    // Import DatabaseManager dynamically to avoid circular dependency
    const { DatabaseManager } = await import('../cache/Database')
    const dbManager = DatabaseManager.getInstance()
    return dbManager.getDB()
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[OfflineQueue] ${message}`, ...args)
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default OfflineQueue
