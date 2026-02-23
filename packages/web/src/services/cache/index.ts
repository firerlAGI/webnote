/**
 * Cache Module
 * IndexedDB-based local cache for offline support
 */

// Database management
export {
  DatabaseManager,
  DatabaseError,
  DatabaseConnectionError,
  DatabaseMigrationError
} from './Database'

// Cache service
export {
  CacheService,
  CacheServiceError
} from './CacheService'

// Types
export {
  // Entity types
  type CachedNote,
  type CachedFolder,
  type CachedReview,

  // Sync queue types
  type SyncQueueItem,
  type SyncOperationType,
  type SyncEntityType,
  type SyncQueueStatus,

  // Metadata types
  type CacheMetadata,

  // Configuration
  type DatabaseConfig,
  DEFAULT_DATABASE_CONFIG,
  STORE_NAMES,
  METADATA_KEYS,

  // Utility types
  type DirtyItems,
  type CacheStats
} from './types'
