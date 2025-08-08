export interface VolumeComparisonData {
  volumeId: string;
  volumeName: string;
  historicalData: HistoricalComparisonPoint[];
  currentSize: number;
  startSize: number;
  totalGrowth: number;
  averageGrowthRate: number;
  color: string;
}

export interface HistoricalComparisonPoint {
  timestamp: string;
  date: Date;
  size: number;
  fileCount: number;
  directoryCount: number;
  growthRate?: number;
}

export interface VolumeComparisonChartProps {
  /** Array of volume data for comparison */
  data: VolumeComparisonData[];

  /** Chart display type */
  chartType?: 'line' | 'area' | 'bar' | 'normalized';

  /** Time range for comparison */
  timeRange?: '1d' | '1w' | '1m' | '3m' | '6m' | '1y';

  /** Whether to normalize data (show as percentages) */
  normalize?: boolean;

  /** Whether to show baseline comparison */
  showBaseline?: boolean;

  /** Metric to compare */
  metric?: 'size' | 'growth' | 'rate' | 'files';

  /** Whether to enable interactive features */
  interactive?: boolean;

  /** Chart height in pixels */
  height?: number;

  /** Whether to show legend */
  showLegend?: boolean;

  /** Whether to show data points */
  showDataPoints?: boolean;

  /** Maximum number of volumes to compare */
  maxVolumes?: number;

  /** Callback when volume is selected/deselected */
  onVolumeToggle?: (volumeId: string, selected: boolean) => void;

  /** Callback when time range changes */
  onTimeRangeChange?: (range: string) => void;

  /** Callback when metric changes */
  onMetricChange?: (metric: string) => void;

  /** Custom CSS class */
  className?: string;
}

export interface ComparisonMetric {
  key: string;
  label: string;
  unit: string;
  formatter: (value: number) => string;
  color: string;
}

export const COMPARISON_METRICS: Record<string, ComparisonMetric> = {
  size: {
    key: 'size',
    label: 'Volume Size',
    unit: 'bytes',
    formatter: (value: number) =>
      `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`,
    color: '#3B82F6',
  },
  growth: {
    key: 'growth',
    label: 'Total Growth',
    unit: 'bytes',
    formatter: (value: number) => `${(value / 1024 / 1024).toFixed(2)} MB`,
    color: '#10B981',
  },
  rate: {
    key: 'rate',
    label: 'Growth Rate',
    unit: 'bytes/day',
    formatter: (value: number) => `${(value / 1024 / 1024).toFixed(2)} MB/day`,
    color: '#F59E0B',
  },
  files: {
    key: 'files',
    label: 'File Count',
    unit: 'files',
    formatter: (value: number) => value.toLocaleString(),
    color: '#EF4444',
  },
};

export interface ComparisonStatistics {
  volumeId: string;
  volumeName: string;
  currentValue: number;
  startValue: number;
  changeAbsolute: number;
  changePercentage: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ChartConfiguration {
  showGrid: boolean;
  showTooltip: boolean;
  showBrush: boolean;
  enableZoom: boolean;
  syncTooltips: boolean;
  smoothLines: boolean;
}
