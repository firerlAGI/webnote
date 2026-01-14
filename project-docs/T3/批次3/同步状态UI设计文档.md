# T3项目同步状态UI设计文档

## 概述

本文档详细描述了T3项目同步状态的UI组件设计，包括同步状态指示器、同步状态详情对话框和冲突解决对话框三个核心组件的设计规范、交互流程和实现细节。

## 目录

1. [设计原则](#设计原则)
2. [颜色规范](#颜色规范)
3. [SyncStatusIndicator组件](#syncstatusindicator组件)
4. [SyncStatusDetailDialog组件](#syncstatusdetaildialog组件)
5. [ConflictResolutionDialog组件](#conflictresolutiondialog组件)
6. [交互流程](#交互流程)

---

## 设计原则

1. **即时反馈**: 所有同步操作都应提供即时的视觉反馈
2. **清晰明了**: 状态信息应简洁明了，易于理解
3. **可操作**: 冲突和错误应提供明确的操作入口
4. **非侵入式**: 状态指示器不应影响主要内容的展示
5. **响应式**: 适配不同屏幕尺寸和设备

---

## 颜色规范

| 状态 | 颜色 | Hex值 | 使用场景 |
|------|------|--------|----------|
| 同步中 | 蓝色 | #3B82F6 | 旋转动画、进度条 |
| 同步成功 | 绿色 | #10B981 | 对勾图标、成功提示 |
| 同步失败 | 红色 | #EF4444 | 错误图标、错误提示 |
| 离线状态 | 灰色 | #6B7280 | 离线图标、离线提示 |
| 存在冲突 | 橙色 | #F59E0B | 警告图标、冲突提示 |

**使用示例:**

```css
:root {
  --sync-syncing: #3B82F6;
  --sync-success: #10B981;
  --sync-failed: #EF4444;
  --sync-offline: #6B7280;
  --sync-conflict: #F59E0B;
}

.status-icon.syncing { color: var(--sync-syncing); }
.status-icon.success { color: var(--sync-success); }
.status-icon.failed { color: var(--sync-failed); }
.status-icon.offline { color: var(--sync-offline); }
.status-icon.conflict { color: var(--sync-conflict); }
```

---

## SyncStatusIndicator组件

### 组件描述

同步状态指示器是一个紧凑的状态展示组件，位于笔记编辑器顶部，实时显示同步状态。

### Props接口定义

```typescript
interface SyncStatusIndicatorProps {
  status: SyncStatus;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number;
  pendingItems: number;
  failedItems: number;
  conflictItems: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  syncMode: 'realtime' | 'offline' | 'polling';
}
```

### State状态定义

```typescript
interface SyncStatusIndicatorState {
  showTooltip: boolean;
  isHovering: boolean;
}
```

### UI布局设计

```
┌─────────────────────────────────────────────┐
│  [图标]  同步中...  [▼]              │  紧凑模式
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [图标]  同步中...                      │
│  待同步: 3  失败: 0  冲突: 0        │  展开模式
└─────────────────────────────────────────────┘
```

### 组件实现

```typescript
import React, { useState } from 'react';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  onClick,
  compact = true,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const getStatusIcon = () => {
    if (status.isSyncing) {
      return <SyncingIcon className="animate-spin" />;
    }
    if (status.failedItems > 0) {
      return <FailedIcon />;
    }
    if (status.conflictItems > 0) {
      return <ConflictIcon />;
    }
    if (status.connectionStatus === 'disconnected') {
      return <OfflineIcon />;
    }
    return <SuccessIcon />;
  };

  const getStatusText = () => {
    if (status.isSyncing) return '同步中...';
    if (status.failedItems > 0) return `${status.failedItems}项失败`;
    if (status.conflictItems > 0) return `${status.conflictItems}项冲突`;
    if (status.connectionStatus === 'disconnected') return '离线';
    return '已同步';
  };

  const getStatusColor = () => {
    if (status.isSyncing) return 'var(--sync-syncing)';
    if (status.failedItems > 0) return 'var(--sync-failed)';
    if (status.conflictItems > 0) return 'var(--sync-conflict)';
    if (status.connectionStatus === 'disconnected') return 'var(--sync-offline)';
    return 'var(--sync-success)';
  };

  const lastSyncTime = new Date(status.lastSyncTime);
  const timeAgo = formatTimeAgo(lastSyncTime);

  return (
    <div
      className={`sync-status-indicator ${className} ${compact ? 'compact' : 'expanded'}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="status-icon" style={{ color: getStatusColor() }}>
        {getStatusIcon()}
      </div>
      
      <div className="status-text">
        <span className="status-label">{getStatusText()}</span>
        {!compact && !status.isSyncing && (
          <span className="status-time">{timeAgo}</span>
        )}
      </div>
      
      {!compact && (
        <div className="status-details">
          <span>待同步: {status.pendingItems}</span>
          {status.failedItems > 0 && (
            <span className="failed">失败: {status.failedItems}</span>
          )}
          {status.conflictItems > 0 && (
            <span className="conflict">冲突: {status.conflictItems}</span>
          )}
        </div>
      )}
      
      {isHovering && !compact && (
        <div className="status-tooltip">
          <div>上次同步: {lastSyncTime.toLocaleString()}</div>
          <div>同步模式: {status.syncMode}</div>
          <div>连接状态: {status.connectionStatus}</div>
        </div>
      )}
    </div>
  );
};
```

### 样式规范

```css
.sync-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  font-size: 14px;
}

.sync-status-indicator:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.sync-status-indicator.compact {
  padding: 4px 8px;
}

.status-icon {
  font-size: 18px;
}

.status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-weight: 500;
}

.status-time {
  font-size: 12px;
  color: var(--sync-offline);
}

.status-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--sync-offline);
}

