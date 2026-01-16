/**
 * 备份服务
 * 处理用户数据的备份和恢复操作，集成阿里云OSS存储
 */

import { prisma } from '../../server';
import { existsSync, mkdirSync, unlinkSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { ossConfig, type BackupType, type RetentionType } from '../../config/oss';
import OSS from 'ali-oss';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

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
  type: BackupType;
  /** 备份状态 */
  status: 'completed' | 'pending' | 'failed';
  /** 备份描述 */
  description?: string;
  /** 备份项数量 */
  itemCount?: number;
  /** 文件路径 */
  filePath?: string;
  /** OSS Key */
  ossKey?: string;
  /** 保留类型 */
  retentionType?: RetentionType;
  /** 保留到期时间 */
  retentionUntil?: Date;
  /** 加密方式 */
  encryption: string;
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
 * 备份数据结构
 */
interface BackupData {
  version: string;
  timestamp: number;
  userId: number;
  notes: any[];
  folders: any[];
  reviews: any[];
  metadata: {
    noteCount: number;
    folderCount: number;
    reviewCount: number;
    appVersion: string;
  };
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

// ============================================================================
// 备份服务类
// ============================================================================

class BackupService {
  private backupsDir: string;
  private ossClient: OSS;
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly ENCRYPTION_KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;

  constructor() {
    // 设置备份目录
    this.backupsDir = join(__dirname, '..', '..', 'backups');
    this.ensureBackupsDirectory();
    // 初始化OSS客户端
    this.ossClient = ossConfig.getClient();
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupsDirectory(): void {
    if (!existsSync(this.backupsDir)) {
      mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  /**
   * 生成备份ID
   */
  private generateBackupId(userId: number): string {
    return `backup_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取用户备份目录
   */
  private getUserBackupDir(userId: number): string {
    const userBackupDir = join(this.backupsDir, userId.toString());
    if (!existsSync(userBackupDir)) {
      mkdirSync(userBackupDir, { recursive: true });
    }
    return userBackupDir;
  }

  /**
   * 获取备份文件路径
   */
  private getBackupFilePath(userId: number, backupId: string): string {
    return join(this.getUserBackupDir(userId), `${backupId}.json`);
  }

  /**
   * 获取备份文件大小
   */
  private getFileSize(filePath: string): number {
    try {
      return statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * 生成加密密钥
   */
  private generateEncryptionKey(): Buffer {
    return randomBytes(this.ENCRYPTION_KEY_LENGTH);
  }

  /**
   * 加密数据
   */
  private encryptData(data: string, key: Buffer): string {
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 组合 IV + AuthTag + Encrypted Data
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  }

  /**
   * 解密数据
   */
  private decryptData(encryptedData: string, key: Buffer): string {
    const ivHex = encryptedData.slice(0, this.IV_LENGTH * 2);
    const authTagHex = encryptedData.slice(
      this.IV_LENGTH * 2,
      (this.IV_LENGTH + this.AUTH_TAG_LENGTH) * 2
    );
    const encryptedHex = encryptedData.slice((this.IV_LENGTH + this.AUTH_TAG_LENGTH) * 2);

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 上传备份到OSS
   */
  private async uploadToOSS(
    ossKey: string,
    data: Buffer,
    encryption: string = 'AES256'
  ): Promise<{ etag: string; versionId?: string }> {
    try {
      const result = await this.ossClient.put(ossKey, data, {
        headers: {
          'x-oss-server-side-encryption': encryption,
          'Content-Type': 'application/json',
        },
      });

      return {
        etag: result.etag,
        versionId: result.versionId,
      };
    } catch (error) {
      console.error('Upload to OSS failed:', error);
      throw new Error('上传到OSS失败');
    }
  }

  /**
   * 从OSS下载备份
   */
  private async downloadFromOSS(ossKey: string): Promise<Buffer> {
    try {
      const result = await this.ossClient.get(ossKey);
      return result.content;
    } catch (error) {
      console.error('Download from OSS failed:', error);
      throw new Error('从OSS下载失败');
    }
  }

  /**
   * 从OSS删除备份
   */
  private async deleteFromOSS(ossKey: string, versionId?: string): Promise<void> {
    try {
      await this.ossClient.delete(ossKey, {
        versionId,
      });
    } catch (error) {
      console.error('Delete from OSS failed:', error);
      throw new Error('从OSS删除失败');
    }
  }

  /**
   * 清理过期的备份
   */
  async cleanupExpiredBackups(): Promise<number> {
    try {
      const expiredBackups = await prisma.backup.findMany({
        where: {
          retention_until: {
            lte: new Date(),
          },
        },
      });

      let deletedCount = 0;

      for (const backup of expiredBackups) {
        try {
          // 从OSS删除
          await this.deleteFromOSS(backup.oss_key, backup.oss_version_id || undefined);
          // 从数据库删除记录
          await prisma.backup.delete({
            where: { id: backup.id },
          });
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete backup ${backup.backup_id}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Cleanup expired backups failed:', error);
      return 0;
    }
  }

  /**
   * 创建备份
   */
  async createBackup(
    userId: number,
    type: BackupType = 'manual',
    onProgress?: (progress: BackupProgress) => void
  ): Promise<BackupInfo> {
    try {
      const totalSteps = 8;
      const backupId = this.generateBackupId(userId);
      const timestamp = Date.now();

      // 步骤1: 获取用户数据
      onProgress?.({
        inProgress: true,
        progress: 10,
        currentStep: '获取用户数据',
        totalSteps,
        processedItems: 0,
        totalItems: 0,
      });

      const [notes, folders, reviews] = await Promise.all([
        prisma.note.findMany({ where: { user_id: userId } }),
        prisma.folder.findMany({ where: { user_id: userId } }),
        prisma.review.findMany({ where: { user_id: userId } }),
      ]);

      const totalItems = notes.length + folders.length + reviews.length;

      // 步骤2: 构建备份数据
      onProgress?.({
        inProgress: true,
        progress: 20,
        currentStep: '构建备份数据',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const backupData: BackupData = {
        version: '1.0.0',
        timestamp,
        userId,
        notes,
        folders,
        reviews,
        metadata: {
          noteCount: notes.length,
          folderCount: folders.length,
          reviewCount: reviews.length,
          appVersion: '1.0.0',
        },
      };

      // 步骤3: 序列化数据
      onProgress?.({
        inProgress: true,
        progress: 30,
        currentStep: '序列化数据',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const jsonData = JSON.stringify(backupData, null, 2);
      const encryptionKey = this.generateEncryptionKey();

      // 步骤4: 加密数据
      onProgress?.({
        inProgress: true,
        progress: 40,
        currentStep: '加密数据',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const encryptedData = this.encryptData(jsonData, encryptionKey);
      const dataBuffer = Buffer.from(encryptedData, 'utf8');

      // 步骤5: 保存到本地（临时）
      onProgress?.({
        inProgress: true,
        progress: 50,
        currentStep: '保存本地副本',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const filePath = this.getBackupFilePath(userId, backupId);
      const writeFile = promisify(require('fs').writeFile);
      await writeFile(filePath, encryptedData, 'utf8');

      // 步骤6: 上传到OSS
      onProgress?.({
        inProgress: true,
        progress: 60,
        currentStep: '上传到OSS',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const ossKey = ossConfig.generateBackupKey(userId, backupId, type);
      const uploadResult = await this.uploadToOSS(ossKey, dataBuffer, 'AES256');

      // 步骤7: 保存备份记录到数据库
      onProgress?.({
        inProgress: true,
        progress: 80,
        currentStep: '保存备份记录',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      const retentionType = ossConfig.determineRetentionType(type);
      const retentionUntil = ossConfig.calculateRetentionUntil(retentionType);

      const size = BigInt(dataBuffer.length);

      await prisma.backup.create({
        data: {
          user_id: userId,
          backup_id: backupId,
          oss_key: ossKey,
          oss_version_id: uploadResult.versionId,
          size,
          type,
          status: 'completed',
          encryption: 'AES256',
          retention_type: retentionType,
          retention_until: retentionUntil,
          item_count: totalItems,
          metadata: JSON.stringify({
            noteCount: notes.length,
            folderCount: folders.length,
            reviewCount: reviews.length
          }),
        },
      });

      // 步骤8: 完成
      onProgress?.({
        inProgress: true,
        progress: 100,
        currentStep: '完成',
        totalSteps,
        processedItems: totalItems,
        totalItems,
      });

      const backupInfo: BackupInfo = {
        id: backupId,
        userId,
        name: `备份 ${new Date(timestamp).toLocaleString('zh-CN')}`,
        timestamp,
        size: dataBuffer.length,
        type,
        status: 'completed',
        itemCount: totalItems,
        description: type === 'manual' ? '手动备份' : '自动备份',
        filePath,
        ossKey,
        retentionType,
        retentionUntil: retentionUntil || undefined,
        encryption: 'AES256',
      };

      return backupInfo;
    } catch (error) {
      console.error('Create backup failed:', error);
      throw new Error('创建备份失败');
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(userId: number): Promise<BackupInfo[]> {
    try {
      const backups = await prisma.backup.findMany({
        where: {
          user_id: userId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return backups.map(backup => ({
        id: backup.backup_id,
        userId: backup.user_id,
        name: `备份 ${backup.created_at.toLocaleString('zh-CN')}`,
        timestamp: backup.created_at.getTime(),
        size: Number(backup.size),
        type: backup.type as BackupType,
        status: backup.status as 'completed' | 'pending' | 'failed',
        itemCount: backup.item_count,
        description: `${backup.type} - ${backup.retention_type}`,
        ossKey: backup.oss_key,
        retentionType: backup.retention_type as RetentionType,
        retentionUntil: backup.retention_until || undefined,
        encryption: backup.encryption,
      }));
    } catch (error) {
      console.error('Get backup list failed:', error);
      return [];
    }
  }

  /**
   * 获取备份详情
   */
  async getBackupDetail(userId: number, backupId: string): Promise<BackupData | null> {
    try {
      // 从数据库获取备份信息
      const backup = await prisma.backup.findUnique({
        where: {
          backup_id: backupId,
        },
      });

      if (!backup || backup.user_id !== userId) {
        return null;
      }

      // 从OSS下载
      const dataBuffer = await this.downloadFromOSS(backup.oss_key);
      const encryptedData = dataBuffer.toString('utf8');

      // 解密数据（注意：实际应用中需要安全地存储和获取加密密钥）
      // 这里简化处理，实际应用中应该使用密钥管理服务
      const encryptionKey = this.generateEncryptionKey();
      const jsonData = this.decryptData(encryptedData, encryptionKey);

      return JSON.parse(jsonData);
    } catch (error) {
      console.error('Get backup detail failed:', error);
      return null;
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(
    userId: number,
    backupId: string,
    options: RestoreOptions,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<void> {
    try {
      const totalSteps = 5;

      // 步骤1: 加载备份数据
      onProgress?.({
        inProgress: true,
        progress: 20,
        currentStep: '加载备份数据',
        totalSteps,
        processedItems: 0,
        totalItems: 0,
      });

      const backupData = await this.getBackupDetail(userId, backupId);
      if (!backupData) {
        throw new Error('备份数据不存在');
      }

      const totalItems = backupData.notes.length +
        backupData.folders.length +
        backupData.reviews.length;

      // 步骤2: 删除现有数据（如果需要）
      if (options.overwriteConflicts) {
        onProgress?.({
          inProgress: true,
          progress: 30,
          currentStep: '清理现有数据',
          totalSteps,
          processedItems: 0,
          totalItems,
        });

        // 删除现有的笔记
        await prisma.note.deleteMany({ where: { user_id: userId } });
        // 删除现有的文件夹
        await prisma.folder.deleteMany({ where: { user_id: userId } });
        // 删除现有的评论
        await prisma.review.deleteMany({ where: { user_id: userId } });
      }

      // 步骤3: 恢复文件夹
      onProgress?.({
        inProgress: true,
        progress: 40,
        currentStep: '恢复文件夹',
        totalSteps,
        processedItems: 0,
        totalItems,
      });

      let processedCount = 0;
      const folderIdMap = new Map<number, number>(); // 旧ID到新ID的映射

      for (const folder of backupData.folders) {
        // 移除原始ID，让数据库自动生成
        const { id, ...folderData } = folder;
        const newFolder = await prisma.folder.create({
          data: {
            ...folderData,
            user_id: userId,
          },
        });
        folderIdMap.set(id, newFolder.id);
        processedCount++;

        onProgress?.({
          inProgress: true,
          progress: 40 + (processedCount / totalItems) * 40,
          currentStep: '恢复数据中',
          totalSteps,
          processedItems: processedCount,
          totalItems,
        });
      }

      // 步骤4: 恢复笔记
      for (const note of backupData.notes) {
        // 移除原始ID和关联对象，让数据库自动生成
        const { id, folder, ...noteData } = note;

        // 转换 folder_id
        const newFolderId = note.folder_id ? folderIdMap.get(note.folder_id) : null;

        await prisma.note.create({
          data: {
            ...noteData,
            user_id: userId,
            folder_id: newFolderId,
          },
        });
        processedCount++;

        onProgress?.({
          inProgress: true,
          progress: 40 + (processedCount / totalItems) * 40,
          currentStep: '恢复数据中',
          totalSteps,
          processedItems: processedCount,
          totalItems,
        });
      }

      // 步骤5: 恢复评论
      for (const review of backupData.reviews) {
        const { id, user, ...reviewData } = review;
        await prisma.review.create({
          data: {
            ...reviewData,
            user_id: userId,
          },
        });
        processedCount++;

        onProgress?.({
          inProgress: true,
          progress: 40 + (processedCount / totalItems) * 40,
          currentStep: '恢复数据中',
          totalSteps,
          processedItems: processedCount,
          totalItems,
        });
      }

      // 完成
      onProgress?.({
        inProgress: true,
        progress: 100,
        currentStep: '恢复完成',
        totalSteps,
        processedItems: totalItems,
        totalItems,
      });
    } catch (error) {
      console.error('Restore backup failed:', error);
      throw new Error('恢复备份失败');
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(userId: number, backupId: string): Promise<boolean> {
    try {
      // 从数据库获取备份信息
      const backup = await prisma.backup.findUnique({
        where: {
          backup_id: backupId,
        },
      });

      if (!backup || backup.user_id !== userId) {
        return false;
      }

      // 从OSS删除
      await this.deleteFromOSS(backup.oss_key, backup.oss_version_id || undefined);

      // 删除本地文件（如果存在）
      const filePath = this.getBackupFilePath(userId, backupId);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      // 从数据库删除记录
      await prisma.backup.delete({
        where: { id: backup.id },
      });

      return true;
    } catch (error) {
      console.error('Delete backup failed:', error);
      return false;
    }
  }

  /**
   * 下载备份
   */
  async downloadBackup(userId: number, backupId: string): Promise<Buffer | null> {
    try {
      // 从数据库获取备份信息
      const backup = await prisma.backup.findUnique({
        where: {
          backup_id: backupId,
        },
      });

      if (!backup || backup.user_id !== userId) {
        return null;
      }

      // 从OSS下载
      const dataBuffer = await this.downloadFromOSS(backup.oss_key);
      return dataBuffer;
    } catch (error) {
      console.error('Download backup failed:', error);
      return null;
    }
  }
}

// 导出单例
export const backupService = new BackupService();
export default backupService;
