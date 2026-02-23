/**
 * ConflictDialog
 * Dialog for resolving synchronization conflicts
 *
 * Features:
 * - Displays conflict details
 * - Side-by-side comparison of local and server versions
 * - Highlights conflicting fields
 * - Three resolution options: Keep Local, Keep Server, Merge
 * - Accessible modal with keyboard navigation
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { X, FileText, FolderOpen, Calendar, AlertTriangle, Check, GitMerge } from 'lucide-react'
import { CyberButton } from './CyberUI'
import type { ConflictInfo } from '../services/cache/CacheConsistency'

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ConflictResolution = 'local' | 'server' | 'merge'

export interface ConflictDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** The conflict to display */
  conflict: ConflictInfo | null
  /** Callback when a resolution is chosen */
  onResolve: (resolution: ConflictResolution) => void
  /** Whether resolution is in progress */
  isResolving?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const ENTITY_TYPE_CONFIG = {
  note: {
    icon: FileText,
    label: 'Note',
    colorClass: 'text-cyber-cyan'
  },
  folder: {
    icon: FolderOpen,
    label: 'Folder',
    colorClass: 'text-cyber-yellow'
  },
  review: {
    icon: Calendar,
    label: 'Review',
    colorClass: 'text-cyber-pink'
  }
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  content: 'Content',
  name: 'Name',
  folder_id: 'Folder',
  is_pinned: 'Pinned',
  date: 'Date',
  mood: 'Mood',
  achievements: 'Achievements',
  improvements: 'Improvements',
  plans: 'Plans'
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a value for display
 */
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '(empty)'
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 200) {
      return value.substring(0, 200) + '...'
    }
    return value || '(empty)'
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)'
    return value.join(', ')
  }
  
  return String(value)
}

/**
 * Get the fields to display for comparison
 */
const getDisplayFields = (
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  conflictFields: string[]
): string[] => {
  // Get all fields that exist in either version
  const allFields = new Set([
    ...Object.keys(localData).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'user_id' && k !== 'updated_at' && k !== 'created_at' && k !== 'version'),
    ...Object.keys(serverData).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'user_id' && k !== 'updated_at' && k !== 'created_at' && k !== 'version')
  ])
  
  // Sort: conflict fields first, then alphabetically
  return Array.from(allFields).sort((a, b) => {
    const aIsConflict = conflictFields.includes(a)
    const bIsConflict = conflictFields.includes(b)
    
    if (aIsConflict && !bIsConflict) return -1
    if (!aIsConflict && bIsConflict) return 1
    return a.localeCompare(b)
  })
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Field comparison row
 */
