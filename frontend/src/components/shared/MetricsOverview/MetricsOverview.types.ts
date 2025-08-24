import type { ReactNode } from 'react';
import type {
  Metric,
  MetricStatus,
  MetricTrend,
  MetricValueType,
  MetricCardSize,
} from '../../ui/MetricCard/MetricCard.types';

/**
 * MetricsOverview component types and configurations
 */

// Core types
export type MetricsLayout = 'grid' | 'list' | 'compact';
export type MetricsGrouping = 'category' | 'status' | 'priority' | 'none';
export type MetricsRefreshMode = 'auto' | 'manual' | 'disabled';
export type MetricsTimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

// Metric category
export interface MetricCategory {
  id: string;
  name: string;
  icon?: ReactNode;
  color?: string;
  description?: string;
  priority?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Enhanced metric with metadata
export interface OverviewMetric extends Metric {
  category: string;
  priority?: number;
  alertThreshold?: {
    warning?: number;
    critical?: number;
  };
  historical?: {
    data: Array<{ timestamp: Date; value: number }>;
    period?: MetricsTimeRange;
  };
  actions?: MetricAction[];
  tags?: string[];
  lastUpdated?: Date;
  source?: string;
  refreshInterval?: number;
}

// Metric action
export interface MetricAction {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  onClick: (metric: OverviewMetric) => void;
  tooltip?: string;
}

// Alert configuration
export interface MetricAlert {
  id: string;
  metricId: string;
  type: 'warning' | 'critical' | 'info';
  condition: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value: number;
  };
  message: string;
  timestamp: Date;
  acknowledged?: boolean;
  autoResolve?: boolean;
}

// Aggregation configuration
export interface MetricsAggregation {
  type: 'sum' | 'avg' | 'min' | 'max' | 'count';
  metrics: string[];
  label: string;
  unit?: string;
  format?: (value: number) => string;
}

// Filtering configuration
export interface MetricsFilter {
  categories?: string[];
  status?: MetricStatus[];
  tags?: string[];
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Sorting configuration
export interface MetricsSorting {
  field: 'name' | 'value' | 'status' | 'category' | 'priority' | 'lastUpdated';
  direction: 'asc' | 'desc';
}

// Refresh configuration
export interface RefreshConfig {
  mode: MetricsRefreshMode;
  interval?: number; // in seconds
  onRefresh?: () => void | Promise<void>;
  lastRefresh?: Date;
  autoRefreshOnFocus?: boolean;
}

// Export configuration
export interface MetricsExportConfig {
  formats: Array<'csv' | 'json' | 'pdf' | 'png'>;
  includeHistorical?: boolean;
  timeRange?: MetricsTimeRange;
  filename?: string;
  onExport?: (format: string, data: any) => void;
}

// MetricsOverview props
export interface MetricsOverviewProps {
  // Data
  metrics: OverviewMetric[];
  categories?: MetricCategory[];
  alerts?: MetricAlert[];
  aggregations?: MetricsAggregation[];

  // Layout and appearance
  layout?: MetricsLayout;
  grouping?: MetricsGrouping;
  cardSize?: MetricCardSize;
  columns?: number;
  gap?: number;
  height?: number | string;
  maxHeight?: number | string;

  // Behavior
  refreshConfig?: RefreshConfig;
  filter?: MetricsFilter;
  sorting?: MetricsSorting;
  searchable?: boolean;
  exportable?: boolean;

  // Interactions
  onMetricClick?: (metric: OverviewMetric) => void;
  onMetricAction?: (action: MetricAction, metric: OverviewMetric) => void;
  onAlertClick?: (alert: MetricAlert) => void;
  onFilterChange?: (filter: MetricsFilter) => void;
  onSortChange?: (sorting: MetricsSorting) => void;
  onRefresh?: () => void | Promise<void>;
  onExport?: (format: string) => void;

  // Customization
  renderMetric?: (metric: OverviewMetric) => ReactNode;
  renderCategory?: (
    category: MetricCategory,
    metrics: OverviewMetric[],
  ) => ReactNode;
  renderAlert?: (alert: MetricAlert) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
  renderError?: (error: string) => ReactNode;

  // State
  loading?: boolean;
  error?: string;

  // Styling
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;

