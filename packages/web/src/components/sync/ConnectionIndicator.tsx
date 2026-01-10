/**
 * WebSocket连接状态指示器组件
 * 显示实时连接状态、HTTP轮询模式和延迟信息
 */

import React, { useState, useEffect } from 'react';
import { SyncManager } from '../../cache/SyncManager';

export interface ConnectionIndicatorProps {
  syncManager?: SyncManager;
  showLatency?: boolean;
  showMode?: boolean;
  compact?: boolean;
  className?: string;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  syncManager,
  showLatency = true,
  showMode = true,
  compact = false,
  className = '',
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [syncMode, setSyncMode] = useState<'websocket' | 'polling'>('websocket');
  const [latency, setLatency] = useState<number | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number | null>(null);

  useEffect(() => {
    if (!syncManager) return;

    const loadStatus = async () => {
      try {
        const status = await syncManager.getSyncStatus();
        setConnectionStatus(status.connectionStatus === 'connected' ? 'connected' : 'disconnected');
        setSyncMode(status.syncMode === 'polling' ? 'polling' : 'websocket');
        
        if (status.lastPingTime) {
          const pingLatency = status.lastPingTime;
          setLatency(pingLatency);
        }

        if (status.nextPollTime) {
          const timeUntilPoll = Math.max(0, status.nextPollTime - Date.now());
          setNextPollIn(timeUntilPoll);
        }
      } catch (err) {
        console.error('Failed to load connection status:', err);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 1000);

    const handleStatusChange = (event: any) => {
      if (event.data) {
        const status = event.data;
        setConnectionStatus(status.connectionStatus === 'connected' ? 'connected' : 'disconnected');
        setSyncMode(status.syncMode === 'polling' ? 'polling' : 'websocket');
      }
    };

    syncManager.on('status_changed', handleStatusChange);

    return () => {
      clearInterval(interval);
      syncManager.off('status_changed', handleStatusChange);
    };
  }, [syncManager]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        );
      case 'reconnecting':
        return (
          <svg className="w-4 h-4 animate-spin text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'disconnected':
        return (
          <div className="w-2 h-2 rounded-full bg-red-500" />
        );
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'reconnecting':
        return '重连中';
      case 'disconnected':
        return '未连接';
    }
  };

  const getModeText = () => {
    if (syncMode === 'polling') {
      return 'HTTP轮询';
    }
    return 'WebSocket';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-xs text-gray-600">{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {showMode && (
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-100">
          <span className="text-xs text-gray-600">{getModeText()}</span>
          {syncMode === 'polling' && nextPollIn !== null && (
            <span className="text-xs text-gray-500">
              {nextPollIn > 0 ? `${Math.ceil(nextPollIn / 1000)}s后轮询` : '轮询中...'}
            </span>
          )}
        </div>
      )}

      {showLatency && latency !== null && syncMode === 'websocket' && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">延迟:</span>
          <span className={`text-xs font-medium ${latency < 100 ? 'text-green-600' : latency < 500 ? 'text-yellow-600' : 'text-red-600'}`}>
            {latency}ms
          </span>
        </div>
      )}
    </div>
  );
};

export default ConnectionIndicator;
