/**
 * Network Monitor Service
 * Monitors network status and quality for the WebNote application
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Network state information
 */
export interface NetworkState {
  /** Whether the browser reports being online */
  isOnline: boolean
  /** Connection type (wifi, cellular, ethernet, unknown) */
  connectionType: string
  /** Effective connection speed (4g, 3g, 2g, slow-2g) */
  effectiveType: string
  /** Last time the network was online */
  lastOnlineTime: string | null
  /** Last time the network went offline */
  lastOfflineTime: string | null
  /** Current latency in milliseconds */
  latency: number | null
}

/**
 * Network callback function type
 */
export type NetworkCallback = (state: NetworkState) => void

/**
 * Network monitor configuration
 */
export interface NetworkMonitorConfig {
  /** URL to check connectivity */
  checkUrl: string
  /** Interval between connectivity checks in milliseconds */
  checkInterval: number
  /** Number of latency samples to keep for averaging */
  latencySamples: number
  /** Enable debug logging */
  debug: boolean
}

/**
 * Network Information API types (not fully standardized)
 */
interface NetworkInformation extends EventTarget {
  readonly type?: string
  readonly effectiveType?: string
  readonly downlink?: number
  readonly rtt?: number
  readonly saveData?: boolean
  onchange?: EventListener
}

/**
 * Extended Navigator with Network Information API
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
  mozConnection?: NetworkInformation
  webkitConnection?: NetworkInformation
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default network monitor configuration
 */
export const DEFAULT_NETWORK_MONITOR_CONFIG: NetworkMonitorConfig = {
  checkUrl: '/api/health',
  checkInterval: 30000, // 30 seconds
  latencySamples: 5,
  debug: false
}

// ============================================================================
// Network Monitor Class
// ============================================================================

/**
 * Network Monitor Service
 *
 * Monitors network status and quality, providing real-time updates
 * when network conditions change.
 *
 * Features:
 * - Online/offline status detection
 * - Connection type detection (WiFi, cellular, etc.)
 * - Effective connection speed (4g, 3g, 2g)
 * - Latency measurement
 * - Real-time status change notifications
 * - Connectivity verification (actual network access)
 *
 * @example
 * ```typescript
 * const monitor = NetworkMonitor.getInstance()
 *
 * // Subscribe to network state changes
 * const unsubscribe = monitor.subscribe((state) => {
 *   console.log('Network state:', state)
 *   if (!state.isOnline) {
 *     console.log('Network is offline!')
 *   }
 * })
 *
 * // Check current state
 * console.log('Is online:', monitor.isOnline())
 * console.log('Connection type:', monitor.getConnectionType())
 *
 * // Verify actual connectivity
 * const hasAccess = await monitor.checkConnectivity()
 *
 * // Measure latency
 * const latency = await monitor.measureLatency('https://api.example.com/ping')
 *
 * // Unsubscribe when done
 * unsubscribe()
 * ```
 */
export class NetworkMonitor {
  // ============================================================================
  // Singleton Instance
  // ============================================================================

  private static instance: NetworkMonitor | null = null

  // ============================================================================
  // Private Properties
  // ============================================================================

  private config: NetworkMonitorConfig
  private state: NetworkState
  private callbacks: Set<NetworkCallback> = new Set()
  private latencyHistory: number[] = []
  private checkIntervalTimer: NodeJS.Timeout | null = null
  private isCheckingConnectivity = false

  // Network Information API
  private networkInfo: NetworkInformation | null = null

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create a new NetworkMonitor instance
   * @param config - Configuration options
   */
  private constructor(config: Partial<NetworkMonitorConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_MONITOR_CONFIG, ...config }

