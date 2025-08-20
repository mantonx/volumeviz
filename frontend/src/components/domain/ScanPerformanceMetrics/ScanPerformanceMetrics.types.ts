export interface PerformanceMetric {
  timestamp: string;
  value: number;
  unit: string;
  label: string;
}

export interface ScanPerformanceData {
  // Throughput metrics
  filesPerSecond: PerformanceMetric[];
  foldersPerSecond: PerformanceMetric[];
  bytesPerSecond: PerformanceMetric[];
  
  // Resource usage
  cpuUsage: PerformanceMetric[];
  memoryUsage: PerformanceMetric[];
  diskIORead: PerformanceMetric[];
  diskIOWrite: PerformanceMetric[];
  
  // Error rates
  errorRate: PerformanceMetric[];
  retryRate: PerformanceMetric[];
  
  // System load
  systemLoad: PerformanceMetric[];
  queueDepth: PerformanceMetric[];
  
  // Scan-specific metrics
  averageFileSize: PerformanceMetric[];
  largestFiles: Array<{
    path: string;
    size: number;
    processingTime: number;
  }>;
  
  // Time-based breakdown
  phaseDistribution: Array<{
    phase: string;
    duration: number;
    percentage: number;
  }>;
  
  // Comparative metrics
  historicalComparison: {
    currentScan: {
      avgFilesPerSecond: number;
      avgDuration: number;
      errorRate: number;
    };
    previousScans: {
      avgFilesPerSecond: number;
      avgDuration: number;
      errorRate: number;
    };
    improvement: {
      throughput: number; // percentage
      duration: number; // percentage
      errorRate: number; // percentage
    };
  };
}

export interface ScanPerformanceMetricsProps {
  /** Scan ID to show metrics for */
  scanId?: string;
  /** Volume ID for historical comparison */
  volumeId?: string;
  /** Performance data */
  data?: ScanPerformanceData;
  /** Whether to show real-time updates */
  realTime?: boolean;
  /** Time range for metrics */
  timeRange?: '5m' | '15m' | '1h' | '6h' | '24h';
  /** Whether to show comparison with previous scans */
  showComparison?: boolean;
  /** Whether to show detailed charts */
  showCharts?: boolean;
  /** Chart height */
  chartHeight?: number;
  /** Update interval for real-time data (ms) */
  updateInterval?: number;
  /** Event handlers */
  onTimeRangeChange?: (range: string) => void;
  onExportMetrics?: (format: 'csv' | 'json' | 'png') => void;
  /** Custom CSS classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

export interface MetricChartProps {
  title: string;
  data: PerformanceMetric[];
  unit: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  yAxisFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
  className?: string;
}

export interface PerformanceSummaryProps {
  data: ScanPerformanceData;
  timeRange: string;
  className?: string;
}

export interface PerformanceComparisonProps {
  comparison: ScanPerformanceData['historicalComparison'];
  className?: string;
}