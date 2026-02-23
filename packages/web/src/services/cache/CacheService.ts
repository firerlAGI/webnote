/**
 * Cache Service
 * Provides high-level API for cached data operations with IndexedDB
 */

import { DatabaseManager, DatabaseError } from './Database'
import {
  STORE_NAMES,
  METADATA_KEYS,
  type CachedNote,
  type CachedFolder,
  type CachedReview,
  type SyncQueueItem,
  type CacheMetadata,
  type DirtyItems,
  type CacheStats,
  type SyncQueueStatus
} from './types'

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Cache service error
 */
export class CacheServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'CacheServiceError'
  }
}

// ============================================================================
// Cache Service Class
// ============================================================================

/**
 * Cache service for managing offline data
 *
 * Features:
 * - CRUD operations for notes, folders, and reviews
 * - Sync queue management for offline operations
 * - Metadata storage for sync state
 * - Batch operations support
 * - Dirty flag tracking
 *
 * @example
 * ```typescript
 * const cacheService = CacheService.getInstance()
 *
 * // Save a note
 * await cacheService.saveNote({
 *   id: 1,
 *   user_id: 1,
 *   title: 'My Note',
 *   content: '# Hello',
 *   folder_id: null,
 *   is_pinned: false,
 *   updated_at: new Date().toISOString(),
 *   version: 1,
 *   _cachedAt: Date.now(),
 *   _dirty: false
 * })
 *
 * // Get all notes for a user
 * const notes = await cacheService.getNotes(1)
 * ```
 */
export class CacheService {
  // ============================================================================
  // Private Properties
  // ============================================================================

  private static instance: CacheService | null = null
  private dbManager: DatabaseManager

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  // ============================================================================
  // Public Static Methods
  // ============================================================================

