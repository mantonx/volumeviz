import type { ProcessTimelinePhase } from '../components/shared/ProcessTimeline/ProcessTimeline.types';
import type { PerformanceMetric } from '../components/shared/PerformanceDashboard/PerformanceDashboard.types';
import type { ErrorSummaryItem } from '../components/shared/ErrorSummary/ErrorSummary.types';
import type {
  ScanData,
  ScanPhase,
  ScanStatus,
} from '../components/domain/ScanProgressModal/ScanProgressModal.types';

/**
 * Utility functions for scan data processing
 */
export interface ScanDataUtils {
  /** Calculate overall progress percentage */
  calculateOverallProgress: (scanData: ScanData) => number;

  /** Get current phase information */
  getCurrentPhase: (scanData: ScanData) => ScanPhase | null;

  /** Get next phase information */
  getNextPhase: (scanData: ScanData) => ScanPhase | null;

  /** Calculate estimated completion time */
  getEstimatedCompletion: (scanData: ScanData) => Date | null;

  /** Format scan duration */
  formatDuration: (milliseconds: number) => string;

  /** Format file size */
  formatFileSize: (bytes: number) => string;

  /** Format throughput */
  formatThroughput: (filesPerSecond: number, bytesPerSecond: number) => string;

  /** Check if scan is in terminal state */
  isTerminalState: (status: ScanStatus) => boolean;

  /** Check if scan can be paused */
  canPause: (status: ScanStatus) => boolean;

  /** Check if scan can be resumed */
  canResume: (status: ScanStatus) => boolean;

  /** Check if scan can be cancelled */
  canCancel: (status: ScanStatus) => boolean;

  /** Get status severity level */
  getStatusSeverity: (
    status: ScanStatus,
  ) => 'info' | 'warning' | 'error' | 'success';

  /** Convert scan data to timeline items */
  toTimelineItems: (scanData: ScanData) => ProcessTimelinePhase[];

  /** Convert scan data to performance metrics */
  toPerformanceMetrics: (scanData: ScanData) => PerformanceMetric[];

  /** Filter errors by severity */
  filterErrorsBySeverity: (
    errors: ErrorSummaryItem[],
    severity: ErrorSummaryItem['severity'],
  ) => ErrorSummaryItem[];

  /** Group errors by category */
  groupErrorsByCategory: (
    errors: ErrorSummaryItem[],
  ) => Record<string, ErrorSummaryItem[]>;
}

export const scanDataUtils: ScanDataUtils = {
  calculateOverallProgress: (scanData: ScanData): number => {
    const completedPhases = scanData.phases.filter(
      (p) => p.status === 'completed',
    ).length;
    const totalPhases = scanData.phases.length;
    const currentPhaseProgress = scanData.currentPhase?.progress || 0;

    if (totalPhases === 0) return 0;

    return Math.round(
      ((completedPhases + currentPhaseProgress / 100) / totalPhases) * 100,
    );
  },

  getCurrentPhase: (scanData: ScanData): ScanPhase | null => {
    return scanData.phases.find((p) => p.status === 'active') || null;
  },

  getNextPhase: (scanData: ScanData): ScanPhase | null => {
    const currentIndex = scanData.phases.findIndex(
      (p) => p.status === 'active',
    );
    if (currentIndex === -1)
      return scanData.phases.find((p) => p.status === 'pending') || null;
    return scanData.phases[currentIndex + 1] || null;
  },

  getEstimatedCompletion: (scanData: ScanData): Date | null => {
    const { timing } = scanData.statistics;
    if (!timing.remainingTime) return null;

    return new Date(timing.currentTime.getTime() + timing.remainingTime);
  },

  formatDuration: (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  formatFileSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  },

  formatThroughput: (
    filesPerSecond: number,
    bytesPerSecond: number,
  ): string => {
    const formattedBytes = scanDataUtils.formatFileSize(bytesPerSecond);
    return `${filesPerSecond.toFixed(1)} files/s, ${formattedBytes}/s`;
  },

  isTerminalState: (status: ScanStatus): boolean => {
    return ['completed', 'cancelled', 'failed'].includes(status);
  },

  canPause: (status: ScanStatus): boolean => {
    return ['indexing', 'analyzing', 'generating'].includes(status);
  },

  canResume: (status: ScanStatus): boolean => {
    return status === 'paused';
  },

  canCancel: (status: ScanStatus): boolean => {
    return !scanDataUtils.isTerminalState(status);
  },

  getStatusSeverity: (status: ScanStatus) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'info';
    }
  },

  toTimelineItems: (scanData: ScanData): ProcessTimelinePhase[] => {
    return scanData.phases.map((phase) => ({
      id: phase.id,
      label: phase.name,
      description: phase.description,
      status: phase.status === 'active' ? 'active' : phase.status,
      progress: phase.progress,
      duration: {
        estimated: phase.estimatedDuration
          ? phase.estimatedDuration / 1000
          : undefined,
        actual: phase.actualDuration ? phase.actualDuration / 1000 : undefined,
      },
      timestamps: {
        startedAt: phase.startTime,
        completedAt: phase.endTime,
      },
      metadata: {
        phase: phase.id,
        filesProcessed: phase.details?.filesProcessed,
        totalFiles: phase.details?.totalFiles,
        errorCount: phase.details?.errorCount,
      },
    }));
  },

  toPerformanceMetrics: (scanData: ScanData): PerformanceMetric[] => {
    const { statistics } = scanData;
    const currentTime = statistics.timing.currentTime;

    return [
      {
        id: 'throughput-files',
        label: 'Files/Second',
        value: statistics.throughput.currentThroughput,
        unit: 'files/s',
        type: 'throughput' as const,
        status: 'good' as const,
        lastUpdated: currentTime,
        trend: 'stable' as const,
      },
      {
        id: 'throughput-bytes',
        label: 'Data/Second',
        value: statistics.throughput.bytesPerSecond,
        unit: 'bytes/s',
        type: 'throughput' as const,
        status: 'good' as const,
        lastUpdated: currentTime,
        trend: 'stable' as const,
      },
      {
        id: 'processed-files',
        label: 'Processed Files',
        value: statistics.processedFiles,
        unit: 'files',
        type: 'count' as const,
        status: 'good' as const,
        lastUpdated: currentTime,
        trend: 'up' as const,
      },
      {
        id: 'processed-size',
        label: 'Processed Data',
        value: statistics.processedSize,
        unit: 'bytes',
        type: 'count' as const,
        status: 'good' as const,
        lastUpdated: currentTime,
        trend: 'up' as const,
      },
    ];
  },

  filterErrorsBySeverity: (
    errors: ErrorSummaryItem[],
    severity: ErrorSummaryItem['severity'],
  ): ErrorSummaryItem[] => {
    return errors.filter((error) => error.severity === severity);
  },

  groupErrorsByCategory: (
    errors: ErrorSummaryItem[],
  ): Record<string, ErrorSummaryItem[]> => {
    return errors.reduce(
      (groups, error) => {
        const category = error.category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(error);
        return groups;
      },
      {} as Record<string, ErrorSummaryItem[]>,
    );
  },
};
