/**
 * WebSocket Sync Services
 * Export all sync-related modules
 */

// WebSocket Client
export { WebSocketClient, default as WebSocketClientDefault } from './WebSocketClient'
export {
  WebSocketConnectionError,
  WebSocketAuthError,
  WebSocketTimeoutError,
  WebSocketSyncError
} from './WebSocketClient'

// HTTP Polling Client
export { HTTPPollingClient, default as HTTPPollingClientDefault } from './HTTPPollingClient'
export {
  HTTPPollingError,
  HTTPPollingAuthError,
  HTTPPollingRateLimitError,
  HTTPPollingNetworkError,
  DEFAULT_POLLING_CONFIG
} from './HTTPPollingClient'

// Network Monitor
export { NetworkMonitor, default as NetworkMonitorDefault } from './NetworkMonitor'
export {
  type NetworkState,
  type NetworkCallback,
  type NetworkMonitorConfig,
  DEFAULT_NETWORK_MONITOR_CONFIG
} from './NetworkMonitor'

// Types
export {
  // Connection states
  type ConnectionState,
  type StateChangeCallback,

  // Message types
  type ClientMessageType,
  type ServerMessageType,
  type BaseMessage,
  type AuthMessage,
  type AuthResponseMessage,
  type SyncMessage,
  type SyncResponseMessage,
  type PingMessage,
  type PongMessage,
  type AckMessage,
  type ErrorMessage,
  type ServerUpdateMessage,
  type ConflictMessage,
  type StatusChangeMessage,
  type WebSocketMessage,

  // Configuration
  type WebSocketClientConfig,
  DEFAULT_CONFIG,

  // Handler types
  type MessageHandler,
  type ErrorHandler,
  type SyncResponseHandler,
  type ServerUpdateHandler,
  type ConflictHandler,

  // Statistics
  type WebSocketClientStats,

  // Request tracking
  type PendingRequest,
  type QueuedSyncOperation,

  // Re-export shared types
  type SyncRequest,
  type SyncResponse,
  type Conflict,
  type ConflictResolutionStrategy,
  type SyncStatus,
  type EntityType,
  type SyncOperationType
} from './types'

// HTTP Polling Types
export {
  type PollingState,
  type PollingStateChangeCallback,
  type ServerPollingUpdate,
  type PollingResponse,
  type HTTPPollingConfig,
  type PollingHandler,
  type PollingErrorHandler,
  type HTTPPollingStats
} from './HTTPPollingClient'
