import type { HTMLAttributes, ReactNode } from 'react';
import type { ProgressBarProps } from '../../ui/ProgressBar';
import type { StatusBadgeProps } from '../../ui/StatusBadge';

export interface PerformanceMetric {
  /** Unique identifier for the metric */
  id: string;
  /** Display label for the metric */
  label: string;
  /** Current value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Optional description */
  description?: string;
  /** Metric type for styling and behavior */
  type:
    | 'throughput'
    | 'latency'
    | 'error_rate'
    | 'resource'
    | 'count'
    | 'custom';
  /** Status based on thresholds */
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'unknown';
  /** Previous value for trend calculation */
  previousValue?: number;
  /** Target or expected value */
  target?: number;
  /** Threshold configuration */
  thresholds?: {
    excellent?: number;
    good?: number;
    warning?: number;
    critical?: number;
  };
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Icon for the metric */
  icon?: ReactNode;
  /** Timestamp of last update */
  lastUpdated?: Date;
  /** Whether higher values are better */
  higherIsBetter?: boolean;
  /** Format configuration */
  format?: {
    decimals?: number;
    showUnit?: boolean;
    showTrend?: boolean;
    showProgress?: boolean;
  };
}

export interface PerformanceDashboardProps {
  /** Array of metrics to display */
  metrics: PerformanceMetric[];
  /** Layout configuration */
  layout?: 'grid' | 'list' | 'compact';
  /** Number of columns for grid layout */
  columns?: 1 | 2 | 3 | 4 | 6;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show trend indicators */
  showTrends?: boolean;
  /** Whether to show progress bars for metrics with targets */
  showProgress?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to animate value changes */
  animated?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Whether dashboard is currently updating */
  isLoading?: boolean;
  /** Error state */
  error?: string;
  /** Custom metric click handler */
  onMetricClick?: (metric: PerformanceMetric) => void;
  /** Custom refresh handler */
  onRefresh?: () => void;
  /** Custom metric filter */
  filter?: (metric: PerformanceMetric) => boolean;
  /** Custom sort function */
  sortBy?: (a: PerformanceMetric, b: PerformanceMetric) => number;
  /** Custom CSS class name */
  className?: string;
  /** Additional props passed to the container */
  containerProps?: HTMLAttributes<HTMLDivElement>;
  /** Test ID for testing */
  testId?: string;
}

export interface PerformanceDashboardRef {
  /** Get the dashboard container element */
  getElement: () => HTMLDivElement | null;
  /** Focus a specific metric */
  focusMetric: (metricId: string) => void;
  /** Get metric element by ID */
  getMetricElement: (metricId: string) => HTMLElement | null;
  /** Trigger manual refresh */
  refresh: () => void;
  /** Get current metrics data */
  getMetrics: () => PerformanceMetric[];
}

export type PerformanceDashboardLayout = PerformanceDashboardProps['layout'];
export type PerformanceDashboardSize = PerformanceDashboardProps['size'];
export type PerformanceMetricType = PerformanceMetric['type'];
export type PerformanceMetricStatus = PerformanceMetric['status'];

// Theme configuration
export interface PerformanceDashboardTheme {
  layouts: Record<
    NonNullable<PerformanceDashboardLayout>,
    {
      container: string;
      metric: string;
      spacing: string;
    }
  >;
  sizes: Record<
    NonNullable<PerformanceDashboardSize>,
    {
      padding: string;
      fontSize: string;
      iconSize: string;
      spacing: string;
    }
  >;
  metricTypes: Record<
    PerformanceMetricType,
    {
      icon: ReactNode;
      color: string;
      background: string;
    }
  >;
  statusMappings: Record<
    PerformanceMetricStatus,
    {
      badge: StatusBadgeProps['variant'];
      progress: ProgressBarProps['variant'];
      color: string;
    }
  >;
}

