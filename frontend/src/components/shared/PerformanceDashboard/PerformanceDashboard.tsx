import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from 'react';
import { clsx } from 'clsx';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  AlertTriangle,
  Clock,
  HardDrive,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { ProgressBar } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import type {
  PerformanceDashboardProps,
  PerformanceDashboardRef,
  PerformanceMetric,
} from './PerformanceDashboard.types';

/**
 * PerformanceDashboard Component
 *
 * A comprehensive dashboard for displaying performance metrics with real-time updates,
 * trend indicators, and status visualization. Combines ProgressBar and StatusBadge
 * components to provide detailed performance monitoring capabilities.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <PerformanceDashboard
 *   metrics={performanceMetrics}
 *   layout="grid"
 *   showTrends
 *   showProgress
 * />
 * ```
 *
 * @example
 * Compact dashboard with refresh:
 * ```tsx
 * <PerformanceDashboard
 *   metrics={metrics}
 *   layout="compact"
 *   size="sm"
 *   refreshInterval={5000}
 *   onRefresh={handleRefresh}
 * />
 * ```
 *
 * @example
 * List layout with filtering:
 * ```tsx
 * <PerformanceDashboard
 *   metrics={metrics}
 *   layout="list"
 *   filter={(metric) => metric.type === 'throughput'}
 *   onMetricClick={handleMetricClick}
 * />
 * ```
 */
export const PerformanceDashboard = forwardRef<
  PerformanceDashboardRef,
  PerformanceDashboardProps
