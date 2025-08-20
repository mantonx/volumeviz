import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

import { MetricCard } from '../../ui/MetricCard';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Toast, useToast } from '../../ui/Toast';
import type {
  MetricsOverviewProps,
  MetricsOverviewRef,
  OverviewMetric,
  MetricCategory,
  MetricAlert,
  MetricsFilter,
  MetricsSorting,
  MetricsLayout,
  MetricsGrouping,
} from './MetricsOverview.types';
import { 
  defaultMetricsLayouts, 
  scanMonitoringCategories 
} from './MetricsOverview.types';

/**
 * Filter metrics based on filter configuration
 */
const filterMetrics = (metrics: OverviewMetric[], filter: MetricsFilter): OverviewMetric[] => {
  return metrics.filter(metric => {
    // Category filter
    if (filter.categories && filter.categories.length > 0) {
      if (!filter.categories.includes(metric.category)) return false;
    }
    
    // Status filter
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(metric.status)) return false;
    }
    
    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      if (!metric.tags || !filter.tags.some(tag => metric.tags!.includes(tag))) {
        return false;
      }
    }
    
    // Search query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const query = filter.searchQuery.toLowerCase();
      if (
        !metric.label.toLowerCase().includes(query) &&
        !metric.description?.toLowerCase().includes(query) &&
        !metric.tags?.some(tag => tag.toLowerCase().includes(query))
      ) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Sort metrics based on sorting configuration
 */
const sortMetrics = (metrics: OverviewMetric[], sorting: MetricsSorting): OverviewMetric[] => {
  return [...metrics].sort((a, b) => {
    let result = 0;
    
    switch (sorting.field) {
      case 'name':
        result = a.label.localeCompare(b.label);
        break;
      case 'value':
        result = (a.value as number) - (b.value as number);
        break;
      case 'status':
        const statusOrder = { success: 0, warning: 1, error: 2, info: 3 };
        result = statusOrder[a.status] - statusOrder[b.status];
        break;
      case 'category':
        result = a.category.localeCompare(b.category);
        break;
      case 'priority':
        result = (a.priority || 0) - (b.priority || 0);
        break;
      case 'lastUpdated':
        const aTime = a.lastUpdated?.getTime() || 0;
        const bTime = b.lastUpdated?.getTime() || 0;
        result = bTime - aTime; // Most recent first
        break;
      default:
        result = 0;
    }
    
    return sorting.direction === 'desc' ? -result : result;
  });
};

/**
 * Group metrics by specified grouping method
 */
const groupMetrics = (
  metrics: OverviewMetric[], 
  grouping: MetricsGrouping,
  categories: MetricCategory[]
): Record<string, OverviewMetric[]> => {
  if (grouping === 'none') {
    return { all: metrics };
  }
  
  const groups: Record<string, OverviewMetric[]> = {};
  
  metrics.forEach(metric => {
    let groupKey: string;
    
    switch (grouping) {
      case 'category':
        groupKey = metric.category;
        break;
      case 'status':
        groupKey = metric.status;
        break;
      case 'priority':
        groupKey = `Priority ${metric.priority || 0}`;
        break;
      default:
        groupKey = 'all';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(metric);
  });
  
  return groups;
};

/**
 * Alert badge component
 */
const AlertBadge: React.FC<{ alert: MetricAlert; onClick?: () => void }> = ({ 
  alert, 
  onClick 
}) => {
  const getAlertIcon = () => {
    switch (alert.type) {
      case 'critical': return AlertTriangle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Info;
    }
  };
  
  const getAlertColor = () => {
    switch (alert.type) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'info': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  const Icon = getAlertIcon();
  
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        'hover:opacity-80 transition-opacity',
        getAlertColor(),
        alert.acknowledged && 'opacity-50'
      )}
      title={alert.message}
    >
      <Icon className="w-3 h-3 mr-1" />
      {alert.type}
    </button>
  );
};

/**
 * Category header component
 */
const CategoryHeader: React.FC<{
  category: MetricCategory;
  metricsCount: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ category, metricsCount, expanded, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
  >
    <div className="flex items-center space-x-3">
      {category.collapsible && (
        expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
      )}
      {category.icon && <div className="text-gray-600">{category.icon}</div>}
      <div className="text-left">
        <h3 className="font-medium text-gray-900">{category.name}</h3>
        {category.description && (
          <p className="text-sm text-gray-600">{category.description}</p>
        )}
      </div>
    </div>
    <Badge variant="secondary">{metricsCount}</Badge>
  </button>
);

/**
 * Enhanced MetricsOverview component
 * 
 * A comprehensive metrics dashboard component that aggregates and displays
 * system metrics with advanced filtering, grouping, and real-time updates.
 * Designed specifically for scan monitoring and system health tracking.
 */
