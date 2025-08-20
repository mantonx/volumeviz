import type { ReactNode } from 'react';

/**
 * Metric value types
 */
export type MetricValueType = 
  | 'number' 
  | 'percentage' 
  | 'bytes' 
  | 'duration' 
  | 'rate' 
  | 'count'
  | 'currency'
  | 'custom';

/**
 * Metric status levels
 */
export type MetricStatus = 'good' | 'warning' | 'critical' | 'neutral' | 'info';

/**
 * Trend direction
 */
export type MetricTrend = 'up' | 'down' | 'stable' | 'unknown';

/**
 * Card size variants
 */
export type MetricCardSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Card layout variants
 */
export type MetricCardLayout = 'default' | 'compact' | 'detailed' | 'minimal';

/**
 * Metric threshold configuration
 */
export interface MetricThreshold {
  /** Warning threshold value */
  warning?: number;
  /** Critical threshold value */
  critical?: number;
  /** Whether higher values are better (default: false) */
  higherIsBetter?: boolean;
}

/**
 * Metric trend data point
 */
export interface MetricTrendPoint {
  /** Timestamp */
  timestamp: Date | number;
  /** Value at this point */
  value: number;
  /** Optional label */
  label?: string;
}

/**
 * Core metric information
 */
export interface Metric {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Current value */
  value: number | string;
  /** Value type for formatting */
  type: MetricValueType;
  /** Custom unit override */
  unit?: string;
  /** Current status */
  status: MetricStatus;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Trend direction */
  trend?: MetricTrend;
  /** Trend percentage change */
  trendPercentage?: number;
  /** Historical data points */
  trendData?: MetricTrendPoint[];
  /** Previous value for comparison */
  previousValue?: number | string;
  /** Threshold configuration */
  thresholds?: MetricThreshold;
  /** Last updated timestamp */
  lastUpdated?: Date;
  /** Whether this metric is currently loading */
  loading?: boolean;
  /** Error state */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Main component props
 */
export interface MetricCardProps {
  /** Metric data to display */
  metric: Metric;

  /** Card size variant */
  size?: MetricCardSize;

  /** Card layout variant */
  layout?: MetricCardLayout;

  /** Whether to show trend information */
  showTrend?: boolean;

  /** Whether to show trend chart/sparkline */
  showTrendChart?: boolean;

  /** Whether to show last updated time */
  showLastUpdated?: boolean;

  /** Whether to show comparison with previous value */
  showComparison?: boolean;

  /** Whether to animate value changes */
  animated?: boolean;

  /** Whether the card is clickable */
  clickable?: boolean;

  /** Whether to show loading state */
  loading?: boolean;

  /** Custom formatting function for values */
  formatValue?: (value: number | string, type: MetricValueType, unit?: string) => string;

  /** Custom formatting function for trends */
  formatTrend?: (trend: MetricTrend, percentage?: number) => string;

  /** Event handlers */
  onClick?: (metric: Metric) => void;
  onHover?: (metric: Metric) => void;

  /** Custom CSS classes */
  className?: string;

  /** Test ID for testing */
  testId?: string;
}

/**
 * Component ref interface
 */
export interface MetricCardRef {
  /** Get current metric data */
  getMetric(): Metric;
  /** Update metric value */
  updateValue(value: number | string): void;
  /** Trigger refresh animation */
  refresh(): void;
  /** Focus the card */
  focus(): void;
}

/**
 * Status color configuration
 */
export interface MetricStatusConfig {
  good: string;
  warning: string;
  critical: string;
  neutral: string;
  info: string;
}

/**
 * Default status colors
 */
export const defaultStatusColors: MetricStatusConfig = {
  good: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
} as const;

/**
 * Value formatting utilities
 */
export interface MetricFormatters {
  /** Format a numeric value */
  formatNumber: (value: number, precision?: number) => string;
  /** Format a percentage */
  formatPercentage: (value: number, precision?: number) => string;
  /** Format bytes */
  formatBytes: (bytes: number, precision?: number) => string;
  /** Format duration in milliseconds */
  formatDuration: (milliseconds: number) => string;
  /** Format rate (per second) */
  formatRate: (value: number, unit?: string) => string;
  /** Format currency */
  formatCurrency: (value: number, currency?: string) => string;
}

/**
 * Predefined metric configurations
 */
export interface MetricPreset {
  type: MetricValueType;
  thresholds?: MetricThreshold;
  icon?: ReactNode;
  unit?: string;
}

/**
 * Common metric presets
 */
export type MetricPresetType = 
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'network_throughput'
  | 'response_time'
  | 'error_rate'
  | 'scan_progress'
  | 'files_per_second'
  | 'bytes_per_second';

/**
 * Card variant configuration
 */
export interface MetricCardVariant {
  size: MetricCardSize;
  layout: MetricCardLayout;
  showTrend: boolean;
  showTrendChart: boolean;
  showLastUpdated: boolean;
  showComparison: boolean;
  animated: boolean;
}