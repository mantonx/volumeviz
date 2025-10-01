import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Memory,
  Monitor,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePerformanceData,
  usePerformanceAlerts,
} from '@/hooks/usePerformanceMonitoring';

export interface PerformanceMonitorProps {
  /** Whether to show the monitor */
  isVisible?: boolean;
  /** Called when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Position of the monitor */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
  /** Whether to show detailed metrics */
  showDetails?: boolean;
}

/**
 * Performance monitoring overlay component
 * Shows real-time performance metrics and alerts
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible = false,
  onVisibilityChange,
  position = 'bottom-right',
  showDetails = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);

  const {
    isEnabled,
    setIsEnabled,
    getAggregatedMetrics,
    getComponentBreakdown,
    clearEntries,
  } = usePerformanceData();

  const { alerts, dismissAlert, hasAlerts, errorCount, warningCount } =
    usePerformanceAlerts();

  const [metrics, setMetrics] = useState(() => getAggregatedMetrics());
  const [componentBreakdown, setComponentBreakdown] = useState(() =>
    getComponentBreakdown(),
  );

  // Update metrics periodically
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setMetrics(getAggregatedMetrics());
      setComponentBreakdown(getComponentBreakdown());
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, getAggregatedMetrics, getComponentBreakdown]);

  if (!isVisible) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg',
        'transition-all duration-200 ease-in-out',
        positionClasses[position],
        isExpanded ? 'w-80' : 'w-64',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Performance</span>
          {hasAlerts && (
            <div className="flex items-center gap-1">
              {errorCount > 0 && (
                <div className="h-2 w-2 bg-red-500 rounded-full" />
              )}
              {warningCount > 0 && (
                <div className="h-2 w-2 bg-yellow-500 rounded-full" />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onVisibilityChange?.(false)}
            className="p-1 hover:bg-muted rounded"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetricCard
            icon={<Clock className="h-3 w-3" />}
            label="Render"
            value={`${metrics.render.avg.toFixed(1)}ms`}
            trend={metrics.render.avg > 16 ? 'warning' : 'good'}
          />
          <MetricCard
            icon={<Database className="h-3 w-3" />}
            label="API"
            value={`${metrics.api.avg.toFixed(0)}ms`}
            trend={
              metrics.api.avg > 1000
                ? 'error'
                : metrics.api.avg > 500
                  ? 'warning'
                  : 'good'
            }
          />
        </div>

        {/* Alerts */}
        {showAlerts && alerts.length > 0 && (
          <div className="space-y-1">
            {alerts.slice(0, 3).map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={() => dismissAlert(alert.id)}
              />
            ))}
            {alerts.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{alerts.length - 3} more alerts
              </div>
            )}
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {/* Detailed Metrics */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">Detailed Metrics</span>
                <button
                  type="button"
                  onClick={clearEntries}
                  className="text-muted-foreground hover:text-foreground"
                  title="Clear metrics"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-1">
                <DetailedMetric
                  label="Render Times"
                  avg={metrics.render.avg}
                  min={metrics.render.min}
                  max={metrics.render.max}
                  count={metrics.render.count}
                  unit="ms"
                />
                <DetailedMetric
                  label="API Calls"
                  avg={metrics.api.avg}
                  min={metrics.api.min}
                  max={metrics.api.max}
                  count={metrics.api.count}
                  unit="ms"
                />
                <DetailedMetric
                  label="Processing"
                  avg={metrics.processing.avg}
                  min={metrics.processing.min}
                  max={metrics.processing.max}
                  count={metrics.processing.count}
                  unit="ms"
                />
              </div>
            </div>

            {/* Component Breakdown */}
            {Object.keys(componentBreakdown).length > 0 && (
              <div className="space-y-2 text-xs">
                <div className="font-medium">Component Performance</div>
                <div className="space-y-1">
                  {Object.entries(componentBreakdown)
                    .sort(([, a], [, b]) => b.avgRenderTime - a.avgRenderTime)
                    .slice(0, 5)
                    .map(([component, data]) => (
                      <div key={component} className="flex justify-between">
                        <span className="truncate">{component}</span>
                        <span
                          className={cn(
                            data.avgRenderTime > 16
                              ? 'text-red-500'
                              : data.avgRenderTime > 8
                                ? 'text-yellow-500'
                                : 'text-green-500',
                          )}
                        >
                          {data.avgRenderTime.toFixed(1)}ms
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded"
            />
            Enabled
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAlerts(!showAlerts)}
              className={cn(
                'p-1 rounded text-xs',
                showAlerts
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              title="Toggle alerts"
            >
              <AlertTriangle className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: 'good' | 'warning' | 'error';
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  trend,
}) => {
  const trendColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
      <div className={cn('flex-shrink-0', trendColors[trend])}>{icon}</div>
      <div>
        <div className="font-medium">{value}</div>
        <div className="text-muted-foreground">{label}</div>
      </div>
    </div>
  );
};

interface AlertCardProps {
  alert: {
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    details?: string;
  };
  onDismiss: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onDismiss }) => {
  const typeColors = {
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 border rounded text-xs',
        typeColors[alert.type],
      )}
    >
      <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{alert.message}</div>
        {alert.details && (
          <div className="text-xs opacity-75 truncate">{alert.details}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 opacity-50 hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

interface DetailedMetricProps {
  label: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  unit: string;
}

const DetailedMetric: React.FC<DetailedMetricProps> = ({
  label,
  avg,
  min,
  max,
  count,
  unit,
}) => {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">
        {label} ({count})
      </span>
      <span>
        {avg.toFixed(1)}
        {unit} ({min.toFixed(1)}-{max.toFixed(1)})
      </span>
    </div>
  );
};

export default PerformanceMonitor;
