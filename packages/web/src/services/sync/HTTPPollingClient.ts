/**
 * HTTP Polling Sync Client
 * Fallback client for data synchronization when WebSocket is unavailable
 */

import axios, { AxiosError, AxiosInstance } from 'axios'
import type { EntityType, SyncOperationType } from '@webnote/shared/types/sync'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * HTTP polling client states
 */
export type PollingState = 'idle' | 'polling' | 'error'

/**
 * State change callback type
 */
export type PollingStateChangeCallback = (
  oldState: PollingState,
  newState: PollingState
) => void

/**
 * Server update from polling response
 */
export interface ServerPollingUpdate {
  /** Entity type */
  entity_type: EntityType
  /** Entity ID */
  entity_id: number
  /** Operation type */
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** Entity data */
  data?: Record<string, unknown>
  /** Modification timestamp */
  modified_at: string
}

/**
 * Polling response from server
 */
export interface PollingResponse {
  /** Success status */
  success: boolean
  /** List of updates from server */
  updates: ServerPollingUpdate[]
  /** Whether there are more updates available */
  has_more: boolean
  /** Server timestamp */
  server_time: string
  /** Server suggested polling interval in milliseconds */
  suggested_interval?: number
  /** Error message if failed */
  error?: string
}

/**
 * HTTP polling client configuration
 */
export interface HTTPPollingConfig {
  /** Base URL for API requests */
  baseUrl: string
  /** Initial polling interval in milliseconds */
  initialInterval: number
  /** Maximum polling interval in milliseconds */
  maxInterval: number
  /** Minimum polling interval in milliseconds */
  minInterval: number
  /** Maximum retry attempts on error */
  maxRetries: number
  /** Request timeout in milliseconds */
  timeout: number
  /** Enable debug logging */
  debug: boolean
}

/**
 * Default HTTP polling configuration
 */
export const DEFAULT_POLLING_CONFIG: HTTPPollingConfig = {
  baseUrl: '/api',
  initialInterval: 5000,
  maxInterval: 30000,
  minInterval: 1000,
  maxRetries: 5,
  timeout: 10000,
  debug: false
}

/**
 * Polling handler function type
 */
export type PollingHandler = (updates: ServerPollingUpdate[]) => void

/**
 * Error handler function type
 */
export type PollingErrorHandler = (error: Error) => void

/**
 * HTTP polling client statistics
 */
export interface HTTPPollingStats {
  /** Total polls performed */
  totalPolls: number
  /** Successful polls */
  successfulPolls: number
  /** Failed polls */
  failedPolls: number
  /** Total updates received */
  totalUpdates: number
  /** Current retry count */
  retryCount: number
  /** Last poll timestamp */
  lastPollAt?: string
  /** Last successful poll timestamp */
  lastSuccessAt?: string
  /** Average poll duration in milliseconds */
  averageDuration?: number
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * HTTP polling error
 */
export class HTTPPollingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'HTTPPollingError'
  }
}

/**
 * Authentication error for polling
 */
export class HTTPPollingAuthError extends HTTPPollingError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_FAILED', 401)
    this.name = 'HTTPPollingAuthError'
  }
}

/**
 * Rate limit error for polling
 */
export class HTTPPollingRateLimitError extends HTTPPollingError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMITED', 429)
    this.name = 'HTTPPollingRateLimitError'
  }
}

/**
 * Network error for polling
 */
export class HTTPPollingNetworkError extends HTTPPollingError {
  constructor(message: string = 'Network error') {
    super(message, 'NETWORK_ERROR')
    this.name = 'HTTPPollingNetworkError'
  }
}

// ============================================================================
// HTTP Polling Client Class
// ============================================================================

/**
 * HTTP polling client for data synchronization
 *
 * Features:
 * - Automatic polling with dynamic interval adjustment
 * - Exponential backoff on errors
 * - Server-suggested interval optimization
 * - Subscription system for update handling
 * - State management and error handling
 *
 * @example
 * ```typescript
 * const client = new HTTPPollingClient({
 *   baseUrl: 'https://api.example.com',
 *   initialInterval: 5000,
 *   maxInterval: 30000
 * })
 *
 * // Subscribe to updates
 * client.subscribe((updates) => {
 *   console.log('Received updates:', updates)
 * })
 *
 * // Start polling
 * client.start('jwt-token', 'client-id')
 *
 * // Stop polling
 * client.stop()
 * ```
 */
