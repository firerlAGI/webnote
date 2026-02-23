import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { NoteExtended, DailyReview } from '../types';
import { MockFolder } from '../constants';
import { notesAPI, foldersAPI, reviewsAPI } from '../api';

interface DataContextType {
  notes: NoteExtended[];
  reviews: DailyReview[];
  folders: MockFolder[];
  isLoading: boolean;
  error: string | null;
  addNote: (note: Omit<NoteExtended, 'id' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: number, updates: Partial<NoteExtended>) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  addReview: (review: Omit<DailyReview, 'id'>) => Promise<void>;
  updateFolder: (id: number, name: string) => Promise<void>;
  refreshData: () => Promise<void>;
  clearData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Transform helpers
const transformNote = (note: any): NoteExtended => ({
  id: note.id,
  user_id: note.user_id,
  title: note.title,
  content: note.content,
  folderId: note.folder_id,
  isPinned: note.is_pinned,
  updatedAt: note.updated_at,
  tags: [] // Backend doesn't support tags yet
});

const transformFolder = (folder: any): MockFolder => ({
  id: folder.id,
  user_id: folder.user_id,
  name: folder.name,
  icon: 'folder' // Default icon
});

interface DataProviderProps {
  children: React.ReactNode;
  userId: number | null;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children, userId }) => {
  const [notes, setNotes] = useState<NoteExtended[]>([]);
  const [reviews, setReviews] = useState<DailyReview[]>([]);
  const [folders, setFolders] = useState<MockFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevUserIdRef = useRef<number | null>(null);
  const updateTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendingUpdates = useRef<Record<number, Partial<NoteExtended>>>({});

  const clearData = () => {
    setNotes([]);
    setReviews([]);
    setFolders([]);
    setError(null);
    setIsLoading(false);
  };

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [notesRes, foldersRes, reviewsRes] = await Promise.allSettled([
        notesAPI.getAll(),
        foldersAPI.getAll(),
        reviewsAPI.getAll()
      ]);

      if (notesRes.status === 'fulfilled') {
        console.log('Notes API Response:', notesRes.value.data);
        // Handle pagination structure if necessary, assume data.data.notes for now based on API response
        const notesData = notesRes.value.data.data.notes || [];
        setNotes(notesData.map(transformNote));
      } else {
        console.error('Failed to fetch notes:', notesRes.reason);
      }

      if (foldersRes.status === 'fulfilled') {
        const foldersData = foldersRes.value.data.data || []; // API response structure might differ
        setFolders(foldersData.map(transformFolder));
      } else {
        console.error('Failed to fetch folders:', foldersRes.reason);
      }

      if (reviewsRes.status === 'fulfilled') {
        const reviewsData = reviewsRes.value.data.data.reviews || []; // API response structure
        setReviews(reviewsData);
      } else {
        console.error('Failed to fetch reviews:', reviewsRes.reason);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data from server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId === null) {
      clearData();
    } else if (prevUserIdRef.current !== userId) {
      clearData();
      refreshData();
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  // Actions
  const addNote = async (noteData: Omit<NoteExtended, 'id' | 'updatedAt'>) => {
    try {
      const res = await notesAPI.create({
        title: noteData.title,
        content: noteData.content,
        folder_id: noteData.folderId,
        is_pinned: noteData.isPinned
      });
      
      const newNote = transformNote(res.data.data);
      setNotes(prev => [newNote, ...prev]);
    } catch (err) {
      console.error('Failed to create note:', err);
      throw err;
    }
  };

  const updateNote = async (id: number, updates: Partial<NoteExtended>) => {
    // 1. Optimistic Update
    setNotes(prev => prev.map(n => 
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ));

    // 2. Accumulate updates
    pendingUpdates.current[id] = { ...pendingUpdates.current[id], ...updates };

    // 3. Debounce API call
    if (updateTimers.current[id]) {
      clearTimeout(updateTimers.current[id]);
    }

    updateTimers.current[id] = setTimeout(async () => {
      const updatesToSync = pendingUpdates.current[id];
      // Clear pending updates for this ID immediately to avoid race conditions with future updates
      delete pendingUpdates.current[id];
      delete updateTimers.current[id];

      if (!updatesToSync) return;

      try {
        // Convert frontend camelCase to backend snake_case
        const apiUpdates: any = {};
        if (updatesToSync.title !== undefined) apiUpdates.title = updatesToSync.title;
        if (updatesToSync.content !== undefined) apiUpdates.content = updatesToSync.content;
        if (updatesToSync.folderId !== undefined) apiUpdates.folder_id = updatesToSync.folderId;
        if (updatesToSync.isPinned !== undefined) apiUpdates.is_pinned = updatesToSync.isPinned;

        if (Object.keys(apiUpdates).length > 0) {
          await notesAPI.update(id, apiUpdates);
        }
      } catch (err) {
        console.error('Failed to update note:', err);
        // Ideally we should revert the optimistic update here or show an error
        // But reverting is tricky if the user kept typing.
      }
    }, 1000);
  };

  const deleteNote = async (id: number) => {
    try {
      await notesAPI.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  const addReview = async (reviewData: Omit<DailyReview, 'id'>) => {
    try {
        // Need to check review API params structure
        await reviewsAPI.create({
            date: reviewData.date || new Date().toISOString(),
            content: reviewData.content || '',
            mood: reviewData.mood,
            // Add other fields if necessary
        });
        // For now, just refresh or push simplified version
        await refreshData();
    } catch (err) {
        console.error('Failed to create review:', err);
        throw err;
    }
  };

  const updateFolder = async (id: number, name: string) => {
    try {
        await foldersAPI.update(id, name);
        setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    } catch (err) {
        console.error('Failed to update folder:', err);
        throw err;
    }
  };

  return (
    <DataContext.Provider value={{ 
      notes, 
      reviews, 
      folders, 
      isLoading, 
      error,
      addNote, 
      updateNote, 
      deleteNote, 
      addReview, 
      updateFolder,
      refreshData,
      clearData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
