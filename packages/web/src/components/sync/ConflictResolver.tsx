/**
 * 冲突解决界面组件
 * 支持用户选择冲突解决策略、冲突通知机制
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Modal } from '../ui';
import { SyncManager, ConflictResolutionStrategy } from '../../cache/SyncManager';
import { Conflict } from '../../cache/types';
import { formatDate } from '../../utils/dateUtils';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 冲突详情
 */
export interface ConflictDetail extends Conflict {
  /** 冲突类型标签 */
  typeLabel: string;
  /** 本地版本标签 */
  localLabel: string;
  /** 远程版本标签 */
  remoteLabel: string;
  /** 冲突描述 */
  description: string;
}

/**
 * 冲突解决选项
 */
export interface ResolutionOption {
  /** 策略 */
  strategy: ConflictResolutionStrategy;
  /** 标签 */
  label: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: React.ReactNode;
}

// ============================================================================
// 冲突解决组件
// ============================================================================

export interface ConflictResolverProps {
  /** 同步管理器实例 */
  syncManager?: SyncManager;
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 是否显示已解决的冲突 */
  showResolved?: boolean;
  /** 是否显示冲突详情 */
  showDetails?: boolean;
  /** 是否启用批量操作 */
  enableBatch?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 冲突解决回调 */
  onConflictResolved?: (conflictId: string, strategy: ConflictResolutionStrategy) => void;
  /** 冲突解决失败回调 */
  onResolveError?: (error: Error, conflictId: string) => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  syncManager,
  showTitle = true,
  showResolved = false,
  showDetails = true,
  enableBatch = true,
  className = '',
  onConflictResolved,
  onResolveError,
}) => {
  // ========================================================================
  // 状态管理
  // ========================================================================

  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConflict, setSelectedConflict] = useState<ConflictDetail | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResolvedConflicts, setShowResolvedConflicts] = useState(showResolved);
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(new Set());

  // ========================================================================
  // 生命周期
  // ========================================================================

  useEffect(() => {
    loadConflicts();
    // 每30秒刷新一次冲突列表
    const interval = setInterval(loadConflicts, 30000);
    return () => clearInterval(interval);
  }, [showResolvedConflicts]);

  // ========================================================================
  // 冲突加载
  // ========================================================================

  const loadConflicts = async () => {
    try {
      setLoading(true);
      if (!syncManager) {
        setConflicts([]);
        return;
      }

      const allConflicts = await syncManager.getConflicts();
      const conflictDetails = allConflicts
        .filter((c) => showResolvedConflicts || !c.resolved)
        .map((c) => enhanceConflict(c));

      setConflicts(conflictDetails);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
      setError('加载冲突列表失败');
    } finally {
      setLoading(false);
    }
  };

  const enhanceConflict = (conflict: Conflict): ConflictDetail => {
    const typeLabels = {
      note: '笔记',
      folder: '文件夹',
      review: '复盘记录',
    };

    const localLabel = `本地版本 (${formatDate(new Date(conflict.localTimestamp))})`;
    const remoteLabel = `远程版本 (${formatDate(new Date(conflict.remoteTimestamp))})`;

    let description = '';
    if (conflict.conflictFields && conflict.conflictFields.length > 0) {
      description = `冲突字段: ${conflict.conflictFields.join(', ')}`;
    } else {
      description = '检测到数据冲突,需要手动解决';
    }

    return {
      ...conflict,
      typeLabel: typeLabels[conflict.type],
      localLabel,
      remoteLabel,
      description,
    };
  };

  // ========================================================================
  // 冲突解决
  // ========================================================================

  const resolveConflict = async (
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    resolvedData?: Record<string, any>
  ) => {
    try {
      setError(null);
      setSuccess(null);
      setResolving(true);

      if (!syncManager) {
        throw new Error('同步管理器未初始化');
      }

      const result = await syncManager.resolveConflict(conflictId, strategy, resolvedData);

      if (result.success) {
        setSuccess('冲突解决成功');
        setShowResolveModal(false);
        setSelectedConflict(null);
        onConflictResolved?.(conflictId, strategy);
        await loadConflicts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(result.error || '解决冲突失败');
      }
    } catch (err) {
      console.error('Resolve conflict failed:', err);
      const errorMessage = err instanceof Error ? err.message : '解决冲突失败';
      setError(errorMessage);
      onResolveError?.(err as Error, conflictId);
    } finally {
      setResolving(false);
    }
  };

  // ========================================================================
  // 批量操作
  // ========================================================================

  const batchResolve = async (strategy: ConflictResolutionStrategy) => {
    if (selectedConflicts.size === 0) return;

    try {
      setError(null);
      setSuccess(null);
      setResolving(true);

      if (!syncManager) {
        throw new Error('同步管理器未初始化');
      }

      let successCount = 0;
      let failCount = 0;

      for (const conflictId of selectedConflicts) {
        try {
          const result = await syncManager.resolveConflict(conflictId, strategy);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setSuccess(`批量解决完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
      setSelectedConflicts(new Set());
      await loadConflicts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Batch resolve failed:', err);
      const errorMessage = err instanceof Error ? err.message : '批量解决失败';
      setError(errorMessage);
    } finally {
      setResolving(false);
    }
  };

  // ========================================================================
  // 辅助方法
  // ========================================================================

  const getResolutionOptions = (): ResolutionOption[] => [
    {
      strategy: ConflictResolutionStrategy.SERVER_WINS,
      label: '使用服务器版本',
      description: '保留服务器上的数据,丢弃本地修改',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      ),
    },
    {
      strategy: ConflictResolutionStrategy.CLIENT_WINS,
      label: '使用本地版本',
      description: '保留本地修改,覆盖服务器数据',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      strategy: ConflictResolutionStrategy.LATEST_WINS,
      label: '使用最新版本',
      description: '保留最后修改的版本',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      strategy: ConflictResolutionStrategy.MERGE,
      label: '自动合并',
      description: '尝试自动合并两个版本的数据',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      ),
    },
    {
      strategy: ConflictResolutionStrategy.MANUAL,
      label: '手动解决',
      description: '手动选择保留哪些数据',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
    },
  ];

  const getResolvedLabel = (resolution?: Conflict['resolution']) => {
    if (!resolution) return '未解决';
    const labels = {
      local: '本地版本',
      remote: '服务器版本',
      merge: '合并',
    };
    return labels[resolution];
  };

  const getResolvedBadge = (conflict: ConflictDetail) => {
    if (!conflict.resolved) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
          待解决
        </span>
      );
    }

    const styles = {
      local: 'bg-blue-100 text-blue-800',
      remote: 'bg-green-100 text-green-800',
      merge: 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[conflict.resolution!]}`}>
        {getResolvedLabel(conflict.resolution)}
      </span>
    );
  };

  // ========================================================================
  // 渲染
  // ========================================================================

  const unresolvedCount = conflicts.filter((c) => !c.resolved).length;

  return (
    <Card className={className}>
      {showTitle && (
        <Card.Header title="冲突解决" subtitle={`当前有 ${unresolvedCount} 个未解决的冲突`} />
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

        {/* 批量操作栏 */}
        {enableBatch && selectedConflicts.size > 0 && (
          <Card shadow="sm" padding="md" className="bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-blue-900">已选择 {selectedConflicts.size} 个冲突</span>
                <button
                  onClick={() => setSelectedConflicts(new Set())}
                  className="ml-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  取消选择
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="outline"
                  onClick={() => batchResolve(ConflictResolutionStrategy.SERVER_WINS)}
                  disabled={resolving}
                >
                  服务器版本
                </Button>
                <Button
                  size="small"
                  variant="outline"
                  onClick={() => batchResolve(ConflictResolutionStrategy.CLIENT_WINS)}
                  disabled={resolving}
                >
                  本地版本
                </Button>
                <Button
                  size="small"
                  variant="outline"
                  onClick={() => batchResolve(ConflictResolutionStrategy.LATEST_WINS)}
                  disabled={resolving}
                >
                  最新版本
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 操作栏 */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={loadConflicts}
            disabled={loading || resolving}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolvedConflicts}
              onChange={(e) => setShowResolvedConflicts(e.target.checked)}
              className="rounded"
            />
            显示已解决的冲突
          </label>
        </div>

        {/* 冲突列表 */}
        {loading && conflicts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : conflicts.length === 0 ? (
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>没有冲突</p>
            <p className="text-sm mt-1">所有数据已同步,无冲突</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <Card
                key={conflict.id}
                shadow="sm"
                padding="sm"
                className={`hover:shadow-md transition-shadow ${!conflict.resolved ? 'border-l-4 border-l-yellow-400' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {enableBatch && !conflict.resolved && (
                    <input
                      type="checkbox"
                      checked={selectedConflicts.has(conflict.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedConflicts);
                        if (e.target.checked) {
                          newSelected.add(conflict.id);
                        } else {
                          newSelected.delete(conflict.id);
                        }
                        setSelectedConflicts(newSelected);
                      }}
                      className="mt-1 rounded"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">{conflict.typeLabel}</span>
                      {getResolvedBadge(conflict)}
                      <span className="text-xs text-gray-500">ID: {conflict.entityId}</span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{conflict.description}</p>

                    {showDetails && (
                      <div className="grid grid-cols-2 gap-2 mt-3 p-3 bg-gray-50 rounded text-sm">
                        <div>
                          <div className="font-medium text-gray-700 mb-1">{conflict.localLabel}</div>
                          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                            {JSON.stringify(conflict.localVersion, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700 mb-1">{conflict.remoteLabel}</div>
                          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                            {JSON.stringify(conflict.remoteVersion, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      {!conflict.resolved && (
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedConflict(conflict);
                            setShowResolveModal(true);
                          }}
                          disabled={resolving}
                        >
                          解决
                        </Button>
                      )}
                      {conflict.resolved && (
                        <span className="text-xs text-gray-500">
                          已于 {getResolvedLabel(conflict.resolution)} 解决
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card.Body>

      {/* 冲突解决模态框 */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setSelectedConflict(null);
        }}
        title="解决冲突"
      >
        {selectedConflict && (
          <div className="space-y-4">
            <Alert variant="warning">
              请选择一个冲突解决策略,此操作将影响数据的最终状态
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">{selectedConflict.typeLabel} (ID: {selectedConflict.entityId})</p>
              <p className="text-sm text-gray-600">{selectedConflict.description}</p>
            </div>

            {showDetails && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">{selectedConflict.localLabel}</h4>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-48">
                    {JSON.stringify(selectedConflict.localVersion, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium mb-2">{selectedConflict.remoteLabel}</h4>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-48">
                    {JSON.stringify(selectedConflict.remoteVersion, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-medium">选择解决策略</h4>
              {getResolutionOptions().map((option) => (
                <Card
                  key={option.strategy}
                  shadow="sm"
                  padding="md"
                  className="cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => resolveConflict(selectedConflict.id, option.strategy)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-blue-600">{option.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowResolveModal(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default ConflictResolver;