.status-details .failed {
  color: var(--sync-failed);
}

.status-details .conflict {
  color: var(--sync-conflict);
}

.status-tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

---

## SyncStatusDetailDialog组件

### 组件描述

同步状态详情对话框用于显示详细的同步信息，包括同步队列、失败项和冲突列表。

### Props接口定义

```typescript
interface SyncStatusDetailDialogProps {
  open: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  syncQueue: SyncQueueItem[];
  conflicts: Conflict[];
  onRetryItem: (operationId: string) => void;
  onDeleteItem: (operationId: string) => void;
  onResolveConflict: (conflictId: string) => void;
}
```

### State状态定义

```typescript
interface SyncStatusDetailDialogState {
  activeTab: 'queue' | 'failed' | 'conflicts';
  selectedItems: string[];
}
```

### UI布局设计

```
┌─────────────────────────────────────────────┐
│  同步状态                            [×] │
├─────────────────────────────────────────────┤
│  [同步队列] [失败项] [冲突项]          │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────┐   │
│  │ 创建笔记 note:123             [重试]│   │
│  │ 更新笔记 note:456             [删除]│   │
│  │ 删除笔记 note:789             [重试]│   │
│  └───────────────────────────────────┘   │
│  显示 1-3 共 3 项                    │
├─────────────────────────────────────────────┤
│              [关闭] [全部重试]          │
└─────────────────────────────────────────────┘
```

### 组件实现

