export interface ScanHistoryEntry {
  id: string;
  scanId: string;
  volumeId: string;
  volumeName: string;
  status: 'completed' | 'failed' | 'cancelled';
  
  // Timing information
  startedAt: string;
  completedAt: string;
  duration: number; // milliseconds
  
  // Progress metrics
  totalFiles: number;
  totalFolders: number;
  totalBytes: number;
  filesScanned: number;
  foldersScanned: number;
  bytesScanned: number;
  
  // Performance metrics
  averageFilesPerSecond: number;
  averageBytesPerSecond: number;
  peakFilesPerSecond: number;
  peakBytesPerSecond: number;
  
  // Phase breakdown
  phases: ScanPhaseMetrics[];
  
  // Error information (if failed)
  errors?: ScanError[];
  errorCount: number;
  
  // Additional metadata
  scanMethod: 'manual' | 'scheduled' | 'triggered';
  scanTrigger?: string; // e.g., 'user_action', 'file_change', 'schedule'
  scanVersion: string;
  
  // Results
  newFilesFound: number;
  modifiedFilesFound: number;
  deletedFilesFound: number;
  duplicatesFound?: number;
  
  // Resource usage
  peakMemoryUsage?: number; // MB
  averageCpuUsage?: number; // percentage
  diskIOBytes?: number;
}

export interface ScanPhaseMetrics {
  phase: 'volume_scan' | 'filesystem_indexing' | 'media_enrichment';
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  filesProcessed: number;
  foldersProcessed: number;
  bytesProcessed: number;
  errorsEncountered: number;
  averageProcessingRate: number; // files per second
}

export interface ScanError {
  id: string;
  timestamp: string;
  phase: string;
  path: string;
  errorType: 'permission_denied' | 'file_not_found' | 'io_error' | 'timeout' | 'unknown';
  errorMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  retryCount?: number;
}

export interface ScanHistoryFilter {
  volumeId?: string;
  status?: ScanHistoryEntry['status'];
  startDate?: Date;
  endDate?: Date;
  minDuration?: number;
  maxDuration?: number;
  hasErrors?: boolean;
  scanMethod?: ScanHistoryEntry['scanMethod'];
}

export interface ScanHistoryStats {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  cancelledScans: number;
  averageDuration: number;
  totalFilesScanned: number;
  totalBytesScanned: number;
  averageFilesPerSecond: number;
  averageBytesPerSecond: number;
  mostScannedVolume: {
    volumeId: string;
    volumeName: string;
    scanCount: number;
  };
  recentTrends: {
    period: 'day' | 'week' | 'month';
    scanCounts: number[];
    performanceMetrics: {
      averageFilesPerSecond: number[];
      averageDuration: number[];
    };
  };
}

export interface ScanHistoryResponse {
  entries: ScanHistoryEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  stats: ScanHistoryStats;
}