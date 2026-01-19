import React, { createContext, useContext, useState, useEffect } from 'react';
import { NoteExtended, DailyReview } from '../types';
import { MOCK_NOTES, MOCK_REVIEWS, MOCK_FOLDERS, MockFolder } from '../constants';

interface DataContextType {
  notes: NoteExtended[];
  reviews: DailyReview[];
  folders: MockFolder[];
  addNote: (note: Omit<NoteExtended, 'id' | 'updatedAt'>) => void;
  updateNote: (id: number, updates: Partial<NoteExtended>) => void;
  deleteNote: (id: number) => void;
  addReview: (review: Omit<DailyReview, 'id'>) => void;
  updateFolder: (id: number, name: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from localStorage or fallback to MOCK data
  const [notes, setNotes] = useState<NoteExtended[]>(() => {
    const saved = localStorage.getItem('wn_notes');
    return saved ? JSON.parse(saved) : MOCK_NOTES;
  });

  const [reviews, setReviews] = useState<DailyReview[]>(() => {
    const saved = localStorage.getItem('wn_reviews');
    return saved ? JSON.parse(saved) : MOCK_REVIEWS;
  });

  const [folders, setFolders] = useState<MockFolder[]>(() => {
    const saved = localStorage.getItem('wn_folders');
    return saved ? JSON.parse(saved) : MOCK_FOLDERS;
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('wn_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('wn_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem('wn_folders', JSON.stringify(folders));
  }, [folders]);

  // Actions
  const addNote = (noteData: Omit<NoteExtended, 'id' | 'updatedAt'>) => {
    const newNote: NoteExtended = {
      ...noteData,
      id: Date.now(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
  };

  const updateNote = (id: number, updates: Partial<NoteExtended>) => {
    setNotes(prev => prev.map(n => 
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ));
  };

  const deleteNote = (id: number) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addReview = (reviewData: Omit<DailyReview, 'id'>) => {
    const newReview: DailyReview = {
      ...reviewData,
      id: Date.now(),
    };
    setReviews(prev => [newReview, ...prev]);
  };

  const updateFolder = (id: number, name: string) => {
    setFolders(prev => prev.map(f => 
      f.id === id ? { ...f, name } : f
    ));
  };

  return (
    <DataContext.Provider value={{ notes, reviews, folders, addNote, updateNote, deleteNote, addReview, updateFolder }}>
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
