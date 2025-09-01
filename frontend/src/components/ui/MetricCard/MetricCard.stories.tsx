import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useState, useEffect } from 'react';
import { action } from '@/utils/storybook-utils';

import {
  Activity,
  Clock,
  Database,
  Download,
  HardDrive,
  Zap,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

import { MetricCard } from './MetricCard';
import type { Metric, MetricStatus, MetricTrend } from './MetricCard.types';

const meta: Meta<typeof MetricCard> = {
  title: 'UI/MetricCard',
  component: MetricCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A versatile metric display component with status indicators, trends, and formatting options.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    layout: {
      control: 'radio',
      options: ['default', 'compact', 'detailed', 'minimal'],
    },
    showTrend: {
      control: 'boolean',
    },
    showTrendChart: {
      control: 'boolean',
    },
    showLastUpdated: {
      control: 'boolean',
    },
    showComparison: {
      control: 'boolean',
    },
    animated: {
      control: 'boolean',
    },
    clickable: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

const createMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: 'sample-metric',
  label: 'Files Processed',
  value: 1547,
  type: 'count',
  status: 'good',
  trend: 'up',
  trendPercentage: 12.5,
  lastUpdated: new Date(),
  ...overrides,
});

const generateTrendData = (points = 10, baseValue = 100, variance = 20) => {
  return Array.from({ length: points }, (_, i) => ({
    timestamp: Date.now() - (points - i) * 60000, // 1 minute intervals
    value: baseValue + (Math.random() - 0.5) * variance + i * 2, // Slight upward trend
  }));
};

export const Default: Story = {
  args: {
    metric: createMetric({
      icon: <Activity className="w-5 h-5" />,
      description: 'Total number of files processed in the current scan',
    }),
    size: 'md',
    layout: 'default',
    showTrend: true,
    showLastUpdated: true,
    animated: true,
    onClick: action('Metric clicked'),
    onHover: action('Metric hovered'),
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Small',
          icon: <Activity className="w-4 h-4" />,
        })}
        size="sm"
      />
      <MetricCard
        metric={createMetric({
          label: 'Medium',
          icon: <Activity className="w-5 h-5" />,
        })}
        size="md"
      />
      <MetricCard
        metric={createMetric({
          label: 'Large',
          icon: <Activity className="w-6 h-6" />,
        })}
        size="lg"
      />
      <MetricCard
        metric={createMetric({
          label: 'Extra Large',
          icon: <Activity className="w-8 h-8" />,
        })}
        size="xl"
      />
    </div>
  ),
};

export const Layouts: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="font-semibold">Default Layout</h3>
        <MetricCard
          metric={createMetric({
            label: 'Scan Progress',
            value: 67.5,
            type: 'percentage',
            icon: <Database className="w-5 h-5" />,
            description: 'Current scan completion percentage',
          })}
          layout="default"
          showTrend
          showLastUpdated
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Compact Layout</h3>
        <MetricCard
          metric={createMetric({
            label: 'Throughput',
            value: 245,
            type: 'rate',
            unit: 'files',
            icon: <Zap className="w-5 h-5" />,
          })}
          layout="compact"
          showTrend
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Detailed Layout</h3>
        <MetricCard
          metric={createMetric({
            label: 'Storage Used',
            value: 2147483648, // 2GB in bytes
            type: 'bytes',
            icon: <HardDrive className="w-5 h-5" />,
            description: 'Total storage space used by scanned files',
            previousValue: 1879048192, // ~1.75GB
          })}
          layout="detailed"
          showTrend
          showComparison
          showLastUpdated
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Minimal Layout</h3>
        <MetricCard
          metric={createMetric({
            label: 'Active Users',
            value: 23,
            type: 'count',
            icon: <Users className="w-5 h-5" />,
          })}
          layout="minimal"
          showTrend={false}
        />
      </div>
    </div>
  ),
};

export const MetricTypes: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Completion',
          value: 87.3,
          type: 'percentage',
          status: 'good',
          icon: <CheckCircle className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Data Processed',
          value: 5368709120, // 5GB
          type: 'bytes',
          status: 'good',
          icon: <Download className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Scan Duration',
          value: 145000, // 2m 25s
          type: 'duration',
          status: 'info',
          icon: <Clock className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Files/Second',
          value: 42.7,
          type: 'rate',
          unit: 'files',
          status: 'good',
          icon: <Zap className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Total Files',
          value: 15247,
          type: 'count',
          status: 'neutral',
          icon: <Database className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Custom Value',
          value: 'Online',
          type: 'custom',
          status: 'good',
          icon: <Activity className="w-5 h-5" />,
        })}
      />
    </div>
  ),
};

export const Statuses: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Good Status',
          value: 98.5,
          type: 'percentage',
          status: 'good',
          icon: <CheckCircle className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Warning Status',
          value: 78.2,
          type: 'percentage',
          status: 'warning',
          icon: <AlertTriangle className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Critical Status',
          value: 23.1,
          type: 'percentage',
          status: 'critical',
          icon: <AlertTriangle className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Info Status',
          value: 156,
          type: 'count',
          status: 'info',
          icon: <Activity className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Neutral Status',
          value: 42,
          type: 'count',
          status: 'neutral',
          icon: <Database className="w-5 h-5" />,
        })}
      />
    </div>
  ),
};

