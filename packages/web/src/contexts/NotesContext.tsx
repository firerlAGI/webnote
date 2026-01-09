import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { Note, NoteFilters } from '@webnote/shared/types'
import api from '@webnote/shared/api'
import { handleApiError, logError } from '../utils/errorHandler';

/**
 * NotesContextType 定义了笔记上下文的类型接口
 * @property {Note[]} notes - 笔记列表
 * @property {Note | null} currentNote - 当前选中的笔记
 * @property {boolean} isLoading - 是否正在加载
 * @property {string | null} error - 错误信息
 * @property {NoteFilters} filters - 笔记过滤条件
 * @property {Function} setFilters - 设置过滤条件函数
 * @property {Function} fetchNotes - 获取笔记列表函数
 * @property {Function} getNoteById - 根据ID获取笔记函数
 * @property {Function} createNote - 创建笔记函数
 * @property {Function} updateNote - 更新笔记函数
 * @property {Function} deleteNote - 删除笔记函数
 * @property {Function} clearError - 清除错误函数
 */
interface NotesContextType {
  notes: Note[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;
  filters: NoteFilters;
  setFilters: (filters: NoteFilters) => void;
  fetchNotes: () => Promise<void>;
  getNoteById: (id: number) => Promise<Note | null>;
  createNote: (
    note: Omit<
      Note,
      'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_accessed_at'
    >
  ) => Promise<Note>;
  updateNote: (id: number, note: Partial<Note>) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  clearError: () => void;
}

// 创建笔记上下文
const NotesContext = createContext<NotesContextType | undefined>(undefined);

/**
 * NotesProvider 组件提供笔记状态和方法
 * @param {Object} props - 组件属性
 * @param {ReactNode} props.children - 子组件
 */
export const NotesProvider = ({ children }: { children: ReactNode }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NoteFilters>({});

  /**
   * 获取笔记列表函数
   */
  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Note[]>('/notes', filters);
      if (response.success) {
        setNotes(response.data);
      } else {
        // 处理API返回的错误
        setError(response.message || 'Failed to fetch notes: Invalid response');
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      const standardError = handleApiError(err);
      logError(standardError, 'Fetch Notes');
      setError(standardError.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  /**
   * 根据ID获取笔记函数
   * @param {number} id - 笔记ID
   * @returns {Promise<Note | null>} 笔记对象或null
   */
  const getNoteById = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Note>(`/notes/${id}`);
      if (response.success) {
        setCurrentNote(response.data);
        return response.data;
      } else {
        // 处理API返回的错误
        setError(response.message || 'Failed to fetch note: Invalid response');
        return null;
      }
    } catch (err: any) {
      // 处理网络错误或其他异常
      const standardError = handleApiError(err);
      logError(standardError, 'Get Note by ID');
      setError(standardError.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 创建笔记函数
   * @param {Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_accessed_at'>} noteData - 笔记数据
   * @returns {Promise<Note>} 创建的笔记对象
   */
  const createNote = useCallback(
    async (
      noteData: Omit<
        Note,
        'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_accessed_at'
      >
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<Note>('/notes', noteData);
        if (response.success) {
          setNotes((prev) => [...prev, response.data]);
          return response.data;
        } else {
          // 处理API返回的错误
          const errorMessage =
            response.message || 'Failed to create note: Invalid response';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        const standardError = handleApiError(err);
        logError(standardError, 'Create Note');
        setError(standardError.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, []);

  /**
   * 更新笔记函数
   * @param {number} id - 笔记ID
   * @param {Partial<Note>} noteData - 笔记更新数据
   * @returns {Promise<Note>} 更新后的笔记对象
   */
  const updateNote = useCallback(
    async (id: number, noteData: Partial<Note>) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.put<Note>(`/notes/${id}`, noteData);
        if (response.success) {
          setNotes((prev) =>
            prev.map((note) => (note.id === id ? response.data : note))
          );
          if (currentNote?.id === id) {
            setCurrentNote(response.data);
          }
          return response.data;
        } else {
          // 处理API返回的错误
          const errorMessage =
            response.message || 'Failed to update note: Invalid response';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        const standardError = handleApiError(err);
        logError(standardError, 'Update Note');
        setError(standardError.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentNote]
  );

  /**
   * 删除笔记函数
   * @param {number} id - 笔记ID
   */
  const deleteNote = useCallback(
    async (id: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.delete<{ success: boolean }>(`/notes/${id}`);
        if (response.success) {
          setNotes((prev) => prev.filter((note) => note.id !== id));
          if (currentNote?.id === id) {
            setCurrentNote(null);
          }
        } else {
          // 处理API返回的错误
          setError(response.message || 'Failed to delete note: Invalid response');
        }
      } catch (err: any) {
        // 处理网络错误或其他异常
        const standardError = handleApiError(err);
        logError(standardError, 'Delete Note');
        setError(standardError.message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentNote]
  );

  /**
   * 清除错误函数
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        currentNote,
        isLoading,
        error,
        filters,
        setFilters,
        fetchNotes,
        getNoteById,
        createNote,
        updateNote,
        deleteNote,
        clearError,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

/**
 * useNotes 钩子用于在组件中访问笔记上下文
 * @returns {NotesContextType} 笔记上下文
 * @throws {Error} 如果在NotesProvider之外使用
 */
export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};
