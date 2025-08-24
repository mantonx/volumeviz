import type { Meta, StoryObj } from '@storybook/react';
import { useState, useMemo } from 'react';
import { action } from '@storybook/addon-actions';
import {
  Activity,
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  Network,
  Zap,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Gauge,
  Server,
  Shield,
  BarChart3,
} from 'lucide-react';

import { MetricsOverview } from './MetricsOverview';
import { ToastProvider } from '../../ui/Toast';
import type {
  MetricsOverviewProps,
  OverviewMetric,
  MetricCategory,
  MetricAlert,
  MetricsFilter,
  MetricsSorting,
} from './MetricsOverview.types';

const meta: Meta<typeof MetricsOverview> = {
  title: 'Shared/MetricsOverview',
  component: MetricsOverview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive metrics dashboard component for monitoring system performance, scan progress, and health indicators in real-time.',
      },
    },
  },
  argTypes: {
    layout: {
      control: 'radio',
      options: ['grid', 'list', 'compact'],
    },
    grouping: {
      control: 'radio',
      options: ['category', 'status', 'priority', 'none'],
    },
    cardSize: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    columns: {
      control: { type: 'range', min: 1, max: 6, step: 1 },
    },
    searchable: {
      control: 'boolean',
    },
    exportable: {
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MetricsOverview>;

// Sample data generators
const generateScanMetrics = (): OverviewMetric[] => [
  // Performance metrics
  {
    id: 'scan-throughput',
    label: 'Scan Throughput',
    value: 142,
    unit: 'files/min',
    type: 'number',
    status: 'success',
    category: 'performance',
    priority: 1,
    description: 'Current scanning speed',
    trend: { direction: 'up', value: 12, period: '1h' },
    target: 150,
    lastUpdated: new Date(),
    tags: ['scanning', 'performance'],
    historical: {
      data: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        value: 120 + Math.random() * 40,
      })),
      period: '24h',
    },
  },
  {
    id: 'avg-scan-duration',
    label: 'Avg Scan Duration',
    value: 3.2,
    unit: 'minutes',
    type: 'duration',
    status: 'info',
    category: 'performance',
    priority: 2,
    description: 'Average time per scan',
    trend: { direction: 'down', value: 8, period: '1h' },
    lastUpdated: new Date(),
    tags: ['scanning', 'duration'],
  },
  {
    id: 'active-scans',
    label: 'Active Scans',
    value: 3,
    type: 'number',
    status: 'success',
    category: 'activity',
    priority: 1,
    description: 'Currently running scans',
    lastUpdated: new Date(),
    tags: ['scanning', 'active'],
  },
  {
    id: 'queued-scans',
    label: 'Queued Scans',
    value: 7,
    type: 'number',
    status: 'warning',
    category: 'activity',
    priority: 2,
    description: 'Scans waiting to be processed',
    lastUpdated: new Date(),
    tags: ['scanning', 'queue'],
    alertThreshold: { warning: 5, critical: 10 },
  },

  // Capacity metrics
  {
    id: 'volume-count',
    label: 'Total Volumes',
    value: 24,
    type: 'number',
    status: 'info',
    category: 'capacity',
    priority: 1,
    description: 'Number of configured volumes',
    lastUpdated: new Date(),
    tags: ['volumes', 'capacity'],
  },
  {
    id: 'total-storage',
    label: 'Total Storage',
    value: 1.2,
    unit: 'TB',
    type: 'fileSize',
    status: 'success',
    category: 'capacity',
    priority: 1,
    description: 'Total storage across all volumes',
    lastUpdated: new Date(),
    tags: ['storage', 'capacity'],
  },
  {
    id: 'indexed-files',
    label: 'Indexed Files',
    value: 1247892,
    type: 'number',
    status: 'success',
    category: 'capacity',
    priority: 2,
    description: 'Total files in index',
    trend: { direction: 'up', value: 3.2, period: '24h' },
    lastUpdated: new Date(),
    tags: ['files', 'index'],
  },
  {
    id: 'storage-utilization',
    label: 'Storage Utilization',
    value: 78.5,
    unit: '%',
    type: 'percentage',
    status: 'warning',
    category: 'capacity',
    priority: 1,
    description: 'Percentage of storage used',
    trend: { direction: 'up', value: 2.1, period: '7d' },
    target: 80,
    lastUpdated: new Date(),
    tags: ['storage', 'utilization'],
    alertThreshold: { warning: 80, critical: 90 },
  },

  // System health metrics
  {
    id: 'cpu-usage',
    label: 'CPU Usage',
    value: 45.2,
    unit: '%',
    type: 'percentage',
    status: 'success',
    category: 'health',
    priority: 1,
    description: 'Current CPU utilization',
    trend: { direction: 'stable', value: 0, period: '1h' },
    target: 70,
    lastUpdated: new Date(),
    tags: ['cpu', 'system'],
    alertThreshold: { warning: 70, critical: 85 },
  },
  {
    id: 'memory-usage',
    label: 'Memory Usage',
    value: 62.8,
    unit: '%',
    type: 'percentage',
    status: 'info',
    category: 'health',
    priority: 1,
    description: 'Current memory utilization',
    trend: { direction: 'up', value: 1.5, period: '1h' },
    target: 80,
    lastUpdated: new Date(),
    tags: ['memory', 'system'],
    alertThreshold: { warning: 80, critical: 90 },
  },
  {
    id: 'disk-usage',
    label: 'Disk Usage',
    value: 89.3,
    unit: '%',
    type: 'percentage',
    status: 'error',
    category: 'health',
    priority: 1,
    description: 'Current disk utilization',
    trend: { direction: 'up', value: 5.2, period: '24h' },
    target: 85,
    lastUpdated: new Date(),
    tags: ['disk', 'system'],
    alertThreshold: { warning: 85, critical: 95 },
  },
  {
    id: 'service-uptime',
    label: 'Service Uptime',
    value: 99.8,
    unit: '%',
    type: 'percentage',
    status: 'success',
    category: 'health',
    priority: 2,
    description: 'Service availability',
    trend: { direction: 'stable', value: 0, period: '30d' },
    target: 99.9,
    lastUpdated: new Date(),
    tags: ['uptime', 'availability'],
  },

  // Quality metrics
  {
    id: 'duplicate-files',
    label: 'Duplicate Files',
    value: 2341,
    type: 'number',
    status: 'warning',
    category: 'quality',
    priority: 3,
    description: 'Files with identical content',
    trend: { direction: 'up', value: 12, period: '7d' },
    lastUpdated: new Date(),
    tags: ['duplicates', 'quality'],
  },
  {
    id: 'corrupted-files',
    label: 'Corrupted Files',
    value: 23,
    type: 'number',
    status: 'error',
    category: 'quality',
    priority: 1,
    description: 'Files with integrity issues',
    lastUpdated: new Date(),
    tags: ['corruption', 'quality'],
    alertThreshold: { warning: 10, critical: 50 },
  },
  {
    id: 'integrity-score',
    label: 'Data Integrity',
    value: 96.7,
    unit: '%',
    type: 'percentage',
    status: 'success',
    category: 'quality',
    priority: 2,
    description: 'Overall data integrity score',
    trend: { direction: 'stable', value: 0.1, period: '30d' },
    target: 98,
    lastUpdated: new Date(),
    tags: ['integrity', 'quality'],
  },
];

