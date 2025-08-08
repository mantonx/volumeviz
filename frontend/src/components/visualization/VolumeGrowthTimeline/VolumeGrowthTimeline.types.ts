export interface HistoricalDataPoint {
  timestamp: string;
  date: Date;
  totalSize: number;
  fileCount: number;
  directoryCount: number;
  volumeId: string;
  volumeName: string;
  scanMethod: string;
  growthRate?: number; // bytes per day
  isAnomaly?: boolean;
}

export interface VolumeGrowthTimelineProps {
  /** Historical data points for volume size growth */
  data: HistoricalDataPoint[];

  /** Selected time range for display */
  timeRange?: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

  /** Array of volume IDs to display (if empty, shows all) */
  selectedVolumes?: string[];

  /** Whether to show growth rate indicators */
  showGrowthRate?: boolean;

  /** Whether to show anomaly detection markers */
  showAnomalies?: boolean;

  /** Whether to enable brushing for time selection */
  enableBrushing?: boolean;

  /** Whether to enable zooming and panning */
  enableZoom?: boolean;

  /** Height of the chart in pixels */
  height?: number;

  /** Whether to show data points */
  showDataPoints?: boolean;

  /** Whether to show area fill under lines */
  showArea?: boolean;

  /** Callback when time range changes via brushing */
  onTimeRangeChange?: (startDate: Date, endDate: Date) => void;

  /** Callback when volume selection changes */
  onVolumeSelectionChange?: (volumeIds: string[]) => void;

  /** Callback when data point is clicked */
  onDataPointClick?: (dataPoint: HistoricalDataPoint) => void;

  /** Custom CSS class */
  className?: string;
}

export interface TimeRangeOption {
  label: string;
  value: string;
  days: number;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: '24 Hours', value: '1d', days: 1, granularity: 'hour' },
  { label: '1 Week', value: '1w', days: 7, granularity: 'day' },
  { label: '1 Month', value: '1m', days: 30, granularity: 'day' },
  { label: '3 Months', value: '3m', days: 90, granularity: 'week' },
  { label: '6 Months', value: '6m', days: 180, granularity: 'week' },
  { label: '1 Year', value: '1y', days: 365, granularity: 'month' },
  { label: 'All Time', value: 'all', days: 0, granularity: 'month' },
];

export interface VolumeInfo {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  totalGrowth: number;
  averageGrowthRate: number;
}

export interface ChartAnnotation {
  timestamp: string;
  title: string;
  description: string;
  type: 'scan' | 'container_event' | 'maintenance' | 'anomaly';
  color: string;
}

export interface GrowthTrendData {
  volumeId: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number; // 0-1
  currentRate: number; // bytes per day
  projectedSize: number; // size in 30 days
}
