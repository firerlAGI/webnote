
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
  // 生物指标（雷达图）
  spirit?: number      // 精神
  energy?: number      // 体力
  focus?: number       // 专注
  creativity?: number  // 创造
  emotion?: number     // 情绪
  social?: number      // 社交
  // 统计数据
  focus_score?: number    // 专注度百分比
  energy_score?: number   // 体力百分比
  mood_score?: number     // 情绪评分（1-10）
  // 核心任务和阻碍
  prime_directive?: string  // 核心任务
  system_interrupts?: string // 阻碍因素
  // 附件
  attachments?: string[]  // 附件文件URL列表
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
  averageMood: number | null
  periodStats: {
    date: string
    mood: number
  }[]
  // 连续打卡统计
  streak?: number
  lastReviewDate?: string
  // 生物指标平均值
  avgSpirit?: number
  avgEnergy?: number
  avgFocus?: number
  avgCreativity?: number
  avgEmotion?: number
  avgSocial?: number
}

// 用户设置
export interface UserSettings {
  id: number
  user_id: number
  // 界面设置
  theme: 'cyan' | 'pink' | 'yellow'
  language: 'zh-CN' | 'en-US' | 'ja-JP'
  density: 'standard' | 'compact'
  // 同步设置
  sync_enabled: boolean
  offline_retention_days: number
  // 通知设置
  notifications: {
    system_updates: boolean
    daily_reminder: boolean
    intrusion_detection: boolean
    community_updates: boolean
  }
  // 安全设置
  two_factor_enabled: boolean
  encryption_enabled: boolean
  created_at: string
  updated_at: string
}

// 复盘统计数据响应
export interface ReviewDashboardData {
  currentReview: Review | null
  streak: number
  stats: {
    focus: number
    energy: number
    mood: number
  }
  bioMetrics: {
    spirit: number
    energy: number
    focus: number
    creativity: number
    emotion: number
    social: number
  }
  recentReviews: Review[]
}
