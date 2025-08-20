import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { MetricCard } from './MetricCard';
import type { Metric, MetricCardProps } from './MetricCard.types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <div data-testid="trending-up">↗</div>,
  TrendingDown: () => <div data-testid="trending-down">↘</div>,
  Minus: () => <div data-testid="minus">–</div>,
  Clock: () => <div data-testid="clock">🕒</div>,
  AlertTriangle: () => <div data-testid="alert-triangle">⚠</div>,
  CheckCircle: () => <div data-testid="check-circle">✓</div>,
  Info: () => <div data-testid="info">ℹ</div>,
  HelpCircle: () => <div data-testid="help-circle">?</div>,
  Activity: () => <div data-testid="activity">📊</div>,
}));

// Sample metric for testing
const createTestMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: 'test-metric',
  label: 'Test Metric',
  value: 100,
  type: 'count',
  status: 'good',
  lastUpdated: new Date('2023-06-01T12:00:00Z'),
  ...overrides,
});

const defaultProps: MetricCardProps = {
  metric: createTestMetric(),
  testId: 'test-metric-card',
};

describe('MetricCard', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders metric label and value correctly', () => {
      render(<MetricCard {...defaultProps} />);

      expect(screen.getByText('Test Metric')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('renders with custom test ID', () => {
      render(<MetricCard {...defaultProps} />);

      expect(screen.getByTestId('test-metric-card')).toBeInTheDocument();
    });

    it('applies correct status colors', () => {
      const { rerender } = render(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'good' })} />
      );

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('border-green-200', 'bg-green-50');

      rerender(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'critical' })} />
      );
      expect(card).toHaveClass('border-red-200', 'bg-red-50');

      rerender(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'warning' })} />
      );
      expect(card).toHaveClass('border-yellow-200', 'bg-yellow-50');
    });

    it('renders status icons correctly', () => {
      const { rerender } = render(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'good' })} />
      );

      expect(screen.getByTestId('check-circle')).toBeInTheDocument();

      rerender(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'critical' })} />
      );
      expect(screen.getByTestId('alert-triangle')).toBeInTheDocument();

      rerender(
        <MetricCard {...defaultProps} metric={createTestMetric({ status: 'info' })} />
      );
      expect(screen.getByTestId('info')).toBeInTheDocument();
    });

    it('renders custom icons when provided', () => {
      const customIcon = <div data-testid="custom-icon">🔧</div>;
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ icon: customIcon })} 
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    it('formats percentage values correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ value: 75.5, type: 'percentage' })} 
        />
      );

      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('formats byte values correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ value: 1073741824, type: 'bytes' })} 
        />
      );

      expect(screen.getByText('1.0 GB')).toBeInTheDocument();
    });

    it('formats duration values correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ value: 65000, type: 'duration' })} 
        />
      );

      expect(screen.getByText('1m 5s')).toBeInTheDocument();
    });

    it('formats rate values correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            value: 42.7, 
            type: 'rate', 
            unit: 'files' 
          })} 
        />
      );

      expect(screen.getByText('42.7 files/s')).toBeInTheDocument();
    });

    it('formats count values correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ value: 1547, type: 'count' })} 
        />
      );

      expect(screen.getByText('1,547')).toBeInTheDocument();
    });

    it('handles string values', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ value: 'Online', type: 'custom' })} 
        />
      );

      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('uses custom formatting function when provided', () => {
      const customFormatter = vi.fn(() => 'Custom: 100');
      render(
        <MetricCard 
          {...defaultProps} 
          formatValue={customFormatter}
        />
      );

      expect(screen.getByText('Custom: 100')).toBeInTheDocument();
      expect(customFormatter).toHaveBeenCalledWith(100, 'count', undefined);
    });
  });

  describe('Sizes', () => {
    it('applies small size classes', () => {
      render(<MetricCard {...defaultProps} size="sm" />);

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('p-3');
    });

    it('applies medium size classes by default', () => {
      render(<MetricCard {...defaultProps} />);

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('p-4');
    });

    it('applies large size classes', () => {
      render(<MetricCard {...defaultProps} size="lg" />);

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('p-6');
    });

    it('applies extra large size classes', () => {
      render(<MetricCard {...defaultProps} size="xl" />);

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('p-8');
    });
  });

  describe('Layouts', () => {
    it('renders compact layout correctly', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          layout="compact"
          metric={createTestMetric({ 
            trend: 'up',
            trendPercentage: 12.5 
          })}
          showTrend
        />
      );

      expect(screen.getByText('Test Metric')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByTestId('trending-up')).toBeInTheDocument();
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
    });

    it('renders detailed layout with description', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          layout="detailed"
          metric={createTestMetric({ 
            description: 'This is a test metric description' 
          })}
        />
      );

      expect(screen.getByText('This is a test metric description')).toBeInTheDocument();
    });
  });

  describe('Trend Display', () => {
    it('shows trend information when enabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            trend: 'up',
            trendPercentage: 15.3 
          })}
          showTrend
        />
      );

      expect(screen.getByTestId('trending-up')).toBeInTheDocument();
      expect(screen.getByText('+15.3%')).toBeInTheDocument();
    });

    it('hides trend information when disabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            trend: 'up',
            trendPercentage: 15.3 
          })}
          showTrend={false}
        />
      );

      expect(screen.queryByTestId('trending-up')).not.toBeInTheDocument();
      expect(screen.queryByText('+15.3%')).not.toBeInTheDocument();
    });

    it('renders different trend directions correctly', () => {
      const { rerender } = render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ trend: 'up' })}
          showTrend
        />
      );

      expect(screen.getByTestId('trending-up')).toBeInTheDocument();

      rerender(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ trend: 'down' })}
          showTrend
        />
      );
      expect(screen.getByTestId('trending-down')).toBeInTheDocument();

      rerender(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ trend: 'stable' })}
          showTrend
        />
      );
      expect(screen.getByTestId('minus')).toBeInTheDocument();
    });

    it('uses custom trend formatting when provided', () => {
      const customTrendFormatter = vi.fn(() => 'Custom trend: up');
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            trend: 'up',
            trendPercentage: 12.5 
          })}
          showTrend
          formatTrend={customTrendFormatter}
        />
      );

      expect(screen.getByText('Custom trend: up')).toBeInTheDocument();
      expect(customTrendFormatter).toHaveBeenCalledWith('up', 12.5);
    });
  });

  describe('Last Updated Display', () => {
    it('shows last updated time when enabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          showLastUpdated
        />
      );

      expect(screen.getByTestId('clock')).toBeInTheDocument();
      // Check for time format (this will depend on locale)
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('hides last updated time when disabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          showLastUpdated={false}
        />
      );

      expect(screen.queryByTestId('clock')).not.toBeInTheDocument();
    });
  });

  describe('Comparison Display', () => {
    it('shows comparison with previous value when enabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            value: 150,
            previousValue: 120 
          })}
          showComparison
        />
      );

      expect(screen.getByText('vs 120')).toBeInTheDocument();
    });

    it('hides comparison when disabled', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            value: 150,
            previousValue: 120 
          })}
          showComparison={false}
        />
      );

      expect(screen.queryByText('vs 120')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when card is clicked and clickable', async () => {
      const mockOnClick = vi.fn();
      render(
        <MetricCard 
          {...defaultProps} 
          clickable
          onClick={mockOnClick}
        />
      );

      const card = screen.getByTestId('test-metric-card');
      await user.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-metric',
          label: 'Test Metric',
        })
      );
    });

    it('does not call onClick when not clickable', async () => {
      const mockOnClick = vi.fn();
      render(
        <MetricCard 
          {...defaultProps} 
          clickable={false}
          onClick={mockOnClick}
        />
      );

      const card = screen.getByTestId('test-metric-card');
      await user.click(card);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('calls onHover when card is hovered', async () => {
      const mockOnHover = vi.fn();
      render(
        <MetricCard 
          {...defaultProps} 
          onHover={mockOnHover}
        />
      );

      const card = screen.getByTestId('test-metric-card');
      await user.hover(card);

      expect(mockOnHover).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-metric',
          label: 'Test Metric',
        })
      );
    });

    it('supports keyboard navigation when clickable', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          clickable
        />
      );

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveAttribute('tabindex', '0');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('does not support keyboard navigation when not clickable', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          clickable={false}
        />
      );

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveAttribute('tabindex', '-1');
      expect(card).not.toHaveAttribute('role', 'button');
    });
  });

  describe('Loading State', () => {
    it('shows loading state when loading prop is true', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          loading
        />
      );

      expect(screen.getByText('---')).toBeInTheDocument();
      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('opacity-75');
    });

    it('shows loading state when metric.loading is true', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ loading: true })}
        />
      );

      expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('shows spinner in loading overlay', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          loading
        />
      );

      const spinner = screen.getByTestId('test-metric-card').querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when metric has error', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            error: 'Failed to fetch data',
            status: 'critical' 
          })}
          layout="detailed"
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });

    it('shows "Error" as value when metric has error', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ error: 'Network error' })}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(<MetricCard {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty('getMetric');
      expect(ref.current).toHaveProperty('updateValue');
      expect(ref.current).toHaveProperty('refresh');
      expect(ref.current).toHaveProperty('focus');
    });

    it('getMetric returns current metric data', () => {
      const ref = React.createRef<any>();
      const testMetric = createTestMetric();
      render(<MetricCard metric={testMetric} ref={ref} />);

      const returnedMetric = ref.current.getMetric();
      expect(returnedMetric).toEqual(testMetric);
    });
  });

  describe('Trend Chart', () => {
    it('renders sparkline when trend data is available', () => {
      const trendData = [
        { timestamp: Date.now() - 300000, value: 90 },
        { timestamp: Date.now() - 240000, value: 95 },
        { timestamp: Date.now() - 180000, value: 98 },
        { timestamp: Date.now() - 120000, value: 100 },
        { timestamp: Date.now() - 60000, value: 105 },
        { timestamp: Date.now(), value: 110 },
      ];

      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            trendData,
            trend: 'up' 
          })}
          showTrendChart
        />
      );

      const svg = screen.getByTestId('test-metric-card').querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not render sparkline when trend data is insufficient', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          metric={createTestMetric({ 
            trendData: [{ timestamp: Date.now(), value: 100 }] // Only one point
          })}
          showTrendChart
        />
      );

      const svg = screen.getByTestId('test-metric-card').querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('applies animation classes when animated is true', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          animated
        />
      );

      const card = screen.getByTestId('test-metric-card');
      expect(card).toHaveClass('transition-all', 'duration-300');
    });

    it('does not apply animation classes when animated is false', () => {
      render(
        <MetricCard 
          {...defaultProps} 
          animated={false}
        />
      );

      const card = screen.getByTestId('test-metric-card');
      expect(card).not.toHaveClass('transition-all', 'duration-300');
    });
  });
});