import type { ReactNode } from 'react';
import type { ProcessTimelinePhase } from '../../shared/ProcessTimeline/ProcessTimeline.types';
import type { PerformanceMetric } from '../../shared/PerformanceDashboard/PerformanceDashboard.types';
import type { ErrorSummaryItem } from '../../shared/ErrorSummary/ErrorSummary.types';

/**
 * Scan status enumeration
 */
export type ScanStatus =
  | 'preparing'
  | 'indexing'
  | 'analyzing'
  | 'generating'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'failed';

/**
 * Modal tab types
 */
export type ScanProgressTab = 'overview' | 'performance' | 'errors' | 'details';

/**
 * Scan phase information
 */
export interface ScanPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  details?: {
    filesProcessed?: number;
    totalFiles?: number;
    currentFile?: string;
    throughput?: number;
    errorCount?: number;
  };
}

/**
 * Scan statistics
 */
export interface ScanStatistics {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  totalSize: number;
  processedSize: number;
  averageFileSize: number;
  throughput: {
    filesPerSecond: number;
    bytesPerSecond: number;
    currentThroughput: number;
    averageThroughput: number;
  };
  timing: {
    startTime: Date;
    currentTime: Date;
    estimatedEndTime?: Date;
    elapsedTime: number;
    remainingTime?: number;
  };
}

/**
 * Scan context information
 */
export interface ScanContext {
  id: string;
  volumeId: string;
  volumeName: string;
  volumePath: string;
  scanType: 'full' | 'incremental' | 'metadata_only' | 'deep_analysis';
  options: {
    includeHidden: boolean;
    includeSystemFiles: boolean;
    enableMetadataExtraction: boolean;
    enablePreviewGeneration: boolean;
    maxDepth?: number;
    fileExtensions?: string[];
    excludePatterns?: string[];
  };
  user?: {
    id: string;
    name: string;
  };
  trigger: 'manual' | 'scheduled' | 'auto' | 'api';
}

/**
 * Real-time scan data
 */
export interface ScanData {
  context: ScanContext;
  status: ScanStatus;
  phases: ScanPhase[];
  statistics: ScanStatistics;
  currentPhase?: ScanPhase;
  errors: ErrorSummaryItem[];
  warnings: ErrorSummaryItem[];
  performance: PerformanceMetric[];
  logs?: Array<{
    id: string;
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    phase?: string;
    context?: Record<string, any>;
  }>;
}

/**
 * WebSocket connection state
 */
export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
  lastUpdate?: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

/**
 * Modal action handlers
 */
export interface ScanProgressActions {
  onPause?: () => void | Promise<void>;
  onResume?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  onViewDetails?: (scanId: string) => void;
  onDownloadReport?: (scanId: string) => void | Promise<void>;
  onRetryError?: (errorId: string) => void | Promise<void>;
  onAcknowledgeError?: (errorId: string) => void | Promise<void>;
  onDismissError?: (errorId: string) => void | Promise<void>;
}

/**
 * Tab content configuration
 */
export interface TabConfig {
  id: ScanProgressTab;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  disabled?: boolean;
  content: ReactNode;
}

/**
 * Main component props
 */
export interface ScanProgressModalProps {
  /** Whether the modal is open */
  open: boolean;

  /** Current scan data */
  scanData: ScanData;

  /** WebSocket connection state */
  connectionState: WebSocketState;

  /** Action handlers */
  actions: ScanProgressActions;

  /** Active tab */
  activeTab?: ScanProgressTab;

  /** Tab change handler */
  onTabChange?: (tab: ScanProgressTab) => void;

  /** Whether to show advanced details */
  showAdvancedDetails?: boolean;

  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;

  /** Update interval in milliseconds */
  updateInterval?: number;

  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';

  /** Whether the modal is closable */
  closable?: boolean;

  /** Whether to show connection status */
  showConnectionStatus?: boolean;

  /** Custom CSS classes */
  className?: string;

  /** Custom tab configurations */
  customTabs?: TabConfig[];

  /** Whether to auto-close on completion */
  autoCloseOnComplete?: boolean;

  /** Auto-close delay in milliseconds */
  autoCloseDelay?: number;

  /** Custom footer content */
  customFooter?: ReactNode;

  /** Test ID for testing */
  testId?: string;
}

/**
 * Component state interface
 */
export interface ScanProgressModalState {
  activeTab: ScanProgressTab;
  showAdvancedDetails: boolean;
  lastUpdate: Date;
  autoRefresh: boolean;
  refreshInterval: number;
  expandedPhases: Set<string>;
  selectedErrors: Set<string>;
  performanceTimeRange: '1m' | '5m' | '15m' | '1h';
}

/**
 * Hook return type for scan progress management
 */
export interface UseScanProgressReturn {
  scanData: ScanData | null;
  connectionState: WebSocketState;
  actions: ScanProgressActions;
  isLoading: boolean;
  error: string | null;
  connect: (scanId: string) => void;
  disconnect: () => void;
  retry: () => void;
}

/**
 * Default scan data for testing and development
 */
export const createMockScanData = (
  overrides: Partial<ScanData> = {},
): ScanData => ({
  context: {
    id: 'scan-001',
    volumeId: 'vol-001',
    volumeName: 'System Drive',
    volumePath: '/System/Volumes/Data',
    scanType: 'full',
    options: {
      includeHidden: false,
      includeSystemFiles: false,
      enableMetadataExtraction: true,
      enablePreviewGeneration: true,
    },
    trigger: 'manual',
  },
  status: 'indexing',
  phases: [
    {
      id: 'prepare',
      name: 'Preparation',
      description: 'Preparing scan configuration and validating access',
      status: 'completed',
      startTime: new Date(Date.now() - 300000),
      endTime: new Date(Date.now() - 240000),
      progress: 100,
      actualDuration: 60000,
    },
    {
      id: 'index',
      name: 'Indexing',
      description: 'Scanning filesystem and building file index',
      status: 'active',
      startTime: new Date(Date.now() - 240000),
      progress: 45,
      estimatedDuration: 180000,
      details: {
        filesProcessed: 4500,
        totalFiles: 10000,
        currentFile: '/Users/docs/important.pdf',
        throughput: 25.5,
        errorCount: 3,
      },
    },
    {
      id: 'analyze',
      name: 'Analysis',
      description: 'Extracting metadata and generating previews',
      status: 'pending',
      estimatedDuration: 120000,
    },
    {
      id: 'finalize',
      name: 'Finalization',
      description: 'Finalizing scan results and updating database',
      status: 'pending',
      estimatedDuration: 30000,
    },
  ],
  statistics: {
    totalFiles: 10000,
    processedFiles: 4500,
    skippedFiles: 150,
    errorFiles: 3,
    totalSize: 2147483648, // 2GB
    processedSize: 966367641, // ~900MB
    averageFileSize: 214748,
    throughput: {
      filesPerSecond: 25.5,
      bytesPerSecond: 5468006, // ~5.2MB/s
      currentThroughput: 28.2,
      averageThroughput: 25.5,
    },
    timing: {
      startTime: new Date(Date.now() - 300000),
      currentTime: new Date(),
      estimatedEndTime: new Date(Date.now() + 330000),
      elapsedTime: 300000,
      remainingTime: 330000,
    },
  },
  errors: [],
  warnings: [],
  performance: [],
  ...overrides,
});
