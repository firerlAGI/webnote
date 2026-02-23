/**
 * WebSocket Sync Client Types
 * Type definitions for the WebSocket synchronization client
 */

import type {
  SyncRequest,
  SyncResponse,
  Conflict,
  ConflictResolutionStrategy,
  SyncStatus,
  EntityType,
  SyncOperationType
} from '@webnote/shared/types/sync'

// ============================================================================
// Connection States
// ============================================================================

/**
 * WebSocket connection states
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'disconnected'
  | 'error'

/**
 * Connection state change callback
 */
export type StateChangeCallback = (
  oldState: ConnectionState,
  newState: ConnectionState
) => void

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * WebSocket message types (client to server)
 */
export type ClientMessageType =
  | 'auth'
  | 'sync'
  | 'ping'
  | 'pong'

/**
 * WebSocket message types (server to client)
 */
export type ServerMessageType =
  | 'auth'
  | 'sync_response'
  | 'pong'
  | 'ping'
  | 'error'
  | 'status_change'
  | 'server_update'
  | 'conflict'
  | 'ack'

/**
 * Base WebSocket message
 */
export interface BaseMessage {
  type: ClientMessageType | ServerMessageType
  timestamp?: string
}

/**
 * Authentication message (client to server)
 */
export interface AuthMessage extends BaseMessage {
  type: 'auth'
  /** JWT token for authentication */
  token?: string
  /** User ID (for testing environments) */
  user_id?: number
  /** Client identifier */
  client_id: string
  /** Device identifier */
  device_id?: string
}

/**
 * Authentication response (server to client)
 */
export interface AuthResponseMessage extends BaseMessage {
  type: 'auth'
  /** Authentication success status */
  success: boolean
  /** User ID after successful authentication */
  user_id?: number
  /** Device ID */
  device_id?: string
  /** Error message if authentication failed */
  error?: string
}

/**
 * Sync message (client to server)
 */
export interface SyncMessage extends BaseMessage {
  type: 'sync'
  /** Sync request data */
  data: SyncRequest
}

/**
 * Sync response message (server to client)
 */
export interface SyncResponseMessage extends BaseMessage {
  type: 'sync_response'
  /** Request ID for matching */
  request_id: string
  /** Sync response data */
  data: SyncResponse
}

/**
 * Ping message (bidirectional)
 */
export interface PingMessage extends BaseMessage {
  type: 'ping'
  /** Server time (from server) */
  server_time?: string
}

/**
 * Pong message (bidirectional)
 */
export interface PongMessage extends BaseMessage {
  type: 'pong'
  /** Server time */
  server_time?: string
}

/**
 * Acknowledgment message
 */
export interface AckMessage extends BaseMessage {
  type: 'ack'
  /** Timestamp being acknowledged */
  timestamp: string
}

/**
 * Error message (server to client)
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error'
  /** Error code */
  error_code: string
  /** Error message */
  error_message: string
  /** Whether client should attempt to reconnect */
  should_reconnect?: boolean
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Server update message (server to client)
 */
export interface ServerUpdateMessage extends BaseMessage {
  type: 'server_update'
  /** Update type */
  update_type: 'incremental' | 'full'
  /** Entity type */
  entity_type: EntityType
  /** Entity ID */
  entity_id?: number
  /** Update data */
  update_data: {
    operation_type: SyncOperationType
    version: number
    data?: Record<string, unknown>
    modified_at: string
    modified_by: number
  }
}

/**
 * Conflict notification message (server to client)
 */
export interface ConflictMessage extends BaseMessage {
  type: 'conflict'
  /** Conflict information */
  conflict: Conflict
  /** Whether manual resolution is required */
  requires_manual_resolution: boolean
}

/**
 * Status change message (server to client)
 */
export interface StatusChangeMessage extends BaseMessage {
  type: 'status_change'
  /** Connection ID */
  connection_id: string
  /** Old status */
  old_status: string
  /** New status */
  new_status: string
}