    // Initialize state
    this.state = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      lastOnlineTime: null,
      lastOfflineTime: null,
      latency: null
    }

    // Initialize network info
    this.initNetworkInfo()

    // Set up event listeners
    this.setupEventListeners()

    // Start periodic checks
    this.startPeriodicChecks()

    this.log('NetworkMonitor initialized')
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  /**
   * Get the singleton instance of NetworkMonitor
   * @param config - Optional configuration (only used on first call)
   * @returns NetworkMonitor instance
   */
  static getInstance(config?: Partial<NetworkMonitorConfig>): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor(config)
    }
    return NetworkMonitor.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (NetworkMonitor.instance) {
      NetworkMonitor.instance.destroy()
      NetworkMonitor.instance = null
    }
  }

  // ============================================================================
  // Public Methods - Status Detection
  // ============================================================================

  /**
   * Check if the browser reports being online
   * @returns Current online status
   */
  isOnline(): boolean {
    return this.state.isOnline
  }

  /**
   * Get the connection type
   * @returns Connection type (wifi, cellular, ethernet, unknown)
   */
  getConnectionType(): string {
    return this.state.connectionType
  }

  /**
   * Get the effective connection type
   * @returns Effective connection speed (4g, 3g, 2g, slow-2g, unknown)
   */
  getEffectiveType(): string {
    return this.state.effectiveType
  }

  /**
   * Get the current network state
   * @returns Current network state
   */
  getState(): NetworkState {
    return { ...this.state }
  }

  // ============================================================================
  // Public Methods - Subscription
  // ============================================================================

  /**
   * Subscribe to network state changes
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: NetworkCallback): () => void {
    this.callbacks.add(callback)

    // Immediately notify with current state
    try {
      callback(this.getState())
    } catch (error) {
      this.log('Error in callback:', error)
    }

    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Unsubscribe from network state changes
   * @param callback - Callback to unsubscribe
   */
  unsubscribe(callback: NetworkCallback): void {
    this.callbacks.delete(callback)
  }

  // ============================================================================
  // Public Methods - Connectivity Check
  // ============================================================================

  /**
   * Check if the network is actually accessible
   * This goes beyond browser's online/offline status
   * @returns Promise that resolves to true if network is accessible
   */
  async checkConnectivity(): Promise<boolean> {
    // Prevent concurrent checks
    if (this.isCheckingConnectivity) {
      return this.state.isOnline
    }

    this.isCheckingConnectivity = true

    try {
      // Try to fetch the check URL
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(this.config.checkUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // For no-cors requests, response.ok might be false
      // but if we get here without error, network is accessible
      return true
    } catch (error) {
      this.log('Connectivity check failed:', error)
      return false
    } finally {
      this.isCheckingConnectivity = false
    }
  }

  /**
   * Measure latency to a specific URL
   * @param url - URL to measure latency to
   * @returns Promise that resolves to latency in milliseconds
   */
  async measureLatency(url: string): Promise<number> {
    const startTime = performance.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const endTime = performance.now()
      const latency = Math.round(endTime - startTime)

      // Update latency history
      this.latencyHistory.push(latency)
      if (this.latencyHistory.length > this.config.latencySamples) {
        this.latencyHistory.shift()
      }

      // Update state
      this.state.latency = latency

      return latency
    } catch (error) {
      this.log('Latency measurement failed:', error)
      throw new Error('Failed to measure latency')
    }
  }

  /**
   * Get the average latency from recent measurements
   * @returns Average latency in milliseconds, or null if no measurements
   */
  getAverageLatency(): number | null {
    if (this.latencyHistory.length === 0) {
      return null
    }

    const sum = this.latencyHistory.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.latencyHistory.length)
  }

  // ============================================================================
  // Private Methods - Initialization
  // ============================================================================

  /**
   * Initialize Network Information API
   */
  private initNetworkInfo(): void {
    if (typeof navigator === 'undefined') {
      return
    }

    const nav = navigator as NavigatorWithConnection
    this.networkInfo = nav.connection || nav.mozConnection || nav.webkitConnection || null

    if (this.networkInfo) {
      // Get initial values
      this.updateConnectionInfo()

      // Listen for changes
      this.networkInfo.addEventListener('change', this.handleConnectionChange.bind(this))
    }
  }

  /**
   * Set up browser event listeners
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') {
      return
    }

    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // Also listen for visibility change to re-check connectivity
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer)
    }

    this.checkIntervalTimer = setInterval(async () => {
      if (this.state.isOnline) {
        // Periodically verify connectivity when online
        const hasAccess = await this.checkConnectivity()
        if (!hasAccess && this.state.isOnline) {
          // Browser says online but we can't reach the network
          this.log('Browser reports online but no actual connectivity')
        }
      }
    }, this.config.checkInterval)
  }

  // ============================================================================
  // Private Methods - Event Handlers
  // ============================================================================

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.log('Browser reports online')

    const now = new Date().toISOString()
    const previousState = this.state.isOnline

    this.state.isOnline = true
    this.state.lastOnlineTime = now

    if (!previousState) {
      this.notifyCallbacks()
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.log('Browser reports offline')

    const now = new Date().toISOString()
    const previousState = this.state.isOnline

    this.state.isOnline = false
    this.state.lastOfflineTime = now
    this.state.latency = null

    if (previousState) {
      this.notifyCallbacks()
    }
  }

  /**
   * Handle Network Information API change event
   */
  private handleConnectionChange(): void {
    this.log('Network connection info changed')
    this.updateConnectionInfo()
    this.notifyCallbacks()
  }

  /**
   * Handle visibility change event
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // Re-check connectivity when page becomes visible
      this.checkConnectivity().then((hasAccess) => {
        const wasOnline = this.state.isOnline
        this.state.isOnline = hasAccess

        if (wasOnline !== hasAccess) {
          if (hasAccess) {
            this.state.lastOnlineTime = new Date().toISOString()
          } else {
            this.state.lastOfflineTime = new Date().toISOString()
          }
          this.notifyCallbacks()
        }
      })
    }
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Update connection info from Network Information API
   */
  private updateConnectionInfo(): void {
    if (!this.networkInfo) {
      return
    }

    // Map connection type
    if (this.networkInfo.type) {
      this.state.connectionType = this.mapConnectionType(this.networkInfo.type)
    }

    // Map effective type
    if (this.networkInfo.effectiveType) {
      this.state.effectiveType = this.networkInfo.effectiveType
    }
  }

  /**
   * Map raw connection type to standardized type
   * @param type - Raw connection type from Network Information API
   * @returns Standardized connection type
   */
  private mapConnectionType(type: string): string {
    const typeMap: Record<string, string> = {
      bluetooth: 'bluetooth',
      cellular: 'cellular',
      ethernet: 'ethernet',
      none: 'none',
      wifi: 'wifi',
      wimax: 'wimax',
      other: 'other',
      unknown: 'unknown'
    }

    return typeMap[type] || 'unknown'
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(): void {
    const state = this.getState()

    this.callbacks.forEach((callback) => {
      try {
        callback(state)
      } catch (error) {
        this.log('Error in callback:', error)
      }
    })
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[NetworkMonitor] ${message}`, ...args)
    }
  }

  // ============================================================================
  // Public Methods - Cleanup
  // ============================================================================

  /**
   * Clean up and destroy the monitor
   */
  destroy(): void {
    // Clear interval timer
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer)
      this.checkIntervalTimer = null
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this))
      window.removeEventListener('offline', this.handleOffline.bind(this))
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    }

    // Remove Network Information API listener
    if (this.networkInfo) {
      this.networkInfo.removeEventListener('change', this.handleConnectionChange.bind(this))
    }

    // Clear callbacks
    this.callbacks.clear()

    // Clear latency history
    this.latencyHistory = []

    this.log('NetworkMonitor destroyed')
  }
}

// ============================================================================
// Exports
// ============================================================================

export default NetworkMonitor
