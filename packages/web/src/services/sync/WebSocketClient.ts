/**
 * WebSocket Sync Client
 * Manages WebSocket connection for real-time data synchronization
 */

import type {
  ConnectionState,
  StateChangeCallback,
  WebSocketClientConfig,
  WebSocketMessage,
  MessageHandler,
  ErrorHandler,
  SyncResponseHandler,
  ServerUpdateHandler,
  ConflictHandler,
  WebSocketClientStats,
  PendingRequest,
  AuthMessage,
  SyncMessage,
  PingMessage,
  PongMessage,
  SyncRequest,
  SyncResponse,
  Conflict,
  ServerUpdateMessage
} from './types'
import { DEFAULT_CONFIG } from './types'
import type { ConflictResolutionStrategy, SyncStatus } from '@webnote/shared/types/sync'

// ============================================================================
// Error Classes
// ============================================================================

/**
 * WebSocket connection error
 */
export class WebSocketConnectionError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'WebSocketConnectionError'
  }
}

/**
 * WebSocket authentication error
 */
export class WebSocketAuthError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'WebSocketAuthError'
  }
}

/**
 * WebSocket timeout error
 */
export class WebSocketTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebSocketTimeoutError'
  }
}

/**
 * WebSocket sync error
 */
export class WebSocketSyncError extends Error {
  constructor(message: string, public readonly syncStatus?: SyncStatus) {
    super(message)
    this.name = 'WebSocketSyncError'
  }
}

// ============================================================================
// WebSocket Client Class
// ============================================================================

/**
 * WebSocket client for real-time synchronization
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat mechanism for connection health
 * - Request-response matching for sync operations
 * - Message subscription system
 * - Connection state management
 *
 * @example
 * ```typescript
 * const client = new WebSocketClient({
 *   url: 'ws://localhost:3000/ws',
 *   heartbeatInterval: 30000,
 *   reconnectAttempts: 5
 * })
 *
 * // Subscribe to messages
 * client.subscribe((message) => {
 *   console.log('Received:', message)
 * })
 *
 * // Connect and authenticate
 * await client.connect('jwt-token', 'client-id')
 *
 * // Send sync request
 * const response = await client.sendSyncRequest(syncRequest)
 *
 * // Disconnect when done
 * client.disconnect()
 * ```
 */
export class WebSocketClient {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private ws: WebSocket | null = null
  private config: WebSocketClientConfig
  private connectionState: ConnectionState = 'disconnected'
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set()
  private messageHandlers: Set<MessageHandler> = new Set()
  private errorHandlers: Set<ErrorHandler> = new Set()
  private syncResponseHandlers: Set<SyncResponseHandler> = new Set()
  private serverUpdateHandlers: Set<ServerUpdateHandler> = new Set()
  private conflictHandlers: Set<ConflictHandler> = new Set()

  // Authentication
  private token: string | null = null
  private clientId: string | null = null
  private userId: number | null = null

  // Reconnection
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManualDisconnect = false

  // Heartbeat
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
  private lastHeartbeatTime: number = 0
  private missedHeartbeats = 0

  // Request tracking
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private requestTimeout: number = 60000 // 60 seconds

