/**
 * IndexedDB Database Manager
 * Handles database initialization, migrations, and connection management
 */

import {
  DEFAULT_DATABASE_CONFIG,
  STORE_NAMES,
  type DatabaseConfig
} from './types'

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Database error for IndexedDB operations
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Database connection error
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string = 'Failed to connect to database', originalError?: unknown) {
    super(message, 'CONNECTION_ERROR', originalError)
    this.name = 'DatabaseConnectionError'
  }
}

/**
 * Database migration error
 */
export class DatabaseMigrationError extends DatabaseError {
  constructor(message: string = 'Database migration failed', originalError?: unknown) {
    super(message, 'MIGRATION_ERROR', originalError)
    this.name = 'DatabaseMigrationError'
  }
}

// ============================================================================
// Database Manager Class
// ============================================================================

/**
 * IndexedDB database manager
 *
 * Features:
 * - Singleton pattern for database connection
 * - Automatic schema migration
 * - Connection pooling simulation
 * - Error handling and recovery
 *
 * @example
 * ```typescript
 * const dbManager = DatabaseManager.getInstance()
 * const db = await dbManager.getDB()
 *
 * // Use the database
 * const transaction = db.transaction(['notes'], 'readwrite')
 * const store = transaction.objectStore('notes')
 * ```
 */
export class DatabaseManager {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private static instance: DatabaseManager | null = null
  private db: IDBDatabase | null = null
  private config: DatabaseConfig
  private connectionPromise: Promise<IDBDatabase> | null = null
  private isConnecting = false

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Private constructor for singleton pattern
   * @param config - Database configuration
   */
  private constructor(config: DatabaseConfig = DEFAULT_DATABASE_CONFIG) {
    this.config = config
  }

  // ============================================================================
  // Public Static Methods
  // ============================================================================

  /**
   * Get the singleton instance of DatabaseManager
   * @param config - Optional database configuration
   * @returns DatabaseManager instance
   */
  static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config)
    }
    return DatabaseManager.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close()
      DatabaseManager.instance = null
    }
  }

  // ============================================================================
  // Public Methods - Connection Management
  // ============================================================================

  /**
   * Get the database instance
   * Returns existing connection or creates a new one
   * @returns Promise resolving to IDBDatabase instance
   */
  async getDB(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (this.db) {
      return this.db
    }

    // Return existing connection promise if connecting
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    // Start new connection
    this.connectionPromise = this.openDatabase()
    return this.connectionPromise
  }

  /**
   * Open or create the database
   * @returns Promise resolving to IDBDatabase instance
   */
  async openDatabase(): Promise<IDBDatabase> {
    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.db) {
            clearInterval(checkInterval)
            resolve(this.db)
          } else if (!this.isConnecting) {
            clearInterval(checkInterval)
            reject(new DatabaseConnectionError('Connection attempt failed'))
          }
        }, 100)
      })
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version)

      request.onerror = () => {
        this.isConnecting = false
        this.connectionPromise = null
        reject(new DatabaseConnectionError(
          `Failed to open database: ${request.error?.message}`,
          request.error
        ))
      }

      request.onsuccess = () => {
        this.isConnecting = false
        this.db = request.result

        // Handle unexpected close
        this.db.onclose = () => {
          this.db = null
          this.connectionPromise = null
        }

        // Handle errors
        this.db.onerror = (event) => {
          console.error('[DatabaseManager] Database error:', event)
        }

        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result
        this.handleMigration(db, event.oldVersion, event.newVersion || this.config.version)
      }
    })
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.connectionPromise = null
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null && !this.db.closed
  }

  // ============================================================================
  // Public Methods - Database Operations
  // ============================================================================

  /**
   * Delete the entire database
   * Use with caution - this will remove all cached data
   * @returns Promise resolving when database is deleted
   */
  async deleteDatabase(): Promise<void> {
    this.close()

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.config.name)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new DatabaseError(
          `Failed to delete database: ${request.error?.message}`,
          'DELETE_ERROR',
          request.error
        ))
      }

      request.onblocked = () => {
        console.warn('[DatabaseManager] Database delete blocked - close all connections')
      }
    })
  }

  /**
   * Clear all object stores
   * @returns Promise resolving when all stores are cleared
   */
  async clearAllStores(): Promise<void> {
    const db = await this.getDB()
    const storeNames = Object.values(STORE_NAMES) as string[]

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite')

      transaction.onerror = () => {
        reject(new DatabaseError(
          `Failed to clear stores: ${transaction.error?.message}`,
          'CLEAR_ERROR',
          transaction.error
        ))
      }

      transaction.oncomplete = () => {
        resolve()
      }

      // Clear each store
      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        store.clear()
      })
    })
  }

  // ============================================================================
  // Private Methods - Schema Migration
  // ============================================================================

  /**
   * Handle database migration
   * @param db - Database instance
   * @param oldVersion - Current database version
   * @param newVersion - Target database version
   */
  private handleMigration(db: IDBDatabase, oldVersion: number, newVersion: number): void {
    console.log(`[DatabaseManager] Migrating database from version ${oldVersion} to ${newVersion}`)

    // Version 1: Initial schema
    if (oldVersion < 1) {
      this.createV1Schema(db)
    }

    // Future migrations can be added here:
    // if (oldVersion < 2) { ... }
  }

  /**
   * Create version 1 database schema
   * @param db - Database instance
   */
  private createV1Schema(db: IDBDatabase): void {
    // Notes store
    if (!db.objectStoreNames.contains(STORE_NAMES.NOTES)) {
      const notesStore = db.createObjectStore(STORE_NAMES.NOTES, {
        keyPath: 'id'
      })
      notesStore.createIndex('user_id', 'user_id', { unique: false })
      notesStore.createIndex('folder_id', 'folder_id', { unique: false })
      notesStore.createIndex('updated_at', 'updated_at', { unique: false })
      notesStore.createIndex('_dirty', '_dirty', { unique: false })
    }

    // Folders store
    if (!db.objectStoreNames.contains(STORE_NAMES.FOLDERS)) {
      const foldersStore = db.createObjectStore(STORE_NAMES.FOLDERS, {
        keyPath: 'id'
      })
      foldersStore.createIndex('user_id', 'user_id', { unique: false })
      foldersStore.createIndex('_dirty', '_dirty', { unique: false })
    }

    // Reviews store
    if (!db.objectStoreNames.contains(STORE_NAMES.REVIEWS)) {
      const reviewsStore = db.createObjectStore(STORE_NAMES.REVIEWS, {
        keyPath: 'id'
      })
      reviewsStore.createIndex('user_id', 'user_id', { unique: false })
      reviewsStore.createIndex('date', 'date', { unique: false })
      reviewsStore.createIndex('_dirty', '_dirty', { unique: false })
    }

    // Sync queue store
    if (!db.objectStoreNames.contains(STORE_NAMES.SYNC_QUEUE)) {
      const syncQueueStore = db.createObjectStore(STORE_NAMES.SYNC_QUEUE, {
        keyPath: 'id'
      })
      syncQueueStore.createIndex('user_id', 'user_id', { unique: false })
      syncQueueStore.createIndex('status', 'status', { unique: false })
      syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    // Metadata store
    if (!db.objectStoreNames.contains(STORE_NAMES.METADATA)) {
      db.createObjectStore(STORE_NAMES.METADATA, {
        keyPath: 'key'
      })
    }

    console.log('[DatabaseManager] V1 schema created successfully')
  }
}

// ============================================================================
// Exports
// ============================================================================

export default DatabaseManager
export {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseMigrationError
}
