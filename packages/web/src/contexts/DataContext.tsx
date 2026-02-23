/**
 * DataContext
 * Provides data management with offline-first caching and synchronization
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { NoteExtended, DailyReview } from '../types'
import { MockFolder } from '../constants'
import { notesAPI, foldersAPI, reviewsAPI } from '../api'
import { CacheService } from '../services/cache/CacheService'
import { OfflineQueue } from '../services/sync/OfflineQueue'
import { NetworkMonitor } from '../services/sync/NetworkMonitor'
import type {
  CachedNote,
  CachedFolder,
  CachedReview,
  SyncQueueItem
} from '../services/cache/types'
import type { SyncState, ConnectionType } from '../services/sync/SyncManager'

/** Sync status type alias for context */
export type SyncStatus = SyncState

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Data context type definition
 */
export interface DataContextType {
  // Data
  notes: NoteExtended[]
  reviews: DailyReview[]
  folders: MockFolder[]

  // Loading state
  isLoading: boolean
  error: string | null

  // Sync status
  syncStatus: SyncStatus
  isOffline: boolean
  pendingCount: number
  connectionType: ConnectionType

  // Actions
  addNote: (note: Omit<NoteExtended, 'id' | 'updatedAt'>) => Promise<void>
  updateNote: (id: number, updates: Partial<NoteExtended>) => Promise<void>
  deleteNote: (id: number) => Promise<void>
  addReview: (review: Omit<DailyReview, 'id'>) => Promise<void>
  updateFolder: (id: number, name: string) => Promise<void>

  // Data management
  refreshData: () => Promise<void>
  clearData: () => void
  forceSync: () => Promise<void>
}

/**
 * Data provider props
 */
export interface DataProviderProps {
  children: React.ReactNode
  userId: number | null
}

// ============================================================================
// Context Creation
// ============================================================================

const DataContext = createContext<DataContextType | undefined>(undefined)

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform API note response to NoteExtended
 */
const transformNote = (note: any): NoteExtended => ({
  id: note.id,
  user_id: note.user_id,
  title: note.title,
  content: note.content,
  folderId: note.folder_id,
  isPinned: note.is_pinned,
  updatedAt: note.updated_at,
  tags: []
})

/**
 * Transform API folder response to MockFolder
 */
const transformFolder = (folder: any): MockFolder => ({
  id: folder.id,
  user_id: folder.user_id,
  name: folder.name,
  icon: 'folder'
})

/**
 * Transform cached note to NoteExtended
 */
const cachedNoteToExtended = (note: CachedNote): NoteExtended => ({
  id: note.id,
  user_id: note.user_id,
  title: note.title,
  content: note.content,
  folderId: note.folder_id ?? undefined,
  isPinned: note.is_pinned,
  updatedAt: note.updated_at,
  tags: []
})

/**
 * Transform cached folder to MockFolder
 */
const cachedFolderToMock = (folder: CachedFolder): MockFolder => ({
  id: folder.id,
  user_id: folder.user_id,
  name: folder.name,
  icon: 'folder'
})

/**
 * Transform cached review to DailyReview
 */
const cachedReviewToDaily = (review: CachedReview): DailyReview => ({
  id: review.id,
  user_id: review.user_id,
  date: review.date,
  content: review.content,
  mood: review.mood ?? undefined,
  productivity: undefined,
  tags: [],
  created_at: review.updated_at,
  updated_at: review.updated_at
})

/**
 * Transform NoteExtended to CachedNote
 */
const noteToCached = (note: NoteExtended, userId: number): CachedNote => ({
  id: note.id!,
  user_id: userId,
  title: note.title,
  content: note.content,
  folder_id: note.folderId ?? null,
  is_pinned: note.isPinned ?? false,
  updated_at: note.updatedAt ?? new Date().toISOString(),
  version: 1,
  _cachedAt: Date.now(),
  _dirty: true
})

/**
 * Transform DailyReview to CachedReview
 */
const reviewToCached = (review: DailyReview, userId: number): CachedReview => ({
  id: review.id!,
  user_id: userId,
  date: review.date ?? new Date().toISOString().split('T')[0],
  content: review.content ?? '',
  mood: review.mood ?? null,
  achievements: null,
  improvements: null,
  plans: null,
  updated_at: review.updated_at ?? new Date().toISOString(),
  _cachedAt: Date.now(),
  _dirty: true
})

// ============================================================================
// Data Provider Component
// ============================================================================

