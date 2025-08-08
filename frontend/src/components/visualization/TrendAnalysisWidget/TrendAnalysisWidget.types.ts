export interface TrendAnalysisData {
  volumeId: string;
  volumeName: string;
  currentSize: number;
  previousSize: number;
  growthRate: number; // bytes per day
  growthPercentage: number; // percentage change
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number; // 0-1 confidence in trend analysis
  timespan: number; // days of data analyzed
  projectedSize30d: number; // projected size in 30 days
  projectedSize90d: number; // projected size in 90 days
  anomalyScore: number; // 0-1 where 1 is most anomalous
  lastUpdated: Date;
}

export interface TrendAnalysisWidgetProps {
  /** Array of volume trend data */
  data: TrendAnalysisData[];
  
  /** Maximum number of volumes to display */
  maxVolumes?: number;
  
  /** Sort order for volumes */
  sortBy?: 'growthRate' | 'growthPercentage' | 'currentSize' | 'anomalyScore' | 'name';
  
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  
  /** Whether to show growth projections */
  showProjections?: boolean;
  
  /** Whether to show anomaly indicators */
  showAnomalies?: boolean;
  
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  
  /** Time period for analysis display */
  analysisPeriod?: '7d' | '30d' | '90d';
  
  /** Callback when volume is selected for detailed view */
  onVolumeSelect?: (volumeId: string) => void;
  
  /** Callback when export is requested */
  onExport?: (format: 'csv' | 'json') => void;
  
  /** Custom CSS class */
  className?: string;
}

export interface TrendIndicator {
  type: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  color: string;
  icon: string;
  label: string;
  description: string;
}

export const TREND_INDICATORS: Record<string, TrendIndicator> = {
  increasing: {
    type: 'increasing',
    color: '#10B981',
    icon: 'trending-up',
    label: 'Growing',
    description: 'Volume size is consistently increasing',
  },
  decreasing: {
    type: 'decreasing',
    color: '#EF4444',
    icon: 'trending-down',
    label: 'Shrinking',
    description: 'Volume size is consistently decreasing',
  },
  stable: {
    type: 'stable',
    color: '#6B7280',
    icon: 'minus',
    label: 'Stable',
    description: 'Volume size remains relatively constant',
  },
  volatile: {
    type: 'volatile',
    color: '#F59E0B',
    icon: 'trending-up-down',
    label: 'Volatile',
    description: 'Volume size shows irregular fluctuations',
  },
};

export interface GrowthPattern {
  pattern: 'linear' | 'exponential' | 'logarithmic' | 'cyclical' | 'irregular';
  correlation: number; // R-squared value
  description: string;
}

export interface AnomalyDetection {
  hasAnomaly: boolean;
  anomalyType: 'spike' | 'drop' | 'pattern_break' | 'none';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
}