  /**
   * Get the singleton instance of CacheService
   * @returns CacheService instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    CacheService.instance = null
  }

  // ============================================================================
  // Public Methods - Notes Operations
  // ============================================================================

  /**
   * Get all notes for a user
   * @param userId - User ID
   * @returns Promise resolving to array of cached notes
   */
  async getNotes(userId: number): Promise<CachedNote[]> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.NOTES, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.NOTES)
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get notes: ${request.error?.message}`,
          'GET_NOTES_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Get a single note by ID
   * @param id - Note ID
   * @returns Promise resolving to cached note or null
   */
  async getNote(id: number): Promise<CachedNote | null> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.NOTES, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.NOTES)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get note: ${request.error?.message}`,
          'GET_NOTE_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save a single note to cache
   * @param note - Note to save
   */
  async saveNote(note: CachedNote): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.NOTES, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.NOTES)
      const request = store.put(note)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to save note: ${request.error?.message}`,
          'SAVE_NOTE_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save multiple notes to cache
   * @param notes - Array of notes to save
   */
  async saveNotes(notes: CachedNote[]): Promise<void> {
    if (notes.length === 0) return

    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.NOTES, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.NOTES)

      let completed = 0
      const total = notes.length

      notes.forEach(note => {
        const request = store.put(note)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to save notes: ${request.error?.message}`,
            'SAVE_NOTES_ERROR',
            request.error
          ))
        }
      })
    })
  }

  /**
   * Delete a note from cache
   * @param id - Note ID to delete
   */
  async deleteNote(id: number): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.NOTES, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.NOTES)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to delete note: ${request.error?.message}`,
          'DELETE_NOTE_ERROR',
          request.error
        ))
      }
    })
  }

  // ============================================================================
  // Public Methods - Folders Operations
  // ============================================================================

  /**
   * Get all folders for a user
   * @param userId - User ID
   * @returns Promise resolving to array of cached folders
   */
  async getFolders(userId: number): Promise<CachedFolder[]> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.FOLDERS, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.FOLDERS)
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get folders: ${request.error?.message}`,
          'GET_FOLDERS_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Get a single folder by ID
   * @param id - Folder ID
   * @returns Promise resolving to cached folder or null
   */
  async getFolder(id: number): Promise<CachedFolder | null> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.FOLDERS, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.FOLDERS)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get folder: ${request.error?.message}`,
          'GET_FOLDER_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save a single folder to cache
   * @param folder - Folder to save
   */
  async saveFolder(folder: CachedFolder): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.FOLDERS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.FOLDERS)
      const request = store.put(folder)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to save folder: ${request.error?.message}`,
          'SAVE_FOLDER_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save multiple folders to cache
   * @param folders - Array of folders to save
   */
  async saveFolders(folders: CachedFolder[]): Promise<void> {
    if (folders.length === 0) return

    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.FOLDERS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.FOLDERS)

      let completed = 0
      const total = folders.length

      folders.forEach(folder => {
        const request = store.put(folder)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to save folders: ${request.error?.message}`,
            'SAVE_FOLDERS_ERROR',
            request.error
          ))
        }
      })
    })
  }

  /**
   * Delete a folder from cache
   * @param id - Folder ID to delete
   */
  async deleteFolder(id: number): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.FOLDERS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.FOLDERS)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to delete folder: ${request.error?.message}`,
          'DELETE_FOLDER_ERROR',
          request.error
        ))
      }
    })
  }

  // ============================================================================
  // Public Methods - Reviews Operations
  // ============================================================================

  /**
   * Get all reviews for a user
   * @param userId - User ID
   * @returns Promise resolving to array of cached reviews
   */
  async getReviews(userId: number): Promise<CachedReview[]> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.REVIEWS, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.REVIEWS)
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get reviews: ${request.error?.message}`,
          'GET_REVIEWS_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Get a single review by ID
   * @param id - Review ID
   * @returns Promise resolving to cached review or null
   */
  async getReview(id: number): Promise<CachedReview | null> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.REVIEWS, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.REVIEWS)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get review: ${request.error?.message}`,
          'GET_REVIEW_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save a single review to cache
   * @param review - Review to save
   */
  async saveReview(review: CachedReview): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.REVIEWS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.REVIEWS)
      const request = store.put(review)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to save review: ${request.error?.message}`,
          'SAVE_REVIEW_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Save multiple reviews to cache
   * @param reviews - Array of reviews to save
   */
  async saveReviews(reviews: CachedReview[]): Promise<void> {
    if (reviews.length === 0) return

    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.REVIEWS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.REVIEWS)

      let completed = 0
      const total = reviews.length

      reviews.forEach(review => {
        const request = store.put(review)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to save reviews: ${request.error?.message}`,
            'SAVE_REVIEWS_ERROR',
            request.error
          ))
        }
      })
    })
  }

  /**
   * Delete a review from cache
   * @param id - Review ID to delete
   */
  async deleteReview(id: number): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.REVIEWS, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.REVIEWS)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to delete review: ${request.error?.message}`,
          'DELETE_REVIEW_ERROR',
          request.error
        ))
      }
    })
  }

  // ============================================================================
  // Public Methods - Sync Queue Operations
  // ============================================================================

  /**
   * Add an item to the sync queue
   * @param item - Sync queue item to add
   */
  async addToQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.SYNC_QUEUE, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)
      const request = store.add(item)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to add to queue: ${request.error?.message}`,
          'ADD_QUEUE_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Get sync queue items for a user
   * @param userId - User ID
   * @param status - Optional status filter
   * @returns Promise resolving to array of sync queue items
   */
  async getQueue(userId: number, status?: SyncQueueStatus): Promise<SyncQueueItem[]> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.SYNC_QUEUE, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => {
        let items = request.result || []

        // Filter by status if provided
        if (status) {
          items = items.filter(item => item.status === status)
        }

        // Sort by timestamp ascending
        items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        resolve(items)
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get queue: ${request.error?.message}`,
          'GET_QUEUE_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Update a sync queue item
   * @param id - Queue item ID
   * @param updates - Partial updates to apply
   */
  async updateQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.SYNC_QUEUE, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const item = getRequest.result

        if (!item) {
          reject(new CacheServiceError(
            `Queue item not found: ${id}`,
            'QUEUE_ITEM_NOT_FOUND'
          ))
          return
        }

        // Apply updates
        const updatedItem = { ...item, ...updates }
        const putRequest = store.put(updatedItem)

        putRequest.onsuccess = () => {
          resolve()
        }

        putRequest.onerror = () => {
          reject(new CacheServiceError(
            `Failed to update queue item: ${putRequest.error?.message}`,
            'UPDATE_QUEUE_ERROR',
            putRequest.error
          ))
        }
      }

      getRequest.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get queue item: ${getRequest.error?.message}`,
          'GET_QUEUE_ITEM_ERROR',
          getRequest.error
        ))
      }
    })
  }

  /**
   * Remove an item from the sync queue
   * @param id - Queue item ID to remove
   */
  async removeFromQueue(id: string): Promise<void> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.SYNC_QUEUE, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to remove from queue: ${request.error?.message}`,
          'REMOVE_QUEUE_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Clear all sync queue items for a user
   * @param userId - User ID
   */
  async clearQueue(userId: number): Promise<void> {
    const items = await this.getQueue(userId)

    if (items.length === 0) return

    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.SYNC_QUEUE, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)

      let completed = 0
      const total = items.length

      items.forEach(item => {
        const request = store.delete(item.id)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to clear queue: ${request.error?.message}`,
            'CLEAR_QUEUE_ERROR',
            request.error
          ))
        }
      })
    })
  }

  // ============================================================================
  // Public Methods - Metadata Operations
  // ============================================================================

  /**
   * Get metadata by key
   * @param key - Metadata key
   * @returns Promise resolving to metadata or null
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    const db = await this.dbManager.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.METADATA, 'readonly')
      const store = transaction.objectStore(STORE_NAMES.METADATA)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to get metadata: ${request.error?.message}`,
          'GET_METADATA_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Set metadata
   * @param key - Metadata key
   * @param value - Metadata value
   */
  async setMetadata(key: string, value: string | number | object): Promise<void> {
    const db = await this.dbManager.getDB()

    const metadata: CacheMetadata = {
      key,
      value,
      updated_at: new Date().toISOString()
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAMES.METADATA, 'readwrite')
      const store = transaction.objectStore(STORE_NAMES.METADATA)
      const request = store.put(metadata)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new CacheServiceError(
          `Failed to set metadata: ${request.error?.message}`,
          'SET_METADATA_ERROR',
          request.error
        ))
      }
    })
  }

  /**
   * Get last sync time
   * @returns Promise resolving to last sync timestamp or null
   */
  async getLastSyncTime(): Promise<string | null> {
    const metadata = await this.getMetadata(METADATA_KEYS.LAST_SYNC_TIME)
    return metadata ? (metadata.value as string) : null
  }

  /**
   * Set last sync time
   * @param time - Sync timestamp
   */
  async setLastSyncTime(time: string): Promise<void> {
    await this.setMetadata(METADATA_KEYS.LAST_SYNC_TIME, time)
  }

  // ============================================================================
  // Public Methods - Batch Operations
  // ============================================================================

  /**
   * Clear all cached data for a user
   * @param userId - User ID
   */
  async clearUserData(userId: number): Promise<void> {
    const db = await this.dbManager.getDB()

    // Get all notes, folders, reviews, and queue items for the user
    const [notes, folders, reviews, queueItems] = await Promise.all([
      this.getNotes(userId),
      this.getFolders(userId),
      this.getReviews(userId),
      this.getQueue(userId)
    ])

    return new Promise((resolve, reject) => {
      const storeNames = [
        STORE_NAMES.NOTES,
        STORE_NAMES.FOLDERS,
        STORE_NAMES.REVIEWS,
        STORE_NAMES.SYNC_QUEUE
      ]

      const transaction = db.transaction(storeNames, 'readwrite')
      let completed = 0
      const total = notes.length + folders.length + reviews.length + queueItems.length

      const deleteAndCount = (store: IDBObjectStore, id: number | string) => {
        const request = store.delete(id as IDBValidKey)
        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }
        request.onerror = () => {
          reject(new CacheServiceError(
            `Failed to delete: ${request.error?.message}`,
            'DELETE_ERROR',
            request.error
          ))
        }
      }

      // Delete notes
      const notesStore = transaction.objectStore(STORE_NAMES.NOTES)
      notes.forEach(note => deleteAndCount(notesStore, note.id))

      // Delete folders
      const foldersStore = transaction.objectStore(STORE_NAMES.FOLDERS)
      folders.forEach(folder => deleteAndCount(foldersStore, folder.id))

      // Delete reviews
      const reviewsStore = transaction.objectStore(STORE_NAMES.REVIEWS)
      reviews.forEach(review => deleteAndCount(reviewsStore, review.id))

      // Delete queue items
      const queueStore = transaction.objectStore(STORE_NAMES.SYNC_QUEUE)
      queueItems.forEach(item => deleteAndCount(queueStore, item.id))

      // If nothing to delete, resolve immediately
      if (total === 0) {
        resolve()
      }
    })
  }

  /**
   * Get all dirty (unsynchronized) items for a user
   * @param userId - User ID
   * @returns Promise resolving to dirty items collection
   */
  async getDirtyItems(userId: number): Promise<DirtyItems> {
    const [notes, folders, reviews] = await Promise.all([
      this.getNotes(userId),
      this.getFolders(userId),
      this.getReviews(userId)
    ])

    return {
      notes: notes.filter(note => note._dirty),
      folders: folders.filter(folder => folder._dirty),
      reviews: reviews.filter(review => review._dirty)
    }
  }

  /**
   * Get cache statistics
   * @param userId - Optional user ID for user-specific stats
   * @returns Promise resolving to cache statistics
   */
  async getStats(userId?: number): Promise<CacheStats> {
    let notes: CachedNote[] = []
    let folders: CachedFolder[] = []
    let reviews: CachedReview[] = []
    let pendingSyncCount = 0

    if (userId) {
      const [userNotes, userFolders, userReviews, queueItems] = await Promise.all([
        this.getNotes(userId),
        this.getFolders(userId),
        this.getReviews(userId),
        this.getQueue(userId, 'pending')
      ])

      notes = userNotes
      folders = userFolders
      reviews = userReviews
      pendingSyncCount = queueItems.length
    } else {
      // Get all data (no user filter)
      const db = await this.dbManager.getDB()

      const getAllFromStore = (storeName: string): Promise<unknown[]> => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(storeName, 'readonly')
          const store = transaction.objectStore(storeName)
          const request = store.getAll()

          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => reject(request.error)
        })
      }

      const [allNotes, allFolders, allReviews, allQueue] = await Promise.all([
        getAllFromStore(STORE_NAMES.NOTES),
        getAllFromStore(STORE_NAMES.FOLDERS),
        getAllFromStore(STORE_NAMES.REVIEWS),
        getAllFromStore(STORE_NAMES.SYNC_QUEUE)
      ])

      notes = allNotes as CachedNote[]
      folders = allFolders as CachedFolder[]
      reviews = allReviews as CachedReview[]
      pendingSyncCount = (allQueue as SyncQueueItem[]).filter(
        item => item.status === 'pending'
      ).length
    }

    return {
      notesCount: notes.length,
      foldersCount: folders.length,
      reviewsCount: reviews.length,
      pendingSyncCount,
      dirtyNotesCount: notes.filter(n => n._dirty).length,
      dirtyFoldersCount: folders.filter(f => f._dirty).length,
      dirtyReviewsCount: reviews.filter(r => r._dirty).length
    }
  }

  // ============================================================================
  // Public Methods - Utility
  // ============================================================================

  /**
   * Check if cache is available
   * @returns Promise resolving to boolean
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.dbManager.getDB()
      return true
    } catch {
      return false
    }
  }

  /**
   * Clear all cached data (entire database)
   */
  async clearAll(): Promise<void> {
    await this.dbManager.clearAllStores()
  }
}

// ============================================================================
// Exports
// ============================================================================

export default CacheService
export { CacheServiceError }
