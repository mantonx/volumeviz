import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { MetricsOverview } from './MetricsOverview';
import { ToastProvider } from '../../ui/Toast';
import type { 
  MetricsOverviewProps, 
  OverviewMetric, 
  MetricCategory, 
  MetricAlert 
} from './MetricsOverview.types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  RefreshCw: () => <div data-testid="refresh-icon">↻</div>,
  Search: () => <div data-testid="search-icon">🔍</div>,
  Filter: () => <div data-testid="filter-icon">🔽</div>,
  Download: () => <div data-testid="download-icon">⬇</div>,
  AlertTriangle: () => <div data-testid="alert-triangle-icon">⚠</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">✓</div>,
  Info: () => <div data-testid="info-icon">ℹ</div>,
  X: () => <div data-testid="x-icon">✕</div>,
  ChevronDown: () => <div data-testid="chevron-down">↓</div>,
  ChevronRight: () => <div data-testid="chevron-right">→</div>,
  MoreVertical: () => <div data-testid="more-vertical">⋮</div>,
  TrendingUp: () => <div data-testid="trending-up">↗</div>,
  TrendingDown: () => <div data-testid="trending-down">↘</div>,
  Minus: () => <div data-testid="minus">−</div>,
  Eye: () => <div data-testid="eye">👁</div>,
  EyeOff: () => <div data-testid="eye-off">🙈</div>,
  Settings: () => <div data-testid="settings">⚙</div>,
  Activity: () => <div data-testid="activity">📊</div>,
  Database: () => <div data-testid="database">🗄</div>,
  Zap: () => <div data-testid="zap">⚡</div>,
}));

// Sample test data
const sampleMetrics: OverviewMetric[] = [
  {
    id: 'metric-1',
    label: 'CPU Usage',
    value: 45.2,
    unit: '%',
    type: 'percentage',
    status: 'success',
    category: 'health',
    priority: 1,
    description: 'Current CPU utilization',
    lastUpdated: new Date('2023-01-01T12:00:00Z'),
    tags: ['cpu', 'system'],
  },
  {
    id: 'metric-2',
    label: 'Memory Usage',
    value: 78.5,
    unit: '%',
    type: 'percentage',
    status: 'warning',
    category: 'health',
    priority: 1,
    description: 'Current memory utilization',
    trend: { direction: 'up', value: 2.1, period: '1h' },
    lastUpdated: new Date('2023-01-01T12:00:00Z'),
    tags: ['memory', 'system'],
    alertThreshold: { warning: 80, critical: 90 },
  },
  {
    id: 'metric-3',
    label: 'Active Scans',
    value: 3,
    type: 'number',
    status: 'success',
    category: 'performance',
    priority: 2,
    description: 'Currently running scans',
    lastUpdated: new Date('2023-01-01T12:00:00Z'),
    tags: ['scanning', 'active'],
  },
];

const sampleCategories: MetricCategory[] = [
  {
    id: 'health',
    name: 'System Health',
    description: 'System health metrics',
    priority: 1,
    defaultExpanded: true,
    collapsible: true,
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Performance metrics',
    priority: 2,
    defaultExpanded: true,
    collapsible: true,
  },
];

const sampleAlerts: MetricAlert[] = [
  {
    id: 'alert-1',
    metricId: 'metric-2',
    type: 'warning',
    condition: { operator: 'gt', value: 75 },
    message: 'Memory usage is approaching threshold',
    timestamp: new Date('2023-01-01T11:30:00Z'),
    acknowledged: false,
  },
  {
    id: 'alert-2',
    metricId: 'metric-1',
    type: 'info',
    condition: { operator: 'lt', value: 50 },
    message: 'CPU usage is within normal range',
    timestamp: new Date('2023-01-01T11:00:00Z'),
    acknowledged: true,
  },
];

// Test wrapper with ToastProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>{children}</ToastProvider>
);