>(
  (
    {
      metrics,
      layout = 'grid',
      columns = 3,
      size = 'md',
      showTrends = true,
      showProgress = true,
      showTimestamps = false,
      animated = true,
      refreshInterval,
      isLoading = false,
      error,
      onMetricClick,
      onRefresh,
      filter,
      sortBy,
      className,
      containerProps,
      testId = 'performance-dashboard',
      ...props
    },
    ref,
  ) => {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const metricRefs = useRef<Map<string, HTMLElement>>(new Map());
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Auto-refresh functionality
    useEffect(() => {
      if (!refreshInterval || !onRefresh) return;

      const interval = setInterval(() => {
        onRefresh();
        setLastRefresh(new Date());
      }, refreshInterval);

      return () => clearInterval(interval);
    }, [refreshInterval, onRefresh]);

    const focusMetric = useCallback((metricId: string) => {
      const element = metricRefs.current.get(metricId);
      element?.focus();
    }, []);

    const getMetricElement = useCallback((metricId: string) => {
      return metricRefs.current.get(metricId) || null;
    }, []);

    const refresh = useCallback(() => {
      onRefresh?.();
      setLastRefresh(new Date());
    }, [onRefresh]);

    const getMetrics = useCallback(() => {
      return processedMetrics;
    }, []);

    useImperativeHandle(ref, () => ({
      getElement: () => dashboardRef.current,
      focusMetric,
      getMetricElement,
      refresh,
      getMetrics,
    }));

    // Process metrics with filtering and sorting
    const processedMetrics = useMemo(() => {
      let processed = [...metrics];

      if (filter) {
        processed = processed.filter(filter);
      }

      if (sortBy) {
        processed.sort(sortBy);
      } else {
        // Default sorting: critical first, then by type
        processed.sort((a, b) => {
          const statusOrder = {
            critical: 0,
            warning: 1,
            good: 2,
            excellent: 3,
            unknown: 4,
          };
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;
          return a.type.localeCompare(b.type);
        });
      }

      return processed;
    }, [metrics, filter, sortBy]);

    // Get icon for metric type
    const getMetricIcon = useCallback((metric: PerformanceMetric) => {
      if (metric.icon) return metric.icon;

      switch (metric.type) {
        case 'throughput':
          return <Activity className="w-full h-full" />;
        case 'latency':
          return <Clock className="w-full h-full" />;
        case 'error_rate':
          return <AlertTriangle className="w-full h-full" />;
        case 'resource':
          return metric.id.includes('memory') ? (
            <HardDrive className="w-full h-full" />
          ) : (
            <Cpu className="w-full h-full" />
          );
        case 'count':
          return <Zap className="w-full h-full" />;
        default:
          return <Activity className="w-full h-full" />;
      }
    }, []);

    // Get trend icon
    const getTrendIcon = useCallback((trend: string) => {
      switch (trend) {
        case 'up':
          return <TrendingUp className="w-4 h-4" />;
        case 'down':
          return <TrendingDown className="w-4 h-4" />;
        default:
          return <Minus className="w-4 h-4" />;
      }
    }, []);

    // Format metric value
    const formatValue = useCallback((metric: PerformanceMetric) => {
      const decimals = metric.format?.decimals ?? (metric.value < 10 ? 1 : 0);
      const formattedValue = metric.value.toFixed(decimals);
      const unit = metric.format?.showUnit !== false ? metric.unit : '';
      return `${formattedValue}${unit ? ` ${unit}` : ''}`;
    }, []);

    // Get status variant for badges and progress bars
    const getStatusVariant = useCallback(
      (status: PerformanceMetric['status']) => {
        switch (status) {
          case 'excellent':
            return 'success';
          case 'good':
            return 'info';
          case 'warning':
            return 'warning';
          case 'critical':
            return 'error';
          default:
            return 'default';
        }
      },
      [],
    );

    // Size classes
    const sizeClasses = {
      sm: {
        padding: 'p-3',
        gap: 'gap-2',
        iconSize: 'w-6 h-6',
        fontSize: 'text-sm',
        valueSize: 'text-lg',
        labelSize: 'text-xs',
      },
      md: {
        padding: 'p-4',
        gap: 'gap-3',
        iconSize: 'w-8 h-8',
        fontSize: 'text-base',
        valueSize: 'text-xl',
        labelSize: 'text-sm',
      },
      lg: {
        padding: 'p-6',
        gap: 'gap-4',
        iconSize: 'w-10 h-10',
        fontSize: 'text-lg',
        valueSize: 'text-2xl',
        labelSize: 'text-base',
      },
    };

    const currentSize = sizeClasses[size];

    // Layout classes
    const getLayoutClasses = () => {
      switch (layout) {
        case 'grid':
          return clsx('grid gap-4', {
            'grid-cols-1': columns === 1,
            'grid-cols-2': columns === 2,
            'grid-cols-3': columns === 3,
            'grid-cols-4': columns === 4,
            'grid-cols-6': columns === 6,
          });
        case 'list':
          return 'flex flex-col gap-3';
        case 'compact':
          return 'flex flex-wrap gap-2';
        default:
          return 'grid grid-cols-3 gap-4';
      }
    };

    // Metric card component
    const MetricCard = ({ metric }: { metric: PerformanceMetric }) => {
      const isClickable = !!onMetricClick;

      const cardClasses = clsx(
        'performance-metric-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-200',
        currentSize.padding,
        {
          'cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600':
            isClickable,
          'opacity-50': isLoading,
        },
        layout === 'compact' ? 'min-w-[120px]' : 'w-full',
      );

      const handleClick = useCallback(() => {
        if (onMetricClick) {
          onMetricClick(metric);
        }
      }, [metric]);

      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
          if ((event.key === 'Enter' || event.key === ' ') && onMetricClick) {
            event.preventDefault();
            handleClick();
          }
        },
        [handleClick],
      );

      return (
        <div
          className={cardClasses}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          data-testid={`${testId}-metric-${metric.id}`}
          data-metric-type={metric.type}
          data-metric-status={metric.status}
          ref={(el) => {
            if (el) metricRefs.current.set(metric.id, el);
          }}
        >
          {/* Header */}
          <div
            className={clsx(
              'flex items-center justify-between',
              currentSize.gap,
            )}
          >
            <div className="flex items-center gap-2">
              <div className={clsx('flex-shrink-0', currentSize.iconSize)}>
                <StatusBadge
                  variant={getStatusVariant(metric.status)}
                  size={size === 'lg' ? 'md' : 'sm'}
                  icon={getMetricIcon(metric)}
                  animated={animated && metric.status === 'critical'}
                  showDot={metric.status === 'critical'}
                />
              </div>
              <div>
                <div
                  className={clsx(
                    'font-medium text-gray-900 dark:text-white',
                    currentSize.labelSize,
                  )}
                >
                  {metric.label}
                </div>
                {layout !== 'compact' && metric.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {metric.description}
                  </div>
                )}
              </div>
            </div>

            {/* Trend Indicator */}
            {showTrends && metric.trend && layout !== 'compact' && (
              <div
                className={clsx('flex items-center', {
                  'text-green-600 dark:text-green-400':
                    metric.trend === 'up' && metric.higherIsBetter,
                  'text-red-600 dark:text-red-400':
                    metric.trend === 'up' && !metric.higherIsBetter,
                  'text-red-600 dark:text-red-400':
                    metric.trend === 'down' && metric.higherIsBetter,
                  'text-green-600 dark:text-green-400':
                    metric.trend === 'down' && !metric.higherIsBetter,
                  'text-gray-400 dark:text-gray-500': metric.trend === 'stable',
                })}
              >
                {getTrendIcon(metric.trend)}
              </div>
            )}
          </div>

          {/* Value */}
          <div className="mt-2">
            <div
              className={clsx(
                'font-bold text-gray-900 dark:text-white',
                currentSize.valueSize,
              )}
            >
              {formatValue(metric)}
            </div>

            {/* Progress Bar */}
            {showProgress &&
              metric.target &&
              metric.format?.showProgress &&
              layout !== 'compact' && (
                <div className="mt-2">
                  <ProgressBar
                    value={(metric.value / metric.target) * 100}
                    variant={getStatusVariant(metric.status)}
                    size={size === 'lg' ? 'md' : 'sm'}
                    showLabel={false}
                    animated={animated}
                  />
                </div>
              )}
          </div>

          {/* Timestamp */}
          {showTimestamps && metric.lastUpdated && layout !== 'compact' && (
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Updated: {metric.lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      );
    };

    // Container classes
    const containerClasses = clsx(
      'performance-dashboard',
      getLayoutClasses(),
      className,
    );

    // Loading overlay
    if (isLoading && processedMetrics.length === 0) {
      return (
        <div
          className="flex items-center justify-center h-48 bg-gray-50 dark:bg-gray-800 rounded-lg"
          data-testid={testId}
        >
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Loading metrics...
          </div>
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div
          className="flex items-center justify-center h-48 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          data-testid={testId}
        >
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
            <div className="text-red-800 dark:text-red-200 font-medium">
              Failed to load metrics
            </div>
            <div className="text-red-600 dark:text-red-400 text-sm mt-1">
              {error}
            </div>
            {onRefresh && (
              <button
                onClick={refresh}
                className="mt-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      );
    }

    // Empty state
    if (processedMetrics.length === 0) {
      return (
        <div
          className="flex items-center justify-center h-48 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          data-testid={testId}
        >
          <div className="text-center text-gray-600 dark:text-gray-400">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <div>No metrics available</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={dashboardRef}
        className="performance-dashboard-container"
        data-testid={testId}
        data-layout={layout}
        data-size={size}
        data-metric-count={processedMetrics.length}
        {...containerProps}
        {...props}
      >
        {/* Header with refresh button */}
        {(onRefresh || refreshInterval) && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {processedMetrics.length} metric
              {processedMetrics.length !== 1 ? 's' : ''}
              {refreshInterval && (
                <> • Auto-refresh: {Math.round(refreshInterval / 1000)}s</>
              )}
            </div>
            {onRefresh && (
              <button
                onClick={refresh}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                data-testid={`${testId}-refresh`}
              >
                <RefreshCw
                  className={clsx('w-3 h-3', { 'animate-spin': isLoading })}
                />
                Refresh
              </button>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className={containerClasses}>
          {processedMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>

        {/* Footer with last refresh time */}
        {showTimestamps && (
          <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  },
);

PerformanceDashboard.displayName = 'PerformanceDashboard';