  // Statistics
  private stats: WebSocketClientStats = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    reconnectionCount: 0,
    heartbeatsSent: 0,
    heartbeatsMissed: 0
  }

  // Latency tracking
  private latencyHistory: number[] = []
  private readonly maxLatencyHistory = 10

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new WebSocket client instance
   * @param config - Client configuration options
   */
  constructor(config: Partial<WebSocketClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.log('WebSocketClient created with config:', this.config)
  }

  // ============================================================================
  // Public Methods - Connection Management
  // ============================================================================

  /**
   * Establish WebSocket connection and authenticate
   * @param token - JWT authentication token
   * @param clientId - Unique client identifier
   * @param deviceId - Optional device identifier
   * @returns Promise that resolves when authenticated
   */
  async connect(
    token: string,
    clientId: string,
    deviceId?: string
  ): Promise<void> {
    if (this.connectionState !== 'disconnected' && this.connectionState !== 'error') {
      throw new WebSocketConnectionError('Already connected or connecting')
    }

    this.token = token
    this.clientId = clientId
    this.isManualDisconnect = false

    return new Promise((resolve, reject) => {
      this.createConnection(
        () => resolve(),
        (error) => reject(error),
        deviceId
      )
    })
  }

  /**
   * Disconnect from the WebSocket server
   * @param reason - Optional reason for disconnection
   */
  disconnect(reason = 'Client disconnect'): void {
    this.log('Disconnecting:', reason)
    this.isManualDisconnect = true

    // Clear all timers
    this.clearReconnectTimer()
    this.clearHeartbeat()
    this.clearPendingRequests()

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close(1000, reason)
      this.ws = null
    }

    // Update state
    this.updateConnectionState('disconnected')
    this.token = null
    this.userId = null
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.connectionState === 'authenticated'
  }

  /**
   * Get current user ID
   */
  getUserId(): number | null {
    return this.userId
  }

  /**
   * Get current client ID
   */
  getClientId(): string | null {
    return this.clientId
  }

  // ============================================================================
  // Public Methods - Message Handling
  // ============================================================================

  /**
   * Send a sync request to the server
   * @param request - Sync request data
   * @returns Promise that resolves with the sync response
   */
  async sendSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    if (!this.isConnected()) {
      throw new WebSocketConnectionError('Not connected')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.request_id)
        reject(new WebSocketTimeoutError(`Sync request timeout: ${request.request_id}`))
      }, this.requestTimeout)

      this.pendingRequests.set(request.request_id, {
        requestId: request.request_id,
        resolve: (response) => {
          clearTimeout(timeout)
          this.pendingRequests.delete(request.request_id)
          resolve(response)
        },
        reject: (error) => {
          clearTimeout(timeout)
          this.pendingRequests.delete(request.request_id)
          reject(error)
        },
        timestamp: Date.now()
      })

      const message: SyncMessage = {
        type: 'sync',
        data: request,
        timestamp: new Date().toISOString()
      }

      this.send(message)
    })
  }

  /**
   * Send a raw message to the server
   * @param message - Message to send
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketConnectionError('WebSocket is not connected')
    }

    const messageString = JSON.stringify(message)
    this.ws.send(messageString)

    // Update statistics
    this.stats.messagesSent++
    this.stats.bytesSent += messageString.length
    this.stats.lastMessageSentAt = new Date().toISOString()

    this.log('Sent message:', message.type)
  }

  // ============================================================================
  // Public Methods - Subscription
  // ============================================================================

  /**
   * Subscribe to all WebSocket messages
   * @param handler - Message handler function
   * @returns Unsubscribe function
   */
  subscribe(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  /**
   * Unsubscribe from messages
   * @param handler - Handler to unsubscribe
   */
  unsubscribe(handler: MessageHandler): void {
    this.messageHandlers.delete(handler)
  }

  /**
   * Subscribe to connection state changes
   * @param callback - State change callback
   * @returns Unsubscribe function
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback)
    return () => this.stateChangeCallbacks.delete(callback)
  }

  /**
   * Subscribe to errors
   * @param handler - Error handler function
   * @returns Unsubscribe function
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  /**
   * Subscribe to sync responses
   * @param handler - Sync response handler
   * @returns Unsubscribe function
   */
  onSyncResponse(handler: SyncResponseHandler): () => void {
    this.syncResponseHandlers.add(handler)
    return () => this.syncResponseHandlers.delete(handler)
  }

  /**
   * Subscribe to server updates
   * @param handler - Server update handler
   * @returns Unsubscribe function
   */
  onServerUpdate(handler: ServerUpdateHandler): () => void {
    this.serverUpdateHandlers.add(handler)
    return () => this.serverUpdateHandlers.delete(handler)
  }

  /**
   * Subscribe to conflict notifications
   * @param handler - Conflict handler
   * @returns Unsubscribe function
   */
  onConflict(handler: ConflictHandler): () => void {
    this.conflictHandlers.add(handler)
    return () => this.conflictHandlers.delete(handler)
  }

  // ============================================================================
  // Public Methods - Statistics
  // ============================================================================

  /**
   * Get client statistics
   */
  getStats(): WebSocketClientStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      reconnectionCount: 0,
      heartbeatsSent: 0,
      heartbeatsMissed: 0,
      connectedAt: this.stats.connectedAt,
      averageLatency: this.stats.averageLatency
    }
    this.latencyHistory = []
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number | undefined {
    if (this.latencyHistory.length === 0) return undefined
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.latencyHistory.length)
  }

  // ============================================================================
  // Private Methods - Connection
  // ============================================================================

  /**
   * Create WebSocket connection
   */
  private createConnection(
    onSuccess: () => void,
    onError: (error: Error) => void,
    deviceId?: string
  ): void {
    this.updateConnectionState('connecting')

    try {
      this.ws = new WebSocket(this.config.url)
    } catch (error) {
      this.handleConnectionError(error as Error, onError)
      return
    }

    // Connection timeout
    const connectionTimer = setTimeout(() => {
      if (this.connectionState === 'connecting') {
        this.ws?.close()
        onError(new WebSocketTimeoutError('Connection timeout'))
      }
    }, this.config.connectionTimeout)

    // WebSocket event handlers
    this.ws.onopen = () => {
      clearTimeout(connectionTimer)
      this.log('WebSocket connected')
      this.updateConnectionState('connected')
      this.stats.connectedAt = new Date().toISOString()

      // Send authentication
      this.authenticate(onSuccess, onError, deviceId)
    }

    this.ws.onclose = (event) => {
      clearTimeout(connectionTimer)
      this.handleClose(event)
    }

    this.ws.onerror = (event) => {
      clearTimeout(connectionTimer)
      this.log('WebSocket error:', event)
      const error = new WebSocketConnectionError('WebSocket connection error')
      this.handleConnectionError(error, onError)
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  /**
   * Send authentication message
   */
  private authenticate(
    onSuccess: () => void,
    onError: (error: Error) => void,
    deviceId?: string
  ): void {
    if (!this.token || !this.clientId) {
      onError(new WebSocketAuthError('Missing token or client ID'))
      return
    }

    const authMessage: AuthMessage = {
      type: 'auth',
      token: this.token,
      client_id: this.clientId,
      device_id: deviceId,
      timestamp: new Date().toISOString()
    }

    // Set auth timeout
    const authTimer = setTimeout(() => {
      onError(new WebSocketTimeoutError('Authentication timeout'))
      this.disconnect('Authentication timeout')
    }, this.config.authTimeout)

    // Temporarily add auth response handler
    const authHandler = (message: WebSocketMessage) => {
      if (message.type === 'auth') {
        clearTimeout(authTimer)
        this.unsubscribe(authHandler)

        if (message.success) {
          this.userId = message.user_id ?? null
          this.updateConnectionState('authenticated')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          onSuccess()
        } else {
          const error = new WebSocketAuthError(message.error || 'Authentication failed')
          onError(error)
          this.disconnect('Authentication failed')
        }
      }
    }

    this.subscribe(authHandler)
    this.send(authMessage)
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error, onError: (error: Error) => void): void {
    this.updateConnectionState('error')
    this.notifyErrorHandlers(error)
    onError(error)

    // Attempt reconnection if not manual disconnect
    if (!this.isManualDisconnect) {
      this.scheduleReconnect()
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.log('WebSocket closed:', event.code, event.reason)
    this.clearHeartbeat()
    this.ws = null

    if (this.connectionState === 'authenticated') {
      this.updateConnectionState('disconnected')
    }

    // Attempt reconnection if not manual disconnect
    if (!this.isManualDisconnect && event.code !== 1000) {
      this.scheduleReconnect()
    }
  }

  // ============================================================================
  // Private Methods - Reconnection
  // ============================================================================

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isManualDisconnect) return

    // Check if max attempts reached
    if (
      this.config.reconnectAttempts > 0 &&
      this.reconnectAttempts >= this.config.reconnectAttempts
    ) {
      this.log('Max reconnection attempts reached')
      this.updateConnectionState('error')
      this.notifyErrorHandlers(
        new WebSocketConnectionError('Max reconnection attempts reached')
      )
      return
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectInterval
    )

    this.reconnectAttempts++
    this.stats.reconnectionCount++

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect && this.token && this.clientId) {
        this.createConnection(
          () => {
            this.log('Reconnection successful')
          },
          (error) => {
            this.log('Reconnection failed:', error.message)
          }
        )
      }
    }, delay)
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ============================================================================
  // Private Methods - Heartbeat
  // ============================================================================

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.missedHeartbeats = 0
    this.lastHeartbeatTime = Date.now()

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval)
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    this.clearHeartbeat()
  }

  /**
   * Clear heartbeat timers
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  /**
   * Send heartbeat ping
   */
  private sendHeartbeat(): void {
    if (!this.isConnected()) return

    const pingMessage: PingMessage = {
      type: 'ping',
      timestamp: new Date().toISOString()
    }

    this.send(pingMessage)
    this.stats.heartbeatsSent++

    // Set timeout for pong response
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.handleHeartbeatTimeout()
    }, this.config.heartbeatTimeout)
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(): void {
    this.missedHeartbeats++
    this.stats.heartbeatsMissed++

    this.log(`Heartbeat timeout (missed: ${this.missedHeartbeats})`)

    // If too many missed heartbeats, reconnect
    if (this.missedHeartbeats >= 3) {
      this.log('Too many missed heartbeats, reconnecting')
      this.ws?.close(4000, 'Heartbeat timeout')
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(timestamp?: string): void {
    // Clear timeout
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }

    // Reset missed heartbeats
    this.missedHeartbeats = 0

    // Calculate latency
    if (timestamp) {
      const latency = Date.now() - new Date(timestamp).getTime()
      this.latencyHistory.push(latency)
      if (this.latencyHistory.length > this.maxLatencyHistory) {
        this.latencyHistory.shift()
      }
      this.stats.averageLatency = this.getAverageLatency()
    }

    this.lastHeartbeatTime = Date.now()
  }

  // ============================================================================
  // Private Methods - Message Handling
  // ============================================================================

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage

      // Update statistics
      this.stats.messagesReceived++
      this.stats.bytesReceived += data.length
      this.stats.lastMessageReceivedAt = new Date().toISOString()

      this.log('Received message:', message.type)

      // Handle specific message types
      switch (message.type) {
        case 'pong':
          this.handlePong(message.timestamp)
          break

        case 'ping':
          this.handleServerPing(message)
          break

        case 'sync_response':
          this.handleSyncResponse(message)
          break

        case 'server_update':
          this.handleServerUpdate(message)
          break

        case 'conflict':
          this.handleConflict(message)
          break

        case 'error':
          this.handleServerError(message)
          break

        case 'status_change':
          this.log('Status change:', message)
          break

        case 'ack':
          this.log('Acknowledgment received')
          break
      }

      // Notify all message handlers
      this.notifyMessageHandlers(message)
    } catch (error) {
      this.log('Error parsing message:', error)
      this.notifyErrorHandlers(error as Error)
    }
  }

  /**
   * Handle server ping
   */
  private handleServerPing(message: PingMessage): void {
    const pongMessage: PongMessage = {
      type: 'pong',
      timestamp: new Date().toISOString()
    }
    this.send(pongMessage)
  }

  /**
   * Handle sync response
   */
  private handleSyncResponse(message: { type: 'sync_response'; request_id: string; data: SyncResponse }): void {
    const pending = this.pendingRequests.get(message.request_id)
    if (pending) {
      pending.resolve(message.data)
    }

    // Notify sync response handlers
    this.syncResponseHandlers.forEach((handler) => {
      try {
        handler(message.data)
      } catch (error) {
        this.log('Error in sync response handler:', error)
      }
    })
  }

  /**
   * Handle server update
   */
  private handleServerUpdate(message: ServerUpdateMessage): void {
    this.serverUpdateHandlers.forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        this.log('Error in server update handler:', error)
      }
    })
  }

  /**
   * Handle conflict notification
   */
  private handleConflict(message: { type: 'conflict'; conflict: Conflict; requires_manual_resolution: boolean }): void {
    this.conflictHandlers.forEach((handler) => {
      try {
        handler(message.conflict, message.requires_manual_resolution)
      } catch (error) {
        this.log('Error in conflict handler:', error)
      }
    })
  }

  /**
   * Handle server error
   */
  private handleServerError(message: { type: 'error'; error_code: string; error_message: string; should_reconnect?: boolean }): void {
    const error = new WebSocketConnectionError(
      message.error_message,
      message.error_code
    )

    this.notifyErrorHandlers(error)

    // If server suggests reconnecting, trigger reconnection
    if (message.should_reconnect) {
      this.ws?.close(4000, 'Server requested reconnect')
    }
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Update connection state and notify callbacks
   */
  private updateConnectionState(newState: ConnectionState): void {
    const oldState = this.connectionState
    if (oldState === newState) return

    this.connectionState = newState
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
   * Notify all message handlers
   */
  private notifyMessageHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        this.log('Error in message handler:', error)
      }
    })
  }

  /**
   * Notify all error handlers
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
   * Clear all pending requests
   */
  private clearPendingRequests(): void {
    this.pendingRequests.forEach((pending) => {
      if (pending.timer) {
        clearTimeout(pending.timer)
      }
      pending.reject(new WebSocketConnectionError('Connection closed'))
    })
    this.pendingRequests.clear()
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[WebSocketClient] ${message}`, ...args)
    }
  }

  // ============================================================================
  // Public Methods - Cleanup
  // ============================================================================

  /**
   * Clean up and destroy the client
   */
  destroy(): void {
    this.disconnect('Client destroyed')

    // Clear all handlers
    this.stateChangeCallbacks.clear()
    this.messageHandlers.clear()
    this.errorHandlers.clear()
    this.syncResponseHandlers.clear()
    this.serverUpdateHandlers.clear()
    this.conflictHandlers.clear()

    this.log('Client destroyed')
  }
}

// ============================================================================
// Exports
// ============================================================================

export default WebSocketClient
export {
  WebSocketConnectionError,
  WebSocketAuthError,
  WebSocketTimeoutError,
  WebSocketSyncError
}
