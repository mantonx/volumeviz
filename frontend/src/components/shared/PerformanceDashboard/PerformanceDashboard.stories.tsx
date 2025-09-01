import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { PerformanceDashboard } from './PerformanceDashboard';
import type {
  PerformanceDashboardProps,
  PerformanceMetric,
  PerformanceDashboardRef,
  ScanPerformanceData,
} from './PerformanceDashboard.types';
import { createScanMetrics } from './PerformanceDashboard.types';

const meta: Meta<typeof PerformanceDashboard> = {
  title: 'Shared/PerformanceDashboard',
  component: PerformanceDashboard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A comprehensive dashboard for displaying performance metrics with real-time updates,
trend indicators, and status visualization. Combines ProgressBar and StatusBadge
components to provide detailed performance monitoring capabilities.

## Features
- Multiple layout options (grid, list, compact)
- Real-time metric updates with auto-refresh
- Trend indicators and status visualization
- Progress bars for metrics with targets
- Clickable metrics for detailed views
- Error handling and loading states
- Filtering and sorting capabilities
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    layout: {
      control: { type: 'select' },
      options: ['grid', 'list', 'compact'],
      description: 'Layout configuration',
    },
    columns: {
      control: { type: 'select' },
      options: [1, 2, 3, 4, 6],
      description: 'Number of columns for grid layout',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    showTrends: {
      control: { type: 'boolean' },
      description: 'Whether to show trend indicators',
    },
    showProgress: {
      control: { type: 'boolean' },
      description: 'Whether to show progress bars',
    },
    showTimestamps: {
      control: { type: 'boolean' },
      description: 'Whether to show timestamps',
    },
    animated: {
      control: { type: 'boolean' },
      description: 'Whether to animate value changes',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Loading state',
    },
    className: {
      control: { type: 'text' },
      description: 'Custom CSS class name',
    },
    testId: {
      control: { type: 'text' },
      description: 'Test ID for testing',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const createSampleMetrics = (
  scenario: 'excellent' | 'mixed' | 'critical',
): PerformanceMetric[] => {
  const baseTime = new Date();

  const excellentMetrics: PerformanceMetric[] = [
    {
      id: 'files_per_second',
      label: 'Files/sec',
      value: 1250,
      unit: 'files/s',
      type: 'throughput',
      status: 'excellent',
      previousValue: 1180,
      trend: 'up',
      thresholds: { excellent: 1000, good: 500, warning: 100, critical: 0 },
      higherIsBetter: true,
      description: 'File processing throughput',
      lastUpdated: baseTime,
    },
    {
      id: 'throughput',
      label: 'Throughput',
      value: 145.7,
      unit: 'MB/s',
      type: 'throughput',
      status: 'excellent',
      previousValue: 132.4,
      trend: 'up',
      thresholds: { excellent: 100, good: 50, warning: 10, critical: 0 },
      higherIsBetter: true,
      description: 'Data processing throughput',
      lastUpdated: baseTime,
      format: { decimals: 1 },
    },
    {
      id: 'error_rate',
      label: 'Error Rate',
      value: 0.05,
      unit: '%',
      type: 'error_rate',
      status: 'excellent',
      previousValue: 0.08,
      trend: 'down',
      thresholds: { excellent: 0.1, good: 1, warning: 5, critical: 10 },
      higherIsBetter: false,
      description: 'Percentage of failed operations',
      lastUpdated: baseTime,
      format: { decimals: 2 },
    },
    {
      id: 'memory_usage',
      label: 'Memory',
      value: 45.2,
      unit: '%',
      type: 'resource',
      status: 'excellent',
      previousValue: 47.8,
      trend: 'down',
      target: 80,
      thresholds: { excellent: 50, good: 70, warning: 85, critical: 95 },
      higherIsBetter: false,
      description: 'System memory utilization',
      lastUpdated: baseTime,
      format: { decimals: 1, showProgress: true },
    },
    {
      id: 'cpu_usage',
      label: 'CPU',
      value: 52.8,
      unit: '%',
      type: 'resource',
      status: 'good',
      previousValue: 55.1,
      trend: 'down',
      target: 80,
      thresholds: { excellent: 50, good: 70, warning: 85, critical: 95 },
      higherIsBetter: false,
      description: 'System CPU utilization',
      lastUpdated: baseTime,
      format: { decimals: 1, showProgress: true },
    },
    {
      id: 'queue_depth',
      label: 'Queue',
      value: 8,
      unit: 'items',
      type: 'count',
      status: 'excellent',
      previousValue: 12,
      trend: 'down',
      thresholds: { excellent: 10, good: 50, warning: 200, critical: 1000 },
      higherIsBetter: false,
      description: 'Pending operations in queue',
      lastUpdated: baseTime,
      format: { decimals: 0 },
    },
  ];

  if (scenario === 'excellent') return excellentMetrics;

  if (scenario === 'mixed') {
    return excellentMetrics.map((metric, index) => {
      if (index === 2) {
        return {
          ...metric,
          value: 2.3,
          status: 'warning' as const,
          trend: 'up' as const,
        };
      }
      if (index === 4) {
        return {
          ...metric,
          value: 78.5,
          status: 'warning' as const,
          trend: 'up' as const,
        };
      }
      return metric;
    });
  }

  return excellentMetrics.map((metric, index) => {
    if (index === 0) {
      return {
        ...metric,
        value: 45,
        status: 'critical' as const,
        trend: 'down' as const,
      };
    }
    if (index === 1) {
      return {
        ...metric,
        value: 8.2,
        status: 'critical' as const,
        trend: 'down' as const,
      };
    }
    if (index === 2) {
      return {
        ...metric,
        value: 12.8,
        status: 'critical' as const,
        trend: 'up' as const,
      };
    }
    if (index === 3) {
      return {
        ...metric,
        value: 96.7,
        status: 'critical' as const,
        trend: 'up' as const,
      };
    }
    if (index === 4) {
      return {
        ...metric,
        value: 98.2,
        status: 'critical' as const,
        trend: 'up' as const,
      };
    }
    if (index === 5) {
      return {
        ...metric,
        value: 1250,
        status: 'critical' as const,
        trend: 'up' as const,
      };
    }
    return metric;
  });
};

export const Default: Story = {
  args: {
    metrics: createSampleMetrics('mixed'),
    layout: 'grid',
    columns: 3,
    size: 'md',
    showTrends: true,
    showProgress: true,
  },
};

export const Excellent: Story = {
  args: {
    metrics: createSampleMetrics('excellent'),
    layout: 'grid',
    columns: 3,
    size: 'md',
    showTrends: true,
    showProgress: true,
    animated: true,
  },
};

export const Critical: Story = {
  args: {
    metrics: createSampleMetrics('critical'),
    layout: 'grid',
    columns: 3,
    size: 'md',
    showTrends: true,
    showProgress: true,
    animated: true,
  },
};

export const LayoutComparison: Story = {
  render: () => {
    const metrics = createSampleMetrics('mixed').slice(0, 4);

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Grid Layout
          </h3>
          <PerformanceDashboard
            metrics={metrics}
            layout="grid"
            columns={2}
            showTrends
            showProgress
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            List Layout
          </h3>
          <PerformanceDashboard
            metrics={metrics}
            layout="list"
            showTrends
            showProgress
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Compact Layout
          </h3>
          <PerformanceDashboard
            metrics={metrics}
            layout="compact"
            showTrends={false}
            showProgress={false}
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Comparison between different layout options.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => {
    const metrics = createSampleMetrics('mixed').slice(0, 3);

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Small</h3>
          <PerformanceDashboard
            metrics={metrics}
            size="sm"
            layout="grid"
            columns={3}
            showTrends
            showProgress
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Medium</h3>
          <PerformanceDashboard
            metrics={metrics}
            size="md"
            layout="grid"
            columns={3}
            showTrends
            showProgress
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Large</h3>
          <PerformanceDashboard
            metrics={metrics}
            size="lg"
            layout="grid"
            columns={3}
            showTrends
            showProgress
            showTimestamps
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows all available size options from sm to lg.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [scenario, setScenario] = useState<
      'excellent' | 'mixed' | 'critical'
    >('mixed');
    const [layout, setLayout] = useState<'grid' | 'list' | 'compact'>('grid');
    const [columns, setColumns] = useState<1 | 2 | 3 | 4 | 6>(3);
    const [options, setOptions] = useState({
      showTrends: true,
      showProgress: true,
      showTimestamps: false,
      animated: true,
    });
    const dashboardRef = useRef<PerformanceDashboardRef>(null);

    const metrics = createSampleMetrics(scenario);

    const handleMetricClick = (metric: PerformanceMetric) => {
      alert(
        `Clicked metric: ${metric.label}\nValue: ${metric.value}${metric.unit}\nStatus: ${metric.status}`,
      );
    };

    const handleRefresh = () => {
      setScenario((prev) => {
        const scenarios: Array<'excellent' | 'mixed' | 'critical'> = [
          'excellent',
          'mixed',
          'critical',
        ];
        const currentIndex = scenarios.indexOf(prev);
        return scenarios[(currentIndex + 1) % scenarios.length];
      });
    };

    const handleFocusMetric = (metricId: string) => {
      dashboardRef.current?.focusMetric(metricId);
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interactive Performance Dashboard
          </h3>

          <PerformanceDashboard
            ref={dashboardRef}
            metrics={metrics}
            layout={layout}
            columns={columns}
            showTrends={options.showTrends}
            showProgress={options.showProgress}
            showTimestamps={options.showTimestamps}
            animated={options.animated}
            onMetricClick={handleMetricClick}
            onRefresh={handleRefresh}
            refreshInterval={10000}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">Scenario:</label>
          {(['excellent', 'mixed', 'critical'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`px-3 py-1 text-sm rounded ${
                scenario === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">Layout:</label>
          {(['grid', 'list', 'compact'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-3 py-1 text-sm rounded ${
                layout === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>

        {layout === 'grid' && (
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-gray-700">Columns:</label>
            {([1, 2, 3, 4, 6] as const).map((c) => (
              <button
                key={c}
                onClick={() => setColumns(c)}
                className={`px-3 py-1 text-sm rounded ${
                  columns === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Options:</label>
          <div className="flex flex-wrap gap-4">
            {Object.entries(options).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-gray-700">Focus metric:</label>
          {metrics.slice(0, 3).map((metric) => (
            <button
              key={metric.id}
              onClick={() => handleFocusMetric(metric.id)}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example demonstrating all dashboard features and programmatic control.',
      },
    },
  },
};

export const RealTimeSimulation: Story = {
  render: () => {
    const [isRunning, setIsRunning] = useState(false);
    const [scanData, setScanData] = useState<ScanPerformanceData>({
      filesPerSecond: 850,
      bytesPerSecond: 125 * 1024 * 1024,
      errorRate: 0.2,
      memoryUsage: 65.4,
      cpuUsage: 72.1,
      queueDepth: 45,
      activeWorkers: 4,
      totalFilesProcessed: 125000,
      estimatedTimeRemaining: 180,
    });

    const [previousData, setPreviousData] = useState<ScanPerformanceData>();

    useEffect(() => {
      if (!isRunning) return;

      const interval = setInterval(() => {
        setPreviousData(scanData);
        setScanData((prev) => ({
          ...prev,
          filesPerSecond: Math.max(
            0,
            prev.filesPerSecond! + (Math.random() - 0.5) * 100,
          ),
          bytesPerSecond: Math.max(
            0,
            prev.bytesPerSecond! + (Math.random() - 0.5) * 10 * 1024 * 1024,
          ),
          errorRate: Math.max(
            0,
            Math.min(10, prev.errorRate! + (Math.random() - 0.5) * 0.5),
          ),
          memoryUsage: Math.max(
            0,
            Math.min(100, prev.memoryUsage! + (Math.random() - 0.5) * 5),
          ),
          cpuUsage: Math.max(
            0,
            Math.min(100, prev.cpuUsage! + (Math.random() - 0.5) * 10),
          ),
          queueDepth: Math.max(
            0,
            prev.queueDepth! + Math.floor((Math.random() - 0.5) * 20),
          ),
          totalFilesProcessed:
            prev.totalFilesProcessed! + Math.floor(Math.random() * 1000),
          estimatedTimeRemaining: Math.max(0, prev.estimatedTimeRemaining! - 1),
        }));
      }, 1000);

      return () => clearInterval(interval);
    }, [isRunning, scanData]);

    const metrics = createScanMetrics(scanData, previousData);

    const handleToggleSimulation = () => {
      setIsRunning((prev) => !prev);
    };

    const handleRefresh = () => {
      setScanData((prev) => ({
        ...prev,
        filesPerSecond: 750 + Math.random() * 500,
        bytesPerSecond: (100 + Math.random() * 100) * 1024 * 1024,
      }));
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Real-time Scan Performance Simulation
          </h3>

          <PerformanceDashboard
            metrics={metrics}
            layout="grid"
            columns={3}
            showTrends
            showProgress
            showTimestamps
            animated
            refreshInterval={isRunning ? 2000 : undefined}
            onRefresh={handleRefresh}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleToggleSimulation}
            className={`px-4 py-2 rounded-md text-white transition-colors ${
              isRunning
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRunning ? 'Stop Simulation' : 'Start Simulation'}
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Manual Refresh
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            This example uses the <code>createScanMetrics</code> utility to
            convert scan performance data into dashboard metrics.
          </p>
          <p>
            Status: {isRunning ? 'Running' : 'Stopped'} | Total Files:{' '}
            {scanData.totalFilesProcessed?.toLocaleString()}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Real-time simulation using the createScanMetrics utility with live data updates.',
      },
    },
  },
};

export const StateExamples: Story = {
  render: () => {
    const [currentState, setCurrentState] = useState<
      'loading' | 'error' | 'empty' | 'normal'
    >('normal');
    const metrics = createSampleMetrics('mixed');

    const getProps = () => {
      switch (currentState) {
        case 'loading':
          return { metrics: [], isLoading: true };
        case 'error':
          return {
            metrics: [],
            error: 'Failed to connect to monitoring service',
          };
        case 'empty':
          return { metrics: [] };
        default:
          return { metrics };
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Dashboard States
          </h3>

          <PerformanceDashboard
            {...getProps()}
            layout="grid"
            columns={3}
            showTrends
            showProgress
            onRefresh={() => setCurrentState('normal')}
          />
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-gray-700">State:</label>
          {(['normal', 'loading', 'error', 'empty'] as const).map((state) => (
            <button
              key={state}
              onClick={() => setCurrentState(state)}
              className={`px-3 py-1 text-sm rounded ${
                currentState === state
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates loading, error, empty, and normal states.',
      },
    },
  },
};

export const FilteringExample: Story = {
  render: () => {
    const [filter, setFilter] = useState<
      'all' | 'throughput' | 'resource' | 'critical'
    >('all');
    const metrics = createSampleMetrics('mixed');

    const getFilter = () => {
      switch (filter) {
        case 'throughput':
          return (metric: PerformanceMetric) => metric.type === 'throughput';
        case 'resource':
          return (metric: PerformanceMetric) => metric.type === 'resource';
        case 'critical':
          return (metric: PerformanceMetric) =>
            ['critical', 'warning'].includes(metric.status);
        default:
          return undefined;
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Filtered Dashboard
          </h3>

          <PerformanceDashboard
            metrics={metrics}
            layout="grid"
            columns={3}
            showTrends
            showProgress
            filter={getFilter()}
          />
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-gray-700">Filter:</label>
          {(['all', 'throughput', 'resource', 'critical'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates metric filtering by type and status.',
      },
    },
  },
};
