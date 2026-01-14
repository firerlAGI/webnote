export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string;
  isPinned: boolean;
  updatedAt: string;
  tags: string[];
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
}

export interface DailyReview {
  id: string;
  date: string;
  mood: number; // 1-10
  productivity: number; // 1-10
  content: string;
  tags: string[];
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  role: 'NET_RUNNER' | 'SYS_ADMIN';
}

export enum AppRoute {
  LOGIN = '/login',
  DASHBOARD = '/',
  NOTES = '/notes',
  REVIEW = '/review',
  SETTINGS = '/settings',
}