const generateCategories = (): MetricCategory[] => [
  {
    id: 'performance',
    name: 'Performance',
    icon: <Zap className="w-5 h-5" />,
    description: 'System and scan performance metrics',
    priority: 1,
    defaultExpanded: true,
    collapsible: true,
  },
  {
    id: 'capacity',
    name: 'Capacity',
    icon: <Database className="w-5 h-5" />,
    description: 'Storage and resource capacity metrics',
    priority: 2,
    defaultExpanded: true,
    collapsible: true,
  },
  {
    id: 'health',
    name: 'System Health',
    icon: <Activity className="w-5 h-5" />,
    description: 'System health and availability metrics',
    priority: 3,
    defaultExpanded: true,
    collapsible: true,
  },
  {
    id: 'activity',
    name: 'Activity',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Scan activity and throughput metrics',
    priority: 4,
    defaultExpanded: false,
    collapsible: true,
  },
  {
    id: 'quality',
    name: 'Data Quality',
    icon: <Shield className="w-5 h-5" />,
    description: 'Data quality and integrity metrics',
    priority: 5,
    defaultExpanded: false,
    collapsible: true,
  },
];

const generateAlerts = (): MetricAlert[] => [
  {
    id: 'alert-1',
    metricId: 'disk-usage',
    type: 'critical',
    condition: { operator: 'gt', value: 85 },
    message: 'Disk usage has exceeded 85% threshold',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: 'alert-2',
    metricId: 'queued-scans',
    type: 'warning',
    condition: { operator: 'gt', value: 5 },
    message: 'Queue backlog is building up',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: 'alert-3',
    metricId: 'corrupted-files',
    type: 'warning',
    condition: { operator: 'gt', value: 10 },
    message: 'High number of corrupted files detected',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    acknowledged: true,
  },
];

