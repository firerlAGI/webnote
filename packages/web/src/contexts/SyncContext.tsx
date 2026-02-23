/**
 * SyncContext
 * Provides synchronization state management for the WebNote application
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { SyncManager, SyncState as SyncManagerState, ConnectionType, SyncProgress, SyncResult } from '../services/sync/SyncManager'
import type { ConflictInfo } from '../services/cache/CacheConsistency'
import { NetworkMonitor } from '../services/sync/NetworkMonitor'
import { OfflineQueue } from '../services/sync/OfflineQueue'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Sync status type matching SyncManager state
 */
export type SyncStatus = SyncManagerState

/**
 * Sync status callback type
 */
export type SyncStatusCallback = (status: SyncContextType) => void

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'local' | 'server' | 'merge'

/**
 * Sync context type definition
 */
export interface SyncContextType {
  // Sync status
  status: SyncStatus
  isOnline: boolean
  connectionType: ConnectionType
  lastSyncTime: string | null

  // Pending operations
  pendingOperations: number

  // Conflicts
  conflicts: ConflictInfo[]

  // Control methods
  forceSync: () => Promise<void>
  resolveConflict: (conflictId: string, resolution: ConflictResolution) => Promise<void>
  goOffline: () => void
  goOnline: () => Promise<void>

  // Subscription
  subscribe: (callback: SyncStatusCallback) => () => void

  // Progress
  progress: SyncProgress | null
  error: string | null
}

/**
 * Sync provider props
 */
export interface SyncProviderProps {
  children: React.ReactNode
  /** User ID for sync operations */
  userId: number | null
  /** JWT authentication token */
  token: string | null
  /** WebSocket server URL */
  wsUrl?: string
  /** HTTP API base URL */
  httpUrl?: string
  /** Enable auto sync */
  autoSync?: boolean
  /** Sync interval in milliseconds */
  syncInterval?: number
  /** Enable debug logging */
  debug?: boolean
}

// ============================================================================
// Context Creation
// ============================================================================

const SyncContext = createContext<SyncContextType | undefined>(undefined)

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SYNC_PROGRESS: SyncProgress = {
  phase: 'complete',
  total: 0,
  processed: 0,
  percentage: 100
}

// ============================================================================
// Sync Provider Component
// ============================================================================

/**
 * SyncProvider
 *
 * Provides synchronization state management for the application.
 * Manages online/offline state, sync progress, and conflict resolution.
 *
 * @example
 * ```tsx
 * <SyncProvider userId={userId} token={token}>
 *   <App />
 * </SyncProvider>
 * ```
 */
