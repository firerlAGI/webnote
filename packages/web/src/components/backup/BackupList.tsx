/**
 * 备份列表页面组件
 * 显示所有备份记录、手动触发备份、恢复功能
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Modal } from '../ui';
import { backupAPI, BackupInfo, BackupProgress, RestoreOptions } from '../../api/backup';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化完整日期时间
 */
function formatFullDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// 备份列表组件
// ============================================================================

interface BackupListProps {
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

const BackupList: React.FC<BackupListProps> = ({
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
  const [operationProgress, setOperationProgress] = useState<{
    type: 'backup' | 'restore' | null;
    progress: BackupProgress | null;
  }>({ type: null, progress: null });
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupInfo | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    overwriteConflicts: false,
    restoreDeleted: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ========================================================================
  // 生命周期
  // ========================================================================

  useEffect(() => {
    loadBackups();
  }, []);

  // ========================================================================
  // 备份加载
  // ========================================================================

  const loadBackups = async () => {
    try {
      setLoading(true);
      const loadedBackups = await backupAPI.getBackupList();
      setBackups(loadedBackups.slice(0, maxBackups));
    } catch (err) {
      console.error('Failed to load backups:', err);
      setError('加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // 备份操作
  // ========================================================================

  const createBackup = async (type: 'manual' | 'auto' = 'manual') => {
    try {
      setError(null);
      setSuccess(null);

      // 模拟进度
      setOperationProgress({
        type: 'backup',
        progress: {
          inProgress: true,
          progress: 10,
          currentStep: '准备中',
          totalSteps: 5,
          processedItems: 0,
          totalItems: 0,
        },
      });

      // 更新进度
      setTimeout(() => {
        setOperationProgress({
          type: 'backup',
          progress: {
            inProgress: true,
            progress: 30,
            currentStep: '导出数据',
            totalSteps: 5,
            processedItems: 0,
            totalItems: 0,
          },
        });
      }, 500);

      // 创建备份
      const backup = await backupAPI.createBackup(type);

      setOperationProgress({
        type: 'backup',
        progress: {
          inProgress: true,
          progress: 80,
          currentStep: '保存备份',
          totalSteps: 5,
          processedItems: backup.itemCount || 0,
          totalItems: backup.itemCount || 0,
        },
      });

      setTimeout(() => {
        setOperationProgress({
          type: 'backup',
          progress: {
            inProgress: true,
            progress: 100,
            currentStep: '完成',
            totalSteps: 5,
            processedItems: backup.itemCount || 0,
            totalItems: backup.itemCount || 0,
          },
        });

        setTimeout(() => {
          setOperationProgress({ type: null, progress: null });
          setBackups([backup, ...backups]);
          setSuccess('备份创建成功');
          onBackupComplete?.(backup);

          setTimeout(() => setSuccess(null), 3000);
        }, 500);
      }, 500);
    } catch (err) {
      console.error('Backup failed:', err);
      const errorMessage = err instanceof Error ? err.message : '备份失败';
      setError(errorMessage);
      setOperationProgress({ type: null, progress: null });
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

      setOperationProgress({
        type: 'restore',
        progress: {
          inProgress: true,
          progress: 10,
          currentStep: '准备恢复',
          totalSteps: 4,
          processedItems: 0,
          totalItems: 0,
        },
      });

      await backupAPI.restoreBackup(selectedBackup.id, restoreOptions);

      setOperationProgress({
        type: 'restore',
        progress: {
          inProgress: true,
          progress: 100,
          currentStep: '恢复完成',
          totalSteps: 4,
          processedItems: selectedBackup.itemCount || 0,
          totalItems: selectedBackup.itemCount || 0,
        },
      });

      setTimeout(() => {
        setOperationProgress({ type: null, progress: null });
        setSuccess('数据恢复成功');
        onRestoreComplete?.();

        setTimeout(() => setSuccess(null), 3000);
      }, 500);
    } catch (err) {
      console.error('Restore failed:', err);
      const errorMessage = err instanceof Error ? err.message : '恢复失败';
      setError(errorMessage);
      setOperationProgress({ type: null, progress: null });
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

      await backupAPI.deleteBackup(backupToDelete.id);

      const updatedBackups = backups.filter((b) => b.id !== backupToDelete.id);
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
  // 下载备份
  // ========================================================================

  const downloadBackup = async (backup: BackupInfo) => {
    try {
      const blob = await backupAPI.downloadBackup(backup.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${backup.id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('备份下载成功');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Download backup failed:', err);
      const errorMessage = err instanceof Error ? err.message : '下载备份失败';
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
        {operationProgress.progress && (
          <Card shadow="sm" padding="md" className="bg-blue-50 border-blue-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {operationProgress.type === 'backup' ? '正在备份' : '正在恢复'}
                </span>
                <span className="text-sm text-blue-700">
                  {operationProgress.progress.progress}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${operationProgress.progress.progress}%`,
                  }}
                />
              </div>
              <div className="text-xs text-blue-700">
                {operationProgress.progress.currentStep}
                {operationProgress.progress.totalItems > 0 && (
                  <span className="ml-2">
                    ({operationProgress.progress.processedItems} /{' '}
                    {operationProgress.progress.totalItems})
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
            disabled={!!operationProgress.progress}
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
            disabled={loading || !!operationProgress.progress}
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
                    onClick={() => downloadBackup(backup)}
                    disabled={!!operationProgress.progress}
                    title="下载备份"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </Button>
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowRestoreModal(true);
                    }}
                    disabled={!!operationProgress.progress}
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
                    disabled={!!operationProgress.progress}
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
                <p>时间: {formatFullDate(new Date(selectedBackup.timestamp))}</p>
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
                <p>时间: {formatFullDate(new Date(backupToDelete.timestamp))}</p>
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

export default BackupList;
