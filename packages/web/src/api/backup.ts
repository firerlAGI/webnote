/**
 * 备份API客户端
 * 处理与后端备份服务的通信
 */

import ApiClient from '@webnote/shared/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份ID */
  id: string;
  /** 用户ID */
  userId: number;
  /** 备份名称 */
  name: string;
  /** 备份时间 */
  timestamp: number;
  /** 备份大小（字节） */
  size: number;
  /** 备份类型 */
  type: 'manual' | 'auto' | 'full' | 'incremental';
  /** 备份状态 */
  status: 'completed' | 'pending' | 'failed';
  /** 备份描述 */
  description?: string;
  /** 备份项数量 */
  itemCount?: number;
  /** 文件路径 */
  filePath?: string;
}

/**
 * 备份进度信息
 */
export interface BackupProgress {
  /** 是否正在进行 */
  inProgress: boolean;
  /** 当前进度 (0-100) */
  progress: number;
  /** 当前步骤 */
  currentStep: string;
  /** 总步骤数 */
  totalSteps: number;
  /** 已处理项目数 */
  processedItems: number;
  /** 总项目数 */
  totalItems: number;
}

/**
 * 恢复选项
 */
export interface RestoreOptions {
  /** 是否覆盖冲突数据 */
  overwriteConflicts: boolean;
  /** 是否恢复删除的数据 */
  restoreDeleted: boolean;
}

/**
 * API响应类型
 */
type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  code: number;
};

// ============================================================================
// 备份API类
// ============================================================================

class BackupAPI {
  private api: ApiClient;

  constructor() {
    this.api = new ApiClient();
  }

  /**
   * 创建备份
   */
  async createBackup(type: 'manual' | 'auto' = 'manual'): Promise<BackupInfo> {
    const response: ApiResponse<BackupInfo> = await this.api.post<BackupInfo>(
      '/backups',
      { type }
    );

    if (!response.success) {
      throw new Error(response.message || '创建备份失败');
    }

    return response.data;
  }

  /**
   * 获取备份列表
   */
  async getBackupList(): Promise<BackupInfo[]> {
    const response: ApiResponse<BackupInfo[]> = await this.api.get<BackupInfo[]>(
      '/backups'
    );

    if (!response.success) {
      throw new Error(response.message || '获取备份列表失败');
    }

    return response.data;
  }

  /**
   * 获取备份详情
   */
  async getBackupDetail(backupId: string): Promise<any> {
    const response: ApiResponse<any> = await this.api.get<any>(
      `/backups/${backupId}`
    );

    if (!response.success) {
      throw new Error(response.message || '获取备份详情失败');
    }

    return response.data;
  }

  /**
   * 恢复备份
   */
  async restoreBackup(
    backupId: string,
    options: RestoreOptions
  ): Promise<void> {
    const response: ApiResponse<any> = await this.api.post<any>(
      `/backups/${backupId}/restore`,
      options
    );

    if (!response.success) {
      throw new Error(response.message || '恢复备份失败');
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<void> {
    const response: ApiResponse<any> = await this.api.delete<any>(
      `/backups/${backupId}`
    );

    if (!response.success) {
      throw new Error(response.message || '删除备份失败');
    }
  }

  /**
   * 下载备份
   */
  async downloadBackup(backupId: string): Promise<Blob> {
    const token = typeof localStorage !== 'undefined'
      ? localStorage.getItem('token')
      : null;

    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`/api/backups/${backupId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('下载备份失败');
    }

    return response.blob();
  }
}

// 导出单例
export const backupAPI = new BackupAPI();
export default backupAPI;
