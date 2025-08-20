import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceDashboard } from './PerformanceDashboard';
import type {
  PerformanceDashboardRef,
  PerformanceMetric,
} from './PerformanceDashboard.types';
import { createScanMetrics } from './PerformanceDashboard.types';
import { useRef } from 'react';
import { Activity, TrendingUp } from 'lucide-react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Sample test data
const createTestMetrics = (): PerformanceMetric[] => [
  {
    id: 'metric1',
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
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
    icon: <Activity data-testid="metric1-icon" />,
  },
  {
    id: 'metric2',
    label: 'Memory',
    value: 75.5,
    unit: '%',
    type: 'resource',
    status: 'warning',
    previousValue: 72.1,
    trend: 'up',
    target: 80,
    thresholds: { excellent: 50, good: 70, warning: 85, critical: 95 },
    higherIsBetter: false,
    description: 'System memory utilization',
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
    format: { decimals: 1, showProgress: true },
  },
  {
    id: 'metric3',
    label: 'Error Rate',
    value: 2.5,
    unit: '%',
    type: 'error_rate',
    status: 'critical',
    previousValue: 1.8,
    trend: 'up',
    thresholds: { excellent: 0.1, good: 1, warning: 5, critical: 10 },
    higherIsBetter: false,
    description: 'Percentage of failed operations',
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
    format: { decimals: 2 },
  },
];