export const MetricsOverview = forwardRef<MetricsOverviewRef, MetricsOverviewProps>(
  (
    {
      metrics,
      categories = scanMonitoringCategories,
      alerts = [],
      aggregations = [],
      layout = 'grid',
      grouping = 'category',
      cardSize = 'md',
      columns = 4,
      gap = 4,
      height,
      maxHeight,
      refreshConfig,
      filter: externalFilter,
      sorting: externalSorting,
      searchable = true,
      exportable = true,
      onMetricClick,
      onMetricAction,
      onAlertClick,
      onFilterChange,
      onSortChange,
      onRefresh,
      onExport,
      renderMetric,
      renderCategory,
      renderAlert,
      renderEmpty,
      renderLoading,
      renderError,
      loading = false,
      error,
      className,
      headerClassName,
      contentClassName,
      footerClassName,
      ariaLabel = 'Metrics overview',
      testId = 'metrics-overview',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const toast = useToast();
    
    // Internal state
    const [internalFilter, setInternalFilter] = useState<MetricsFilter>({});
    const [internalSorting, setInternalSorting] = useState<MetricsSorting>({
      field: 'priority',
      direction: 'asc',
    });
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
      new Set(categories.filter(cat => cat.defaultExpanded).map(cat => cat.id))
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Computed values
    const currentFilter = externalFilter || internalFilter;
    const currentSorting = externalSorting || internalSorting;
    const layoutConfig = defaultMetricsLayouts[layout];

    // Filter and sort metrics
    const filteredMetrics = useMemo(() => {
      const filtered = filterMetrics(metrics, { 
        ...currentFilter, 
        searchQuery: searchQuery || currentFilter.searchQuery 
      });
      return sortMetrics(filtered, currentSorting);
    }, [metrics, currentFilter, currentSorting, searchQuery]);

    // Group metrics
    const groupedMetrics = useMemo(() => {
      return groupMetrics(filteredMetrics, grouping, categories);
    }, [filteredMetrics, grouping, categories]);

    // Active alerts
    const activeAlerts = useMemo(() => {
      return alerts.filter(alert => !alert.acknowledged);
    }, [alerts]);

    // Auto-refresh handling
    useEffect(() => {
      if (refreshConfig?.mode === 'auto' && refreshConfig.interval) {
        const interval = setInterval(() => {
          if (refreshConfig.onRefresh) {
            refreshConfig.onRefresh();
          } else {
            onRefresh?.();
          }
          setLastRefresh(new Date());
        }, refreshConfig.interval * 1000);

        return () => clearInterval(interval);
      }
    }, [refreshConfig, onRefresh]);

    // Event handlers
    const handleFilterChange = useCallback((newFilter: MetricsFilter) => {
      if (externalFilter) {
        onFilterChange?.(newFilter);
      } else {
        setInternalFilter(newFilter);
      }
    }, [externalFilter, onFilterChange]);

    const handleSortChange = useCallback((newSorting: MetricsSorting) => {
      if (externalSorting) {
        onSortChange?.(newSorting);
      } else {
        setInternalSorting(newSorting);
      }
    }, [externalSorting, onSortChange]);

    const handleRefresh = useCallback(async () => {
      try {
        if (refreshConfig?.onRefresh) {
          await refreshConfig.onRefresh();
        } else {
          await onRefresh?.();
        }
        setLastRefresh(new Date());
        toast.success('Metrics refreshed successfully');
      } catch (error) {
        toast.error('Failed to refresh metrics');
      }
    }, [refreshConfig, onRefresh, toast]);

    const handleExport = useCallback((format: string) => {
      try {
        onExport?.(format);
        toast.success(`Metrics exported as ${format.toUpperCase()}`);
      } catch (error) {
        toast.error('Failed to export metrics');
      }
    }, [onExport, toast]);

    const handleCategoryToggle = useCallback((categoryId: string) => {
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(categoryId)) {
          newSet.delete(categoryId);
        } else {
          newSet.add(categoryId);
        }
        return newSet;
      });
    }, []);

    // Imperative API
    useImperativeHandle(ref, () => ({
      refresh: handleRefresh,
      exportData: handleExport,
      scrollToMetric: (metricId: string) => {
        const element = containerRef.current?.querySelector(`[data-metric-id="${metricId}"]`);
        element?.scrollIntoView({ behavior: 'smooth' });
      },
      scrollToCategory: (categoryId: string) => {
        const element = containerRef.current?.querySelector(`[data-category-id="${categoryId}"]`);
        element?.scrollIntoView({ behavior: 'smooth' });
      },
      getFilteredMetrics: () => filteredMetrics,
      getAlerts: () => activeAlerts,
      acknowledgeAlert: (alertId: string) => {
        // Implementation would update alert state
        toast.info('Alert acknowledged');
      },
      clearFilters: () => {
        setSearchQuery('');
        handleFilterChange({});
      },
      getElement: () => containerRef.current,
    }), [filteredMetrics, activeAlerts, handleRefresh, handleExport, handleFilterChange, toast]);

    // Render functions
    const renderMetricCard = (metric: OverviewMetric) => {
      if (renderMetric) {
        return renderMetric(metric);
      }

      return (
        <div key={metric.id} data-metric-id={metric.id}>
          <MetricCard
            metric={metric}
            size={cardSize}
            showTrend={true}
            onClick={() => onMetricClick?.(metric)}
            testId={`${testId}-metric-${metric.id}`}
          />
          {/* Metric actions */}
          {metric.actions && metric.actions.length > 0 && (
            <div className="mt-2 flex space-x-1">
              {metric.actions.map(action => (
                <Button
                  key={action.id}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={() => onMetricAction?.(action, metric)}
                  disabled={action.disabled}
                  title={action.tooltip}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      );
    };

    const renderCategorySection = (categoryId: string, categoryMetrics: OverviewMetric[]) => {
      const category = categories.find(cat => cat.id === categoryId);
      if (!category) return null;

      const isExpanded = expandedCategories.has(categoryId);
      const shouldShowContent = !category.collapsible || isExpanded;

      if (renderCategory) {
        return renderCategory(category, categoryMetrics);
      }

      return (
        <div key={categoryId} data-category-id={categoryId} className="space-y-4">
          <CategoryHeader
            category={category}
            metricsCount={categoryMetrics.length}
            expanded={isExpanded}
            onToggle={() => handleCategoryToggle(categoryId)}
          />
          
          {shouldShowContent && (
            <div className={clsx(layoutConfig.container, getLayoutColumns())}>
              {categoryMetrics.map(renderMetricCard)}
            </div>
          )}
        </div>
      );
    };

    const getLayoutColumns = () => {
      if (layout === 'grid') {
        return clsx(
          `grid-cols-1`,
          columns >= 2 && 'sm:grid-cols-2',
          columns >= 3 && 'lg:grid-cols-3',
          columns >= 4 && 'xl:grid-cols-4',
          columns >= 5 && '2xl:grid-cols-5'
        );
      }
      return '';
    };

    const renderHeader = () => (
      <div className={clsx('flex items-center justify-between p-4 border-b', headerClassName)}>
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">Metrics Overview</h2>
          
          {activeAlerts.length > 0 && (
            <div className="flex space-x-1">
              {activeAlerts.slice(0, 3).map(alert => (
                <AlertBadge
                  key={alert.id}
                  alert={alert}
                  onClick={() => onAlertClick?.(alert)}
                />
              ))}
              {activeAlerts.length > 3 && (
                <Badge variant="secondary">+{activeAlerts.length - 3} more</Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search metrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>

          {exportable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('csv')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={clsx('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>
    );

    const renderContent = () => {
      if (loading && renderLoading) {
        return renderLoading();
      }

      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
            <span className="text-gray-600">Loading metrics...</span>
          </div>
        );
      }

      if (error && renderError) {
        return renderError(error);
      }

      if (error) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 mb-2">{error}</p>
              <Button onClick={handleRefresh} size="sm">
                Try Again
              </Button>
            </div>
          </div>
        );
      }

      if (filteredMetrics.length === 0) {
        if (renderEmpty) {
          return renderEmpty();
        }

        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-gray-400 mb-2">No metrics found</div>
              <p className="text-sm text-gray-600">
                {searchQuery || Object.keys(currentFilter).length > 0
                  ? 'Try adjusting your search or filters'
                  : 'No metrics available to display'}
              </p>
            </div>
          </div>
        );
      }

      if (grouping === 'none') {
        return (
          <div className={clsx(layoutConfig.container, getLayoutColumns())}>
            {filteredMetrics.map(renderMetricCard)}
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {Object.entries(groupedMetrics).map(([groupKey, groupMetrics]) =>
            renderCategorySection(groupKey, groupMetrics)
          )}
        </div>
      );
    };

    const renderFooter = () => (
      <div className={clsx('flex items-center justify-between p-4 border-t bg-gray-50', footerClassName)}>
        <div className="text-sm text-gray-600">
          Showing {filteredMetrics.length} of {metrics.length} metrics
          {lastRefresh && (
            <span className="ml-2">
              • Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {refreshConfig?.mode === 'auto' && (
          <div className="text-sm text-gray-600">
            Auto-refresh: {refreshConfig.interval}s
          </div>
        )}
      </div>
    );

    // Container styles
    const containerStyles: React.CSSProperties = {
      height,
      maxHeight,
    };

    return (
      <div
        ref={containerRef}
        className={clsx('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}
        style={containerStyles}
        role="region"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {renderHeader()}
        
        <div className={clsx('overflow-auto', contentClassName)}>
          {renderContent()}
        </div>
        
        {renderFooter()}
      </div>
    );
  }
);

MetricsOverview.displayName = 'MetricsOverview';