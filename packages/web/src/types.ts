// 导入共享类型
import type {
  Note as SharedNote,
  Folder as SharedFolder,
  Review as SharedReview,
  User as SharedUser,
  ApiResponse as SharedApiResponse
} from '@webnote/shared/types';

// 使用共享类型
export type Note = SharedNote;
export type Folder = SharedFolder;
export type Review = SharedReview;
export type User = SharedUser;
export type ApiResponse<T = any> = SharedApiResponse<T>;

// 前端扩展类型 - 适配 cyberpunk UI
export interface UserExtended extends User {
  avatar?: string;
  role?: 'NET_RUNNER' | 'SYS_ADMIN' | 'USER';
}

export interface NoteExtended extends Omit<Note, 'is_pinned' | 'last_accessed_at' | 'created_at' | 'updated_at'> {
  tags?: string[]; // 前端可选的tags字段
  isPinned?: boolean;
  updatedAt?: string;
  folderId?: number; // 前端使用 camelCase
}

export interface DailyReview extends Omit<Review, 'date' | 'mood'> {
  date?: string;
  mood?: number; // 1-10
  productivity?: number; // 1-10
  tags?: string[];
}

export enum AppRoute {
  LOGIN = '/login',
  DASHBOARD = '/',
  NOTES = '/notes',
  REVIEW = '/review',
  SETTINGS = '/settings',
}
