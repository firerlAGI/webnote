/**
 * OfflineBanner
 * Displays a notification banner when the application is offline
 *
 * Features:
 * - Shows when network is disconnected
 * - Displays pending operations count
 * - Shows message about data syncing when reconnected
 * - Can be dismissed (but will reappear on next offline)
 * - Auto-hides when network is restored
 */

import React, { useState, useEffect, useCallback } from 'react'
import { WifiOff, X, CloudOff, RefreshCw } from 'lucide-react'
import { useSync } from '../contexts/SyncContext'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface OfflineBannerProps {
  /** Additional CSS classes */
  className?: string
  /** Whether to show pending operations count */
  showPendingCount?: boolean
  /** Callback when banner is dismissed */
  onDismiss?: () => void
  /** Callback when reconnect is attempted */
  onReconnectAttempt?: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * OfflineBanner Component
 *
 * Displays a full-width banner at the top of the page when offline.
 * Can be dismissed but will reappear if still offline.
 *
 * @example
 * ```tsx
 * <OfflineBanner showPendingCount />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  className = '',
  showPendingCount = true,
  onDismiss,
  onReconnectAttempt
}) => {
  const { isOnline, pendingOperations, goOnline, status } = useSync()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  
  // Reset dismissed state when online status changes
  useEffect(() => {
    if (isOnline) {
      setIsDismissed(false)
    }
  }, [isOnline])
  
  /**
   * Handle dismiss click
   */
  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    onDismiss?.()
  }, [onDismiss])
  
  /**
   * Handle reconnect attempt
   */
  const handleReconnect = useCallback(async () => {
    setIsReconnecting(true)
    try {
      await goOnline()
      onReconnectAttempt?.()
    } catch (err) {
      console.error('Reconnect failed:', err)
    } finally {
      setIsReconnecting(false)
    }
  }, [goOnline, onReconnectAttempt])
  
  // Don't render if online or dismissed
  if (isOnline || isDismissed) {
    return null
  }
  
  return (
    <div 
      className={`
        fixed top-0 left-0 right-0 z-50
        bg-gradient-to-r from-cyber-panel via-gray-900 to-cyber-panel
        border-b border-cyber-yellow/30
        animate-in slide-in-from-top duration-300
        ${className}
      `}
    >
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left side: Icon and message */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Offline icon with pulse animation */}
          <div className="relative flex-shrink-0">
            <WifiOff className="w-5 h-5 text-cyber-yellow" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyber-yellow rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyber-yellow rounded-full" />
          </div>
          
          {/* Message */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
            <span className="font-mono text-sm font-bold text-cyber-yellow uppercase tracking-wider whitespace-nowrap">
              You are offline
            </span>
            
            {/* Pending operations */}
            {showPendingCount && pendingOperations > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                <CloudOff className="w-3.5 h-3.5" />
                <span>
                  {pendingOperations} operation{pendingOperations !== 1 ? 's' : ''} pending sync
                </span>
              </span>
            )}
          </div>
        </div>
        
        {/* Right side: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Reconnect button */}
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className={`
              flex items-center gap-1.5 px-3 py-1.5
              bg-cyber-yellow/10 border border-cyber-yellow/30
              text-cyber-yellow text-xs font-mono font-bold uppercase tracking-wider
              rounded-sm hover:bg-cyber-yellow/20 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reconnect</span>
          </button>
          
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="
              p-1.5 text-gray-500 hover:text-gray-300
              hover:bg-white/5 rounded transition-colors
            "
            aria-label="Dismiss offline banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-cyber-yellow/50 to-transparent" />
    </div>
  )
}

export default OfflineBanner
