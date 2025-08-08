/**
 * Type definitions for auto-refresh hook
 */

export interface AutoRefreshOptions {
  /** Function to call for refreshing data */
  refreshFn: () => Promise<void> | void;
  /** Custom refresh interval (overrides global setting) */
  interval?: number;
  /** Enable adaptive refresh based on user activity */
  adaptive?: boolean;
  /** Minimum interval when adaptive (ms) */
  minInterval?: number;
  /** Maximum interval when adaptive (ms) */
  maxInterval?: number;
  /** Pause refresh when tab is not visible */
  pauseOnHidden?: boolean;
  /** Pause refresh when user is idle */
  pauseOnIdle?: boolean;
  /** Idle timeout in milliseconds */
  idleTimeout?: number;
  /** Enable immediate refresh on focus/activity */
  refreshOnFocus?: boolean;
  /** Maximum number of consecutive errors before pausing */
  maxErrors?: number;
  /** Callback for refresh success */
  onSuccess?: () => void;
  /** Callback for refresh error */
  onError?: (error: Error) => void;
}

export interface AutoRefreshState {
  /** Whether auto-refresh is currently active */
  isActive: boolean;
  /** Whether refresh is currently paused */
  isPaused: boolean;
  /** Reason for pause (if paused) */
  pauseReason: 'disabled' | 'hidden' | 'idle' | 'errors' | 'manual' | null;
  /** Current effective refresh interval */
  currentInterval: number;
  /** Last refresh timestamp */
  lastRefresh: Date | null;
  /** Next scheduled refresh timestamp */
  nextRefresh: Date | null;
  /** Whether refresh is currently in progress */
  isRefreshing: boolean;
  /** Number of consecutive errors */
  errorCount: number;
  /** Last error message */
  lastError: string | null;
  /** User activity state */
  isUserActive: boolean;
  /** Page visibility state */
  isPageVisible: boolean;
}

export interface AutoRefreshReturn extends AutoRefreshState {
  // Controls
  start: () => void;
  stop: () => void;
  refresh: () => Promise<void>;
  pause: () => void;
  resume: () => void;

  // Utilities
  timeUntilNextRefresh: number;
  timeSinceLastRefresh: number | null;
}