// Default story
export const Default: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);
    const alerts = useMemo(() => generateAlerts(), []);

    return (
      <div className="p-4">
        <MetricsOverview
          metrics={metrics}
          categories={categories}
          alerts={alerts}
          layout="grid"
          grouping="category"
          cardSize="md"
          columns={4}
          onMetricClick={action('metricClick')}
          onAlertClick={action('alertClick')}
          onRefresh={action('refresh')}
          onExport={action('export')}
        />
      </div>
    );
  },
};

// Different layouts
export const Layouts: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics().slice(0, 8), []);
    const categories = useMemo(() => generateCategories(), []);

    return (
      <div className="p-4 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Grid Layout</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            layout="grid"
            columns={4}
            height="400px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">List Layout</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            layout="list"
            height="400px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Compact Layout</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            layout="compact"
            height="400px"
          />
        </div>
      </div>
    );
  },
};

// Different groupings
export const Groupings: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);

    return (
      <div className="p-4 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Grouped by Category</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            grouping="category"
            height="400px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Grouped by Status</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            grouping="status"
            height="400px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">No Grouping</h3>
          <MetricsOverview
            metrics={metrics}
            categories={categories}
            grouping="none"
            height="400px"
          />
        </div>
      </div>
    );
  },
};

// Loading and error states
export const LoadingAndError: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);

    return (
      <div className="p-4 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Loading State</h3>
          <MetricsOverview
            metrics={[]}
            categories={categories}
            loading={true}
            height="300px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Error State</h3>
          <MetricsOverview
            metrics={[]}
            categories={categories}
            error="Failed to load metrics from the server"
            height="300px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Empty State</h3>
          <MetricsOverview
            metrics={[]}
            categories={categories}
            height="300px"
          />
        </div>
      </div>
    );
  },
};

// With alerts
export const WithAlerts: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);
    const alerts = useMemo(() => generateAlerts(), []);

    return (
      <div className="p-4">
        <MetricsOverview
          metrics={metrics}
          categories={categories}
          alerts={alerts}
          onAlertClick={action('alertClick')}
          onMetricClick={action('metricClick')}
        />
      </div>
    );
  },
};

// Real-time simulation
export const RealTimeSimulation: Story = {
  render: () => {
    const [metrics, setMetrics] = useState(() => generateScanMetrics());
    const categories = useMemo(() => generateCategories(), []);
    const [alerts, setAlerts] = useState(() => generateAlerts());

    // Simulate real-time updates
    const simulateUpdates = () => {
      setMetrics((prev) =>
        prev.map((metric) => {
          // Randomly update some metrics
          if (Math.random() < 0.3) {
            let newValue = metric.value as number;

            if (metric.type === 'percentage') {
              newValue = Math.max(
                0,
                Math.min(100, newValue + (Math.random() - 0.5) * 10),
              );
            } else if (metric.type === 'number') {
              newValue = Math.max(
                0,
                newValue + (Math.random() - 0.5) * (newValue * 0.1),
              );
            }

            return {
              ...metric,
              value: Math.round(newValue * 10) / 10,
              lastUpdated: new Date(),
            };
          }
          return metric;
        }),
      );
    };

    return (
      <div className="p-4">
        <div className="mb-4 flex space-x-2">
          <button
            onClick={simulateUpdates}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Simulate Update
          </button>
          <span className="text-sm text-gray-600 py-2">
            Click to simulate real-time metric updates
          </span>
        </div>

        <MetricsOverview
          metrics={metrics}
          categories={categories}
          alerts={alerts}
          refreshConfig={{
            mode: 'auto',
            interval: 30,
            onRefresh: simulateUpdates,
          }}
          onMetricClick={action('metricClick')}
          onAlertClick={action('alertClick')}
        />
      </div>
    );
  },
};

