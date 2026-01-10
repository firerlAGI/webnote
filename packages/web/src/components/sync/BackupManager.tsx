/**
 * 备份管理组件
 * 提供备份列表展示、手动触发备份、恢复功能和备份状态展示
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Modal } from '../ui';
import { HybridCache } from '../../cache/HybridCache';
import { SyncManager } from '../../cache/SyncManager';
import { formatBytes, formatDate } from '../../utils/dateUtils';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份ID */
  id: string;
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
  /** 是否恢复同步队列 */
  restoreSyncQueue: boolean;
}

// ============================================================================
// 备份管理组件
// ============================================================================

export interface BackupManagerProps {
  /** 缓存实例 */
  cache?: HybridCache;
  /** 同步管理器实例 */
  syncManager?: SyncManager;
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 备份列表的最大显示数量 */
  maxBackups?: number;
  /** 备份完成回调 */
  onBackupComplete?: (backup: BackupInfo) => void;
  /** 恢复完成回调 */
  onRestoreComplete?: () => void;
  /** 备份失败回调 */
  onBackupError?: (error: Error) => void;
  /** 恢复失败回调 */
  onRestoreError?: (error: Error) => void;
  /** 自定义类名 */
  className?: string;
}

const BackupManager: React.FC<BackupManagerProps> = ({
  cache,
  syncManager,
  showTitle = true,
  maxBackups = 10,
  onBackupComplete,
  onRestoreComplete,
  onBackupError,
  onRestoreError,
  className = '',
}) => {
  // ========================================================================
  // 状态管理
  // ========================================================================

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<BackupProgress | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupInfo | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    overwriteConflicts: false,
    restoreDeleted: true,
    restoreSyncQueue: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ========================================================================
  // 生命周期
  // ========================================================================

  useEffect(() => {
    loadBackups();
    // 每分钟刷新一次备份列表
    const interval = setInterval(loadBackups, 60000);
    return () => clearInterval(interval);
  }, []);

  // ========================================================================
  // 备份加载
  // ========================================================================

  const loadBackups = async () => {
    try {
      setLoading(true);
      const loadedBackups = await getBackupList();
      setBackups(loadedBackups.slice(0, maxBackups));
    } catch (err) {
      console.error('Failed to load backups:', err);
      setError('加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getBackupList = async (): Promise<BackupInfo[]> => {
    // 从IndexedDB加载备份元数据
    if (!cache) return [];

    try {
      const metadata = await cache.get<{ backups: BackupInfo[] }>('metadata:backups');
      return metadata?.data?.backups || [];
    } catch {
      return [];
    }
  };

  // ========================================================================
  // 备份操作
  // ========================================================================

  const createBackup = async (type: 'manual' | 'auto' = 'manual') => {
    try {
      setError(null);
      setSuccess(null);
      setBackupProgress({
        inProgress: true,
        progress: 0,
        currentStep: '准备中',
        totalSteps: 5,
        processedItems: 0,
        totalItems: 0,
      });

      if (!cache) {
        throw new Error('缓存实例未初始化');
      }

      // 步骤1: 导出缓存数据
      setBackupProgress((prev) => ({
        ...prev!,
        progress: 10,
        currentStep: '导出缓存数据',
      }));

      const cacheData = await cache.export();

      // 统计项目数量
      const totalItems = Object.keys(cacheData).length;
      setBackupProgress((prev) => ({
        ...prev!,
        totalItems,
        progress: 20,
        currentStep: `导出 ${totalItems} 个项目`,
      }));

      // 步骤2: 获取同步状态
      setBackupProgress((prev) => ({
        ...prev!,
        progress: 40,
        currentStep: '获取同步状态',
      }));

      let syncStatus = null;
      if (syncManager) {
        syncStatus = await syncManager.getSyncStatus();
      }

      // 步骤3: 构建备份数据
      setBackupProgress((prev) => ({
        ...prev!,
        progress: 60,
        currentStep: '构建备份数据',
      }));

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        cacheData,
        syncStatus,
        metadata: {
          itemCount: totalItems,
          appVersion: '1.0.0',
        },
      };

      // 步骤4: 计算大小
      setBackupProgress((prev) => ({
        ...prev!,
        progress: 80,
        currentStep: '计算备份大小',
      }));

      const size = new Blob([JSON.stringify(backupData)]).size;

      // 步骤5: 保存备份
      setBackupProgress((prev) => ({
        ...prev!,
        progress: 90,
        currentStep: '保存备份',
      }));

      const backup: BackupInfo = {
        id: `backup_${Date.now()}`,
        name: `备份 ${formatDate(new Date())}`,
        timestamp: Date.now(),
        size,
        type,
        status: 'completed',
        itemCount: totalItems,
        description: type === 'manual' ? '手动备份' : '自动备份',
      };

      // 保存备份数据
      await cache.set(`backup:${backup.id}`, backupData, {
        persist: true,
        ttl: 30 * 24 * 60 * 60 * 1000, // 30天
      });

      // 更新备份列表
      const updatedBackups = [backup, ...backups];
      await cache.set('metadata:backups', { backups: updatedBackups }, {
        persist: true,
      });

      setBackups(updatedBackups);
      setBackupProgress(null);

      setSuccess('备份创建成功');
      onBackupComplete?.(backup);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Backup failed:', err);
      const errorMessage = err instanceof Error ? err.message : '备份失败';
      setError(errorMessage);
      setBackupProgress(null);
      onBackupError?.(err as Error);
    }
  };

  // ========================================================================
  // 恢复操作
  // ========================================================================

  const restoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      setError(null);
      setSuccess(null);
      setShowRestoreModal(false);
      setRestoreProgress({
        inProgress: true,
        progress: 0,
        currentStep: '准备恢复',
        totalSteps: 4,
        processedItems: 0,
        totalItems: 0,
      });

      if (!cache) {
        throw new Error('缓存实例未初始化');
      }

      // 步骤1: 加载备份数据
      setRestoreProgress((prev) => ({
        ...prev!,
        progress: 20,
        currentStep: '加载备份数据',
      }));

      const backupData = await cache.get(`backup:${selectedBackup.id}`);
      if (!backupData) {
        throw new Error('备份数据不存在');
      }

      const data = backupData.data as any;
      const totalItems = Object.keys(data.cacheData).length;

      setRestoreProgress((prev) => ({
        ...prev!,
        totalItems,
        progress: 40,
        currentStep: `准备恢复 ${totalItems} 个项目`,
      }));

      // 步骤2: 恢复缓存数据
      setRestoreProgress((prev) => ({
        ...prev!,
        progress: 50,
        currentStep: '恢复缓存数据',
      }));

      let processedCount = 0;
      for (const [key, value] of Object.entries(data.cacheData)) {
        await cache.set(key, (value as any).data, {
          persist: true,
        });
        processedCount++;

        setRestoreProgress((prev) => ({
          ...prev!,
          processedItems: processedCount,
          progress: 50 + (processedCount / totalItems) * 30,
        }));
      }

      // 步骤3: 恢复同步状态
      if (restoreOptions.restoreSyncQueue && data.syncStatus) {
        setRestoreProgress((prev) => ({
          ...prev!,
          progress: 85,
          currentStep: '恢复同步状态',
        }));

        await cache.set('sync:status', data.syncStatus, {
          persist: true,
        });
      }

      // 步骤4: 完成
      setRestoreProgress((prev) => ({
        ...prev!,
        progress: 100,
        currentStep: '恢复完成',
      }));

      setRestoreProgress(null);
      setSuccess('数据恢复成功');
      onRestoreComplete?.();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Restore failed:', err);
      const errorMessage = err instanceof Error ? err.message : '恢复失败';
      setError(errorMessage);
      setRestoreProgress(null);
      onRestoreError?.(err as Error);
    }
  };

  // ========================================================================
  // 删除备份
  // ========================================================================

  const deleteBackup = async () => {
    if (!backupToDelete) return;

    try {
      setError(null);

      if (!cache) {
        throw new Error('缓存实例未初始化');
      }

      // 删除备份数据
      await cache.delete(`backup:${backupToDelete.id}`);

      // 更新备份列表
      const updatedBackups = backups.filter((b) => b.id !== backupToDelete.id);
      await cache.set('metadata:backups', { backups: updatedBackups }, {
        persist: true,
      });

      setBackups(updatedBackups);
      setSuccess('备份删除成功');
      setShowDeleteModal(false);
      setBackupToDelete(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Delete backup failed:', err);
      const errorMessage = err instanceof Error ? err.message : '删除备份失败';
      setError(errorMessage);
    }
  };

  // ========================================================================
  // 辅助方法
  // ========================================================================

  const getBackupTypeLabel = (type: BackupInfo['type']) => {
    const labels = {
      manual: '手动',
      auto: '自动',
      full: '完整',
      incremental: '增量',
    };
    return labels[type];
  };

  const getStatusBadge = (status: BackupInfo['status']) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels = {
      completed: '已完成',
      pending: '进行中',
      failed: '失败',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // ========================================================================
  // 渲染
  // ========================================================================

  return (
    <Card className={className}>
      {showTitle && (
        <Card.Header title="数据备份" subtitle="管理和恢复您的数据备份" />
      )}

      <Card.Body className="space-y-4">
        {/* 错误提示 */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 成功提示 */}
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* 备份进度 */}
        {(backupProgress || restoreProgress) && (
          <Card shadow="sm" padding="md" className="bg-blue-50 border-blue-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {backupProgress ? '正在备份' : '正在恢复'}
                </span>
                <span className="text-sm text-blue-700">
                  {backupProgress?.progress || restoreProgress?.progress || 0}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${backupProgress?.progress || restoreProgress?.progress || 0}%`,
                  }}
                />
              </div>
              <div className="text-xs text-blue-700">
                {backupProgress?.currentStep || restoreProgress?.currentStep}
                {(backupProgress?.totalItems || restoreProgress?.totalItems) > 0 && (
                  <span className="ml-2">
                    ({backupProgress?.processedItems || restoreProgress?.processedItems} /{' '}
                    {backupProgress?.totalItems || restoreProgress?.totalItems})
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => createBackup('manual')}
            disabled={!!backupProgress || !!restoreProgress}
            loading={!!backupProgress}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            创建备份
          </Button>
          <Button
            variant="outline"
            onClick={loadBackups}
            disabled={loading || !!backupProgress || !!restoreProgress}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新列表
          </Button>
        </div>

        {/* 备份列表 */}
        {loading && backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p>暂无备份</p>
            <p className="text-sm mt-1">点击上方按钮创建第一个备份</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <Card
                key={backup.id}
                shadow="sm"
                padding="sm"
                className="flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {backup.name}
                    </span>
                    {getStatusBadge(backup.status)}
                    <span className="text-xs text-gray-500">
                      {getBackupTypeLabel(backup.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>
                      <svg
                        className="w-4 h-4 inline mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {formatDate(new Date(backup.timestamp))}
                    </span>
                    <span>
                      <svg
                        className="w-4 h-4 inline mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                        />
                      </svg>
                      {formatBytes(backup.size)}
                    </span>
                    {backup.itemCount && (
                      <span>
                        <svg
                          className="w-4 h-4 inline mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                        {backup.itemCount} 项
                      </span>
                    )}
                  </div>
                  {backup.description && (
                    <p className="text-sm text-gray-500 mt-1">{backup.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowRestoreModal(true);
                    }}
                    disabled={!!backupProgress || !!restoreProgress}
                  >
                    恢复
                  </Button>
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => {
                      setBackupToDelete(backup);
                      setShowDeleteModal(true);
                    }}
                    disabled={!!backupProgress || !!restoreProgress}
                  >
                    删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card.Body>

      {/* 恢复确认模态框 */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="确认恢复"
      >
        <div className="space-y-4">
          <Alert variant="warning">
            恢复操作将覆盖当前数据,请谨慎操作
          </Alert>

          {selectedBackup && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">{selectedBackup.name}</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>时间: {formatDate(new Date(selectedBackup.timestamp))}</p>
                <p>大小: {formatBytes(selectedBackup.size)}</p>
                {selectedBackup.itemCount && <p>项目: {selectedBackup.itemCount} 项</p>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={restoreOptions.overwriteConflicts}
                onChange={(e) =>
                  setRestoreOptions({ ...restoreOptions, overwriteConflicts: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">覆盖冲突数据</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={restoreOptions.restoreDeleted}
                onChange={(e) =>
                  setRestoreOptions({ ...restoreOptions, restoreDeleted: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">恢复已删除的数据</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={restoreOptions.restoreSyncQueue}
                onChange={(e) =>
                  setRestoreOptions({ ...restoreOptions, restoreSyncQueue: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">恢复同步队列</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={restoreBackup}>
              确认恢复
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setBackupToDelete(null);
        }}
        title="确认删除"
      >
        <div className="space-y-4">
          <Alert variant="danger">删除后无法恢复,确定要继续吗?</Alert>

          {backupToDelete && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">{backupToDelete.name}</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>时间: {formatDate(new Date(backupToDelete.timestamp))}</p>
                <p>大小: {formatBytes(backupToDelete.size)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={deleteBackup}>
              确认删除
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default BackupManager;
