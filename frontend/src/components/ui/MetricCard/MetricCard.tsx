import React, { forwardRef, useImperativeHandle, useState, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Info,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';

import type {
  MetricCardProps,
  MetricCardRef,
  Metric,
  MetricStatus,
  MetricTrend,
  MetricValueType,
  MetricFormatters,
  defaultStatusColors,
} from './MetricCard.types';

/**
 * Default value formatters
 */
const formatters: MetricFormatters = {
  formatNumber: (value: number, precision = 0): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  },

  formatPercentage: (value: number, precision = 1): string => {
    return `${formatters.formatNumber(value, precision)}%`;
  },

  formatBytes: (bytes: number, precision = 1): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${formatters.formatNumber(bytes / Math.pow(k, i), precision)} ${sizes[i]}`;
  },

  formatDuration: (milliseconds: number): string => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${formatters.formatNumber(milliseconds / 1000, 1)}s`;
    if (milliseconds < 3600000) return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`;
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  },

  formatRate: (value: number, unit = 'ops'): string => {
    return `${formatters.formatNumber(value, 1)} ${unit}/s`;
  },

  formatCurrency: (value: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  },
};

/**
 * Get status icon for a metric
 */
const getStatusIcon = (status: MetricStatus, size = 'w-4 h-4') => {
  switch (status) {
    case 'good':
      return <CheckCircle className={`${size} text-green-500`} />;
    case 'warning':
      return <AlertTriangle className={`${size} text-yellow-500`} />;
    case 'critical':
      return <AlertTriangle className={`${size} text-red-500`} />;
    case 'info':
      return <Info className={`${size} text-blue-500`} />;
    default:
      return <HelpCircle className={`${size} text-gray-500`} />;
  }
};

/**
 * Get trend icon
 */
const getTrendIcon = (trend: MetricTrend, size = 'w-4 h-4') => {
  switch (trend) {
    case 'up':
      return <TrendingUp className={`${size} text-green-500`} />;
    case 'down':
      return <TrendingDown className={`${size} text-red-500`} />;
    case 'stable':
      return <Minus className={`${size} text-gray-500`} />;
    default:
      return null;
  }
};

/**
 * Get status colors
 */
const getStatusColors = (status: MetricStatus): string => {
  switch (status) {
    case 'good':
      return 'border-green-200 bg-green-50';
    case 'warning':
      return 'border-yellow-200 bg-yellow-50';
    case 'critical':
      return 'border-red-200 bg-red-50';
    case 'info':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-white';
  }
};

/**
 * Format metric value based on type
 */
const formatMetricValue = (
  value: number | string,
  type: MetricValueType,
  unit?: string,
  customFormatter?: MetricCardProps['formatValue']
): string => {
  if (customFormatter) {
    return customFormatter(value, type, unit);
  }

  if (typeof value === 'string') {
    return value;
  }

  switch (type) {
    case 'percentage':
      return formatters.formatPercentage(value);
    case 'bytes':
      return formatters.formatBytes(value);
    case 'duration':
      return formatters.formatDuration(value);
    case 'rate':
      return formatters.formatRate(value, unit);
    case 'currency':
      return formatters.formatCurrency(value, unit);
    case 'count':
      return formatters.formatNumber(value, 0);
    case 'number':
    default:
      return formatters.formatNumber(value, unit ? 2 : 0) + (unit ? ` ${unit}` : '');
  }
};

/**
 * MetricCard - Data display component with trends and status indicators
 * 
 * A versatile component for displaying key performance metrics with visual
 * indicators, trend information, and status awareness. Perfect for dashboards
 * and monitoring interfaces.
 */
export const MetricCard = forwardRef<MetricCardRef, MetricCardProps>(
  (
    {
      metric,
      size = 'md',
      layout = 'default',
      showTrend = true,
      showTrendChart = false,
      showLastUpdated = false,
      showComparison = false,
      animated = true,
      clickable = false,
      loading = false,
      formatValue,
      formatTrend,
      onClick,
      onHover,
      className,
      testId = 'metric-card',
    },
    ref,
  ) => {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Memoized formatted value
    const formattedValue = useMemo(() => {
      if (loading || metric.loading) return '---';
      if (metric.error) return 'Error';
      return formatMetricValue(metric.value, metric.type, metric.unit, formatValue);
    }, [metric.value, metric.type, metric.unit, metric.loading, metric.error, loading, formatValue]);

    // Memoized trend information
    const trendInfo = useMemo(() => {
      if (!showTrend || !metric.trend) return null;

      const percentage = metric.trendPercentage ? 
        formatters.formatNumber(Math.abs(metric.trendPercentage), 1) : '';

      if (formatTrend) {
        return formatTrend(metric.trend, metric.trendPercentage);
      }

      switch (metric.trend) {
        case 'up':
          return percentage ? `+${percentage}%` : 'Trending up';
        case 'down':
          return percentage ? `-${percentage}%` : 'Trending down';
        case 'stable':
          return 'Stable';
        default:
          return '';
      }
    }, [showTrend, metric.trend, metric.trendPercentage, formatTrend]);

    // Imperative API
    useImperativeHandle(ref, () => ({
      getMetric: () => metric,
      updateValue: (value: number | string) => {
        // This would typically trigger a re-render with new data
        // Implementation depends on parent state management
      },
      refresh: () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
      },
      focus: () => {
        // Focus implementation for clickable cards
      },
    }), [metric]);

    // Event handlers
    const handleClick = useCallback(() => {
      if (clickable && !loading && !metric.loading && onClick) {
        onClick(metric);
      }
    }, [clickable, loading, metric, onClick]);

    const handleHover = useCallback(() => {
      if (onHover) {
        onHover(metric);
      }
    }, [metric, onHover]);

    // Size-based classes
    const sizeClasses = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    };

    const valueSizeClasses = {
      sm: 'text-lg',
      md: 'text-2xl',
      lg: 'text-3xl',
      xl: 'text-4xl',
    };

    const iconSizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      xl: 'w-8 h-8',
    };

    // Card classes
    const cardClasses = clsx(
      'border rounded-lg transition-all duration-200',
      sizeClasses[size],
      getStatusColors(metric.status),
      clickable && 'cursor-pointer hover:shadow-md hover:scale-105',
      animated && 'transition-all duration-300',
      isRefreshing && 'animate-pulse',
      (loading || metric.loading) && 'opacity-75',
      className,
    );

    // Render simple sparkline chart
    const renderSparkline = () => {
      if (!showTrendChart || !metric.trendData || metric.trendData.length < 2) {
        return null;
      }

      const points = metric.trendData;
      const maxValue = Math.max(...points.map(p => typeof p.value === 'number' ? p.value : 0));
      const minValue = Math.min(...points.map(p => typeof p.value === 'number' ? p.value : 0));
      const range = maxValue - minValue || 1;

      const width = 60;
      const height = 20;
      const pathData = points
        .map((point, index) => {
          const x = (index / (points.length - 1)) * width;
          const y = height - (((typeof point.value === 'number' ? point.value : 0) - minValue) / range) * height;
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

      return (
        <div className="flex items-center justify-end">
          <svg width={width} height={height} className="overflow-visible">
            <path
              d={pathData}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={clsx(
                metric.trend === 'up' && 'text-green-500',
                metric.trend === 'down' && 'text-red-500',
                metric.trend === 'stable' && 'text-gray-500',
              )}
            />
          </svg>
        </div>
      );
    };

    return (
      <div
        className={cardClasses}
        onClick={handleClick}
        onMouseEnter={handleHover}
        data-testid={testId}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
      >
        {layout === 'compact' ? (
          // Compact layout
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {metric.icon && (
                <div className={iconSizeClasses[size]}>
                  {metric.icon}
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-gray-700">
                  {metric.label}
                </div>
                <div className={clsx('font-bold', valueSizeClasses[size])}>
                  {formattedValue}
                </div>
              </div>
            </div>
            {showTrend && metric.trend && (
              <div className="flex items-center gap-1">
                {getTrendIcon(metric.trend, iconSizeClasses[size])}
                {trendInfo && (
                  <span className="text-sm text-gray-600">{trendInfo}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          // Default/detailed layout
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {metric.icon && (
                  <div className={iconSizeClasses[size]}>
                    {metric.icon}
                  </div>
                )}
                <h3 className="text-sm font-medium text-gray-700">
                  {metric.label}
                </h3>
              </div>
              {getStatusIcon(metric.status, iconSizeClasses[size])}
            </div>

            {/* Value */}
            <div className="flex items-baseline justify-between">
              <div className={clsx(
                'font-bold',
                valueSizeClasses[size],
                metric.status === 'critical' && 'text-red-600',
                metric.status === 'warning' && 'text-yellow-600',
                metric.status === 'good' && 'text-green-600',
              )}>
                {formattedValue}
              </div>
              {showTrendChart && renderSparkline()}
            </div>

            {/* Trend and additional info */}
            {(showTrend || showComparison || showLastUpdated) && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {showTrend && metric.trend && (
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend, 'w-3 h-3')}
                      {trendInfo && <span>{trendInfo}</span>}
                    </div>
                  )}
                  {showComparison && metric.previousValue && (
                    <div className="text-xs">
                      vs {formatMetricValue(metric.previousValue, metric.type, metric.unit, formatValue)}
                    </div>
                  )}
                </div>
                {showLastUpdated && metric.lastUpdated && (
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {metric.lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {layout === 'detailed' && metric.description && (
              <div className="text-xs text-gray-500 mt-2">
                {metric.description}
              </div>
            )}

            {/* Error state */}
            {metric.error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {metric.error}
              </div>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {(loading || metric.loading) && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  },
);

MetricCard.displayName = 'MetricCard';