// Scan-specific performance metrics
export interface ScanPerformanceData {
  /** Files processed per second */
  filesPerSecond?: number;
  /** Directories processed per second */
  foldersPerSecond?: number;
  /** Bytes processed per second */
  bytesPerSecond?: number;
  /** Current queue depth */
  queueDepth?: number;
  /** Error rate percentage */
  errorRate?: number;
  /** Memory usage percentage */
  memoryUsage?: number;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Active worker threads */
  activeWorkers?: number;
  /** Total files processed */
  totalFilesProcessed?: number;
  /** Total scan time in seconds */
  totalScanTime?: number;
  /** Current phase */
  currentPhase?: string;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

export const createScanMetrics = (
  data: ScanPerformanceData,
  previousData?: ScanPerformanceData,
): PerformanceMetric[] => {
  const calculateTrend = (
    current: number,
    previous?: number,
  ): 'up' | 'down' | 'stable' => {
    if (!previous || Math.abs(current - previous) < 0.01) return 'stable';
    return current > previous ? 'up' : 'down';
  };

  const calculateStatus = (
    value: number,
    thresholds: {
      excellent: number;
      good: number;
      warning: number;
      critical: number;
    },
    higherIsBetter = true,
  ): PerformanceMetricStatus => {
    if (higherIsBetter) {
      if (value >= thresholds.excellent) return 'excellent';
      if (value >= thresholds.good) return 'good';
      if (value >= thresholds.warning) return 'warning';
      return 'critical';
    } else {
      if (value <= thresholds.excellent) return 'excellent';
      if (value <= thresholds.good) return 'good';
      if (value <= thresholds.warning) return 'warning';
      return 'critical';
    }
  };

  const metrics: PerformanceMetric[] = [];

  // Files per second
  if (data.filesPerSecond !== undefined) {
    metrics.push({
      id: 'files_per_second',
      label: 'Files/sec',
      value: data.filesPerSecond,
      unit: 'files/s',
      type: 'throughput',
      status: calculateStatus(data.filesPerSecond, {
        excellent: 1000,
        good: 500,
        warning: 100,
        critical: 0,
      }),
      previousValue: previousData?.filesPerSecond,
      trend: calculateTrend(data.filesPerSecond, previousData?.filesPerSecond),
      thresholds: { excellent: 1000, good: 500, warning: 100, critical: 0 },
      higherIsBetter: true,
      description: 'File processing throughput',
      lastUpdated: new Date(),
    });
  }

  // Bytes per second
  if (data.bytesPerSecond !== undefined) {
    const mbPerSecond = data.bytesPerSecond / (1024 * 1024);
    metrics.push({
      id: 'bytes_per_second',
      label: 'Throughput',
      value: mbPerSecond,
      unit: 'MB/s',
      type: 'throughput',
      status: calculateStatus(mbPerSecond, {
        excellent: 100,
        good: 50,
        warning: 10,
        critical: 0,
      }),
      previousValue: previousData?.bytesPerSecond
        ? previousData.bytesPerSecond / (1024 * 1024)
        : undefined,
      trend: calculateTrend(
        mbPerSecond,
        previousData?.bytesPerSecond
          ? previousData.bytesPerSecond / (1024 * 1024)
          : undefined,
      ),
      thresholds: { excellent: 100, good: 50, warning: 10, critical: 0 },
      higherIsBetter: true,
      description: 'Data processing throughput',
      lastUpdated: new Date(),
      format: { decimals: 1 },
    });
  }

  // Error rate
  if (data.errorRate !== undefined) {
    metrics.push({
      id: 'error_rate',
      label: 'Error Rate',
      value: data.errorRate,
      unit: '%',
      type: 'error_rate',
      status: calculateStatus(
        data.errorRate,
        {
          excellent: 0.1,
          good: 1,
          warning: 5,
          critical: 10,
        },
        false,
      ),
      previousValue: previousData?.errorRate,
      trend: calculateTrend(data.errorRate, previousData?.errorRate),
      thresholds: { excellent: 0.1, good: 1, warning: 5, critical: 10 },
      higherIsBetter: false,
      description: 'Percentage of failed operations',
      lastUpdated: new Date(),
      format: { decimals: 2 },
    });
  }

  // Memory usage
  if (data.memoryUsage !== undefined) {
    metrics.push({
      id: 'memory_usage',
      label: 'Memory',
      value: data.memoryUsage,
      unit: '%',
      type: 'resource',
      status: calculateStatus(
        data.memoryUsage,
        {
          excellent: 50,
          good: 70,
          warning: 85,
          critical: 95,
        },
        false,
      ),
      previousValue: previousData?.memoryUsage,
      trend: calculateTrend(data.memoryUsage, previousData?.memoryUsage),
      target: 80,
      thresholds: { excellent: 50, good: 70, warning: 85, critical: 95 },
      higherIsBetter: false,
      description: 'System memory utilization',
      lastUpdated: new Date(),
      format: { decimals: 1, showProgress: true },
    });
  }

  // CPU usage
  if (data.cpuUsage !== undefined) {
    metrics.push({
      id: 'cpu_usage',
      label: 'CPU',
      value: data.cpuUsage,
      unit: '%',
      type: 'resource',
      status: calculateStatus(
        data.cpuUsage,
        {
          excellent: 50,
          good: 70,
          warning: 85,
          critical: 95,
        },
        false,
      ),
      previousValue: previousData?.cpuUsage,
      trend: calculateTrend(data.cpuUsage, previousData?.cpuUsage),
      target: 80,
      thresholds: { excellent: 50, good: 70, warning: 85, critical: 95 },
      higherIsBetter: false,
      description: 'System CPU utilization',
      lastUpdated: new Date(),
      format: { decimals: 1, showProgress: true },
    });
  }

  // Queue depth
  if (data.queueDepth !== undefined) {
    metrics.push({
      id: 'queue_depth',
      label: 'Queue',
      value: data.queueDepth,
      unit: 'items',
      type: 'count',
      status: calculateStatus(
        data.queueDepth,
        {
          excellent: 10,
          good: 50,
          warning: 200,
          critical: 1000,
        },
        false,
      ),
      previousValue: previousData?.queueDepth,
      trend: calculateTrend(data.queueDepth, previousData?.queueDepth),
      thresholds: { excellent: 10, good: 50, warning: 200, critical: 1000 },
      higherIsBetter: false,
      description: 'Pending operations in queue',
      lastUpdated: new Date(),
      format: { decimals: 0 },
    });
  }

  // Active workers
  if (data.activeWorkers !== undefined) {
    metrics.push({
      id: 'active_workers',
      label: 'Workers',
      value: data.activeWorkers,
      unit: 'threads',
      type: 'count',
      status: data.activeWorkers > 0 ? 'good' : 'warning',
      previousValue: previousData?.activeWorkers,
      trend: calculateTrend(data.activeWorkers, previousData?.activeWorkers),
      description: 'Active processing threads',
      lastUpdated: new Date(),
      format: { decimals: 0 },
    });
  }

  // Estimated time remaining
  if (data.estimatedTimeRemaining !== undefined) {
    const minutes = Math.floor(data.estimatedTimeRemaining / 60);
    const seconds = data.estimatedTimeRemaining % 60;
    const displayValue = minutes > 0 ? minutes + seconds / 60 : seconds;
    const unit = minutes > 0 ? 'min' : 'sec';

    metrics.push({
      id: 'eta',
      label: 'ETA',
      value: displayValue,
      unit,
      type: 'custom',
      status: 'unknown',
      description: 'Estimated time to completion',
      lastUpdated: new Date(),
      format: { decimals: minutes > 0 ? 1 : 0 },
    });
  }

  return metrics;
};