```typescript
import React, { useState } from 'react';
import { Dialog } from '@/components/Dialog';

export const SyncStatusDetailDialog: React.FC<SyncStatusDetailDialogProps> = ({
  open,
  onClose,
  syncStatus,
  syncQueue,
  conflicts,
  onRetryItem,
  onDeleteItem,
  onResolveConflict
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'failed' | 'conflicts'>('queue');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const tabs = [
    { id: 'queue' as const, label: '同步队列', count: syncQueue.length },
    { id: 'failed' as const, label: '失败项', count: syncQueue.filter(q => q.status === 'failed').length },
    { id: 'conflicts' as const, label: '冲突项', count: conflicts.length }
  ];

  const getTabItems = () => {
    switch (activeTab) {
      case 'queue':
        return syncQueue.filter(q => q.status === 'pending');
      case 'failed':
        return syncQueue.filter(q => q.status === 'failed');
      case 'conflicts':
        return conflicts;
    }
  };

  const items = getTabItems();

  const handleRetrySelected = () => {
    selectedItems.forEach(id => onRetryItem(id));
    setSelectedItems([]);
  };

  const handleRetryAll = () => {
    items.forEach(item => {
      if ('operationId' in item) {
        onRetryItem(item.operationId);
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="同步状态">
      <div className="sync-status-detail-dialog">
        <div className="dialog-summary">
          <div className="summary-item">
            <span className="label">上次同步:</span>
            <span>{new Date(syncStatus.lastSyncTime).toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="label">连接状态:</span>
            <span className={`status ${syncStatus.connectionStatus}`}>
              {syncStatus.connectionStatus}
            </span>
          </div>
          <div className="summary-item">
            <span className="label">同步模式:</span>
            <span>{syncStatus.syncMode}</span>
          </div>
        </div>

        <div className="dialog-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedItems([]);
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="dialog-content">
          {activeTab === 'queue' && items.length === 0 && (
            <div className="empty-state">没有待同步项</div>
          )}

          {activeTab === 'failed' && items.length === 0 && (
            <div className="empty-state">没有失败项</div>
          )}

          {activeTab === 'conflicts' && items.length === 0 && (
            <div className="empty-state">没有冲突项</div>
          )}

          {items.length > 0 && (
            <div className="items-list">
              {items.map((item, index) => {
                if ('operationId' in item) {
                  return (
                    <QueueItem
                      key={item.operationId}
                      item={item}
                      selected={selectedItems.includes(item.operationId)}
                      onSelect={(selected) => {
                        setSelectedItems(prev =>
                          selected
                            ? [...prev, item.operationId]
                            : prev.filter(id => id !== item.operationId)
                        );
                      }}
                      onRetry={() => onRetryItem(item.operationId)}
                      onDelete={() => onDeleteItem(item.operationId)}
                    />
                  );
                } else {
                  return (
                    <ConflictItem
                      key={item.conflictId}
                      conflict={item}
                      onSelect={() => onResolveConflict(item.conflictId)}
                    />
                  );
                }
              })}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>
            关闭
          </button>
          {activeTab !== 'conflicts' && selectedItems.length > 0 && (
            <button className="btn-primary" onClick={handleRetrySelected}>
              重试选中 ({selectedItems.length})
            </button>
          )}
          {activeTab !== 'conflicts' && items.length > 0 && (
            <button className="btn-primary" onClick={handleRetryAll}>
              全部重试
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
};

const QueueItem: React.FC<QueueItemProps> = ({
  item,
  selected,
  onSelect,
  onRetry,
  onDelete
}) => {
  const getOperationLabel = () => {
    switch (item.operationType) {
      case 'create': return '创建';
      case 'update': return '更新';
      case 'delete': return '删除';
      default: return '操作';
    }
  };

  return (
    <div className={`queue-item ${selected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        className="item-checkbox"
      />
      <div className="item-content">
        <div className="item-header">
          <span className="item-type">{getOperationLabel()}</span>
          <span className="item-entity">{item.entityType}:{item.entityId}</span>
        </div>
        <div className="item-meta">
          <span className="item-time">
            {new Date(item.createdAt).toLocaleString()}
          </span>
          {item.error && (
            <span className="item-error">{item.error.message}</span>
          )}
        </div>
      </div>
      <div className="item-actions">
        <button className="btn-icon" onClick={onRetry} title="重试">
          <RetryIcon />
        </button>
        <button className="btn-icon" onClick={onDelete} title="删除">
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};
```

### 样式规范

```css
.sync-status-detail-dialog {
  display: flex;
  flex-direction: column;
  min-height: 500px;
  max-height: 700px;
}

.dialog-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item .label {
  font-size: 12px;
  color: #6b7280;
}

.dialog-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 16px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  color: #6b7280;
  transition: all 0.2s;
}

.tab:hover {
  color: #374151;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab .badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: #ef4444;
  color: white;
  font-size: 12px;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #9ca3af;
  font-size: 14px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  transition: all 0.2s;
}

.queue-item:hover {
  background: #f9fafb;
}

