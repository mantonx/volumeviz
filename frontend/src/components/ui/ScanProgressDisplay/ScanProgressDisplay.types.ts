export interface ScanPhase {
  id: string;
  name: string;
  label: string;
  description: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  itemsProcessed: number;
  itemsTotal: number;
  bytesProcessed: number;
  bytesTotal: number;
  itemsPerSecond: number;
  bytesPerSecond: number;
  currentItem?: string;
  errorMessage?: string;
  errorCount: number;
  startedAt?: string;
  completedAt?: string;
  estimatedEndTime?: string;
}

export interface ScanPerformanceStats {
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  overallItemsPerSecond: number;
  overallBytesPerSecond: number;
  errorRate: number;
  memoryUsageBytes?: number;
  cpuUsagePercent?: number;
}

export interface ScanProgressData {
  scanId: string;
  volumeId: string;
  overallStatus: 'pending' | 'running' | 'completed' | 'failed';
  overallProgress: number; // 0-100
  phases: ScanPhase[];
  performanceStats?: ScanPerformanceStats;
  startedAt?: string;
  completedAt?: string;
  estimatedEndTime?: string;
  recentErrors?: Array<{
    itemName: string;
    errorMessage: string;
    occurredAt: string;
  }>;
}

export interface ScanProgressDisplayProps {
  /** Unique identifier for the volume being scanned */
  volumeId: string;

  /** Optional scan ID if known */
  scanId?: string;

  /** Display variant - 'border' for subtle bottom border, 'panel' for full detailed view */
  variant?: 'border' | 'panel';

  /** Display size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether to show performance statistics (panel mode only) */
  showPerformanceStats?: boolean;

  /** Whether to show recent errors (panel mode only) */
  showErrors?: boolean;

  /** Whether to animate progress changes */
  animated?: boolean;

  /** Whether to show estimated completion time (panel mode only) */
  showEstimatedTime?: boolean;

  /** Compact mode - reduced spacing and smaller text (panel mode only) */
  compact?: boolean;

  /** Height of the progress border in pixels (border mode only) */
  borderHeight?: number;

  /** Whether to show a subtle progress percentage text in border mode */
  showBorderProgress?: boolean;

  /** Callback when scan starts */
  onScanStart?: (scanId: string) => void;

  /** Callback when scan completes */
  onScanComplete?: (scanId: string, totalDuration: number) => void;

  /** Callback when scan fails */
  onScanError?: (scanId: string, error: string) => void;

  /** Callback when progress updates */
  onProgressUpdate?: (progress: ScanProgressData) => void;

  /** Auto-expand behavior for new scans */
  autoExpandOnScanStart?: {
    /** Whether to auto-expand when scan starts */
    enabled: boolean;
    /** Duration in ms to keep panel open before auto-closing (0 = don't auto-close) */
    autoCloseDuration?: number;
    /** Whether to show toast notification when scan starts */
    showToast?: boolean;
  };

  /** Manual expand/collapse control */
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for testing */
  testId?: string;
}

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// Phase configuration for UI display
export interface PhaseConfig {
  name: string;
  label: string;
  description: string;
  color: {
    pending: string;
    running: string;
    completed: string;
    failed: string;
  };
  weight: number; // Contribution to overall progress (0-1)
}

// Component interaction patterns
export type ScanInteractionMode =
  | 'scan-triggered' // Auto-expand with toast, then auto-close after delay
  | 'view-only' // Manual expand/collapse, no toast, real-time updates
  | 'border-only'; // Always collapsed, subtle progress border only

export interface ScanProgressAction {
  type: 'start-scan' | 'view-progress' | 'close-panel';
  timestamp: number;
}