export const Trends: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Trending Up',
          value: 1247,
          type: 'count',
          status: 'good',
          trend: 'up',
          trendPercentage: 15.3,
          icon: <TrendingUp className="w-5 h-5" />,
        })}
        showTrend
      />

      <MetricCard
        metric={createMetric({
          label: 'Trending Down',
          value: 892,
          type: 'count',
          status: 'warning',
          trend: 'down',
          trendPercentage: -8.7,
          icon: <TrendingUp className="w-5 h-5" />,
        })}
        showTrend
      />

      <MetricCard
        metric={createMetric({
          label: 'Stable',
          value: 445,
          type: 'count',
          status: 'neutral',
          trend: 'stable',
          icon: <Activity className="w-5 h-5" />,
        })}
        showTrend
      />
    </div>
  ),
};

export const WithTrendCharts: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <MetricCard
        metric={createMetric({
          label: 'Files Processed',
          value: 1547,
          type: 'count',
          status: 'good',
          trend: 'up',
          trendPercentage: 12.5,
          trendData: generateTrendData(15, 1400, 100),
          icon: <Database className="w-5 h-5" />,
        })}
        showTrend
        showTrendChart
        showLastUpdated
      />

      <MetricCard
        metric={createMetric({
          label: 'Throughput',
          value: 42.7,
          type: 'rate',
          unit: 'files',
          status: 'good',
          trend: 'up',
          trendPercentage: 8.3,
          trendData: generateTrendData(20, 35, 15),
          icon: <Zap className="w-5 h-5" />,
        })}
        showTrend
        showTrendChart
        layout="detailed"
      />
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [metrics, setMetrics] = useState([
      createMetric({
        id: 'files',
        label: 'Files Processed',
        value: 1547,
        type: 'count',
        status: 'good',
        trend: 'up',
        trendPercentage: 12.5,
        icon: <Database className="w-5 h-5" />,
      }),
      createMetric({
        id: 'throughput',
        label: 'Processing Rate',
        value: 42.7,
        type: 'rate',
        unit: 'files',
        status: 'good',
        trend: 'stable',
        icon: <Zap className="w-5 h-5" />,
      }),
      createMetric({
        id: 'errors',
        label: 'Error Rate',
        value: 2.1,
        type: 'percentage',
        status: 'warning',
        trend: 'down',
        trendPercentage: -5.2,
        icon: <AlertTriangle className="w-5 h-5" />,
      }),
    ]);

    const [isSimulating, setIsSimulating] = useState(false);

    const simulateRealTime = () => {
      if (isSimulating) return;

      setIsSimulating(true);
      const interval = setInterval(() => {
        setMetrics((prevMetrics) =>
          prevMetrics.map((metric) => ({
            ...metric,
            value:
              typeof metric.value === 'number'
                ? metric.value + Math.floor(Math.random() * 10) - 5
                : metric.value,
            lastUpdated: new Date(),
          })),
        );
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        setIsSimulating(false);
      }, 10000);
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              metric={metric}
              clickable
              showTrend
              showLastUpdated
              animated
              onClick={action('Metric clicked')}
              onHover={action('Metric hovered')}
            />
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={simulateRealTime}
            disabled={isSimulating}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {isSimulating ? 'Simulating...' : 'Simulate Real-time Updates'}
          </button>
        </div>
      </div>
    );
  },
};

export const LoadingAndErrors: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Loading Metric',
          value: 0,
          type: 'count',
          status: 'neutral',
          loading: true,
          icon: <Activity className="w-5 h-5" />,
        })}
      />

      <MetricCard
        metric={createMetric({
          label: 'Error Metric',
          value: 0,
          type: 'count',
          status: 'critical',
          error: 'Failed to fetch data',
          icon: <AlertTriangle className="w-5 h-5" />,
        })}
        layout="detailed"
      />

      <MetricCard
        metric={createMetric({
          label: 'Normal Metric',
          value: 1247,
          type: 'count',
          status: 'good',
          icon: <CheckCircle className="w-5 h-5" />,
        })}
      />
    </div>
  ),
};

export const ScanMonitoring: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        metric={createMetric({
          label: 'Scan Progress',
          value: 67.3,
          type: 'percentage',
          status: 'good',
          trend: 'up',
          trendPercentage: 2.1,
          icon: <Database className="w-5 h-5" />,
          description: 'Overall scan completion',
        })}
        layout="detailed"
        showTrend
      />

      <MetricCard
        metric={createMetric({
          label: 'Files/Second',
          value: 245.7,
          type: 'rate',
          unit: 'files',
          status: 'good',
          trend: 'stable',
          icon: <Zap className="w-5 h-5" />,
        })}
        showTrend
      />

      <MetricCard
        metric={createMetric({
          label: 'Data Processed',
          value: 8589934592, // 8GB
          type: 'bytes',
          status: 'info',
          trend: 'up',
          trendPercentage: 15.2,
          icon: <Download className="w-5 h-5" />,
        })}
        showTrend
      />

      <MetricCard
        metric={createMetric({
          label: 'Errors',
          value: 3,
          type: 'count',
          status: 'warning',
          trend: 'down',
          trendPercentage: -25,
          icon: <AlertTriangle className="w-5 h-5" />,
        })}
        showTrend
      />
    </div>
  ),
};