// Filtering and searching
export const FilteringAndSearching: Story = {
  render: () => {
    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);
    const [filter, setFilter] = useState<MetricsFilter>({});
    const [sorting, setSorting] = useState<MetricsSorting>({
      field: 'priority',
      direction: 'asc',
    });

    return (
      <div className="p-4">
        <div className="mb-4 space-y-2">
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Filter by Status
              </label>
              <select
                value={filter.status?.[0] || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    status: e.target.value
                      ? [e.target.value as any]
                      : undefined,
                  }))
                }
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Filter by Category
              </label>
              <select
                value={filter.categories?.[0] || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    categories: e.target.value ? [e.target.value] : undefined,
                  }))
                }
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">All Categories</option>
                <option value="performance">Performance</option>
                <option value="capacity">Capacity</option>
                <option value="health">Health</option>
                <option value="activity">Activity</option>
                <option value="quality">Quality</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sort by</label>
              <select
                value={sorting.field}
                onChange={(e) =>
                  setSorting((prev) => ({
                    ...prev,
                    field: e.target.value as any,
                  }))
                }
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="priority">Priority</option>
                <option value="name">Name</option>
                <option value="value">Value</option>
                <option value="status">Status</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </div>

        <MetricsOverview
          metrics={metrics}
          categories={categories}
          filter={filter}
          sorting={sorting}
          onFilterChange={setFilter}
          onSortChange={setSorting}
          searchable
          exportable
        />
      </div>
    );
  },
};

// Performance dashboard
export const PerformanceDashboard: Story = {
  render: () => {
    const performanceMetrics = useMemo(
      () =>
        generateScanMetrics().filter((m) =>
          ['performance', 'health', 'activity'].includes(m.category),
        ),
      [],
    );
    const categories = useMemo(
      () =>
        generateCategories().filter((c) =>
          ['performance', 'health', 'activity'].includes(c.id),
        ),
      [],
    );
    const alerts = useMemo(() => generateAlerts().slice(0, 2), []);

    return (
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            System Performance Dashboard
          </h2>
          <p className="text-gray-600">
            Real-time monitoring of system performance and scan activity
          </p>
        </div>

        <MetricsOverview
          metrics={performanceMetrics}
          categories={categories}
          alerts={alerts}
          layout="grid"
          grouping="category"
          cardSize="lg"
          columns={3}
          refreshConfig={{
            mode: 'auto',
            interval: 15,
          }}
          onMetricClick={action('viewDetails')}
          onAlertClick={action('viewAlert')}
          className="border-0 shadow-lg"
        />
      </div>
    );
  },
};

// Interactive playground
export const Interactive: Story = {
  render: () => {
    const [config, setConfig] = useState({
      layout: 'grid' as const,
      grouping: 'category' as const,
      cardSize: 'md' as const,
      columns: 4,
      searchable: true,
      exportable: true,
    });

    const metrics = useMemo(() => generateScanMetrics(), []);
    const categories = useMemo(() => generateCategories(), []);
    const alerts = useMemo(() => generateAlerts(), []);

    return (
      <div className="p-4 space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-1">Layout</label>
            <select
              value={config.layout}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: e.target.value as any,
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Grouping</label>
            <select
              value={config.grouping}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  grouping: e.target.value as any,
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="category">Category</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Card Size</label>
            <select
              value={config.cardSize}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  cardSize: e.target.value as any,
                }))
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Columns</label>
            <input
              type="range"
              min="2"
              max="6"
              value={config.columns}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  columns: Number(e.target.value),
                }))
              }
              className="w-full"
            />
            <span className="text-xs text-gray-600">
              {config.columns} columns
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.searchable}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    searchable: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              Searchable
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.exportable}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    exportable: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              Exportable
            </label>
          </div>
        </div>

        {/* MetricsOverview */}
        <MetricsOverview
          metrics={metrics}
          categories={categories}
          alerts={alerts}
          layout={config.layout}
          grouping={config.grouping}
          cardSize={config.cardSize}
          columns={config.columns}
          searchable={config.searchable}
          exportable={config.exportable}
          height="600px"
          onMetricClick={action('metricClick')}
          onAlertClick={action('alertClick')}
          onRefresh={action('refresh')}
          onExport={action('export')}
        />

        <div className="text-sm text-gray-600">
          Configuration: {config.layout} layout • {config.grouping} grouping •{' '}
          {config.cardSize} cards • {config.columns} columns
        </div>
      </div>
    );
  },
};
