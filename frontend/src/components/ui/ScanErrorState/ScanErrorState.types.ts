export interface ScanErrorStateProps {
  /** The scan error to display */
  error: any;
  /** Scan context information */
  context?: {
    phase?: string;
    operation?: string;
    volumeName?: string;
    fileName?: string;
    batchInfo?: {
      currentBatch: number;
      totalBatches: number;
      filesInBatch: number;
      batchProgress: number;
    };
  };
  /** Available actions */
  actions?: {
    onRetry?: () => void;
    onSkip?: () => void;
    onPause?: () => void;
    onAbort?: () => void;
    onViewDetails?: () => void;
  };
  /** Whether to show technical details by default */
  showTechnicalDetails?: boolean;
  /** Whether to show suggested actions */
  showActions?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}
