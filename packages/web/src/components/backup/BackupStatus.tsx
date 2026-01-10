/**
 * 备份状态卡片组件
 * 显示备份摘要信息和快速操作按钮
 */

import React from 'react';
import { Card, Button } from '../ui';
import { BackupInfo } from '../../api/backup';

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

// ============================================================================
// 备份状态组件
// ============================================================================

interface BackupStatusProps {
  /** 备份信息 */
  backup: BackupInfo;
  /** 是否显示下载按钮 */
  showDownload?: boolean;
  /** 是否显示恢复按钮 */
  showRestore?: boolean;
  /** 是否显示删除按钮 */
  showDelete?: boolean;
  /** 下载回调 */
  onDownload?: (backup: BackupInfo) => void;
  /** 恢复回调 */
  onRestore?: (backup: BackupInfo) => void;
  /** 删除回调 */
  onDelete?: (backup: BackupInfo) => void;
  /** 自定义类名 */
  className?: string;
}

const BackupStatus: React.FC<BackupStatusProps> = ({
  backup,
  showDownload = true,
  showRestore = true,
  showDelete = true,
  onDownload,
  onRestore,
  onDelete,
  className = '',
}) => {
  // ========================================================================
  // 辅助方法
  // ========================================================================

  const getStatusBadge = () => {
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
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[backup.status]}`}>
        {labels[backup.status]}
      </span>
    );
  };

  const getTypeBadge = () => {
    const styles = {
      manual: 'bg-blue-100 text-blue-800',
      auto: 'bg-purple-100 text-purple-800',
      full: 'bg-indigo-100 text-indigo-800',
      incremental: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      manual: '手动',
      auto: '自动',
      full: '完整',
      incremental: '增量',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[backup.type]}`}>
        {labels[backup.type]}
      </span>
    );
  };

  // ========================================================================
  // 渲染
  // ========================================================================

  return (
    <Card shadow="sm" padding="md" className={className}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {backup.name}
            </h3>
            {getStatusBadge()}
            {getTypeBadge()}
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(new Date(backup.timestamp))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 p-2 rounded">
          <p className="text-xs text-gray-500">文件大小</p>
          <p className="text-sm font-medium text-gray-900">
            {formatBytes(backup.size)}
          </p>
        </div>
        {backup.itemCount && (
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-xs text-gray-500">项目数量</p>
            <p className="text-sm font-medium text-gray-900">
              {backup.itemCount} 项
            </p>
          </div>
        )}
      </div>

      {backup.description && (
        <p className="text-sm text-gray-600 mb-3">{backup.description}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {showDownload && (
          <Button
            size="small"
            variant="outline"
            onClick={() => onDownload?.(backup)}
            className="flex-1"
          >
            <svg
              className="w-4 h-4 mr-1"
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
            下载
          </Button>
        )}
        {showRestore && (
          <Button
            size="small"
            variant="primary"
            onClick={() => onRestore?.(backup)}
            className="flex-1"
          >
            <svg
              className="w-4 h-4 mr-1"
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
            恢复
          </Button>
        )}
        {showDelete && (
          <Button
            size="small"
            variant="danger"
            onClick={() => onDelete?.(backup)}
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
        )}
      </div>
    </Card>
  );
};

export default BackupStatus;