/**
 * DataProvider
 *
 * Provides data management with offline-first caching and synchronization.
 *
 * Features:
 * - Offline-first data access (reads from local cache first)
 * - Background synchronization with server
 * - Optimistic updates with local caching
 * - Automatic queue management for offline operations
 *
 * @example
 * ```tsx
 * <DataProvider userId={userId}>
 *   <App />
 * </DataProvider>
 * ```
 */
export const DataProvider: React.FC<DataProviderProps> = ({ children, userId }) => {
  // ============================================================================
  // State
  // ============================================================================

  const [notes, setNotes] = useState<NoteExtended[]>([])
  const [reviews, setReviews] = useState<DailyReview[]>([])
  const [folders, setFolders] = useState<MockFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOffline, setIsOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [connectionType, setConnectionType] = useState<ConnectionType>('offline')

  // ============================================================================
  // Refs
  // ============================================================================

  const prevUserIdRef = useRef<number | null>(null)
  const updateTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const pendingUpdatesRef = useRef<Record<number, Partial<NoteExtended>>>({})
  const cacheServiceRef = useRef<CacheService | null>(null)
  const offlineQueueRef = useRef<OfflineQueue | null>(null)
  const networkMonitorRef = useRef<NetworkMonitor | null>(null)

  // ============================================================================
  // Initialize Services
  // ============================================================================

  useEffect(() => {
    cacheServiceRef.current = CacheService.getInstance()
    offlineQueueRef.current = OfflineQueue.getInstance()
    networkMonitorRef.current = NetworkMonitor.getInstance()

    // Subscribe to network state
    const unsubscribe = networkMonitorRef.current.subscribe(state => {
      setIsOffline(!state.isOnline)
      if (!state.isOnline) {
        setSyncStatus('offline')
        setConnectionType('offline')
      }
    })

    setIsOffline(!networkMonitorRef.current.isOnline())

    return () => {
      unsubscribe()
    }
  }, [])

  // ============================================================================
  // Clear Data
  // ============================================================================

  const clearData = useCallback(() => {
    setNotes([])
    setReviews([])
    setFolders([])
    setError(null)
    setIsLoading(false)
    setPendingCount(0)
    setSyncStatus('idle')
  }, [])

  // ============================================================================
  // Load Data from Cache
  // ============================================================================

  const loadFromCache = useCallback(async (userId: number): Promise<boolean> => {
    if (!cacheServiceRef.current) return false

    try {
      const [cachedNotes, cachedFolders, cachedReviews] = await Promise.all([
        cacheServiceRef.current.getNotes(userId),
        cacheServiceRef.current.getFolders(userId),
        cacheServiceRef.current.getReviews(userId)
      ])

      if (cachedNotes.length > 0 || cachedFolders.length > 0 || cachedReviews.length > 0) {
        setNotes(cachedNotes.map(cachedNoteToExtended))
        setFolders(cachedFolders.map(cachedFolderToMock))
        setReviews(cachedReviews.map(cachedReviewToDaily))
        return true
      }

      return false
    } catch (err) {
      console.error('Failed to load from cache:', err)
      return false
    }
  }, [])

  // ============================================================================
  // Save Data to Cache
  // ============================================================================

  const saveToCache = useCallback(async (
    notes: NoteExtended[],
    folders: MockFolder[],
    reviews: DailyReview[],
    userId: number
  ): Promise<void> => {
    if (!cacheServiceRef.current) return

    try {
      const cachedNotes: CachedNote[] = notes.map(note => ({
        id: note.id!,
        user_id: userId,
        title: note.title,
        content: note.content,
        folder_id: note.folderId ?? null,
        is_pinned: note.isPinned ?? false,
        updated_at: note.updatedAt ?? new Date().toISOString(),
        version: 1,
        _cachedAt: Date.now(),
        _dirty: false
      }))

      const cachedFolders: CachedFolder[] = folders.map(folder => ({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        updated_at: new Date().toISOString(),
        _cachedAt: Date.now(),
        _dirty: false
      }))

      const cachedReviews: CachedReview[] = reviews.map(review => ({
        id: review.id!,
        user_id: userId,
        date: review.date ?? new Date().toISOString().split('T')[0],
        content: review.content ?? '',
        mood: review.mood ?? null,
        achievements: null,
        improvements: null,
        plans: null,
        updated_at: review.updated_at ?? new Date().toISOString(),
        _cachedAt: Date.now(),
        _dirty: false
      }))

      await Promise.all([
        cacheServiceRef.current.saveNotes(cachedNotes),
        cacheServiceRef.current.saveFolders(cachedFolders),
        cacheServiceRef.current.saveReviews(cachedReviews)
      ])
    } catch (err) {
      console.error('Failed to save to cache:', err)
    }
  }, [])

  // ============================================================================
  // Refresh Data
  // ============================================================================

  const refreshData = useCallback(async (): Promise<void> => {
    if (!userId) {
      clearData()
      return
    }

    setIsLoading(true)
    setError(null)

    // Try to load from cache first for offline-first experience
    const hasCacheData = await loadFromCache(userId)

    // If offline, use cache data only
    if (isOffline) {
      setIsLoading(false)
      if (!hasCacheData) {
        setError('No cached data available offline')
      }
      return
    }

    // Try to fetch from server
    try {
      setSyncStatus('syncing')

      const [notesRes, foldersRes, reviewsRes] = await Promise.allSettled([
        notesAPI.getAll(),
        foldersAPI.getAll(),
        reviewsAPI.getAll()
      ])

      const newNotes: NoteExtended[] = []
      const newFolders: MockFolder[] = []
      const newReviews: DailyReview[] = []

      if (notesRes.status === 'fulfilled') {
        const notesData = notesRes.value.data.data.notes || []
        notesData.forEach((note: any) => newNotes.push(transformNote(note)))
      } else {
        console.error('Failed to fetch notes:', notesRes.reason)
      }

      if (foldersRes.status === 'fulfilled') {
        const foldersData = foldersRes.value.data.data || []
        foldersData.forEach((folder: any) => newFolders.push(transformFolder(folder)))
      } else {
        console.error('Failed to fetch folders:', foldersRes.reason)
      }

      if (reviewsRes.status === 'fulfilled') {
        const reviewsData = reviewsRes.value.data.data.reviews || []
        reviewsData.forEach((review: any) => newReviews.push(review))
      } else {
        console.error('Failed to fetch reviews:', reviewsRes.reason)
      }

      // Update state
      setNotes(newNotes)
      setFolders(newFolders)
      setReviews(newReviews)

      // Save to cache
      await saveToCache(newNotes, newFolders, newReviews, userId)

      // Update last sync time
      if (cacheServiceRef.current) {
        await cacheServiceRef.current.setLastSyncTime(new Date().toISOString())
      }

      setSyncStatus('idle')
      setConnectionType('http') // Using HTTP for API calls
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data from server')

      // If we don't have cache data, show error
      if (!hasCacheData) {
        setError('Failed to load data')
      }

      setSyncStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [userId, isOffline, clearData, loadFromCache, saveToCache])

  // ============================================================================
  // Update Pending Count
  // ============================================================================

  const updatePendingCount = useCallback(async (): Promise<void> => {
    if (!userId || !offlineQueueRef.current) return

    try {
      const status = await offlineQueueRef.current.getStatus(userId)
      setPendingCount(status.pending)
    } catch (err) {
      console.error('Failed to get pending count:', err)
    }
  }, [userId])

  // ============================================================================
  // User Change Effect
  // ============================================================================

  useEffect(() => {
    if (userId === null) {
      clearData()
      // Clear cache for previous user
      if (prevUserIdRef.current && cacheServiceRef.current) {
        cacheServiceRef.current.clearUserData(prevUserIdRef.current).catch(err => {
          console.error('Failed to clear user cache:', err)
        })
      }
    } else if (prevUserIdRef.current !== userId) {
      clearData()
      refreshData()
      updatePendingCount()
    }
    prevUserIdRef.current = userId
  }, [userId, clearData, refreshData, updatePendingCount])

  // ============================================================================
  // Add Note
  // ============================================================================

  const addNote = useCallback(async (noteData: Omit<NoteExtended, 'id' | 'updatedAt'>): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated')
    }

    const tempId = Date.now() // Temporary ID for optimistic update
    const newNote: NoteExtended = {
      ...noteData,
      id: tempId,
      updatedAt: new Date().toISOString()
    }

    // Optimistic update
    setNotes(prev => [newNote, ...prev])

    try {
      // If offline, add to queue
      if (isOffline) {
        if (offlineQueueRef.current) {
          await offlineQueueRef.current.addOperation({
            user_id: userId,
            operation_type: 'CREATE',
            entity_type: 'note',
            entity_id: null,
            data: {
              title: noteData.title,
              content: noteData.content,
              folder_id: noteData.folderId,
              is_pinned: noteData.isPinned
            }
          })
          updatePendingCount()
        }
        return
      }

      // Online: sync with server
      const res = await notesAPI.create({
        title: noteData.title,
        content: noteData.content,
        folder_id: noteData.folderId,
        is_pinned: noteData.isPinned
      })

      const createdNote = transformNote(res.data.data)

      // Update with real ID from server
      setNotes(prev => prev.map(n =>
        n.id === tempId ? createdNote : n
      ))

      // Save to cache
      if (cacheServiceRef.current) {
        await cacheServiceRef.current.saveNote({
          id: createdNote.id,
          user_id: userId,
          title: createdNote.title,
          content: createdNote.content,
          folder_id: createdNote.folderId ?? null,
          is_pinned: createdNote.isPinned ?? false,
          updated_at: createdNote.updatedAt ?? new Date().toISOString(),
          version: 1,
          _cachedAt: Date.now(),
          _dirty: false
        })
      }
    } catch (err) {
      // Revert optimistic update on error
      setNotes(prev => prev.filter(n => n.id !== tempId))
      console.error('Failed to create note:', err)
      throw err
    }
  }, [userId, isOffline, updatePendingCount])

  // ============================================================================
  // Update Note
  // ============================================================================

  const updateNote = useCallback(async (id: number, updates: Partial<NoteExtended>): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated')
    }

    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ))

    // Accumulate updates for debouncing
    pendingUpdatesRef.current[id] = { ...pendingUpdatesRef.current[id], ...updates }

    // Debounce API call
    if (updateTimersRef.current[id]) {
      clearTimeout(updateTimersRef.current[id])
    }

    updateTimersRef.current[id] = setTimeout(async () => {
      const updatesToSync = pendingUpdatesRef.current[id]
      delete pendingUpdatesRef.current[id]
      delete updateTimersRef.current[id]

      if (!updatesToSync) return

      // Update cache with dirty flag
      if (cacheServiceRef.current) {
        const existingNote = await cacheServiceRef.current.getNote(id)
        if (existingNote) {
          await cacheServiceRef.current.saveNote({
            ...existingNote,
            title: updatesToSync.title ?? existingNote.title,
            content: updatesToSync.content ?? existingNote.content,
            folder_id: updatesToSync.folderId ?? existingNote.folder_id,
            is_pinned: updatesToSync.isPinned ?? existingNote.is_pinned,
            updated_at: new Date().toISOString(),
            _dirty: true
          })
        }
      }

      // If offline, add to queue
      if (isOffline) {
        if (offlineQueueRef.current) {
          await offlineQueueRef.current.addOperation({
            user_id: userId,
            operation_type: 'UPDATE',
            entity_type: 'note',
            entity_id: id,
            data: {
              title: updatesToSync.title,
              content: updatesToSync.content,
              folder_id: updatesToSync.folderId,
              is_pinned: updatesToSync.isPinned
            }
          })
          updatePendingCount()
        }
        return
      }

      // Online: sync with server
      try {
        const apiUpdates: any = {}
        if (updatesToSync.title !== undefined) apiUpdates.title = updatesToSync.title
        if (updatesToSync.content !== undefined) apiUpdates.content = updatesToSync.content
        if (updatesToSync.folderId !== undefined) apiUpdates.folder_id = updatesToSync.folderId
        if (updatesToSync.isPinned !== undefined) apiUpdates.is_pinned = updatesToSync.isPinned

        if (Object.keys(apiUpdates).length > 0) {
          await notesAPI.update(id, apiUpdates)
        }

        // Mark as clean in cache
        if (cacheServiceRef.current) {
          const cachedNote = await cacheServiceRef.current.getNote(id)
          if (cachedNote) {
            await cacheServiceRef.current.saveNote({
              ...cachedNote,
              _dirty: false
            })
          }
        }
      } catch (err) {
        console.error('Failed to update note:', err)
        // Keep the dirty flag so it will be synced later
      }
    }, 1000)
  }, [userId, isOffline, updatePendingCount])

  // ============================================================================
  // Delete Note
  // ============================================================================

  const deleteNote = useCallback(async (id: number): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated')
    }

    // Optimistic delete
    setNotes(prev => prev.filter(n => n.id !== id))

    // Delete from cache
    if (cacheServiceRef.current) {
      await cacheServiceRef.current.deleteNote(id)
    }

    // If offline, add to queue
    if (isOffline) {
      if (offlineQueueRef.current) {
        await offlineQueueRef.current.addOperation({
          user_id: userId,
          operation_type: 'DELETE',
          entity_type: 'note',
          entity_id: id,
          data: {}
        })
        updatePendingCount()
      }
      return
    }

    // Online: sync with server
    try {
      await notesAPI.delete(id)
    } catch (err) {
      console.error('Failed to delete note:', err)
      throw err
    }
  }, [userId, isOffline, updatePendingCount])

  // ============================================================================
  // Add Review
  // ============================================================================

  const addReview = useCallback(async (reviewData: Omit<DailyReview, 'id'>): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated')
    }

    const tempId = Date.now()
    const newReview: DailyReview = {
      ...reviewData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Optimistic update
    setReviews(prev => [newReview, ...prev])

    try {
      // If offline, add to queue
      if (isOffline) {
        if (offlineQueueRef.current) {
          await offlineQueueRef.current.addOperation({
            user_id: userId,
            operation_type: 'CREATE',
            entity_type: 'review',
            entity_id: null,
            data: {
              date: reviewData.date || new Date().toISOString(),
              content: reviewData.content || '',
              mood: reviewData.mood
            }
          })
          updatePendingCount()
        }
        return
      }

      // Online: sync with server
      await reviewsAPI.create({
        date: reviewData.date || new Date().toISOString(),
        content: reviewData.content || '',
        mood: reviewData.mood
      })

      // Refresh to get the actual created review
      await refreshData()
    } catch (err) {
      // Revert on error
      setReviews(prev => prev.filter(r => r.id !== tempId))
      console.error('Failed to create review:', err)
      throw err
    }
  }, [userId, isOffline, updatePendingCount, refreshData])

  // ============================================================================
  // Update Folder
  // ============================================================================

  const updateFolder = useCallback(async (id: number, name: string): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated')
    }

    // Optimistic update
    setFolders(prev => prev.map(f =>
      f.id === id ? { ...f, name } : f
    ))

    // Update cache with dirty flag
    if (cacheServiceRef.current) {
      const existingFolder = await cacheServiceRef.current.getFolder(id)
      if (existingFolder) {
        await cacheServiceRef.current.saveFolder({
          ...existingFolder,
          name,
          _dirty: true
        })
      }
    }

    // If offline, add to queue
    if (isOffline) {
      if (offlineQueueRef.current) {
        await offlineQueueRef.current.addOperation({
          user_id: userId,
          operation_type: 'UPDATE',
          entity_type: 'folder',
          entity_id: id,
          data: { name }
        })
        updatePendingCount()
      }
      return
    }

    // Online: sync with server
    try {
      await foldersAPI.update(id, name)

      // Mark as clean in cache
      if (cacheServiceRef.current) {
        const cachedFolder = await cacheServiceRef.current.getFolder(id)
        if (cachedFolder) {
          await cacheServiceRef.current.saveFolder({
            ...cachedFolder,
            _dirty: false
          })
        }
      }
    } catch (err) {
      console.error('Failed to update folder:', err)
      throw err
    }
  }, [userId, isOffline, updatePendingCount])

  // ============================================================================
  // Force Sync
  // ============================================================================

  const forceSync = useCallback(async (): Promise<void> => {
    if (!userId || isOffline) {
      return
    }

    setSyncStatus('syncing')
    await refreshData()
    await updatePendingCount()
    setSyncStatus('idle')
  }, [userId, isOffline, refreshData, updatePendingCount])

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      // Clear all timers
      Object.values(updateTimersRef.current).forEach(timer => {
        clearTimeout(timer)
      })
    }
  }, [])

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: DataContextType = {
    notes,
    reviews,
    folders,
    isLoading,
    error,
    syncStatus,
    isOffline,
    pendingCount,
    connectionType,
    addNote,
    updateNote,
    deleteNote,
    addReview,
    updateFolder,
    refreshData,
    clearData,
    forceSync
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access data context
 *
 * @returns Data context value
 * @throws Error if used outside of DataProvider
 *
 * @example
 * ```tsx
 * const { notes, addNote, isOffline } = useData()
 * ```
 */
export const useData = (): DataContextType => {
  const context = useContext(DataContext)

  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }

  return context
}

// ============================================================================
// Exports
// ============================================================================

export default DataContext
