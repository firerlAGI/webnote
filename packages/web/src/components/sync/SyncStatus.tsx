/**
 * 同步状态展示组件
 * 显示当前同步状态、离线状态提示、同步进度和统计信息
 */

import React, { useState, useEffect } from 'react';
import { Card, Alert, Button } from '../ui';
import { SyncManager, SyncEventType, SyncEvent } from '../../cache/SyncManager';
import { CacheSyncStatus } from '../../cache/types';
import { formatRelativeTime } from '../../utils/dateUtils';

// ============================================================================
// 类型定义
// ============================================================================

export interface SyncStatusProps {
  /** 同步管理器实例 */
  syncManager?: SyncManager;
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 是否显示离线提示 */
  showOfflineIndicator?: boolean;
  /** 是否显示统计信息 */
  showStats?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 状态变化回调 */
  onStatusChange?: (status: CacheSyncStatus) => void;
}

// ============================================================================
// 同步状态展示组件
// ============================================================================

const SyncStatus: React.FC<SyncStatusProps> = ({
  syncManager,
  showTitle = true,
  showDetails = true,
  showActions = true,
  showOfflineIndicator = true,
  showStats = true,
  className = '',
  onStatusChange,
}) => {
  // ========================================================================
  // 状态管理
  // ========================================================================

  const [status, setStatus] = useState<CacheSyncStatus>({
    lastSyncTime: 0,
    isSyncing: false,
    pendingItems: 0,
    failedItems: 0,
    conflictItems: 0,
    syncMode: 'realtime',
    connectionStatus: 'connected',
  });
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // ========================================================================
  // 生命周期
  // ========================================================================

  useEffect(() => {
    if (!syncManager) return;

    // 初始化状态
    loadStatus();

    // 设置事件监听
    const handleStatusChanged = (event: SyncEvent) => {
      if (event.data) {
        const newStatus = event.data as CacheSyncStatus;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    };

    const handleOfflineMode = () => {
      setShowOfflineBanner(true);
      setIsOnline(false);
      loadStatus();
    };

    const handleOnlineMode = () => {
      setShowOfflineBanner(false);
      setIsOnline(true);
      loadStatus();
    };

    syncManager.on('status_changed', handleStatusChanged);
    syncManager.on('offline_mode', handleOfflineMode);
    syncManager.on('online_mode', handleOnlineMode);

    // 定期更新状态
    const interval = setInterval(loadStatus, 5000);

    return () => {
      syncManager.off('status_changed', handleStatusChanged);
      syncManager.off('offline_mode', handleOfflineMode);
      syncManager.off('online_mode', handleOnlineMode);
      clearInterval(interval);
    };
  }, [syncManager]);

  // ========================================================================
  // 状态加载
  // ========================================================================

  const loadStatus = async () => {
    if (!syncManager) return;

    try {
      const currentStatus = await syncManager.getSyncStatus();
      setStatus(currentStatus);
      onStatusChange?.(currentStatus);
    } catch (err) {
      console.error('Failed to load sync status:', err);
    }
  };

  // ========================================================================
  // 同步操作
  // ========================================================================

  const handleManualSync = async () => {
    if (!syncManager) return;

    try {
      await syncManager.sync();
      await loadStatus();
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  };

  const handleRetryFailed = async () => {
    if (!syncManager) return;

    try {
      await syncManager.retryAllFailed();
      await loadStatus();
    } catch (err) {
      console.error('Retry failed items failed:', err);
    }
  };

  // ========================================================================
  // 辅助方法
  // ========================================================================

  const getConnectionStatus = () => {
    switch (status.connectionStatus) {
      case 'connected':
        return {
          label: '已连接',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          ),
        };
      case 'disconnected':
        return {
          label: '未连接',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          ),
        };
      case 'reconnecting':
        return {
          label: '重新连接中',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          icon: (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          ),
        };
      default:
        return {
          label: '未知',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: null,
        };
    }
  };

  const getSyncMode = () => {
    switch (status.syncMode) {
      case 'realtime':
        return {
          label: '实时同步',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          ),
        };
      case 'offline':
        return {
          label: '离线模式',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          ),
        };
      case 'polling':
        return {
          label: '定时同步',
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
      default:
        return {
          label: '未知',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: null,
        };
    }
  };

  const hasIssues = status.failedItems > 0 || status.conflictItems > 0;

  // ========================================================================
  // 渲染
  // ========================================================================

  const connectionStatus = getConnectionStatus();
  const syncMode = getSyncMode();

  return (
    <Card className={className}>
      {showTitle && (
        <Card.Header title="同步状态" subtitle="查看数据同步和连接状态" />
      )}

      <Card.Body className="space-y-4">
        {/* 离线提示横幅 */}
        {showOfflineIndicator && !isOnline && (
          <Alert variant="warning" className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium">您处于离线模式</p>
              <p className="text-sm mt-1">
                离线编辑的数据将在恢复网络连接后自动同步
              </p>
            </div>
          </Alert>
        )}

        {/* 同步中提示 */}
        {status.isSyncing && (
          <Alert variant="info" className="flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium">正在同步数据...</p>
              {status.progress && (
                <p className="text-sm mt-1">
                  进度: {status.progress.current} / {status.progress.total}
                </p>
              )}
            </div>
          </Alert>
        )}

        {/* 状态概览 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 连接状态 */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${connectionStatus.bgColor}`}>
            <div className={connectionStatus.color}>{connectionStatus.icon}</div>
            <div>
              <p className="text-sm text-gray-600">连接状态</p>
              <p className={`font-medium ${connectionStatus.color}`}>{connectionStatus.label}</p>
            </div>
          </div>

          {/* 同步模式 */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${syncMode.bgColor}`}>
            <div className={syncMode.color}>{syncMode.icon}</div>
            <div>
              <p className="text-sm text-gray-600">同步模式</p>
              <p className={`font-medium ${syncMode.color}`}>{syncMode.label}</p>
            </div>
          </div>
        </div>

        {/* 详细信息 */}
        {showDetails && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">上次同步时间</span>
              <span className="text-sm font-medium">
                {status.lastSyncTime
                  ? formatRelativeTime(new Date(status.lastSyncTime))
                  : '从未同步'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">待同步项目</span>
              <span className="text-sm font-medium">{status.pendingItems}</span>
            </div>

            {status.failedItems > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">同步失败</span>
                <span className="text-sm font-medium text-red-600">{status.failedItems}</span>
              </div>
            )}

            {status.conflictItems > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">冲突项目</span>
                <span className="text-sm font-medium text-yellow-600">{status.conflictItems}</span>
              </div>
            )}

            {/* 服务器版本 */}
            {status.serverVersion && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">服务器版本</span>
                <span className="text-sm font-medium">{status.serverVersion}</span>
              </div>
            )}
          </div>
        )}

        {/* 统计信息 */}
        {showStats && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{status.pendingItems}</div>
                <div className="text-sm text-gray-600">待同步</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${status.failedItems > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {status.failedItems}
                </div>
                <div className="text-sm text-gray-600">失败</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${status.conflictItems > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {status.conflictItems}
                </div>
                <div className="text-sm text-gray-600">冲突</div>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {showActions && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            <Button
              onClick={handleManualSync}
              disabled={status.isSyncing}
              loading={status.isSyncing}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              立即同步
            </Button>
            {status.failedItems > 0 && (
              <Button
                variant="outline"
                onClick={handleRetryFailed}
                disabled={status.isSyncing}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                重试失败
              </Button>
            )}
            <Button
              variant="outline"
              onClick={loadStatus}
              disabled={status.isSyncing}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              刷新
            </Button>
          </div>
        )}

        {/* 问题提示 */}
        {hasIssues && (
          <Alert variant="warning">
            <div className="font-medium">需要您的注意</div>
            <div className="text-sm mt-1">
              {status.failedItems > 0 && (
                <div className="mb-1">
                  有 <strong>{status.failedItems}</strong> 个项目同步失败,点击"重试失败"按钮重试
                </div>
              )}
              {status.conflictItems > 0 && (
                <div>
                  有 <strong>{status.conflictItems}</strong> 个冲突需要解决,请在冲突解决界面处理
                </div>
              )}
            </div>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default SyncStatus;
