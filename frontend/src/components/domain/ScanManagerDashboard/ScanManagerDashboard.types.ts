export interface ScanOperation {
  scanId: string;
  volumeId: string;
  volumeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  phase?: 'volume_scan' | 'filesystem_indexing' | 'media_enrichment';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  filesScanned?: number;
  foldersScanned?: number;
  filesPerSecond?: number;
  bytesPerSecond?: number;
  errorsCount?: number;
  estimatedRemaining?: number;
}

export interface SystemMetrics {
  totalVolumes: number;
  activeScans: number;
  queuedScans: number;
  completedScans: number;
  failedScans: number;
  totalFilesScanned: number;
  totalFoldersScanned: number;
  averageScanSpeed: number;
  systemLoad?: number;
  memoryUsage?: number;
  diskIORate?: number;
}

export interface ScanManagerDashboardProps {
  scans: ScanOperation[];
  systemMetrics?: SystemMetrics;
  onScanPause?: (scanId: string) => void;
  onScanResume?: (scanId: string) => void;
  onScanStop?: (scanId: string) => void;
  onScanRetry?: (scanId: string) => void;
  onViewScanDetails?: (scanId: string) => void;
  onClearCompleted?: () => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
  className?: string;
  testId?: string;
}
