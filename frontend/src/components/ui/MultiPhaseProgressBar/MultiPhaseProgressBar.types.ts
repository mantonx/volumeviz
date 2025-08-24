import { ReactNode } from 'react';

export interface ScanPhaseProgress {
  id?: number;
  scan_id?: string;
  phase_name: string;
  phase_order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  items_processed: number;
  items_total: number;
  items_successful: number;
  items_failed: number;
  items_skipped?: number;
  bytes_processed: number;
  bytes_total: number;
  items_per_second: number;
  bytes_per_second: number;
  current_item?: string;
  current_depth?: number;
  started_at?: string;
  completed_at?: string;
  estimated_end_time?: string;
  error_message?: string;
  error_count: number;
  duration_ms?: number;
  metadata?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScanProgressError {
  error_type: string;
  error_category: string;
  severity: string;
  component: string;
  operation: string;
  item_path: string;
  item_name: string;
  error_message: string;
  technical_details?: string;
  occurred_at: string;
  retry_count: number;
}

export interface ComprehensiveScanProgress {
  scan_id: string;
  volume_id: string;
  overall_status: 'pending' | 'running' | 'completed' | 'failed';
  overall_progress: number; // 0-100
  started_at?: string;
  completed_at?: string;
  estimated_end_time?: string;
  phases: ScanPhaseProgress[];
  recent_errors?: ScanProgressError[];
  performance_stats?: {
    elapsed_seconds: number;
    estimated_remaining_seconds: number;
    overall_items_per_second: number;
    overall_bytes_per_second: number;
    error_rate: number;
    memory_usage_bytes?: number;
    cpu_usage_percent?: number;
  };
}

export interface MultiPhaseProgressBarProps {
  /** Unique identifier for the volume being scanned */
  volumeId: string;

  /** Optional scan ID if known */
  scanId?: string;

  /** Display size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether to show phase descriptions */
  showPhaseDescriptions?: boolean;

  /** Whether to show detailed progress metrics */
  showDetailedMetrics?: boolean;

  /** Whether to show recent errors */
  showErrors?: boolean;

  /** Whether to animate progress changes */
  animated?: boolean;

  /** Whether to show estimated completion time */
  showEstimatedTime?: boolean;

  /** Compact mode - show only essential information */
  compact?: boolean;

  /** Custom phase labels override */
  phaseLabels?: {
    volume_scan?: string;
    filesystem_indexing?: string;
    media_enrichment?: string;
  };

  /** Custom phase descriptions override */
  phaseDescriptions?: {
    volume_scan?: string;
    filesystem_indexing?: string;
    media_enrichment?: string;
  };

  /** Callback when scan starts */
  onScanStart?: (scanId: string) => void;

  /** Callback when scan completes */
  onScanComplete?: (scanId: string, totalDuration: number) => void;

  /** Callback when scan fails */
  onScanError?: (scanId: string, error: string) => void;

  /** Callback when progress updates */
  onProgressUpdate?: (progress: ComprehensiveScanProgress) => void;

  /** Callback when phase transitions occur */
  onPhaseTransition?: (
    transition: import('../../../utils/phaseTransitionNotifications').PhaseTransition,
  ) => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for testing */
  testId?: string;

  /** Custom header content */
  headerContent?: ReactNode;

  /** Custom footer content */
  footerContent?: ReactNode;
}

export type MultiPhaseProgressBarSize = 'sm' | 'md' | 'lg';
export type ScanStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';
