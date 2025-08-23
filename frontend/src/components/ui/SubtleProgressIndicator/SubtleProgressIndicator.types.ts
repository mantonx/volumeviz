export interface SubtleProgressIndicatorProps {
  /** Volume ID to track progress for */
  volumeId: string;
  
  /** Whether to show the indicator */
  show?: boolean;
  
  /** Progress value (0-100) - if provided, uses this instead of WebSocket */
  progress?: number;
  
  /** Current scan status */
  status?: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  
  /** Additional CSS classes */
  className?: string;
  
  /** Test ID for testing */
  testId?: string;
  
  /** Animation duration in milliseconds */
  animationDuration?: number;
  
  /** Whether to show phase-based progress (3 segments) */
  showPhases?: boolean;
  
  /** Callback when progress updates */
  onProgressUpdate?: (progress: number, status: string) => void;
  
  /** Callback when scan completes */
  onComplete?: () => void;
  
  /** Render as table row instead of absolute positioned div */
  asTableRow?: boolean;
}

export interface ScanProgressState {
  overall_progress: number;
  overall_status: 'pending' | 'running' | 'completed' | 'failed';
  phases?: Array<{
    phase_name: string;
    phase_order: number;
    status: string;
    progress: number;
  }>;
}