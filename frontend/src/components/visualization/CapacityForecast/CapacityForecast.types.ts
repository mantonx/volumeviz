export interface ForecastDataPoint {
  timestamp: string;
  date: Date;
  volumeId: string;
  volumeName: string;
  actualSize?: number; // Historical data points have actual size
  predictedSize: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  predictionModel: 'linear' | 'exponential' | 'polynomial' | 'seasonal';
  accuracy: number; // 0-1 confidence score
}

export interface CapacityForecastProps {
  /** Historical data for prediction training */
  historicalData: HistoricalForecastPoint[];

  /** Forecast horizon in days */
  forecastDays?: number;

  /** Prediction model to use */
  model?: 'auto' | 'linear' | 'exponential' | 'polynomial' | 'seasonal';

  /** Selected volumes to forecast */
  selectedVolumes?: string[];

  /** Whether to show confidence intervals */
  showConfidence?: boolean;

  /** Whether to show capacity thresholds */
  showThresholds?: boolean;

  /** Storage capacity limits for warnings */
  capacityLimits?: Record<string, number>; // volumeId -> max capacity in bytes

  /** Whether to show prediction accuracy metrics */
  showAccuracy?: boolean;

  /** Chart height in pixels */
  height?: number;

  /** Whether to enable interactive features */
  interactive?: boolean;

  /** Callback when forecast period changes */
  onForecastPeriodChange?: (days: number) => void;

  /** Callback when model changes */
  onModelChange?: (model: string) => void;

  /** Callback when capacity alert is triggered */
  onCapacityAlert?: (alert: CapacityAlert) => void;

  /** Custom CSS class */
  className?: string;
}

export interface HistoricalForecastPoint {
  timestamp: string;
  date: Date;
  volumeId: string;
  volumeName: string;
  size: number;
  growthRate: number;
}

export interface PredictionModel {
  type: 'linear' | 'exponential' | 'polynomial' | 'seasonal';
  parameters: Record<string, number>;
  accuracy: number; // R-squared
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  description: string;
}

export interface ForecastSummary {
  volumeId: string;
  volumeName: string;
  currentSize: number;
  forecastSize30d: number;
  forecastSize90d: number;
  forecastSize365d: number;
  model: PredictionModel;
  growthTrend:
    | 'linear'
    | 'exponential'
    | 'logarithmic'
    | 'declining'
    | 'volatile';
  capacityAlert?: CapacityAlert;
  timeToCapacity?: number; // days until reaching capacity limit
}

export interface CapacityAlert {
  volumeId: string;
  volumeName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type:
    | 'approaching_limit'
    | 'exceeding_limit'
    | 'rapid_growth'
    | 'unusual_pattern';
  message: string;
  threshold: number;
  predicted_date: Date;
  recommended_action: string;
}

export interface ModelPerformance {
  model: string;
  accuracy: number;
  mae: number;
  rmse: number;
  aic: number; // Akaike Information Criterion
  bic: number; // Bayesian Information Criterion
  suitable_for: string[];
}

export const DEFAULT_MODELS: ModelPerformance[] = [
  {
    model: 'linear',
    accuracy: 0.0,
    mae: 0,
    rmse: 0,
    aic: 0,
    bic: 0,
    suitable_for: ['steady growth', 'consistent patterns'],
  },
  {
    model: 'exponential',
    accuracy: 0.0,
    mae: 0,
    rmse: 0,
    aic: 0,
    bic: 0,
    suitable_for: ['accelerating growth', 'compound changes'],
  },
  {
    model: 'polynomial',
    accuracy: 0.0,
    mae: 0,
    rmse: 0,
    aic: 0,
    bic: 0,
    suitable_for: ['complex trends', 'changing growth rates'],
  },
  {
    model: 'seasonal',
    accuracy: 0.0,
    mae: 0,
    rmse: 0,
    aic: 0,
    bic: 0,
    suitable_for: ['cyclical patterns', 'seasonal data'],
  },
];

export interface ForecastConfiguration {
  horizon: number; // days
  confidence_level: number; // 0.95 for 95% confidence interval
  min_data_points: number; // minimum historical points needed
  update_frequency: 'daily' | 'weekly' | 'monthly';
  alert_thresholds: {
    time_to_capacity: number; // days warning threshold
    growth_rate_multiplier: number; // alert if rate > multiplier * average
    accuracy_minimum: number; // minimum model accuracy to trust
  };
}