export class HTTPPollingClient {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private config: HTTPPollingConfig
  private axiosInstance: AxiosInstance
  private pollingState: PollingState = 'idle'
  private stateChangeCallbacks: Set<PollingStateChangeCallback> = new Set()
  private handlers: Set<PollingHandler> = new Set()
  private errorHandlers: Set<PollingErrorHandler> = new Set()

  // Authentication
  private token: string | null = null
  private clientId: string | null = null

  // Polling
  private pollingTimer: NodeJS.Timeout | null = null
  private currentInterval: number
  private lastSyncTime: string | null = null
  private isPollingInProgress = false

  // Retry logic
  private retryCount = 0
  private consecutiveErrors = 0

  // Statistics
  private stats: HTTPPollingStats = {
    totalPolls: 0,
    successfulPolls: 0,
    failedPolls: 0,
    totalUpdates: 0,
    retryCount: 0
  }

  // Duration tracking
  private durationHistory: number[] = []
  private readonly maxDurationHistory = 10

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new HTTP polling client instance
   * @param config - Client configuration options
   */
  constructor(config: Partial<HTTPPollingConfig> = {}) {
    this.config = { ...DEFAULT_POLLING_CONFIG, ...config }
    this.currentInterval = this.config.initialInterval

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.log('HTTPPollingClient created with config:', this.config)
  }

  // ============================================================================
  // Public Methods - Lifecycle
  // ============================================================================