interface FieldRowProps {
  field: string
  localValue: unknown
  serverValue: unknown
  isConflicting: boolean
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  localValue,
  serverValue,
  isConflicting
}) => {
  const label = FIELD_LABELS[field] || field
  const localDisplay = formatValue(localValue)
  const serverDisplay = formatValue(serverValue)
  const hasDifference = localDisplay !== serverDisplay
  
  return (
    <div className={`
      grid grid-cols-[140px_1fr_1fr] gap-2 items-start py-2 px-3
      ${isConflicting ? 'bg-cyber-yellow/5' : ''}
      border-b border-gray-800/50 last:border-b-0
    `}>
      {/* Field label */}
      <div className="flex items-center gap-2">
        {isConflicting && (
          <AlertTriangle className="w-3.5 h-3.5 text-cyber-yellow flex-shrink-0" />
        )}
        <span className={`
          text-xs font-mono uppercase tracking-wider
          ${isConflicting ? 'text-cyber-yellow font-bold' : 'text-gray-500'}
        `}>
          {label}
        </span>
      </div>
      
      {/* Local value */}
      <div className={`
        text-sm font-mono break-words
        ${isConflicting ? 'text-cyber-cyan' : 'text-gray-400'}
      `}>
        {localDisplay}
      </div>
      
      {/* Server value */}
      <div className={`
        text-sm font-mono break-words
        ${isConflicting ? 'text-cyber-pink' : 'text-gray-400'}
      `}>
        {serverDisplay}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConflictDialog Component
 *
 * Displays a modal dialog for resolving sync conflicts.
 * Shows side-by-side comparison with highlighted differences.
 *
 * @example
 * ```tsx
 * <ConflictDialog
 *   isOpen={hasConflict}
 *   onClose={() => setShowConflict(false)}
 *   conflict={currentConflict}
 *   onResolve={(resolution) => handleResolution(resolution)}
 * />
 * ```
 */
export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve,
  isResolving = false
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  
  // Reset selected resolution when conflict changes
  useEffect(() => {
    setSelectedResolution(null)
  }, [conflict])
  
  // Handle focus trap and escape key
  useEffect(() => {
    if (!isOpen) return
    
    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement
    
    // Focus the dialog
    dialogRef.current?.focus()
    
    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResolving) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus
      previousActiveElement.current?.focus()
    }
  }, [isOpen, onClose, isResolving])
  
  /**
   * Handle resolution selection
   */
  const handleResolve = useCallback((resolution: ConflictResolution) => {
    setSelectedResolution(resolution)
    onResolve(resolution)
  }, [onResolve])
  
  // Don't render if not open or no conflict
  if (!isOpen || !conflict) {
    return null
  }
  
  const entityConfig = ENTITY_TYPE_CONFIG[conflict.entityType]
  const EntityIcon = entityConfig.icon
  const displayFields = getDisplayFields(
    conflict.localData,
    conflict.serverData,
    conflict.conflictFields
  )
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={isResolving ? undefined : onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        className="
          relative w-full max-w-4xl max-h-[90vh]
          bg-cyber-black border border-cyber-cyan/30
          rounded-lg shadow-[0_0_30px_rgba(0,255,255,0.1)]
          overflow-hidden flex flex-col
          animate-in zoom-in-95 duration-300
        "
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="
          sticky top-0 z-10
          bg-black/90 backdrop-blur-sm
          border-b border-gray-800
          px-6 py-4
          flex items-center justify-between
        ">
          <div className="flex items-center gap-3">
            <div className="relative">
              <EntityIcon className={`w-5 h-5 ${entityConfig.colorClass}`} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyber-yellow rounded-full animate-pulse" />
            </div>
            <div>
              <h2 
                id="conflict-dialog-title"
                className="text-lg font-display font-bold text-white"
              >
                Sync Conflict Detected
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {entityConfig.label} #{conflict.entityId} has conflicting changes
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            disabled={isResolving}
            className="
              p-2 hover:bg-cyber-cyan/10 rounded transition-colors
              text-gray-400 hover:text-cyber-cyan
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Warning message */}
          <div className="
            mb-6 p-4 rounded-sm
            bg-cyber-yellow/5 border border-cyber-yellow/20
            flex items-start gap-3
          ">
            <AlertTriangle className="w-5 h-5 text-cyber-yellow flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-bold text-cyber-yellow mb-1">
                This {entityConfig.label.toLowerCase()} was modified both locally and on the server.
              </p>
              <p className="text-gray-400">
                Choose how to resolve the conflict. Highlighted fields show differences.
              </p>
            </div>
          </div>
          
          {/* Comparison table */}
          <div className="bg-cyber-panel border border-gray-800 rounded-sm overflow-hidden">
            {/* Table header */}
            <div className="
              grid grid-cols-[140px_1fr_1fr] gap-2
              bg-black/40 border-b border-gray-800
              px-3 py-2
            ">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Field
              </span>
              <span className="text-xs font-mono text-cyber-cyan uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-cyber-cyan rounded-full" />
                Local Version
              </span>
              <span className="text-xs font-mono text-cyber-pink uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-cyber-pink rounded-full" />
                Server Version
              </span>
            </div>
            
            {/* Table body */}
            <div className="divide-y divide-gray-800/50">
              {displayFields.map(field => (
                <FieldRow
                  key={field}
                  field={field}
                  localValue={conflict.localData[field]}
                  serverValue={conflict.serverData[field]}
                  isConflicting={conflict.conflictFields.includes(field)}
                />
              ))}
            </div>
          </div>
          
          {/* Suggested resolution */}
          {conflict.suggestedResolution && (
            <div className="mt-4 text-xs text-gray-500 font-mono flex items-center gap-2">
              <span>Suggested:</span>
              <span className={`
                px-2 py-0.5 rounded-sm uppercase
                ${conflict.suggestedResolution === 'local' ? 'bg-cyber-cyan/10 text-cyber-cyan' : ''}
                ${conflict.suggestedResolution === 'server' ? 'bg-cyber-pink/10 text-cyber-pink' : ''}
                ${conflict.suggestedResolution === 'merge' ? 'bg-cyber-yellow/10 text-cyber-yellow' : ''}
              `}>
                {conflict.suggestedResolution === 'merge' ? 'Merge versions' : `Keep ${conflict.suggestedResolution}`}
              </span>
            </div>
          )}
        </div>
        
        {/* Footer with resolution buttons */}
        <div className="
          sticky bottom-0 z-10
          bg-black/90 backdrop-blur-sm
          border-t border-gray-800
          px-6 py-4
          flex flex-wrap items-center justify-end gap-3
        ">
          <CyberButton
            variant="secondary"
            onClick={() => handleResolve('local')}
            disabled={isResolving}
            icon={<Check className="w-4 h-4" />}
          >
            Keep Local
          </CyberButton>
          
          <CyberButton
            variant="secondary"
            onClick={() => handleResolve('server')}
            disabled={isResolving}
            icon={<Check className="w-4 h-4" />}
          >
            Keep Server
          </CyberButton>
          
          <CyberButton
            variant="primary"
            onClick={() => handleResolve('merge')}
            disabled={isResolving}
            glow
            icon={<GitMerge className="w-4 h-4" />}
          >
            {isResolving && selectedResolution === 'merge' ? 'Merging...' : 'Merge'}
          </CyberButton>
        </div>
      </div>
    </div>
  )
}

export default ConflictDialog
