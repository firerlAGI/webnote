
export interface User {
  id: number
  username: string
  email: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: number
  user_id: number
  title: string
  content: string
  folder_id?: number
  is_pinned: boolean
  last_accessed_at: string
  content_hash?: string
  created_at: string
  updated_at: string
  folder?: Folder
}

export interface Folder {
  id: number
  user_id: number
  name: string
  created_at: string
  updated_at: string
  notes?: Note[]
}

export interface Review {
  id: number
  user_id: number
  date: string
  content: string
  mood?: number
  achievements?: string[]
  improvements?: string[]
  plans?: string[]
  template_id?: number
  created_at: string
  updated_at: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  code: number
}

export interface NoteFilters {
  search?: string
  folder_id?: number
  is_pinned?: boolean
  sort_by?: 'created_at' | 'updated_at' | 'last_accessed_at'
  sort_order?: 'asc' | 'desc'
}

export interface ReviewStats {
  total: number
  averageMood: number
  periodStats: {
    date: string
    mood: number
  }[]
}