/**
 * All WebSocket message types
 */
export type WebSocketMessage =
  | AuthMessage
  | AuthResponseMessage
  | SyncMessage
  | SyncResponseMessage
  | PingMessage
  | PongMessage
  | AckMessage
  | ErrorMessage
  | ServerUpdateMessage
  | ConflictMessage
  | StatusChangeMessage

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * WebSocket client configuration
 */
export interface WebSocketClientConfig {
  /** WebSocket server URL */
  url: string
  /** Maximum reconnection attempts (0 = infinite) */
  reconnectAttempts: number
  /** Initial reconnection interval in milliseconds */
  reconnectInterval: number
  /** Maximum reconnection interval in milliseconds */
  maxReconnectInterval: number
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number
  /** Heartbeat timeout in milliseconds */
  heartbeatTimeout: number
  /** Authentication timeout in milliseconds */
  authTimeout: number
  /** Connection timeout in milliseconds */
  connectionTimeout: number
  /** Enable debug logging */
  debug: boolean
}

/**
 * Default WebSocket client configuration
 */
export const DEFAULT_CONFIG: WebSocketClientConfig = {
  url: 'ws://localhost:3000/ws',
  reconnectAttempts: 0, // Infinite reconnection
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  authTimeout: 5000,
  connectionTimeout: 10000,
  debug: false
}

// ============================================================================
// Message Handler Types
// ============================================================================

/**
 * Message handler function type
 */
export type MessageHandler = (message: WebSocketMessage) => void

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error) => void

/**
 * Sync response handler function type
 */
export type SyncResponseHandler = (response: SyncResponse) => void

/**
 * Server update handler function type
 */
export type ServerUpdateHandler = (update: ServerUpdateMessage) => void

/**
 * Conflict handler function type
 */
export type ConflictHandler = (conflict: Conflict, requiresManualResolution: boolean) => void

// ============================================================================
// Client Statistics
// ============================================================================

/**
 * WebSocket client statistics
 */
export interface WebSocketClientStats {
  /** Total messages sent */
  messagesSent: number
  /** Total messages received */
  messagesReceived: number
  /** Total bytes sent */
  bytesSent: number
  /** Total bytes received */
  bytesReceived: number
  /** Number of reconnections */
  reconnectionCount: number
  /** Number of heartbeats sent */
  heartbeatsSent: number
  /** Number of heartbeats missed */
  heartbeatsMissed: number
  /** Connection start time */
  connectedAt?: string
  /** Last message sent time */
  lastMessageSentAt?: string
  /** Last message received time */
  lastMessageReceivedAt?: string
  /** Average latency in milliseconds */
  averageLatency?: number
}

// ============================================================================
// Pending Request Tracking
// ============================================================================

/**
 * Pending request for request-response matching
 */
export interface PendingRequest {
  /** Request ID */
  requestId: string
  /** Promise resolve function */
  resolve: (response: SyncResponse) => void
  /** Promise reject function */
  reject: (error: Error) => void
  /** Request timestamp */
  timestamp: number
  /** Timeout timer */
  timer?: NodeJS.Timeout
}

// ============================================================================
// Sync Operation Queue
// ============================================================================

/**
 * Queued sync operation
 */
export interface QueuedSyncOperation {
  /** Operation ID */
  operation_id: string
  /** Operation type */
  operation_type: SyncOperationType
  /** Entity type */
  entity_type: EntityType
  /** Entity ID */
  entity_id?: number
  /** Operation data */
  data?: Record<string, unknown>
  /** Changes for update operations */
  changes?: Record<string, unknown>
  /** Timestamp */
  timestamp: string
  /** Retry count */
  retry_count: number
  /** Status */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** Error message if failed */
  error?: string
}

// ============================================================================
// Export shared types for convenience
// ============================================================================

export type {
  SyncRequest,
  SyncResponse,
  Conflict,
  ConflictResolutionStrategy,
  SyncStatus,
  EntityType,
  SyncOperationType
}