export const SyncProvider: React.FC<SyncProviderProps> = ({
  children,
  userId,
  token,
  wsUrl = 'ws://localhost:3000/ws',
  httpUrl = '/api',
  autoSync = true,
  syncInterval = 30000,
  debug = false
}) => {
  // ============================================================================
  // State
  // ============================================================================

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(true)
  const [connectionType, setConnectionType] = useState<ConnectionType>('offline')
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [pendingOperations, setPendingOperations] = useState(0)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ============================================================================
  // Refs
  // ============================================================================

  const syncManagerRef = useRef<SyncManager | null>(null)
  const networkMonitorRef = useRef<NetworkMonitor | null>(null)
  const offlineQueueRef = useRef<OfflineQueue | null>(null)
  const callbacksRef = useRef<Set<SyncStatusCallback>>(new Set())
  const unsubscriptionsRef = useRef<(() => void)[]>([])

  // ============================================================================
  // Notify Callbacks
  // ============================================================================

  const notifyCallbacks = useCallback(() => {
    const contextValue: SyncContextType = {
      status,
      isOnline,
      connectionType,
      lastSyncTime,
      pendingOperations,
      conflicts,
      forceSync: async () => { /* placeholder */ },
      resolveConflict: async () => { /* placeholder */ },
      goOffline: () => { /* placeholder */ },
      goOnline: async () => { /* placeholder */ },
      subscribe: () => () => { /* placeholder */ },
      progress,
      error
    }

    callbacksRef.current.forEach(callback => {
      try {
        callback(contextValue)
      } catch (err) {
        if (debug) {
          console.error('[SyncContext] Error in callback:', err)
        }
      }
    })
  }, [status, isOnline, connectionType, lastSyncTime, pendingOperations, conflicts, progress, error, debug])

  // ============================================================================
  // Initialize Services
  // ============================================================================

  useEffect(() => {
    // Get singleton instances
    networkMonitorRef.current = NetworkMonitor.getInstance()
    offlineQueueRef.current = OfflineQueue.getInstance()

    // Subscribe to network state
    const networkUnsubscribe = networkMonitorRef.current.subscribe(state => {
      setIsOnline(state.isOnline)
      if (!state.isOnline && status !== 'offline') {
        setStatus('offline')
      }
    })
    unsubscriptionsRef.current.push(networkUnsubscribe)

    // Subscribe to queue changes
    const queueUnsubscribe = offlineQueueRef.current.subscribe(async change => {
      if (change.user_id === userId || change.user_id === 0) {
        // Update pending operations count
        if (offlineQueueRef.current && userId) {
          const queueStatus = await offlineQueueRef.current.getStatus(userId)
          setPendingOperations(queueStatus.pending)
        }
      }
    })
    unsubscriptionsRef.current.push(queueUnsubscribe)

    // Set initial online state
    setIsOnline(networkMonitorRef.current.isOnline())

    return () => {
      unsubscriptionsRef.current.forEach(unsub => unsub())
      unsubscriptionsRef.current = []
    }
  }, [userId, status, debug])

  // ============================================================================
  // Initialize SyncManager
  // ============================================================================

  useEffect(() => {
    // Clean up existing sync manager
    if (syncManagerRef.current) {
      syncManagerRef.current.destroy()
      syncManagerRef.current = null
    }

    // Only initialize if we have userId and token
    if (!userId || !token) {
      setStatus('idle')
      setConnectionType('offline')
      setPendingOperations(0)
      setConflicts([])
      return
    }

    // Create new sync manager
    const syncManager = new SyncManager({
      wsUrl,
      httpUrl,
      autoSync,
      syncInterval,
      debug
    })

    syncManagerRef.current = syncManager

    // Subscribe to state changes
    const stateUnsubscribe = syncManager.onStateChange((oldState, newState) => {
      if (debug) {
        console.log(`[SyncContext] State changed: ${oldState} -> ${newState}`)
      }
      setStatus(newState)
    })
    unsubscriptionsRef.current.push(stateUnsubscribe)

    // Subscribe to progress
    const progressUnsubscribe = syncManager.onProgress(progressInfo => {
      setProgress(progressInfo)
    })
    unsubscriptionsRef.current.push(progressUnsubscribe)

    // Subscribe to errors
    const errorUnsubscribe = syncManager.onError(err => {
      setError(err.message)
    })
    unsubscriptionsRef.current.push(errorUnsubscribe)

    // Subscribe to server updates
    const updateUnsubscribe = syncManager.onServerUpdate(update => {
      if (debug) {
        console.log('[SyncContext] Server update received:', update.update_type)
      }
      // Trigger re-render for data consumers
      notifyCallbacks()
    })
    unsubscriptionsRef.current.push(updateUnsubscribe)

    // Initialize sync manager
    syncManager.initialize(userId, token).then(() => {
      if (debug) {
        console.log('[SyncContext] SyncManager initialized')
      }

      // Get initial state
      const state = syncManager.getState()
      setStatus(state.status)
      setConnectionType(state.connectionType)
      setLastSyncTime(state.lastSyncTime)
      setConflicts(state.conflicts)
      setError(state.error)

      // Get pending operations count
      if (offlineQueueRef.current) {
        offlineQueueRef.current.getStatus(userId).then(queueStatus => {
          setPendingOperations(queueStatus.pending)
        })
      }
    }).catch(err => {
      console.error('[SyncContext] Failed to initialize SyncManager:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize sync')
      setStatus('error')
    })

    return () => {
      if (syncManagerRef.current) {
        syncManagerRef.current.destroy()
        syncManagerRef.current = null
      }
    }
  }, [userId, token, wsUrl, httpUrl, autoSync, syncInterval, debug, notifyCallbacks])

  // ============================================================================
  // Control Methods
  // ============================================================================

  /**
   * Force a synchronization
   */
  const forceSync = useCallback(async (): Promise<void> => {
    if (!syncManagerRef.current) {
      throw new Error('SyncManager not initialized')
    }

    setError(null)
    setProgress({
      phase: 'connecting',
      total: 0,
      processed: 0,
      percentage: 0,
      message: 'Starting sync...'
    })

    try {
      const result: SyncResult = await syncManagerRef.current.forceSync()

      if (!result.success && result.error) {
        setError(result.error)
      }

      // Update state after sync
      const state = syncManagerRef.current.getState()
      setLastSyncTime(state.lastSyncTime)
      setConflicts(state.conflicts)

      if (offlineQueueRef.current && userId) {
        const queueStatus = await offlineQueueRef.current.getStatus(userId)
        setPendingOperations(queueStatus.pending)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed'
      setError(errorMessage)
      throw err
    } finally {
      setProgress(null)
    }
  }, [userId])

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> => {
    if (!syncManagerRef.current) {
      throw new Error('SyncManager not initialized')
    }

    try {
      await syncManagerRef.current.resolveConflict(conflictId, resolution)

      // Update conflicts list
      setConflicts(syncManagerRef.current.getConflicts())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve conflict'
      setError(errorMessage)
      throw err
    }
  }, [])

  /**
   * Enter offline mode manually
   */
  const goOffline = useCallback((): void => {
    if (syncManagerRef.current) {
      syncManagerRef.current.goOffline()
    }
    setStatus('offline')
    setConnectionType('offline')
    setIsOnline(false)
  }, [])

  /**
   * Resume online mode
   */
  const goOnline = useCallback(async (): Promise<void> => {
    if (!syncManagerRef.current) {
      throw new Error('SyncManager not initialized')
    }

    try {
      await syncManagerRef.current.goOnline()

      // Update state
      const state = syncManagerRef.current.getState()
      setStatus(state.status)
      setConnectionType(state.connectionType)
      setIsOnline(state.isOnline)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to go online'
      setError(errorMessage)
      throw err
    }
  }, [])

  /**
   * Subscribe to sync status changes
   */
  const subscribe = useCallback((callback: SyncStatusCallback): (() => void) => {
    callbacksRef.current.add(callback)

    return () => {
      callbacksRef.current.delete(callback)
    }
  }, [])

  // ============================================================================
  // Notify callbacks on state changes
  // ============================================================================

  useEffect(() => {
    notifyCallbacks()
  }, [notifyCallbacks])

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: SyncContextType = {
    status,
    isOnline,
    connectionType,
    lastSyncTime,
    pendingOperations,
    conflicts,
    forceSync,
    resolveConflict,
    goOffline,
    goOnline,
    subscribe,
    progress,
    error
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access sync context
 *
 * @returns Sync context value
 * @throws Error if used outside of SyncProvider
 *
 * @example
 * ```tsx
 * const { status, isOnline, forceSync } = useSync()
 *
 * if (!isOnline) {
 *   return <div>You are offline</div>
 * }
 * ```
 */
export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext)

  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider')
  }

  return context
}

// ============================================================================
// Exports
// ============================================================================

export default SyncContext
