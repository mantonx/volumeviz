export interface GrowthRateDataPoint {
  timestamp: string;
  date: Date;
  volumeId: string;
  volumeName: string;
  size: number;
  previousSize: number;
  growthRate: number; // bytes per unit time
  growthPercentage: number; // percentage change
  timespan: number; // time period in hours
  unit: 'hour' | 'day' | 'week' | 'month';
}

export interface GrowthRateChartProps {
  /** Array of growth rate data points */
  data: GrowthRateDataPoint[];
  
  /** Chart display mode */
  mode?: 'absolute' | 'percentage' | 'both';
  
  /** Time unit for rate calculation */
  rateUnit?: 'hour' | 'day' | 'week' | 'month';
  
  /** Chart type for visualization */
  chartType?: 'line' | 'bar' | 'area' | 'combo';
  
  /** Selected volumes to display */
  selectedVolumes?: string[];
  
  /** Whether to show moving average */
  showMovingAverage?: boolean;
  
  /** Moving average period */
  movingAveragePeriod?: number;
  
  /** Whether to show trend lines */
  showTrendLines?: boolean;
  
  /** Whether to highlight positive/negative rates with colors */
  colorByRate?: boolean;
  
  /** Minimum threshold for highlighting significant changes */
  significanceThreshold?: number; // percentage
  
  /** Chart height in pixels */
  height?: number;
  
  /** Whether to show data labels */
  showDataLabels?: boolean;
  
  /** Whether to enable interactive features */
  interactive?: boolean;
  
  /** Callback when time period is selected */
  onTimeSelectionChange?: (startDate: Date, endDate: Date) => void;
  
  /** Callback when volume selection changes */
  onVolumeSelectionChange?: (volumeIds: string[]) => void;
  
  /** Callback when rate unit changes */
  onRateUnitChange?: (unit: string) => void;
  
  /** Custom CSS class */
  className?: string;
}

export interface GrowthRateStats {
  volumeId: string;
  volumeName: string;
  averageGrowthRate: number;
  maxGrowthRate: number;
  minGrowthRate: number;
  volatility: number; // standard deviation
  trend: 'accelerating' | 'decelerating' | 'stable' | 'volatile';
  currentRate: number;
  projectedGrowth24h: number;
  projectedGrowth7d: number;
  projectedGrowth30d: number;
}

export interface RateThreshold {
  label: string;
  value: number;
  color: string;
  type: 'warning' | 'critical' | 'info';
}

export const DEFAULT_RATE_THRESHOLDS: RateThreshold[] = [
  {
    label: 'High Growth',
    value: 1000000000, // 1GB/day
    color: '#EF4444',
    type: 'critical',
  },
  {
    label: 'Moderate Growth',
    value: 100000000, // 100MB/day  
    color: '#F59E0B',
    type: 'warning',
  },
  {
    label: 'Low Growth',
    value: 10000000, // 10MB/day
    color: '#10B981',
    type: 'info',
  },
];

export interface MovingAveragePoint {
  timestamp: string;
  value: number;
  period: number;
}

export interface TrendLinePoint {
  timestamp: string;
  value: number;
  slope: number;
  correlation: number;
}