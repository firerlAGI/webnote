/**
 * Cache Types
 * Type definitions for the IndexedDB cache layer
 */

// ============================================================================
// Cached Entity Types
// ============================================================================

/**
 * Cached note entity with additional metadata for offline support
 */
export interface CachedNote {
  /** Note ID */
  id: number
  /** Owner user ID */
  user_id: number
  /** Note title */
  title: string
  /** Note content (markdown) */
  content: string
  /** Folder ID (nullable for root notes) */
  folder_id: number | null
  /** Whether the note is pinned */
  is_pinned: boolean
  /** Last update timestamp */
  updated_at: string
  /** Content hash for conflict detection */
  content_hash?: string
  /** Version number for optimistic locking */
  version: number
  /** Timestamp when cached locally */
  _cachedAt: number
  /** Whether has unsynchronized changes */
  _dirty: boolean
}

/**
 * Cached folder entity with additional metadata
 */
export interface CachedFolder {
  /** Folder ID */
  id: number
  /** Owner user ID */
  user_id: number
  /** Folder name */
  name: string
  /** Last update timestamp */
  updated_at: string
  /** Timestamp when cached locally */
  _cachedAt: number
  /** Whether has unsynchronized changes */
  _dirty: boolean
}

/**
 * Cached review entity with additional metadata
 */
export interface CachedReview {
  /** Review ID */
  id: number
  /** Owner user ID */
  user_id: number
  /** Review date (YYYY-MM-DD) */
  date: string
  /** Review content */
  content: string
  /** Mood score (1-10) */
  mood: number | null
  /** Achievements text */
  achievements: string | null
  /** Improvements text */
  improvements: string | null
  /** Plans text */
  plans: string | null
  /** Last update timestamp */
  updated_at: string
  /** Timestamp when cached locally */
  _cachedAt: number
  /** Whether has unsynchronized changes */
  _dirty: boolean
}

// ============================================================================
// Sync Queue Types
// ============================================================================

/**
 * Operation types for sync queue
 */
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE'

/**
 * Entity types for sync queue
 */
export type SyncEntityType = 'note' | 'folder' | 'review'

/**
 * Sync queue item status
 */
export type SyncQueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Sync queue item for offline operation tracking
 */
export interface SyncQueueItem {
  /** Unique client-generated ID */
  id: string
  /** Owner user ID */
  user_id: number
  /** Operation type */
  operation_type: SyncOperationType
  /** Entity type */
  entity_type: SyncEntityType
  /** Entity ID (null for CREATE operations before server response) */
  entity_id: number | null
  /** Operation data payload */
  data: Record<string, unknown>
  /** Operation timestamp */
  timestamp: string
  /** Current status */
  status: SyncQueueStatus
  /** Number of retry attempts */
  retry_count: number
  /** Error message if failed */
  error?: string
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Cache metadata for storing sync state and configuration
 */
export interface CacheMetadata {
  /** Metadata key */
  key: string
  /** Metadata value */
  value: string | number | object
  /** Last update timestamp */
  updated_at: string
}

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * IndexedDB database configuration
 */
export interface DatabaseConfig {
  /** Database name */
  name: string
  /** Database version */
  version: number
}

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  name: 'webnote-cache',
  version: 1
}

/**
 * Object store names
 */
export const STORE_NAMES = {
  NOTES: 'notes',
  FOLDERS: 'folders',
  REVIEWS: 'reviews',
  SYNC_QUEUE: 'syncQueue',
  METADATA: 'metadata'
} as const

/**
 * Metadata keys for cache management
 */
export const METADATA_KEYS = {
  LAST_SYNC_TIME: 'lastSyncTime',
  USER_ID: 'userId',
  DEVICE_ID: 'deviceId',
  SYNC_VERSION: 'syncVersion'
} as const

// ============================================================================
// Dirty Items Collection
// ============================================================================

/**
 * Collection of dirty (unsynchronized) items
 */
export interface DirtyItems {
  /** Dirty notes */
  notes: CachedNote[]
  /** Dirty folders */
  folders: CachedFolder[]
  /** Dirty reviews */
  reviews: CachedReview[]
}

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total notes cached */
  notesCount: number
  /** Total folders cached */
  foldersCount: number
  /** Total reviews cached */
  reviewsCount: number
  /** Pending sync queue items */
  pendingSyncCount: number
  /** Dirty notes count */
  dirtyNotesCount: number
  /** Dirty folders count */
  dirtyFoldersCount: number
  /** Dirty reviews count */
  dirtyReviewsCount: number
  /** Cache size in bytes (estimated) */
  estimatedSize?: number
}
