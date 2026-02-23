/**
 * SyncIndicator
 * Displays the current synchronization status with visual indicators
 *
 * Features:
 * - Shows sync status: syncing, idle, offline, conflict, error
 * - Displays pending operations count
 * - Shows last sync time
 * - Click to force sync
 * - Animated syncing indicator
 */

import React, { useState, useCallback } from 'react'
import { 
  RefreshCw, 
  Check, 
  WifiOff, 
  AlertTriangle, 
  XCircle,
  Clock
} from 'lucide-react'
import { useSync } from '../contexts/SyncContext'
import type { SyncStatus } from '../contexts/SyncContext'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncIndicatorProps {
  /** Additional CSS classes */
  className?: string
  /** Whether to show the status label text */
  showLabel?: boolean
  /** Whether to show pending operations count */
  showPendingCount?: boolean
  /** Whether to show last sync time */
  showLastSyncTime?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Callback when sync is triggered */
  onSyncTriggered?: () => void
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<SyncStatus, {
  icon: React.ElementType
  label: string
  colorClass: string
  bgColorClass: string
  animate?: boolean
}> = {
  syncing: {
    icon: RefreshCw,
    label: 'Syncing...',
    colorClass: 'text-cyber-cyan',
    bgColorClass: 'bg-cyber-cyan/10',
    animate: true
  },
  idle: {
    icon: Check,
    label: 'Synced',
    colorClass: 'text-green-400',
    bgColorClass: 'bg-green-400/10'
  },
  offline: {
    icon: WifiOff,
    label: 'Offline',
    colorClass: 'text-gray-400',
    bgColorClass: 'bg-gray-400/10'
  },
  conflict: {
    icon: AlertTriangle,
    label: 'Conflicts',
    colorClass: 'text-cyber-yellow',
    bgColorClass: 'bg-cyber-yellow/10'
  },
  error: {
    icon: XCircle,
    label: 'Error',
    colorClass: 'text-cyber-pink',
    bgColorClass: 'bg-cyber-pink/10'
  }
}

const SIZE_CONFIG = {
  sm: {
    container: 'px-2 py-1 text-xs gap-1.5',
    icon: 'w-3 h-3',
    badge: 'text-[9px] px-1.5 py-0.5'
  },
  md: {
    container: 'px-3 py-1.5 text-sm gap-2',
    icon: 'w-4 h-4',
    badge: 'text-[10px] px-2 py-0.5'
  },
  lg: {
    container: 'px-4 py-2 text-base gap-2.5',
    icon: 'w-5 h-5',
    badge: 'text-xs px-2.5 py-1'
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format last sync time to human readable string
 */
const formatLastSyncTime = (time: string | null): string => {
  if (!time) return 'Never'
  
  const date = new Date(time)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

// ============================================================================
// Component
// ============================================================================

/**
 * SyncIndicator Component
 *
 * Displays the current sync status with visual feedback.
 * Supports click-to-sync functionality and shows pending operations.
 *
 * @example
 * ```tsx
 * <SyncIndicator showLabel showPendingCount />
 * ```
 */
export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  className = '',
  showLabel = true,
  showPendingCount = true,
  showLastSyncTime = false,
  size = 'md',
  onSyncTriggered
}) => {
  const { 
    status, 
    isOnline, 
    lastSyncTime, 
    pendingOperations, 
    forceSync,
    error 
  } = useSync()
  
  const [isForceSyncing, setIsForceSyncing] = useState(false)
  
  const config = STATUS_CONFIG[status]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon
  
  /**
   * Handle click to force sync
   */
  const handleClick = useCallback(async () => {
    // Don't allow force sync when offline or already syncing
    if (!isOnline || status === 'syncing' || isForceSyncing) {
      return
    }
    
    setIsForceSyncing(true)
    try {
      await forceSync()
      onSyncTriggered?.()
    } catch (err) {
      console.error('Force sync failed:', err)
    } finally {
      setIsForceSyncing(false)
    }
  }, [isOnline, status, isForceSyncing, forceSync, onSyncTriggered])
  
  /**
   * Determine if the indicator is clickable
   */
  const isClickable = isOnline && status !== 'syncing' && !isForceSyncing
  
  return (
    <div 
      className={`
        inline-flex items-center rounded-sm font-mono uppercase tracking-wider
        ${config.bgColorClass} ${config.colorClass}
        ${sizeConfig.container}
        ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
        ${className}
      `}
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
      title={error || (isClickable ? 'Click to sync' : undefined)}
    >
      {/* Status Icon */}
      <Icon 
        className={`
          ${sizeConfig.icon}
          ${config.animate || isForceSyncing ? 'animate-spin' : ''}
        `}
      />
      
      {/* Status Label */}
      {showLabel && (
        <span className="font-bold">
          {isForceSyncing ? 'Syncing...' : config.label}
        </span>
      )}
      
      {/* Pending Operations Count */}
      {showPendingCount && pendingOperations > 0 && (
        <span 
          className={`
            rounded-sm bg-cyber-cyan/20 border border-cyber-cyan/30
            ${sizeConfig.badge}
          `}
        >
          {pendingOperations} pending
        </span>
      )}
      
      {/* Last Sync Time */}
      {showLastSyncTime && status === 'idle' && (
        <span className="flex items-center gap-1 opacity-70">
          <Clock className="w-3 h-3" />
          {formatLastSyncTime(lastSyncTime)}
        </span>
      )}
      
      {/* Error indicator */}
      {error && status === 'error' && (
        <span className="opacity-70 text-[10px] truncate max-w-[100px]" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}

export default SyncIndicator