.queue-item.selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-header {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.item-type {
  font-weight: 500;
  color: #374151;
}

.item-entity {
  color: #6b7280;
}

.item-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.item-error {
  color: #ef4444;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  padding: 4px;
  border: none;
  background: none;
  cursor: pointer;
  color: #6b7280;
  transition: color 0.2s;
}

.btn-icon:hover {
  color: #374151;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  background: #3b82f6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}
```

---

## ConflictResolutionDialog组件

### 组件描述

冲突解决对话框用于处理同步冲突，提供多种冲突解决策略的选择界面。

### Props接口定义

```typescript
interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: Conflict;
  onClose: () => void;
  onResolve: (conflictId: string, strategy: ConflictResolutionStrategy, resolvedData?: any) => void;
  onIgnore: (conflictId: string) => void;
}

interface Conflict {
  conflictId: string;
  conflictType: ConflictType;
  entityType: string;
  entityId: string | number;
  localData: any;
  remoteData: any;
  conflictFields: string[];
  timestamp: number;
}

type ConflictResolutionStrategy = 
  | 'local_wins' 
  | 'remote_wins' 
  | 'latest_wins' 
  | 'manual';

type ConflictType = 'content' | 'version' | 'delete' | 'parent' | 'unique';
```

### State状态定义

```typescript
interface ConflictResolutionDialogState {
  selectedStrategy: ConflictResolutionStrategy;
  customData: any;
  showDiff: boolean;
  activeView: 'local' | 'remote' | 'merged';
}
```

### UI布局设计

```
┌─────────────────────────────────────────────┐
│  冲突解决                            [×] │
├─────────────────────────────────────────────┤
│  笔记 "note:123" 存在冲突             │
│  冲突字段: 标题, 内容                  │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ │
│  │  本地版本       │ │  服务器版本     │ │
│  │  [选中]        │ │                 │ │
│  └─────────────────┘ └─────────────────┘ │
│                                        │
│  标题: 本地标题  |  服务器标题        │
│  内容: 本地内容  |  服务器内容        │
├─────────────────────────────────────────────┤
│  解决策略:                              │
│  ○ 使用本地版本                        │
│  ● 使用服务器版本                       │
│  ○ 使用最新版本                        │
│  ○ 手动合并                           │
├─────────────────────────────────────────────┤
│  [忽略冲突]  [取消]  [应用解决方案]    │
└─────────────────────────────────────────────┘
```

### 组件实现

```typescript
import React, { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { DataDiffViewer } from '@/components/DataDiffViewer';

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  open,
  conflict,
  onClose,
  onResolve,
  onIgnore
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictResolutionStrategy>('remote_wins');
  const [customData, setCustomData] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [activeView, setActiveView] = useState<'local' | 'remote' | 'merged'>('remote');

  const getConflictTypeLabel = () => {
    switch (conflict.conflictType) {
      case 'content': return '内容冲突';
      case 'version': return '版本冲突';
      case 'delete': return '删除冲突';
      case 'parent': return '父级冲突';
      case 'unique': return '唯一性冲突';
    }
  };

  const strategies = [
    { id: 'local_wins' as const, label: '使用本地版本', description: '保留您编辑的内容' },
    { id: 'remote_wins' as const, label: '使用服务器版本', description: '使用服务器上的最新内容' },
    { id: 'latest_wins' as const, label: '使用最新版本', description: '基于时间戳选择最新版本' },
    { id: 'manual' as const, label: '手动合并', description: '手动选择保留的内容' }
  ];

  const getResolvedData = () => {
    switch (selectedStrategy) {
      case 'local_wins':
        return conflict.localData;
      case 'remote_wins':
        return conflict.remoteData;
      case 'latest_wins':
        const localTime = new Date(conflict.localData.updated_at || Date.now()).getTime();
        const remoteTime = new Date(conflict.remoteData.updated_at).getTime();
        return localTime > remoteTime ? conflict.localData : conflict.remoteData;
      case 'manual':
        return customData || conflict.remoteData;
    }
  };

  const handleResolve = () => {
    const resolvedData = getResolvedData();
    onResolve(conflict.conflictId, selectedStrategy, resolvedData);
    onClose();
  };

  const handleIgnore = () => {
    onIgnore(conflict.conflictId);
    onClose();
  };

  const latestTimestamp = Math.max(
    new Date(conflict.localData.updated_at || Date.now()).getTime(),
    new Date(conflict.remoteData.updated_at).getTime()
  );
  const latestVersion = latestTimestamp === new Date(conflict.localData.updated_at || Date.now()).getTime() 
    ? 'local' 
    : 'remote';

  return (
    <Dialog open={open} onClose={onClose} title="冲突解决">
      <div className="conflict-resolution-dialog">
        <div className="conflict-header">
          <h3>{conflict.entityType}:{conflict.entityId}</h3>
          <span className="conflict-type">{getConflictTypeLabel()}</span>
        </div>

        <div className="conflict-fields">
          <span className="fields-label">冲突字段:</span>
          {conflict.conflictFields.map(field => (
            <span key={field} className="conflict-field">
              {field}
            </span>
          ))}
        </div>

        {showDiff && (
          <div className="diff-viewer">
            <DataDiffViewer
              localData={conflict.localData}
              remoteData={conflict.remoteData}
              conflictFields={conflict.conflictFields}
            />
          </div>
        )}

        <div className="strategy-selection">
          <h4>解决策略</h4>
          <div className="strategies">
            {strategies.map(strategy => (
              <label
                key={strategy.id}
                className={`strategy-option ${selectedStrategy === strategy.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={strategy.id}
                  checked={selectedStrategy === strategy.id}
                  onChange={() => setSelectedStrategy(strategy.id)}
                />
                <div className="strategy-content">
                  <span className="strategy-label">{strategy.label}</span>
                  {strategy.id === 'latest_wins' && (
                    <span className="strategy-hint">
                      最新: {latestVersion === 'local' ? '本地版本' : '服务器版本'}
                    </span>
                  )}
                  <span className="strategy-description">{strategy.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {selectedStrategy === 'manual' && (
          <div className="manual-merge">
            <h4>手动合并</h4>
            <div className="merge-preview">
              <div className="merge-editor">
                <textarea
                  value={JSON.stringify(customData || conflict.remoteData, null, 2)}
                  onChange={(e) => {
                    try {
                      setCustomData(JSON.parse(e.target.value));
                    } catch {
                      // 忽略JSON解析错误
                    }
                  }}
                  rows={10}
                  placeholder="编辑合并后的数据..."
                />
              </div>
            </div>
          </div>
        )}

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleIgnore}>
            忽略冲突
          </button>
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={handleResolve}>
            应用解决方案
          </button>
        </div>
      </div>
    </Dialog>
  );
};
```

### 样式规范

```css
.conflict-resolution-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conflict-header h3 {
  margin: 0;
  font-size: 16px;
  color: #374151;
}

.conflict-type {
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef3c7;
  color: #d97706;
  font-size: 12px;
}

.conflict-fields {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.fields-label {
  color: #6b7280;
}

.conflict-field {
  padding: 2px 8px;
  border-radius: 4px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 12px;
}

.diff-viewer {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.strategy-selection h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #374151;
}

.strategies {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.strategy-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.strategy-option:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.strategy-option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.strategy-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.strategy-label {
  font-weight: 500;
  color: #374151;
}

.strategy-hint {
  font-size: 12px;
  color: #3b82f6;
}

.strategy-description {
  font-size: 12px;
  color: #6b7280;
}

.manual-merge {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.manual-merge h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #374151;
}

.merge-editor textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  resize: vertical;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
```

---

## 交互流程

### 点击状态指示器

```
用户点击 SyncStatusIndicator
    ↓
检查是否有待处理事项
    ↓
├─ 无待处理事项
│  显示提示："所有内容已同步"
│
└─ 有待处理事项
   ↓
   打开 SyncStatusDetailDialog
   ↓
   显示相应标签页（优先显示冲突项）
```

### 处理冲突

```
用户打开 ConflictResolutionDialog
    ↓
查看本地版本和服务器版本
    ↓
选择解决策略
    ↓
├─ 本地版本胜出
│  → 使用本地数据更新缓存
│  → 发送解决请求到服务器
│  → 关闭对话框
│
├─ 服务器版本胜出
│  → 使用服务器数据更新缓存
│  → 发送解决请求到服务器
│  → 关闭对话框
│
├─ 最新版本胜出
│  → 比对时间戳选择最新数据
│  → 更新缓存
│  → 发送解决请求到服务器
│  → 关闭对话框
│
└─ 手动合并
   → 显示编辑器
   → 用户编辑合并后的数据
   → 验证JSON格式
   → 发送解决请求到服务器
   → 关闭对话框
```

### 自动刷新机制

```typescript
import { useEffect } from 'react';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export const useSyncStatusPolling = (interval: number = 5000) => {
  const { status, refresh } = useSyncStatus();

  useEffect(() => {
    if (status.isSyncing) {
      const timer = setInterval(refresh, interval);
      return () => clearInterval(timer);
    }
  }, [status.isSyncing, interval, refresh]);

  return status;
};
```

### 事件监听

```typescript
import { useEffect } from 'react';
import { syncManager } from '@/cache/SyncManager';

export const useSyncEvents = () => {
  useEffect(() => {
    const handleSyncStart = () => {
      console.log('同步开始');
    };

    const handleSyncComplete = () => {
      console.log('同步完成');
    };

    const handleSyncError = (error: Error) => {
      console.error('同步错误:', error);
    };

    const handleConflict = (conflict: Conflict) => {
      console.log('检测到冲突:', conflict);
      // 打开冲突解决对话框
    };

    syncManager.on('sync_start', handleSyncStart);
    syncManager.on('sync_complete', handleSyncComplete);
    syncManager.on('sync_error', handleSyncError);
    syncManager.on('conflict', handleConflict);

    return () => {
      syncManager.off('sync_start', handleSyncStart);
      syncManager.off('sync_complete', handleSyncComplete);
      syncManager.off('sync_error', handleSyncError);
      syncManager.off('conflict', handleConflict);
    };
  }, []);
};
```

---

## 版本历史

- **v1.0.0** (2024-01-10): 初始版本，定义完整的同步状态UI组件设计
