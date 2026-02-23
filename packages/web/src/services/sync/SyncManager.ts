/**
 * Sync Manager
 * Core synchronization manager that coordinates WebSocket, HTTP polling, cache, and offline queue
 */

import { WebSocketClient } from './WebSocketClient'
import { HTTPPollingClient } from './HTTPPollingClient'
import { OfflineQueue } from './OfflineQueue'
import { NetworkMonitor } from './NetworkMonitor'
import { CacheService } from '../cache/CacheService'
import { CacheConsistency, type ConflictInfo } from '../cache/CacheConsistency'
import type {
  SyncRequest,
  SyncResponse,
  SyncOperation,
  Conflict,
  ConflictResolutionStrategy,
  SyncStatus,
  EntityType,
  ClientSyncState
} from '@webnote/shared/types/sync'
import { SyncOperationType } from '@webnote/shared/types/sync'
import type { ServerUpdateMessage } from './types'
import type { CachedNote, CachedFolder, CachedReview, SyncQueueItem } from '../cache/types'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Sync manager states
 */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'conflict' | 'error'

/**
 * Connection type
 */
export type ConnectionType = 'websocket' | 'http' | 'offline'

/**
 * State change callback type
 */
export type StateChangeCallback = (oldState: SyncState, newState: SyncState) => void

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: SyncProgress) => void

/**
 * Error callback type
 */
export type ErrorCallback = (error: Error) => void

/**
 * Update callback type
 */
export type UpdateCallback = (update: ServerUpdateMessage) => void

/**
 * Sync progress information
 */
export interface SyncProgress {
  /** Current phase of sync */
  phase: 'connecting' | 'uploading' | 'downloading' | 'merging' | 'complete'
  /** Total items to sync */
  total: number
  /** Items processed */
  processed: number
  /** Percentage complete (0-100) */
  percentage: number
  /** Current operation description */
  message?: string
}

/**
 * Sync manager state
 */
export interface SyncManagerState {
  /** Current sync status */
  status: SyncState
  /** Whether online */
  isOnline: boolean
  /** Current connection type */
  connectionType: ConnectionType
  /** Last successful sync time */
  lastSyncTime: string | null
  /** Number of pending operations */
  pendingOperations: number
  /** Current conflicts */
  conflicts: ConflictInfo[]
  /** Last error message */
  error: string | null
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  /** WebSocket server URL */
  wsUrl: string
  /** HTTP API base URL */
  httpUrl: string
  /** Enable automatic sync */
  autoSync: boolean
  /** Sync interval in milliseconds */
  syncInterval: number
  /** Timeout before considering offline */
  offlineTimeout: number
  /** Maximum retry attempts */
  maxRetries: number
  /** Enable debug logging */
  debug: boolean
}

/**
 * Default sync manager configuration
 */
export const DEFAULT_SYNC_MANAGER_CONFIG: SyncManagerConfig = {
  wsUrl: 'ws://localhost:3000/ws',
  httpUrl: '/api',
  autoSync: true,
  syncInterval: 30000,
  offlineTimeout: 10000,
  maxRetries: 3,
  debug: false
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean
  /** Number of items synced */
  itemsSynced: number
  /** Number of conflicts detected */
  conflictsDetected: number
  /** Server time at sync completion */
  serverTime: string
  /** Error message if failed */
  error?: string
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Sync manager error
 */
export class SyncManagerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'SyncManagerError'
  }
}

// ============================================================================
// Sync Manager Class
// ============================================================================

/**
 * Sync Manager
 *
 * Core synchronization manager that coordinates:
 * - WebSocket client for real-time sync
 * - HTTP polling client for fallback
 * - Offline queue for offline operations
 * - Network monitor for connectivity detection
 * - Cache service for local data storage
 * - Cache consistency for conflict detection/resolution
 *
 * @example
 * ```typescript
 * const syncManager = new SyncManager({
 *   wsUrl: 'wss://api.example.com/ws',
 *   httpUrl: 'https://api.example.com',
 *   autoSync: true
 * })
 *
 * // Initialize with user credentials
 * await syncManager.initialize(userId, token)
 *
 * // Subscribe to state changes
 * syncManager.onStateChange((oldState, newState) => {
 *   console.log(`Sync state: ${oldState} -> ${newState}`)
 * })
 *
 * // Force a full sync
 * await syncManager.fullSync()
 *
 * // Clean up
 * syncManager.destroy()
 * ```
 */