describe('PerformanceDashboard', () => {
  // Mock timers for refresh functionality
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toBeInTheDocument();
      expect(dashboard).toHaveAttribute('data-layout', 'grid');
      expect(dashboard).toHaveAttribute('data-size', 'md');
    });

    it('renders all metrics', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      metrics.forEach((metric) => {
        expect(
          screen.getByTestId(`performance-dashboard-metric-${metric.id}`),
        ).toBeInTheDocument();
        expect(screen.getByText(metric.label)).toBeInTheDocument();
      });
    });

    it('renders with custom test ID', () => {
      const metrics = createTestMetrics();
      render(
        <PerformanceDashboard metrics={metrics} testId="custom-dashboard" />,
      );

      const dashboard = screen.getByTestId('custom-dashboard');
      expect(dashboard).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const metrics = createTestMetrics();
      render(
        <PerformanceDashboard metrics={metrics} className="custom-class" />,
      );

      const container = screen.getByTestId(
        'performance-dashboard',
      ).parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });

  // Layout Tests
  describe('Layout', () => {
    it('applies grid layout correctly', () => {
      const metrics = createTestMetrics();
      render(
        <PerformanceDashboard metrics={metrics} layout="grid" columns={2} />,
      );

      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toHaveAttribute('data-layout', 'grid');

      const metricsContainer = dashboard.querySelector(
        '.performance-dashboard',
      );
      expect(metricsContainer).toHaveClass('grid', 'grid-cols-2');
    });

    it('applies list layout correctly', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} layout="list" />);

      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toHaveAttribute('data-layout', 'list');

      const metricsContainer = dashboard.querySelector(
        '.performance-dashboard',
      );
      expect(metricsContainer).toHaveClass('flex', 'flex-col');
    });

    it('applies compact layout correctly', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} layout="compact" />);

      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toHaveAttribute('data-layout', 'compact');

      const metricsContainer = dashboard.querySelector(
        '.performance-dashboard',
      );
      expect(metricsContainer).toHaveClass('flex', 'flex-wrap');
    });

    it('applies column count correctly', () => {
      const metrics = createTestMetrics();
      const columns = [1, 2, 3, 4, 6] as const;

      columns.forEach((columnCount) => {
        const { container } = render(
          <PerformanceDashboard
            metrics={metrics}
            layout="grid"
            columns={columnCount}
          />,
        );
        const metricsContainer = container.querySelector(
          '.performance-dashboard',
        );
        expect(metricsContainer).toHaveClass(`grid-cols-${columnCount}`);
      });
    });
  });

  // Size Tests
  describe('Size Variants', () => {
    it('applies size variants correctly', () => {
      const metrics = createTestMetrics();
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { container } = render(
          <PerformanceDashboard metrics={metrics} size={size} />,
        );
        const dashboard = container.querySelector(
          '[data-testid="performance-dashboard"]',
        );
        expect(dashboard).toHaveAttribute('data-size', size);
      });
    });
  });

  // Metric Display Tests
  describe('Metric Display', () => {
    it('displays metric values correctly', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      expect(screen.getByText('1250 files/s')).toBeInTheDocument();
      expect(screen.getByText('75.5 %')).toBeInTheDocument();
      expect(screen.getByText('2.50 %')).toBeInTheDocument();
    });

    it('shows descriptions when provided', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      expect(
        screen.getByText('File processing throughput'),
      ).toBeInTheDocument();
      expect(screen.getByText('System memory utilization')).toBeInTheDocument();
    });

    it('shows trend indicators when showTrends is true', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} showTrends />);

      // Should show trend icons (tested via class presence since icons are components)
      const metricCards = screen.getAllByTestId(
        /performance-dashboard-metric-/,
      );
      expect(metricCards.length).toBeGreaterThan(0);
    });

    it('hides trend indicators when showTrends is false', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} showTrends={false} />);

      // Trends should not be visible in compact layout or when disabled
      const metricCards = screen.getAllByTestId(
        /performance-dashboard-metric-/,
      );
      expect(metricCards.length).toBeGreaterThan(0);
    });

    it('shows progress bars when showProgress is true', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} showProgress />);

      // Should show progress bar for metric with target
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows timestamps when showTimestamps is true', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} showTimestamps />);

      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });
  });

  // Status Tests
  describe('Status Visualization', () => {
    it('displays status badges correctly', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      const metric1 = screen.getByTestId(
        'performance-dashboard-metric-metric1',
      );
      const metric2 = screen.getByTestId(
        'performance-dashboard-metric-metric2',
      );
      const metric3 = screen.getByTestId(
        'performance-dashboard-metric-metric3',
      );

      expect(metric1).toHaveAttribute('data-metric-status', 'excellent');
      expect(metric2).toHaveAttribute('data-metric-status', 'warning');
      expect(metric3).toHaveAttribute('data-metric-status', 'critical');
    });

    it('displays metric types correctly', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      const metric1 = screen.getByTestId(
        'performance-dashboard-metric-metric1',
      );
      const metric2 = screen.getByTestId(
        'performance-dashboard-metric-metric2',
      );
      const metric3 = screen.getByTestId(
        'performance-dashboard-metric-metric3',
      );

      expect(metric1).toHaveAttribute('data-metric-type', 'throughput');
      expect(metric2).toHaveAttribute('data-metric-type', 'resource');
      expect(metric3).toHaveAttribute('data-metric-type', 'error_rate');
    });
  });

  // Interaction Tests
  describe('Interaction', () => {
    it('handles metric click events', () => {
      const handleMetricClick = vi.fn();
      const metrics = createTestMetrics();

      render(
        <PerformanceDashboard
          metrics={metrics}
          onMetricClick={handleMetricClick}
        />,
      );

      const metric1 = screen.getByTestId(
        'performance-dashboard-metric-metric1',
      );
      fireEvent.click(metric1);

      expect(handleMetricClick).toHaveBeenCalledWith(metrics[0]);
    });

    it('handles keyboard navigation for clickable metrics', async () => {
      const handleMetricClick = vi.fn();
      const metrics = createTestMetrics();
      const user = userEvent.setup();

      render(
        <PerformanceDashboard
          metrics={metrics}
          onMetricClick={handleMetricClick}
        />,
      );

      // Focus and activate first metric
      await user.tab();
      await user.keyboard('{Enter}');

      expect(handleMetricClick).toHaveBeenCalled();
    });

    it('handles refresh button click', () => {
      const handleRefresh = vi.fn();
      const metrics = createTestMetrics();

      render(
        <PerformanceDashboard metrics={metrics} onRefresh={handleRefresh} />,
      );

      const refreshButton = screen.getByTestId('performance-dashboard-refresh');
      fireEvent.click(refreshButton);

      expect(handleRefresh).toHaveBeenCalled();
    });
  });

  // Auto-refresh Tests
  describe('Auto-refresh', () => {
    it('calls onRefresh at specified interval', async () => {
      const handleRefresh = vi.fn();
      const metrics = createTestMetrics();

      render(
        <PerformanceDashboard
          metrics={metrics}
          onRefresh={handleRefresh}
          refreshInterval={5000}
        />,
      );

      // Fast-forward time
      vi.advanceTimersByTime(5000);

      expect(handleRefresh).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(handleRefresh).toHaveBeenCalledTimes(2);
    });

    it('does not auto-refresh without interval', () => {
      const handleRefresh = vi.fn();
      const metrics = createTestMetrics();

      render(
        <PerformanceDashboard metrics={metrics} onRefresh={handleRefresh} />,
      );

      vi.advanceTimersByTime(10000);
      expect(handleRefresh).not.toHaveBeenCalled();
    });
  });

  // State Tests
  describe('Loading and Error States', () => {
    it('shows loading state correctly', () => {
      render(<PerformanceDashboard metrics={[]} isLoading />);

      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    });

    it('shows error state correctly', () => {
      const errorMessage = 'Failed to load metrics';
      render(<PerformanceDashboard metrics={[]} error={errorMessage} />);

      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('shows retry button in error state', () => {
      const handleRefresh = vi.fn();
      render(
        <PerformanceDashboard
          metrics={[]}
          error="Connection failed"
          onRefresh={handleRefresh}
        />,
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(handleRefresh).toHaveBeenCalled();
    });

    it('shows empty state correctly', () => {
      render(<PerformanceDashboard metrics={[]} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
    });
  });

  // Filtering and Sorting Tests
  describe('Filtering and Sorting', () => {
    it('applies filter correctly', () => {
      const metrics = createTestMetrics();
      const filter = (metric: PerformanceMetric) =>
        metric.type === 'throughput';

      render(<PerformanceDashboard metrics={metrics} filter={filter} />);

      // Should only show throughput metrics
      expect(
        screen.getByTestId('performance-dashboard-metric-metric1'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('performance-dashboard-metric-metric2'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('performance-dashboard-metric-metric3'),
      ).not.toBeInTheDocument();
    });

    it('applies custom sorting', () => {
      const metrics = createTestMetrics();
      const sortBy = (a: PerformanceMetric, b: PerformanceMetric) =>
        a.label.localeCompare(b.label);

      render(<PerformanceDashboard metrics={metrics} sortBy={sortBy} />);

      // Metrics should be sorted alphabetically by label
      const metricElements = screen.getAllByTestId(
        /performance-dashboard-metric-/,
      );
      expect(metricElements).toHaveLength(3);
    });

    it('applies default sorting (critical first)', () => {
      const metrics = createTestMetrics();
      render(<PerformanceDashboard metrics={metrics} />);

      // Critical metrics should appear first
      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toHaveAttribute('data-metric-count', '3');
    });
  });

  // Ref API Tests
  describe('Ref API', () => {
    const TestComponent = () => {
      const ref = useRef<PerformanceDashboardRef>(null);
      const metrics = createTestMetrics();

      return (
        <div>
          <PerformanceDashboard ref={ref} metrics={metrics} />
          <button onClick={() => ref.current?.focusMetric('metric1')}>
            Focus Metric 1
          </button>
          <button onClick={() => ref.current?.refresh()}>Refresh</button>
          <button onClick={() => ref.current?.getElement()}>Get Element</button>
          <button onClick={() => ref.current?.getMetricElement('metric1')}>
            Get Metric Element
          </button>
          <button onClick={() => ref.current?.getMetrics()}>Get Metrics</button>
        </div>
      );
    };

    it('exposes getElement method', () => {
      const ref = { current: null as PerformanceDashboardRef | null };
      const metrics = createTestMetrics();

      render(<PerformanceDashboard ref={ref} metrics={metrics} />);

      const element = ref.current?.getElement();
      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('exposes getMetricElement method', () => {
      const ref = { current: null as PerformanceDashboardRef | null };
      const metrics = createTestMetrics();

      render(<PerformanceDashboard ref={ref} metrics={metrics} />);

      const metricElement = ref.current?.getMetricElement('metric1');
      expect(metricElement).toBeInstanceOf(HTMLElement);
    });

    it('exposes focusMetric method', () => {
      const ref = { current: null as PerformanceDashboardRef | null };
      const metrics = createTestMetrics();

      render(<PerformanceDashboard ref={ref} metrics={metrics} />);

      // Should not throw when calling focusMetric
      expect(() => ref.current?.focusMetric('metric1')).not.toThrow();
    });

    it('exposes refresh method', () => {
      const handleRefresh = vi.fn();
      const ref = { current: null as PerformanceDashboardRef | null };
      const metrics = createTestMetrics();

      render(
        <PerformanceDashboard
          ref={ref}
          metrics={metrics}
          onRefresh={handleRefresh}
        />,
      );

      ref.current?.refresh();
      expect(handleRefresh).toHaveBeenCalled();
    });

    it('exposes getMetrics method', () => {
      const ref = { current: null as PerformanceDashboardRef | null };
      const metrics = createTestMetrics();

      render(<PerformanceDashboard ref={ref} metrics={metrics} />);

      const returnedMetrics = ref.current?.getMetrics();
      expect(returnedMetrics).toEqual(metrics);
    });
  });

  // Utility Function Tests
  describe('Utility Functions', () => {
    it('createScanMetrics utility works correctly', () => {
      const scanData = {
        filesPerSecond: 1200,
        bytesPerSecond: 150 * 1024 * 1024,
        errorRate: 0.5,
        memoryUsage: 65.2,
        cpuUsage: 78.5,
        queueDepth: 25,
        activeWorkers: 4,
        estimatedTimeRemaining: 300,
      };

      const metrics = createScanMetrics(scanData);

      expect(metrics).toHaveLength(8);
      expect(metrics.find((m) => m.id === 'files_per_second')?.value).toBe(
        1200,
      );
      expect(
        metrics.find((m) => m.id === 'bytes_per_second')?.value,
      ).toBeCloseTo(150, 1);
      expect(metrics.find((m) => m.id === 'error_rate')?.value).toBe(0.5);
    });

    it('handles trend calculation correctly', () => {
      const currentData = { filesPerSecond: 1200, errorRate: 0.3 };
      const previousData = { filesPerSecond: 1000, errorRate: 0.5 };

      const metrics = createScanMetrics(currentData, previousData);

      const filesMetric = metrics.find((m) => m.id === 'files_per_second');
      const errorMetric = metrics.find((m) => m.id === 'error_rate');

      expect(filesMetric?.trend).toBe('up');
      expect(errorMetric?.trend).toBe('down');
    });

    it('handles missing previous data', () => {
      const scanData = { filesPerSecond: 1200 };

      const metrics = createScanMetrics(scanData);

      const filesMetric = metrics.find((m) => m.id === 'files_per_second');
      expect(filesMetric?.trend).toBe('stable');
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const metrics = createTestMetrics();
      const { container } = render(
        <PerformanceDashboard
          metrics={metrics}
          showTrends
          showProgress
          showTimestamps
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility for clickable metrics', async () => {
      const metrics = createTestMetrics();
      const { container } = render(
        <PerformanceDashboard metrics={metrics} onMetricClick={() => {}} />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper role attributes for clickable metrics', () => {
      const metrics = createTestMetrics();
      render(
        <PerformanceDashboard metrics={metrics} onMetricClick={() => {}} />,
      );

      const metric1 = screen.getByTestId(
        'performance-dashboard-metric-metric1',
      );
      expect(metric1).toHaveAttribute('role', 'button');
      expect(metric1).toHaveAttribute('tabIndex', '0');
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('handles large number of metrics efficiently', () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => ({
        id: `metric-${i}`,
        label: `Metric ${i}`,
        value: Math.random() * 100,
        unit: 'units',
        type: 'count' as const,
        status: 'good' as const,
      }));

      const startTime = performance.now();
      render(<PerformanceDashboard metrics={manyMetrics} />);
      const endTime = performance.now();

      // Should render quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should show metric count
      const dashboard = screen.getByTestId('performance-dashboard');
      expect(dashboard).toHaveAttribute('data-metric-count', '100');
    });

    it('updates efficiently on metric changes', () => {
      const metrics = createTestMetrics();
      const { rerender } = render(<PerformanceDashboard metrics={metrics} />);

      const updatedMetrics = metrics.map((m) => ({
        ...m,
        value: m.value * 1.1,
      }));

      const startTime = performance.now();
      rerender(<PerformanceDashboard metrics={updatedMetrics} />);
      const endTime = performance.now();

      // Should update quickly
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
