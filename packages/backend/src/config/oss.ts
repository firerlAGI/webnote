/**
 * 阿里云OSS配置模块
 * 提供OSS客户端和配置管理
 */

import OSS from 'ali-oss';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * OSS配置接口
 */
export interface OSSConfig {
  /** OSS区域 */
  region: string;
  /** AccessKey ID */
  accessKeyId: string;
  /** AccessKey Secret */
  accessKeySecret: string;
  /** Bucket名称 */
  bucket: string;
  /** 备份文件前缀 */
  backupPrefix: string;
}

/**
 * 备份类型
 */
export type BackupType = 'manual' | 'auto' | 'full' | 'incremental';

/**
 * 保留类型
 */
export type RetentionType = 'daily' | 'weekly' | 'monthly' | 'permanent';

// ============================================================================
// OSS配置类
// ============================================================================

class OSSConfigManager {
  private config: OSSConfig;
  private client: OSS | null = null;
  private isConfigured: boolean;

  constructor() {
    // 从环境变量加载配置
    this.config = {
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || '',
      backupPrefix: process.env.OSS_BACKUP_PREFIX || 'backups',
    };

    // 验证必要配置（在开发环境中可以是可选的）
    this.isConfigured = !!(this.config.accessKeyId && this.config.accessKeySecret && this.config.bucket);
    
    if (process.env.NODE_ENV !== 'production' && !this.isConfigured) {
      console.warn('OSS配置不完整，备份功能将被禁用');
    } else if (process.env.NODE_ENV === 'production' && !this.isConfigured) {
      this.validateConfig();
    }
  }

  /**
   * 验证配置是否完整
   */
  private validateConfig(): void {
    if (!this.isConfigured) {
      throw new Error('OSS配置不完整，请检查环境变量');
    }
  }

  /**
   * 获取OSS客户端（单例模式）
   */
  public getClient(): OSS | null {
    if (!this.isConfigured) {
      return null;
    }
    
    if (!this.client) {
      this.client = new OSS({
        region: this.config.region,
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
        bucket: this.config.bucket,
        secure: true, // 使用HTTPS
      });
    }
    return this.client;
  }

  /**
   * 检查是否已配置
   */
  public isOSSConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * 获取配置
   */
  public getConfig(): OSSConfig {
    return { ...this.config };
  }

  /**
   * 生成备份文件的OSS Key
   */
  public generateBackupKey(userId: number, backupId: string, type: BackupType): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${this.config.backupPrefix}/${userId}/${type}/${year}/${month}/${backupId}.json`;
  }

  /**
   * 生成增量备份的OSS Key
   */
  public generateIncrementalKey(userId: number, baseBackupId: string): string {
    return `${this.config.backupPrefix}/${userId}/incremental/${baseBackupId}`;
  }

  /**
   * 根据保留类型计算过期时间
   */
  public calculateRetentionUntil(retentionType: RetentionType): Date | null {
    const now = new Date();

    switch (retentionType) {
      case 'daily':
        // 保留7天
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      case 'weekly':
        // 保留4周
        return new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

      case 'monthly':
        // 永久保留
        return null;

      case 'permanent':
        // 永久保留
        return null;

      default:
        return null;
    }
  }

  /**
   * 判断备份类型对应的保留类型
   */
  public determineRetentionType(type: BackupType): RetentionType {
    // 手动备份永久保留
    if (type === 'manual') {
      return 'permanent';
    }

    // 自动备份根据日期判断
    const now = new Date();
    const dayOfWeek = now.getDay();

    // 每周日生成周备份
    if (dayOfWeek === 0) {
      return 'weekly';
    }

    // 每月1号生成月备份
    if (now.getDate() === 1) {
      return 'monthly';
    }

    // 其他情况为日备份
    return 'daily';
  }

  /**
   * 重置客户端（用于测试或重新初始化）
   */
  public resetClient(): void {
    this.client = null;
  }
}

// 导出单例
export const ossConfig = new OSSConfigManager();
export default ossConfig;