export class SyncManager {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private config: SyncManagerConfig
  private state: SyncState = 'idle'
  private connectionType: ConnectionType = 'offline'

  // Service instances
  private wsClient: WebSocketClient | null = null
  private httpPollingClient: HTTPPollingClient | null = null
  private offlineQueue: OfflineQueue
  private networkMonitor: NetworkMonitor
  private cacheService: CacheService
  private cacheConsistency: CacheConsistency

  // Authentication
  private userId: number | null = null
  private token: string | null = null
  private clientId: string | null = null
  private deviceId: string | null = null

  // Callbacks
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set()
  private progressCallbacks: Set<ProgressCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()
  private updateCallbacks: Set<UpdateCallback> = new Set()

  // Sync state
  private lastSyncTime: string | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private isInitialized = false
  private isConnecting = false
  private currentConflicts: ConflictInfo[] = []
  private lastError: string | null = null

  // Unsubscribe functions
  private networkUnsubscribe: (() => void) | null = null
  private queueUnsubscribe: (() => void) | null = null
  private wsStateUnsubscribe: (() => void) | null = null
  private wsErrorUnsubscribe: (() => void) | null = null
  private wsUpdateUnsubscribe: (() => void) | null = null
  private wsConflictUnsubscribe: (() => void) | null = null
  private httpStateUnsubscribe: (() => void) | null = null
  private httpErrorUnsubscribe: (() => void) | null = null

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new SyncManager instance
   * @param config - Configuration options
   */
  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_MANAGER_CONFIG, ...config }

    // Get service instances
    this.offlineQueue = OfflineQueue.getInstance()
    this.networkMonitor = NetworkMonitor.getInstance()
    this.cacheService = CacheService.getInstance()
    this.cacheConsistency = CacheConsistency.getInstance()

    this.log('SyncManager created with config:', this.config)
  }

  // ============================================================================
  // Public Methods - Lifecycle
  // ============================================================================

  /**
   * Initialize the sync manager with user credentials
   * @param userId - User ID
   * @param token - JWT authentication token
   */
  async initialize(userId: number, token: string): Promise<void> {
    if (this.isInitialized) {
      this.log('Already initialized')
      return
    }

    this.userId = userId
    this.token = token
    this.clientId = this.generateClientId()
    this.deviceId = this.generateDeviceId()

    // Store user ID in cache metadata
    await this.cacheService.setMetadata('userId', userId)
    await this.cacheService.setMetadata('deviceId', this.deviceId)

    // Get last sync time from cache
    this.lastSyncTime = await this.cacheService.getLastSyncTime()

    // Set up network monitoring
    this.setupNetworkMonitoring()

    // Set up offline queue monitoring
    this.setupQueueMonitoring()

    // Initialize clients
    this.initializeClients()

    this.isInitialized = true
    this.log('SyncManager initialized for user:', userId)

    // Auto-connect if configured
    if (this.config.autoSync) {
      await this.connect()
    }
  }

  /**
   * Connect to the sync service
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      throw new SyncManagerError('SyncManager not initialized', 'NOT_INITIALIZED')
    }

    if (this.isConnecting) {
      this.log('Connection already in progress')
      return
    }

    this.isConnecting = true
    this.log('Connecting to sync service...')

    try {
      // Check network status
      const isOnline = this.networkMonitor.isOnline()

      if (!isOnline) {
        this.log('Network is offline, entering offline mode')
        this.transitionTo('offline')
        this.connectionType = 'offline'
        this.isConnecting = false
        return
      }

      // Try WebSocket first
      const wsConnected = await this.connectWebSocket()

      if (wsConnected) {
        this.connectionType = 'websocket'
        this.log('Connected via WebSocket')
      } else {
        // Fall back to HTTP polling
        this.log('WebSocket connection failed, falling back to HTTP polling')
        this.startHTTPPolling()
        this.connectionType = 'http'
      }

      // Start auto-sync timer if configured
      if (this.config.autoSync) {
        this.startSyncTimer()
      }

      // Process any pending offline operations
      await this.processOfflineQueue()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Connection failed'
      this.transitionTo('error')
      this.notifyErrorHandlers(error instanceof Error ? error : new Error(String(error)))
      throw new SyncManagerError(
        'Failed to connect to sync service',
        'CONNECTION_FAILED',
        error
      )
    } finally {
      this.isConnecting = false
    }
  }

  /**
   * Disconnect from the sync service
   */
  async disconnect(): Promise<void> {
    this.log('Disconnecting from sync service...')

    // Stop sync timer
    this.stopSyncTimer()

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect('User disconnect')
    }

    // Stop HTTP polling
    if (this.httpPollingClient) {
      this.httpPollingClient.stop()
    }

    this.connectionType = 'offline'
    this.transitionTo('idle')

    this.log('Disconnected from sync service')
  }

  /**
   * Destroy the sync manager and clean up resources
   */
  destroy(): void {
    this.log('Destroying SyncManager...')

    // Disconnect
    this.disconnect().catch(err => {
      this.log('Error during disconnect:', err)
    })

    // Unsubscribe from all services
    if (this.networkUnsubscribe) this.networkUnsubscribe()
    if (this.queueUnsubscribe) this.queueUnsubscribe()
    if (this.wsStateUnsubscribe) this.wsStateUnsubscribe()
    if (this.wsErrorUnsubscribe) this.wsErrorUnsubscribe()
    if (this.wsUpdateUnsubscribe) this.wsUpdateUnsubscribe()
    if (this.wsConflictUnsubscribe) this.wsConflictUnsubscribe()
    if (this.httpStateUnsubscribe) this.httpStateUnsubscribe()
    if (this.httpErrorUnsubscribe) this.httpErrorUnsubscribe()

    // Clear callbacks
    this.stateChangeCallbacks.clear()
    this.progressCallbacks.clear()
    this.errorCallbacks.clear()
    this.updateCallbacks.clear()

    // Destroy clients
    if (this.wsClient) {
      this.wsClient.destroy()
      this.wsClient = null
    }

    if (this.httpPollingClient) {
      this.httpPollingClient.destroy()
      this.httpPollingClient = null
    }

    this.isInitialized = false
    this.userId = null
    this.token = null

    this.log('SyncManager destroyed')
  }

  // ============================================================================
  // Public Methods - Sync Operations
  // ============================================================================

  /**
   * Perform a full synchronization
   */
  async fullSync(): Promise<SyncResult> {
    if (!this.isInitialized || !this.userId) {
      throw new SyncManagerError('SyncManager not initialized', 'NOT_INITIALIZED')
    }

    this.log('Starting full sync...')
    this.transitionTo('syncing')
    this.notifyProgress({
      phase: 'connecting',
      total: 0,
      processed: 0,
      percentage: 0,
      message: 'Connecting to server...'
    })

    try {
      // Get local data
      const localNotes = await this.cacheService.getNotes(this.userId)
      const localFolders = await this.cacheService.getFolders(this.userId)
      const localReviews = await this.cacheService.getReviews(this.userId)

      // Get pending operations
      const pendingOps = await this.offlineQueue.getPendingOperations(this.userId)

      this.notifyProgress({
        phase: 'uploading',
        total: pendingOps.length,
        processed: 0,
        percentage: 10,
        message: 'Uploading local changes...'
      })

      // Build sync request
      const syncRequest = this.buildSyncRequest(pendingOps, true)

      // Send sync request
      let response: SyncResponse | null = null

      if (this.connectionType === 'websocket' && this.wsClient?.isConnected()) {
        response = await this.wsClient.sendSyncRequest(syncRequest)
      } else if (this.connectionType === 'http') {
        response = await this.sendHTTPSyncRequest(syncRequest)
      } else {
        throw new SyncManagerError('No active connection', 'NO_CONNECTION')
      }

      // Process response
      this.notifyProgress({
        phase: 'downloading',
        total: response.server_updates.length,
        processed: 0,
        percentage: 50,
        message: 'Downloading server updates...'
      })

      // Apply server updates
      await this.applyServerUpdates(response.server_updates)

      // Process operation results
      await this.processOperationResults(response.operation_results)

      // Handle conflicts
      if (response.conflicts.length > 0) {
        this.currentConflicts = this.convertConflicts(response.conflicts)
        this.transitionTo('conflict')

        return {
          success: false,
          itemsSynced: response.operation_results.filter(r => r.success).length,
          conflictsDetected: response.conflicts.length,
          serverTime: response.server_time,
          error: 'Conflicts detected, manual resolution required'
        }
      }

      // Update last sync time
      this.lastSyncTime = response.server_time
      await this.cacheService.setLastSyncTime(response.server_time)

      this.notifyProgress({
        phase: 'complete',
        total: response.operation_results.length,
        processed: response.operation_results.length,
        percentage: 100,
        message: 'Sync complete'
      })

      this.transitionTo('idle')

      return {
        success: true,
        itemsSynced: response.operation_results.filter(r => r.success).length,
        conflictsDetected: 0,
        serverTime: response.server_time
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Sync failed'
      this.transitionTo('error')
      this.notifyErrorHandlers(error instanceof Error ? error : new Error(String(error)))

      return {
        success: false,
        itemsSynced: 0,
        conflictsDetected: 0,
        serverTime: new Date().toISOString(),
        error: this.lastError
      }
    }
  }

  /**
   * Perform an incremental synchronization
   */
  async incrementalSync(): Promise<SyncResult> {
    if (!this.isInitialized || !this.userId) {
      throw new SyncManagerError('SyncManager not initialized', 'NOT_INITIALIZED')
    }

    this.log('Starting incremental sync...')
    this.transitionTo('syncing')

    try {
      // Get pending operations only
      const pendingOps = await this.offlineQueue.getPendingOperations(this.userId)

      if (pendingOps.length === 0) {
        this.log('No pending operations, skipping sync')
        this.transitionTo('idle')
        return {
          success: true,
          itemsSynced: 0,
          conflictsDetected: 0,
          serverTime: new Date().toISOString()
        }
      }

      // Build sync request
      const syncRequest = this.buildSyncRequest(pendingOps, false)

      // Send sync request
      let response: SyncResponse | null = null

      if (this.connectionType === 'websocket' && this.wsClient?.isConnected()) {
        response = await this.wsClient.sendSyncRequest(syncRequest)
      } else if (this.connectionType === 'http') {
        response = await this.sendHTTPSyncRequest(syncRequest)
      } else {
        throw new SyncManagerError('No active connection', 'NO_CONNECTION')
      }

      // Apply server updates
      await this.applyServerUpdates(response.server_updates)

      // Process operation results
      await this.processOperationResults(response.operation_results)

      // Handle conflicts
      if (response.conflicts.length > 0) {
        this.currentConflicts = this.convertConflicts(response.conflicts)
        this.transitionTo('conflict')

        return {
          success: false,
          itemsSynced: response.operation_results.filter(r => r.success).length,
          conflictsDetected: response.conflicts.length,
          serverTime: response.server_time,
          error: 'Conflicts detected'
        }
      }

      // Update last sync time
      this.lastSyncTime = response.server_time
      await this.cacheService.setLastSyncTime(response.server_time)

      this.transitionTo('idle')

      return {
        success: true,
        itemsSynced: response.operation_results.filter(r => r.success).length,
        conflictsDetected: 0,
        serverTime: response.server_time
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Incremental sync failed'
      this.transitionTo('error')
      this.notifyErrorHandlers(error instanceof Error ? error : new Error(String(error)))

      return {
        success: false,
        itemsSynced: 0,
        conflictsDetected: 0,
        serverTime: new Date().toISOString(),
        error: this.lastError
      }
    }
  }

  /**
   * Force a synchronization
   */
  async forceSync(): Promise<SyncResult> {
    this.log('Forcing sync...')

    // Clear any cached state
    this.lastError = null

    // Reconnect if needed
    if (this.connectionType === 'offline') {
      await this.connect()
    }

    // Perform full sync
    return this.fullSync()
  }

  /**
   * Sync a single entity
   * @param entityType - Entity type
   * @param entityId - Entity ID
   */
  async syncEntity(entityType: EntityType, entityId: number): Promise<void> {
    if (!this.isInitialized || !this.userId) {
      throw new SyncManagerError('SyncManager not initialized', 'NOT_INITIALIZED')
    }

    this.log(`Syncing entity: ${entityType}:${entityId}`)

    // Get the entity from cache
    let entity: CachedNote | CachedFolder | CachedReview | null = null

    switch (entityType) {
      case 'note':
        entity = await this.cacheService.getNote(entityId)
        break
      case 'folder':
        entity = await this.cacheService.getFolder(entityId)
        break
      case 'review':
        entity = await this.cacheService.getReview(entityId)
        break
      default:
        throw new SyncManagerError(`Unknown entity type: ${entityType}`, 'UNKNOWN_ENTITY_TYPE')
    }

    if (!entity) {
      throw new SyncManagerError(`Entity not found: ${entityType}:${entityId}`, 'ENTITY_NOT_FOUND')
    }

    // Add to offline queue if dirty
    if (entity._dirty) {
      await this.offlineQueue.addOperation({
        user_id: this.userId,
        operation_type: 'UPDATE',
        entity_type: entityType as 'note' | 'folder' | 'review',
        entity_id: entityId,
        data: { ...entity }
      })
    }

    // Trigger incremental sync
    await this.incrementalSync()
  }

  // ============================================================================
  // Public Methods - Offline Support
  // ============================================================================

  /**
   * Enter offline mode manually
   */
  goOffline(): void {
    this.log('Entering offline mode')

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect('Going offline')
    }

    // Stop HTTP polling
    if (this.httpPollingClient) {
      this.httpPollingClient.stop()
    }

    this.connectionType = 'offline'
    this.transitionTo('offline')

    // Set offline queue mode
    this.offlineQueue.setOfflineMode(true)
  }

  /**
   * Resume online mode
   */
  async goOnline(): Promise<void> {
    this.log('Resuming online mode')

    // Clear offline mode
    this.offlineQueue.setOfflineMode(false)

    // Reconnect
    await this.connect()
  }

  /**
   * Process the offline queue
   */
  async processOfflineQueue(): Promise<void> {
    if (!this.isInitialized || !this.userId) {
      return
    }

    const pendingOps = await this.offlineQueue.getPendingOperations(this.userId)

    if (pendingOps.length === 0) {
      this.log('No pending offline operations')
      return
    }

    this.log(`Processing ${pendingOps.length} offline operations`)

    // Trigger incremental sync to process pending operations
    await this.incrementalSync()
  }

  // ============================================================================
  // Public Methods - Conflict Handling
  // ============================================================================

  /**
   * Get current conflicts
   */
  getConflicts(): ConflictInfo[] {
    return [...this.currentConflicts]
  }

  /**
   * Resolve a conflict
   * @param conflictId - Conflict ID
   * @param resolution - Resolution strategy
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'server' | 'merge'
  ): Promise<void> {
    const conflict = this.currentConflicts.find(
      c => `${c.entityType}_${c.entityId}` === conflictId
    )

    if (!conflict) {
      throw new SyncManagerError(`Conflict not found: ${conflictId}`, 'CONFLICT_NOT_FOUND')
    }

    this.log(`Resolving conflict ${conflictId} with strategy: ${resolution}`)

    // Use cache consistency manager to resolve
    const resolved = this.cacheConsistency.resolveConflict(conflict, resolution)

    // Apply resolved data to cache
    switch (resolved.entityType) {
      case 'note':
        await this.cacheService.saveNote(resolved.data as CachedNote)
        break
      case 'folder':
        await this.cacheService.saveFolder(resolved.data as CachedFolder)
        break
      case 'review':
        await this.cacheService.saveReview(resolved.data as CachedReview)
        break
    }

    // Remove from current conflicts
    this.currentConflicts = this.currentConflicts.filter(
      c => `${c.entityType}_${c.entityId}` !== conflictId
    )

    // If no more conflicts, return to idle
    if (this.currentConflicts.length === 0 && this.state === 'conflict') {
      this.transitionTo('idle')
    }

    // Sync the resolved data
    await this.syncEntity(resolved.entityType, resolved.data.id)
  }

  /**
   * Auto-resolve all conflicts
   */
  async autoResolveConflicts(): Promise<void> {
    this.log('Auto-resolving all conflicts')

    for (const conflict of this.currentConflicts) {
      const resolved = this.cacheConsistency.autoResolve(conflict)

      // Apply resolved data
      switch (resolved.entityType) {
        case 'note':
          await this.cacheService.saveNote(resolved.data as CachedNote)
          break
        case 'folder':
          await this.cacheService.saveFolder(resolved.data as CachedFolder)
          break
        case 'review':
          await this.cacheService.saveReview(resolved.data as CachedReview)
          break
      }
    }

    // Clear conflicts
    this.currentConflicts = []

    // Return to idle
    if (this.state === 'conflict') {
      this.transitionTo('idle')
    }

    // Trigger sync
    await this.incrementalSync()
  }

  // ============================================================================
  // Public Methods - Event Subscription
  // ============================================================================

  /**
   * Subscribe to state changes
   * @param callback - State change callback
   * @returns Unsubscribe function
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback)
    return () => this.stateChangeCallbacks.delete(callback)
  }

  /**
   * Subscribe to sync progress
   * @param callback - Progress callback
   * @returns Unsubscribe function
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  /**
   * Subscribe to errors
   * @param callback - Error callback
   * @returns Unsubscribe function
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback)
    return () => this.errorCallbacks.delete(callback)
  }

  /**
   * Subscribe to server updates
   * @param callback - Update callback
   * @returns Unsubscribe function
   */
  onServerUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback)
    return () => this.updateCallbacks.delete(callback)
  }

  // ============================================================================
  // Public Methods - State Query
  // ============================================================================

  /**
   * Get current sync manager state
   */
  getState(): SyncManagerState {
    return {
      status: this.state,
      isOnline: this.networkMonitor.isOnline(),
      connectionType: this.connectionType,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: 0, // Will be updated async
      conflicts: this.currentConflicts,
      error: this.lastError
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionType !== 'offline'
  }

  /**
   * Get connection type
   */
  getConnectionType(): ConnectionType {
    return this.connectionType
  }

  // ============================================================================
  // Private Methods - Initialization
  // ============================================================================

  /**
   * Initialize client instances
   */
  private initializeClients(): void {
    // Create WebSocket client
    this.wsClient = new WebSocketClient({
      url: this.config.wsUrl,
      debug: this.config.debug
    })

    // Create HTTP polling client
    this.httpPollingClient = new HTTPPollingClient({
      baseUrl: this.config.httpUrl,
      debug: this.config.debug
    })

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers()

    // Set up HTTP polling event handlers
    this.setupHTTPPollingHandlers()
  }

  /**
   * Set up network monitoring
   */
  private setupNetworkMonitoring(): void {
    this.networkUnsubscribe = this.networkMonitor.subscribe(state => {
      this.log('Network state changed:', state)

      if (state.isOnline && this.state === 'offline') {
        // Network recovered
        this.log('Network recovered, reconnecting...')
        this.connect().catch(err => {
          this.log('Reconnection failed:', err)
        })
      } else if (!state.isOnline && this.state !== 'offline') {
        // Network lost
        this.log('Network lost, entering offline mode')
        this.goOffline()
      }
    })
  }

  /**
   * Set up queue monitoring
   */
  private setupQueueMonitoring(): void {
    this.queueUnsubscribe = this.offlineQueue.subscribe(change => {
      this.log('Queue changed:', change.type)

      // Trigger sync when new operations are added
      if (change.type === 'added' && this.isConnected() && this.state === 'idle') {
        this.incrementalSync().catch(err => {
          this.log('Auto-sync failed:', err)
        })
      }
    })
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wsClient) return

    // State changes
    this.wsStateUnsubscribe = this.wsClient.onStateChange((oldState, newState) => {
      this.log('WebSocket state changed:', oldState, '->', newState)

      if (newState === 'authenticated') {
        this.connectionType = 'websocket'
      } else if (newState === 'disconnected' || newState === 'error') {
        // Try to upgrade to WebSocket from HTTP
        if (this.connectionType === 'websocket') {
          this.log('WebSocket disconnected, falling back to HTTP')
          this.startHTTPPolling()
          this.connectionType = 'http'
        }
      }
    })

    // Errors
    this.wsErrorUnsubscribe = this.wsClient.onError(error => {
      this.log('WebSocket error:', error.message)
      this.lastError = error.message
      this.notifyErrorHandlers(error)
    })

    // Server updates
    this.wsUpdateUnsubscribe = this.wsClient.onServerUpdate(update => {
      this.log('Received server update:', update.update_type)
      this.handleServerUpdate(update)
    })

    // Conflicts
    this.wsConflictUnsubscribe = this.wsClient.onConflict((conflict, requiresManual) => {
      this.log('Received conflict notification:', conflict.conflict_id)
      this.handleConflictNotification(conflict, requiresManual)
    })
  }

  /**
   * Set up HTTP polling event handlers
   */
  private setupHTTPPollingHandlers(): void {
    if (!this.httpPollingClient) return

    // State changes
    this.httpStateUnsubscribe = this.httpPollingClient.onStateChange((oldState, newState) => {
      this.log('HTTP polling state changed:', oldState, '->', newState)
    })

    // Errors
    this.httpErrorUnsubscribe = this.httpPollingClient.onError(error => {
      this.log('HTTP polling error:', error.message)
      this.lastError = error.message
      this.notifyErrorHandlers(error)
    })
  }

  // ============================================================================
  // Private Methods - Connection
  // ============================================================================

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<boolean> {
    if (!this.wsClient || !this.token || !this.clientId) {
      return false
    }

    try {
      await this.wsClient.connect(this.token, this.clientId, this.deviceId ?? undefined)
      return true
    } catch (error) {
      this.log('WebSocket connection failed:', error)
      return false
    }
  }

  /**
   * Start HTTP polling
   */
  private startHTTPPolling(): void {
    if (!this.httpPollingClient || !this.token || !this.clientId) {
      return
    }

    this.httpPollingClient.start(this.token, this.clientId)
  }

  // ============================================================================
  // Private Methods - Sync Operations
  // ============================================================================

  /**
   * Build a sync request from pending operations
   */
  private buildSyncRequest(pendingOps: SyncQueueItem[], full: boolean): SyncRequest {
    const operations: SyncOperation[] = pendingOps.map(op => ({
      operation_id: op.id,
      operation_type: this.mapOperationType(op.operation_type),
      entity_type: op.entity_type as EntityType,
      entity_id: op.entity_id ?? undefined,
      client_id: this.clientId!,
      timestamp: op.timestamp,
      data: op.data
    } as SyncOperation))

    const clientState: ClientSyncState = {
      client_id: this.clientId!,
      last_sync_time: this.lastSyncTime ?? new Date(0).toISOString(),
      server_version: '1.0.0',
      pending_operations: pendingOps.length
    }

    return {
      request_id: this.generateRequestId(),
      client_id: this.clientId!,
      client_state: clientState,
      protocol_version: '1.0.0',
      operations,
      incremental: !full
    }
  }

  /**
   * Send sync request via HTTP
   */
  private async sendHTTPSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    const response = await fetch(`${this.config.httpUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new SyncManagerError(
        `HTTP sync failed: ${response.status}`,
        'HTTP_SYNC_ERROR'
      )
    }

    return response.json()
  }

  /**
   * Apply server updates to local cache
   */
  private async applyServerUpdates(updates: SyncResponse['server_updates']): Promise<void> {
    for (const update of updates) {
      switch (update.entity_type) {
        case 'note':
          if (update.operation_type === SyncOperationType.DELETE) {
            await this.cacheService.deleteNote(update.entity_id)
          } else if (update.data) {
            await this.cacheService.saveNote({
              ...(update.data as unknown as CachedNote),
              _cachedAt: Date.now(),
              _dirty: false
            })
          }
          break

        case 'folder':
          if (update.operation_type === SyncOperationType.DELETE) {
            await this.cacheService.deleteFolder(update.entity_id)
          } else if (update.data) {
            await this.cacheService.saveFolder({
              ...(update.data as unknown as CachedFolder),
              _cachedAt: Date.now(),
              _dirty: false
            })
          }
          break

        case 'review':
          if (update.operation_type === SyncOperationType.DELETE) {
            await this.cacheService.deleteReview(update.entity_id)
          } else if (update.data) {
            await this.cacheService.saveReview({
              ...(update.data as unknown as CachedReview),
              _cachedAt: Date.now(),
              _dirty: false
            })
          }
          break
      }
    }
  }

  /**
   * Process operation results from server
   */
  private async processOperationResults(
    results: SyncResponse['operation_results']
  ): Promise<void> {
    for (const result of results) {
      if (result.success) {
        // Mark operation as completed in queue
        await this.offlineQueue.markCompleted(result.operation_id)
      } else {
        // Mark operation as failed
        await this.offlineQueue.markFailed(
          result.operation_id,
          result.error ?? 'Unknown error'
        )
      }
    }
  }

  /**
   * Handle server update from WebSocket
   */
  private async handleServerUpdate(update: ServerUpdateMessage): Promise<void> {
    // Notify update callbacks
    this.notifyUpdateHandlers(update)

    // Apply update to cache
    const { entity_type, entity_id, update_data } = update
    const { operation_type, data } = update_data

    switch (entity_type) {
      case 'note':
        if (operation_type === SyncOperationType.DELETE) {
          await this.cacheService.deleteNote(entity_id!)
        } else if (data) {
          await this.cacheService.saveNote({
            ...(data as unknown as CachedNote),
            _cachedAt: Date.now(),
            _dirty: false
          })
        }
        break

      case 'folder':
        if (operation_type === SyncOperationType.DELETE) {
          await this.cacheService.deleteFolder(entity_id!)
        } else if (data) {
          await this.cacheService.saveFolder({
            ...(data as unknown as CachedFolder),
            _cachedAt: Date.now(),
            _dirty: false
          })
        }
        break

      case 'review':
        if (operation_type === SyncOperationType.DELETE) {
          await this.cacheService.deleteReview(entity_id!)
        } else if (data) {
          await this.cacheService.saveReview({
            ...(data as unknown as CachedReview),
            _cachedAt: Date.now(),
            _dirty: false
          })
        }
        break
    }
  }

  /**
   * Handle conflict notification from server
   */
  private handleConflictNotification(conflict: Conflict, requiresManual: boolean): void {
    const conflictInfo: ConflictInfo = {
      entityType: conflict.entity_type as 'note' | 'folder' | 'review',
      entityId: conflict.entity_id,
      localData: conflict.client_data.data,
      serverData: conflict.server_data.data,
      conflictFields: conflict.conflict_fields,
      suggestedResolution: this.mapResolutionStrategy(conflict.suggested_strategy)
    }

    this.currentConflicts.push(conflictInfo)

    if (requiresManual) {
      this.transitionTo('conflict')
    } else {
      // Auto-resolve
      this.autoResolveConflicts().catch(err => {
        this.log('Auto-resolve failed:', err)
      })
    }
  }

  // ============================================================================
  // Private Methods - State Management
  // ============================================================================

  /**
   * Transition to a new state
   */
  private transitionTo(newState: SyncState): void {
    const oldState = this.state

    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      this.log(`Invalid state transition: ${oldState} -> ${newState}`)
      return
    }

    this.state = newState
    this.log(`State transition: ${oldState} -> ${newState}`)

    // Notify state change callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(oldState, newState)
      } catch (error) {
        this.log('Error in state change callback:', error)
      }
    })
  }

  /**
   * Check if state transition is valid
   */
  private isValidTransition(from: SyncState, to: SyncState): boolean {
    const validTransitions: Record<SyncState, SyncState[]> = {
      idle: ['syncing', 'offline', 'error'],
      syncing: ['idle', 'conflict', 'offline', 'error'],
      offline: ['syncing', 'idle'],
      conflict: ['syncing', 'idle'],
      error: ['idle', 'syncing', 'offline']
    }

    return validTransitions[from]?.includes(to) ?? false
  }

  // ============================================================================
  // Private Methods - Timer
  // ============================================================================

  /**
   * Start the auto-sync timer
   */
  private startSyncTimer(): void {
    this.stopSyncTimer()

    this.syncTimer = setInterval(() => {
      if (this.state === 'idle' && this.isConnected()) {
        this.incrementalSync().catch(err => {
          this.log('Auto-sync failed:', err)
        })
      }
    }, this.config.syncInterval)
  }

  /**
   * Stop the auto-sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  // ============================================================================
  // Private Methods - Notification
  // ============================================================================

  /**
   * Notify progress callbacks
   */
  private notifyProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        this.log('Error in progress callback:', error)
      }
    })
  }

  /**
   * Notify error callbacks
   */
  private notifyErrorHandlers(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error)
      } catch (err) {
        this.log('Error in error callback:', err)
      }
    })
  }

  /**
   * Notify update callbacks
   */
  private notifyUpdateHandlers(update: ServerUpdateMessage): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(update)
      } catch (error) {
        this.log('Error in update callback:', error)
      }
    })
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Map operation type from cache to sync protocol
   */
  private mapOperationType(type: string): 'create' | 'update' | 'delete' {
    const map: Record<string, 'create' | 'update' | 'delete'> = {
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete'
    }
    return map[type] ?? 'update'
  }

  /**
   * Map resolution strategy from sync protocol to local
   */
  private mapResolutionStrategy(
    strategy: ConflictResolutionStrategy
  ): 'local' | 'server' | 'merge' {
    const map: Record<string, 'local' | 'server' | 'merge'> = {
      client_wins: 'local',
      server_wins: 'server',
      merge: 'merge',
      latest_wins: 'server'
    }
    return map[strategy] ?? 'server'
  }

  /**
   * Convert sync protocol conflicts to local conflict info
   */
  private convertConflicts(conflicts: Conflict[]): ConflictInfo[] {
    return conflicts.map(c => ({
      entityType: c.entity_type as 'note' | 'folder' | 'review',
      entityId: c.entity_id,
      localData: c.client_data.data,
      serverData: c.server_data.data,
      conflictFields: c.conflict_fields,
      suggestedResolution: this.mapResolutionStrategy(c.suggested_strategy)
    }))
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[SyncManager] ${message}`, ...args)
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default SyncManager