  // Accessibility
  ariaLabel?: string;
  testId?: string;
}

// MetricsOverview ref API
export interface MetricsOverviewRef {
  refresh: () => void;
  exportData: (format: string) => void;
  scrollToMetric: (metricId: string) => void;
  scrollToCategory: (categoryId: string) => void;
  getFilteredMetrics: () => OverviewMetric[];
  getAlerts: () => MetricAlert[];
  acknowledgeAlert: (alertId: string) => void;
  clearFilters: () => void;
  getElement: () => HTMLDivElement | null;
}

// Layout configurations
export interface MetricsLayoutConfig {
  grid: {
    container: string;
    item: string;
    responsive: Record<string, string>;
  };
  list: {
    container: string;
    item: string;
  };
  compact: {
    container: string;
    item: string;
  };
}

export const defaultMetricsLayouts: MetricsLayoutConfig = {
  grid: {
    container: 'grid gap-4',
    item: 'w-full',
    responsive: {
      'grid-cols-1': 'grid-cols-1',
      'sm:grid-cols-2': 'sm:grid-cols-2',
      'lg:grid-cols-3': 'lg:grid-cols-3',
      'xl:grid-cols-4': 'xl:grid-cols-4',
    },
  },
  list: {
    container: 'space-y-2',
    item: 'w-full',
  },
  compact: {
    container: 'flex flex-wrap gap-2',
    item: 'flex-1 min-w-48',
  },
};

// Predefined metric categories for scan monitoring
export const scanMonitoringCategories: MetricCategory[] = [
  {
    id: 'performance',
    name: 'Performance',
    description: 'System and scan performance metrics',
    priority: 1,
    defaultExpanded: true,
  },
  {
    id: 'capacity',
    name: 'Capacity',
    description: 'Storage and resource capacity metrics',
    priority: 2,
    defaultExpanded: true,
  },
  {
    id: 'health',
    name: 'System Health',
    description: 'System health and availability metrics',
    priority: 3,
    defaultExpanded: true,
  },
  {
    id: 'activity',
    name: 'Activity',
    description: 'Scan activity and throughput metrics',
    priority: 4,
    defaultExpanded: false,
  },
  {
    id: 'quality',
    name: 'Data Quality',
    description: 'Data quality and integrity metrics',
    priority: 5,
    defaultExpanded: false,
  },
];

// Utility types
export type MetricsData = {
  metrics: OverviewMetric[];
  categories: MetricCategory[];
  alerts: MetricAlert[];
  lastUpdated: Date;
};

export type MetricsState = {
  data: MetricsData;
  filter: MetricsFilter;
  sorting: MetricsSorting;
  loading: boolean;
  error?: string;
};

// Hook types for metrics management
export interface UseMetricsOverviewOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
  onMetricUpdate?: (metric: OverviewMetric) => void;
  onAlert?: (alert: MetricAlert) => void;
}

export interface UseMetricsOverviewReturn {
  metrics: OverviewMetric[];
  categories: MetricCategory[];
  alerts: MetricAlert[];
  filteredMetrics: OverviewMetric[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  updateMetric: (metricId: string, updates: Partial<OverviewMetric>) => void;
  acknowledgeAlert: (alertId: string) => void;
  setFilter: (filter: MetricsFilter) => void;
  setSorting: (sorting: MetricsSorting) => void;
}

// Scan-specific metric interfaces
export interface ScanPerformanceMetrics {
  scanThroughput: OverviewMetric;
  avgScanDuration: OverviewMetric;
  activeScans: OverviewMetric;
  queuedScans: OverviewMetric;
  failureRate: OverviewMetric;
}

export interface CapacityMetrics {
  volumeCount: OverviewMetric;
  totalStorage: OverviewMetric;
  indexedFiles: OverviewMetric;
  storageUtilization: OverviewMetric;
  indexSize: OverviewMetric;
}

export interface SystemHealthMetrics {
  cpuUsage: OverviewMetric;
  memoryUsage: OverviewMetric;
  diskUsage: OverviewMetric;
  networkThroughput: OverviewMetric;
  serviceUptime: OverviewMetric;
}

export interface ActivityMetrics {
  filesScanned: OverviewMetric;
  dataProcessed: OverviewMetric;
  indexingRate: OverviewMetric;
  errorCount: OverviewMetric;
  warningCount: OverviewMetric;
}

export interface DataQualityMetrics {
  duplicateFiles: OverviewMetric;
  corruptedFiles: OverviewMetric;
  missingMetadata: OverviewMetric;
  compressionRatio: OverviewMetric;
  integrityScore: OverviewMetric;
}

// Complete scan metrics interface
export interface ScanMonitoringMetrics {
  performance: ScanPerformanceMetrics;
  capacity: CapacityMetrics;
  health: SystemHealthMetrics;
  activity: ActivityMetrics;
  quality: DataQualityMetrics;
}

// Widget configuration for custom layouts
export interface MetricWidget {
  id: string;
  metricId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  customization?: {
    showTrend?: boolean;
    showTarget?: boolean;
    showAlert?: boolean;
    color?: string;
    format?: 'compact' | 'detailed';
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: MetricWidget[];
  columns: number;
  gap: number;
  autoLayout?: boolean;
}

// Real-time updates
export interface MetricsSubscription {
  metricIds: string[];
  interval: number;
  onUpdate: (updates: Partial<OverviewMetric>[]) => void;
  onError: (error: Error) => void;
}

// Batch operations
export interface MetricsBatchOperation {
  type: 'update' | 'delete' | 'alert' | 'export';
  metricIds: string[];
  data?: any;
  onComplete?: (results: any[]) => void;
  onError?: (error: Error) => void;
}