  /**
   * Start polling for updates
   * @param token - JWT authentication token
   * @param clientId - Unique client identifier
   */
  start(token: string, clientId: string): void {
    if (this.pollingState === 'polling') {
      this.log('Polling already in progress')
      return
    }

    this.token = token
    this.clientId = clientId
    this.retryCount = 0
    this.consecutiveErrors = 0
    this.currentInterval = this.config.initialInterval

    // Update axios authorization header
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`

    this.updateState('polling')
    this.log('Starting polling')

    // Start polling immediately
    this.scheduleNextPoll(0)
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollingState === 'idle') {
      return
    }

    this.log('Stopping polling')
    this.clearPollingTimer()
    this.updateState('idle')

    // Clear authentication
    this.token = null
    this.clientId = null
    delete this.axiosInstance.defaults.headers.common['Authorization']
  }

  /**
   * Execute a single poll request
   * @returns Promise resolving to polling response
   */
  async poll(): Promise<PollingResponse> {
    if (!this.token || !this.clientId) {
      throw new HTTPPollingAuthError('Not authenticated')
    }

    const startTime = Date.now()
    this.stats.totalPolls++
    this.stats.lastPollAt = new Date().toISOString()

    try {
      const params: Record<string, string> = {
        client_id: this.clientId
      }

      // Add since parameter for incremental sync
      if (this.lastSyncTime) {
        params.since = this.lastSyncTime
      }

      const response = await this.axiosInstance.get<PollingResponse>('/sync/poll', {
        params,
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      })

      const data = response.data
      const duration = Date.now() - startTime

      // Track duration
      this.durationHistory.push(duration)
      if (this.durationHistory.length > this.maxDurationHistory) {
        this.durationHistory.shift()
      }
      this.stats.averageDuration = this.getAverageDuration()

      if (data.success) {
        this.handleSuccessfulPoll(data)
      } else {
        throw new HTTPPollingError(
          data.error || 'Poll failed',
          'POLL_FAILED'
        )
      }

      return data
    } catch (error) {
      this.handlePollError(error as Error)
      throw error
    }
  }

  /**
   * Dynamically adjust polling interval
   * @param interval - New interval in milliseconds
   */
  setInterval(interval: number): void {
    const clampedInterval = Math.max(
      this.config.minInterval,
      Math.min(this.config.maxInterval, interval)
    )

    this.currentInterval = clampedInterval
    this.log(`Interval updated to ${clampedInterval}ms`)

    // Reschedule if currently polling
    if (this.pollingState === 'polling' && !this.isPollingInProgress) {
      this.clearPollingTimer()
      this.scheduleNextPoll(clampedInterval)
    }
  }

  // ============================================================================
  // Public Methods - Subscription
  // ============================================================================

  /**
   * Subscribe to polling updates
   * @param handler - Handler function for updates
   * @returns Unsubscribe function
   */
  subscribe(handler: PollingHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Unsubscribe from polling updates
   * @param handler - Handler to unsubscribe
   */
  unsubscribe(handler: PollingHandler): void {
    this.handlers.delete(handler)
  }

  /**
   * Subscribe to state changes
   * @param callback - State change callback
   * @returns Unsubscribe function
   */
  onStateChange(callback: PollingStateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback)
    return () => this.stateChangeCallbacks.delete(callback)
  }

  /**
   * Subscribe to errors
   * @param handler - Error handler function
   * @returns Unsubscribe function
   */
  onError(handler: PollingErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  // ============================================================================
  // Public Methods - State and Statistics
  // ============================================================================

  /**
   * Get current polling state
   */
  getState(): PollingState {
    return this.pollingState
  }

  /**
   * Check if currently polling
   */
  isPolling(): boolean {
    return this.pollingState === 'polling'
  }

  /**
   * Get current polling interval
   */
  getInterval(): number {
    return this.currentInterval
  }

  /**
   * Get client statistics
   */
  getStats(): HTTPPollingStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      totalUpdates: 0,
      retryCount: 0
    }
    this.durationHistory = []
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): string | null {
    return this.lastSyncTime
  }

  // ============================================================================
  // Private Methods - Polling Logic
  // ============================================================================

  /**
   * Schedule the next poll
   * @param delay - Delay in milliseconds before next poll
   */
  private scheduleNextPoll(delay: number): void {
    this.clearPollingTimer()

    this.pollingTimer = setTimeout(() => {
      this.executePoll()
    }, delay)
  }

  /**
   * Execute a poll and schedule the next one
   */
  private async executePoll(): Promise<void> {
    if (this.pollingState !== 'polling' || this.isPollingInProgress) {
      return
    }

    this.isPollingInProgress = true

    try {
      const response = await this.poll()

      // Reset error counters on success
      this.consecutiveErrors = 0
      this.retryCount = 0

      // Adjust interval based on server suggestion and response
      this.adjustInterval(response)

      // Schedule next poll
      if (this.pollingState === 'polling') {
        this.scheduleNextPoll(this.currentInterval)
      }
    } catch (error) {
      this.log('Poll error:', error)

      // Handle error and potentially retry
      const shouldRetry = this.handlePollingError(error as Error)

      if (shouldRetry && this.pollingState === 'polling') {
        // Calculate backoff delay
        const backoffDelay = this.calculateBackoffDelay()
        this.scheduleNextPoll(backoffDelay)
      } else {
        this.updateState('error')
      }
    } finally {
      this.isPollingInProgress = false
    }
  }

  /**
   * Handle successful poll response
   * @param response - Poll response
   */
  private handleSuccessfulPoll(response: PollingResponse): void {
    this.stats.successfulPolls++
    this.stats.lastSuccessAt = new Date().toISOString()

    // Update last sync time
    if (response.server_time) {
      this.lastSyncTime = response.server_time
    }

    // Process updates
    if (response.updates && response.updates.length > 0) {
      this.stats.totalUpdates += response.updates.length
      this.notifyHandlers(response.updates)
    }

    // If has_more, poll again sooner
    if (response.has_more) {
      this.currentInterval = Math.max(
        this.config.minInterval,
        this.currentInterval * 0.5
      )
    }
  }

  /**
   * Adjust polling interval based on response
   * @param response - Poll response
   */
  private adjustInterval(response: PollingResponse): void {
    // Use server suggested interval if provided
    if (response.suggested_interval) {
      this.setInterval(response.suggested_interval)
      return
    }

    // Adjust based on activity
    if (response.updates && response.updates.length > 0) {
      // Has updates - decrease interval (more frequent polling)
      this.currentInterval = Math.max(
        this.config.minInterval,
        this.currentInterval * 0.8
      )
    } else {
      // No updates - increase interval (less frequent polling)
      this.currentInterval = Math.min(
        this.config.maxInterval,
        this.currentInterval * 1.2
      )
    }
  }

  /**
   * Handle polling error
   * @param error - Error that occurred
   * @returns Whether to retry
   */
  private handlePollingError(error: Error): boolean {
    this.stats.failedPolls++
    this.consecutiveErrors++

    let pollingError: HTTPPollingError

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; retry_after?: number }>

      if (axiosError.response) {
        const status = axiosError.response.status
        const data = axiosError.response.data

        switch (status) {
          case 401:
            pollingError = new HTTPPollingAuthError(data?.error || 'Authentication failed')
            this.notifyErrorHandlers(pollingError)
            return false

          case 429:
            pollingError = new HTTPPollingRateLimitError(
              data?.error || 'Rate limit exceeded',
              data?.retry_after
            )
            // Use retry_after if provided
            if (data?.retry_after) {
              this.currentInterval = Math.min(
                this.config.maxInterval,
                data.retry_after * 1000
              )
            }
            this.notifyErrorHandlers(pollingError)
            return true

          case 500:
          case 502:
          case 503:
          case 504:
            pollingError = new HTTPPollingError(
              'Server error',
              'SERVER_ERROR',
              status
            )
            break

          default:
            pollingError = new HTTPPollingError(
              data?.error || `HTTP error ${status}`,
              'HTTP_ERROR',
              status
            )
        }
      } else if (axiosError.request) {
        // Network error
        pollingError = new HTTPPollingNetworkError('Network error - no response received')
      } else {
        pollingError = new HTTPPollingError(axiosError.message || 'Request failed')
      }
    } else {
      pollingError = new HTTPPollingError(
        error.message || 'Unknown error',
        'UNKNOWN_ERROR'
      )
    }

    this.notifyErrorHandlers(pollingError)

    // Check if we should retry
    if (this.consecutiveErrors >= this.config.maxRetries) {
      this.log('Max retries exceeded')
      return false
    }

    return true
  }

  /**
   * Handle poll error (legacy method for backward compatibility)
   * @param error - Error that occurred
   */
  private handlePollError(error: Error): void {
    this.handlePollingError(error)
  }

  /**
   * Calculate backoff delay for retries
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.initialInterval
    const exponentialDelay = baseDelay * Math.pow(2, this.consecutiveErrors - 1)
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter

    return Math.min(
      this.config.maxInterval,
      exponentialDelay + jitter
    )
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Clear polling timer
   */
  private clearPollingTimer(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  /**
   * Update polling state and notify callbacks
   * @param newState - New state
   */
  private updateState(newState: PollingState): void {
    const oldState = this.pollingState
    if (oldState === newState) return

    this.pollingState = newState
    this.log(`State changed: ${oldState} -> ${newState}`)

    this.stateChangeCallbacks.forEach((callback) => {
      try {
        callback(oldState, newState)
      } catch (error) {
        this.log('Error in state change callback:', error)
      }
    })
  }

  /**
   * Notify all handlers of updates
   * @param updates - Updates to notify
   */
  private notifyHandlers(updates: ServerPollingUpdate[]): void {
    this.handlers.forEach((handler) => {
      try {
        handler(updates)
      } catch (error) {
        this.log('Error in update handler:', error)
      }
    })
  }

  /**
   * Notify all error handlers
   * @param error - Error to notify
   */
  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error)
      } catch (err) {
        this.log('Error in error handler:', err)
      }
    })
  }

  /**
   * Calculate average duration
   */
  private getAverageDuration(): number | undefined {
    if (this.durationHistory.length === 0) return undefined
    const sum = this.durationHistory.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.durationHistory.length)
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[HTTPPollingClient] ${message}`, ...args)
    }
  }

  // ============================================================================
  // Public Methods - Cleanup
  // ============================================================================

  /**
   * Clean up and destroy the client
   */
  destroy(): void {
    this.stop()

    // Clear all handlers
    this.stateChangeCallbacks.clear()
    this.handlers.clear()
    this.errorHandlers.clear()

    this.log('Client destroyed')
  }
}

// ============================================================================
// Exports
// ============================================================================

export default HTTPPollingClient
export {
  HTTPPollingError,
  HTTPPollingAuthError,
  HTTPPollingRateLimitError,
  HTTPPollingNetworkError
}
