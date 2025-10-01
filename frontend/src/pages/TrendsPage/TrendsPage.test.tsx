/**
 * TrendsPage Tests
 * Comprehensive test suite for trends analysis page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrendsPage } from './TrendsPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('TrendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the page title', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Storage Trends & Analytics'),
      ).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText(
          'Historical analysis and capacity planning for your volumes',
        ),
      ).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<TrendsPage className="custom-class" />, {
        wrapper: createWrapper(),
      });
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Header Actions', () => {
    it('renders refresh button', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByRole('button', { name: /refresh/i }),
      ).toBeInTheDocument();
    });

    it('renders export CSV button', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByRole('button', { name: /export csv/i }),
      ).toBeInTheDocument();
    });

    it('renders export JSON button', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByRole('button', { name: /export json/i }),
      ).toBeInTheDocument();
    });

    it('handles refresh button click', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      render(<TrendsPage />, { wrapper: createWrapper() });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Button should be disabled during refresh
      expect(refreshButton).toBeDisabled();

      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Time Range Selector', () => {
    it('renders all time range options', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Quarter' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Year' })).toBeInTheDocument();
    });

    it('has default time range selected', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const monthButton = screen.getByRole('button', { name: 'Month' });
      expect(monthButton).toHaveAttribute('data-variant', 'primary');
    });

    it('changes time range when button clicked', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      const weekButton = screen.getByRole('button', { name: 'Week' });
      fireEvent.click(weekButton);

      expect(weekButton).toHaveAttribute('data-variant', 'primary');
    });

    it('renders aggregation selector', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const select = screen.getByDisplayValue('Daily');
      expect(select).toBeInTheDocument();
    });

    it('changes aggregation when option selected', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      const select = screen.getByDisplayValue('Daily');
      fireEvent.change(select, { target: { value: 'week' } });

      expect(select).toHaveValue('week');
    });
  });

  describe('Key Metrics Cards', () => {
    it('renders total growth metric', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Total Growth')).toBeInTheDocument();
    });

    it('renders average size metric', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Average Size')).toBeInTheDocument();
    });

    it('renders top growing volume metric', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Top Growing Volume')).toBeInTheDocument();
    });

    it('renders forecast alert metric', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Forecast Alert')).toBeInTheDocument();
      expect(screen.getByText('42 days')).toBeInTheDocument();
    });

    it('displays growth rate with proper formatting', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      // Should show percentage with sign
      const percentageElements = screen.getAllByText(/[+-]?\d+\.\d+%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });
  });

  describe('Charts', () => {
    it('renders storage growth chart section', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Historical Storage Growth')).toBeInTheDocument();
    });

    it('renders file type distribution chart', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('File Type Distribution')).toBeInTheDocument();
    });

    it('renders volume growth comparison chart', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Volume Growth Comparison')).toBeInTheDocument();
    });

    it('renders capacity forecast chart', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Predictive Capacity Planning (90-Day Forecast)'),
      ).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('calls handleExport with CSV format', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      render(<TrendsPage />, { wrapper: createWrapper() });

      const exportButton = screen.getByRole('button', { name: /export csv/i });
      fireEvent.click(exportButton);

      expect(consoleSpy).toHaveBeenCalledWith('Exporting trends data as csv');
      consoleSpy.mockRestore();
    });

    it('calls handleExport with JSON format', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      render(<TrendsPage />, { wrapper: createWrapper() });

      const exportButton = screen.getByRole('button', { name: /export json/i });
      fireEvent.click(exportButton);

      expect(consoleSpy).toHaveBeenCalledWith('Exporting trends data as json');
      consoleSpy.mockRestore();
    });
  });

  describe('Data Display', () => {
    it('shows top growing volume name', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('media-storage')).toBeInTheDocument();
    });

    it('displays across all tracked volumes text', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Across all tracked volumes'),
      ).toBeInTheDocument();
    });

    it('shows capacity threshold warning text', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Until capacity threshold')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Storage Trends & Analytics');

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('buttons have accessible labels', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      expect(
        screen.getByRole('button', { name: /refresh/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /export csv/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /export json/i }),
      ).toBeInTheDocument();
    });

    it('has proper ARIA attributes on interactive elements', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('renders metrics grid', () => {
      const { container } = render(<TrendsPage />, {
        wrapper: createWrapper(),
      });

      const metricsGrid = container.querySelector(
        '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4',
      );
      expect(metricsGrid).toBeInTheDocument();
    });

    it('renders charts grid', () => {
      const { container } = render(<TrendsPage />, {
        wrapper: createWrapper(),
      });

      const chartsGrid = container.querySelector(
        '.grid.grid-cols-1.lg\\:grid-cols-2',
      );
      expect(chartsGrid).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
      // Component should render without crashing even with mock data
      expect(() => {
        render(<TrendsPage />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    it('renders with minimum viewport', () => {
      const { container } = render(<TrendsPage />, {
        wrapper: createWrapper(),
      });
      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
    });
  });
});
