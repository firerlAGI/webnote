/**
 * 备份进度组件
 * 显示备份或恢复操作的进度条和状态信息
 */

import React from 'react';
import { Card } from '../ui';
import { BackupProgress as BackupProgressType } from '../../api/backup';

// ============================================================================
// 备份进度组件
// ============================================================================

interface BackupProgressProps {
  /** 进度信息 */
  progress: BackupProgressType;
  /** 操作类型 */
  operationType: 'backup' | 'restore';
  /** 自定义类名 */
  className?: string;
}

const BackupProgress: React.FC<BackupProgressProps> = ({
  progress,
  operationType,
  className = '',
}) => {
  // ========================================================================
  // 辅助方法
  // ========================================================================

  const getOperationTitle = () => {
    return operationType === 'backup' ? '正在备份' : '正在恢复';
  };

  const getThemeColors = () => {
    return operationType === 'backup'
      ? {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          subtext: 'text-blue-700',
          bar: 'bg-blue-600',
          progressBg: 'bg-blue-200',
        }
      : {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-900',
          subtext: 'text-green-700',
          bar: 'bg-green-600',
          progressBg: 'bg-green-200',
        };
  };

  const colors = getThemeColors();

  // ========================================================================
  // 渲染
  // ========================================================================

  return (
    <Card
      shadow="sm"
      padding="md"
      className={`${colors.bg} ${colors.border} ${className}`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${colors.text}`}>
            {getOperationTitle()}
          </span>
          <span className={`text-sm ${colors.subtext}`}>{progress.progress}%</span>
        </div>
        <div className={`w-full ${colors.progressBg} rounded-full h-2`}>
          <div
            className={`${colors.bar} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <div className={`text-xs ${colors.subtext}`}>
          {progress.currentStep}
          {progress.totalItems > 0 && (
            <span className="ml-2">
              ({progress.processedItems} / {progress.totalItems})
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default BackupProgress;