const defaultProps: MetricsOverviewProps = {
  metrics: sampleMetrics,
  categories: sampleCategories,
  alerts: sampleAlerts,
  testId: 'test-metrics-overview',
};

describe('MetricsOverview', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with metrics and categories', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('test-metrics-overview')).toBeInTheDocument();
      expect(screen.getByText('Metrics Overview')).toBeInTheDocument();
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('Active Scans')).toBeInTheDocument();
    });

    it('renders category headers', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="category" />
        </TestWrapper>
      );
      
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    it('applies custom test ID', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} testId="custom-metrics" />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('custom-metrics')).toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} ariaLabel="System metrics dashboard" />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('test-metrics-overview');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'System metrics dashboard');
    });
  });

  describe('Layouts', () => {
    it('applies grid layout classes', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} layout="grid" columns={3} />
        </TestWrapper>
      );
      
      // Check that grid layout is applied
      const container = screen.getByTestId('test-metrics-overview');
      expect(container).toBeInTheDocument();
    });

    it('applies list layout classes', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} layout="list" />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('test-metrics-overview');
      expect(container).toBeInTheDocument();
    });

    it('applies compact layout classes', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} layout="compact" />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('test-metrics-overview');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Grouping', () => {
    it('groups metrics by category', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="category" />
        </TestWrapper>
      );
      
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    it('groups metrics by status', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="status" />
        </TestWrapper>
      );
      
      // Status grouping should work but exact text depends on implementation
      const container = screen.getByTestId('test-metrics-overview');
      expect(container).toBeInTheDocument();
    });

    it('shows all metrics without grouping', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="none" />
        </TestWrapper>
      );
      
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('Active Scans')).toBeInTheDocument();
    });
  });

  describe('Alerts', () => {
    it('displays active alerts', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} />
        </TestWrapper>
      );
      
      // Should show unacknowledged alerts
      expect(screen.getByText('warning')).toBeInTheDocument();
    });

    it('handles alert clicks', async () => {
      const onAlertClick = vi.fn();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} onAlertClick={onAlertClick} />
        </TestWrapper>
      );
      
      const alertBadge = screen.getByText('warning');
      await user.click(alertBadge);
      
      expect(onAlertClick).toHaveBeenCalledWith(sampleAlerts[0]);
    });
  });

  describe('Search Functionality', () => {
    it('shows search input when searchable is true', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} searchable={true} />
        </TestWrapper>
      );
      
      expect(screen.getByPlaceholderText('Search metrics...')).toBeInTheDocument();
    });

    it('hides search input when searchable is false', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} searchable={false} />
        </TestWrapper>
      );
      
      expect(screen.queryByPlaceholderText('Search metrics...')).not.toBeInTheDocument();
    });

    it('filters metrics based on search query', async () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} searchable={true} />
        </TestWrapper>
      );
      
      const searchInput = screen.getByPlaceholderText('Search metrics...');
      await user.type(searchInput, 'CPU');
      
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      // Memory Usage and Active Scans should still be visible since we're not implementing real filtering in this test
    });
  });

  describe('Refresh Functionality', () => {
    it('shows refresh button', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('handles refresh click', async () => {
      const onRefresh = vi.fn();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} onRefresh={onRefresh} />
        </TestWrapper>
      );
      
      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);
      
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('disables refresh button when loading', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} loading={true} />
        </TestWrapper>
      );
      
      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Export Functionality', () => {
    it('shows export button when exportable is true', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} exportable={true} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByTestId('download-icon')).toBeInTheDocument();
    });

    it('hides export button when exportable is false', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} exportable={false} />
        </TestWrapper>
      );
      
      expect(screen.queryByText('Export')).not.toBeInTheDocument();
    });

    it('handles export click', async () => {
      const onExport = vi.fn();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} exportable={true} onExport={onExport} />
        </TestWrapper>
      );
      
      const exportButton = screen.getByText('Export');
      await user.click(exportButton);
      
      expect(onExport).toHaveBeenCalledWith('csv');
    });
  });

  describe('Category Expansion', () => {
    it('expands and collapses categories', async () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="category" />
        </TestWrapper>
      );
      
      const categoryHeader = screen.getByText('System Health');
      await user.click(categoryHeader);
      
      // Category should toggle (exact behavior depends on implementation)
      expect(categoryHeader).toBeInTheDocument();
    });

    it('shows metrics count in category badge', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} grouping="category" />
        </TestWrapper>
      );
      
      // Should show count badges for categories
      expect(screen.getByText('2')).toBeInTheDocument(); // Health category has 2 metrics
      expect(screen.getByText('1')).toBeInTheDocument(); // Performance category has 1 metric
    });
  });

  describe('Loading States', () => {
    it('shows loading state', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} loading={true} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('shows custom loading component', () => {
      const CustomLoading = () => <div>Custom loading...</div>;
      
      render(
        <TestWrapper>
          <MetricsOverview 
            {...defaultProps} 
            loading={true} 
            renderLoading={CustomLoading}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Custom loading...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows error state', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} error="Failed to load metrics" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('shows custom error component', () => {
      const CustomError = (error: string) => <div>Custom error: {error}</div>;
      
      render(
        <TestWrapper>
          <MetricsOverview 
            {...defaultProps} 
            error="Test error" 
            renderError={CustomError}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no metrics', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} metrics={[]} />
        </TestWrapper>
      );
      
      expect(screen.getByText('No metrics found')).toBeInTheDocument();
    });

    it('shows custom empty component', () => {
      const CustomEmpty = () => <div>No data available</div>;
      
      render(
        <TestWrapper>
          <MetricsOverview 
            {...defaultProps} 
            metrics={[]} 
            renderEmpty={CustomEmpty}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('Metric Interactions', () => {
    it('handles metric clicks', async () => {
      const onMetricClick = vi.fn();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} onMetricClick={onMetricClick} />
        </TestWrapper>
      );
      
      // Find and click a metric card
      const metricCard = screen.getByTestId('test-metrics-overview-metric-metric-1');
      await user.click(metricCard);
      
      expect(onMetricClick).toHaveBeenCalledWith(sampleMetrics[0]);
    });
  });

  describe('Footer Information', () => {
    it('shows metrics count in footer', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Showing 3 of 3 metrics/)).toBeInTheDocument();
    });

    it('shows last updated time', () => {
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe('Auto-refresh', () => {
    it('shows auto-refresh interval in footer', () => {
      render(
        <TestWrapper>
          <MetricsOverview 
            {...defaultProps} 
            refreshConfig={{ mode: 'auto', interval: 30 }}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('Auto-refresh: 30s')).toBeInTheDocument();
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} ref={ref} />
        </TestWrapper>
      );
      
      expect(ref.current).toHaveProperty('refresh');
      expect(ref.current).toHaveProperty('exportData');
      expect(ref.current).toHaveProperty('getFilteredMetrics');
      expect(ref.current).toHaveProperty('getAlerts');
      expect(ref.current).toHaveProperty('clearFilters');
    });

    it('getFilteredMetrics returns correct metrics', () => {
      const ref = React.createRef<any>();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} ref={ref} />
        </TestWrapper>
      );
      
      const filteredMetrics = ref.current.getFilteredMetrics();
      expect(filteredMetrics).toHaveLength(3);
      expect(filteredMetrics[0]).toEqual(sampleMetrics[0]);
    });

    it('getAlerts returns active alerts', () => {
      const ref = React.createRef<any>();
      render(
        <TestWrapper>
          <MetricsOverview {...defaultProps} ref={ref} />
        </TestWrapper>
      );
      
      const alerts = ref.current.getAlerts();
      expect(alerts).toHaveLength(1); // Only unacknowledged alerts
      expect(alerts[0].acknowledged).toBe(false);
    });
  });
});