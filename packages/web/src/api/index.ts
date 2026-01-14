import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.hash = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

// User API
export const userAPI = {
  getMe: () => api.get('/user/me'),
  
  updateMe: (data: { username?: string; email?: string }) =>
    api.put('/user/me', data),
};

// Notes API
export const notesAPI = {
  create: (data: { title: string; content: string; folder_id?: number; is_pinned?: boolean }) =>
    api.post('/notes', data),
  
  getAll: (params?: {
    search?: string;
    folder_id?: string;
    is_pinned?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    limit?: number;
  }) => api.get('/notes', { params }),
  
  getById: (id: number) => api.get(`/notes/${id}`),
  
  update: (id: number, data: {
    title?: string;
    content?: string;
    folder_id?: number;
    is_pinned?: boolean;
  }) => api.put(`/notes/${id}`, data),
  
  delete: (id: number) => api.delete(`/notes/${id}`),
  
  batchDelete: (ids: number[]) => api.post('/notes/batch-delete', { ids }),
  
  batchPin: (ids: number[], is_pinned: boolean) =>
    api.post('/notes/batch-pin', { ids, is_pinned }),
};

// Folders API
export const foldersAPI = {
  create: (name: string) => api.post('/folders', { name }),
  
  getAll: () => api.get('/folders'),
  
  getById: (id: number) => api.get(`/folders/${id}`),
  
  update: (id: number, name: string) => api.put(`/folders/${id}`, { name }),
  
  delete: (id: number) => api.delete(`/folders/${id}`),
};

// Reviews API
export const reviewsAPI = {
  create: (data: {
    date: string;
    content: string;
    mood?: number;
    achievements?: string[];
    improvements?: string[];
    plans?: string[];
    template_id?: number;
  }) => api.post('/reviews', data),
  
  getAll: (params?: {
    start_date?: string;
    end_date?: string;
    mood?: string;
    page?: number;
    limit?: number;
  }) => api.get('/reviews', { params }),
  
  getById: (id: number) => api.get(`/reviews/${id}`),
  
  update: (id: number, data: {
    date?: string;
    content?: string;
    mood?: number;
    achievements?: string[];
    improvements?: string[];
    plans?: string[];
    template_id?: number;
  }) => api.put(`/reviews/${id}`, data),
  
  delete: (id: number) => api.delete(`/reviews/${id}`),
  
  getStats: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/reviews/stats', { params }),
};

// Backup API
export const backupAPI = {
  create: (type: 'manual' | 'auto' = 'manual') =>
    api.post('/backups', { type }),
  
  getAll: () => api.get('/backups'),
  
  getById: (id: string) => api.get(`/backups/${id}`),
  
  restore: (id: string, options: { overwriteConflicts?: boolean; restoreDeleted?: boolean }) =>
    api.post(`/backups/${id}/restore`, options),
  
  delete: (id: string) => api.delete(`/backups/${id}`),
  
  download: (id: string) => api.get(`/backups/${id}/download`, { responseType: 'blob' }),
};

export default api;
