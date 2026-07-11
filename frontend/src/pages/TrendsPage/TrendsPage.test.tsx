/**
 * TrendsPage Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TrendsPage } from './TrendsPage';

const volumesResponse = {
  data: [{ name: 'media-storage' }, { name: 'backups' }],
  page: 1,
  page_size: 100,
  total: 2,
  summary: {
    total_volumes: 2,
    tracked_volumes: 2,
    orphaned_volumes: 0,
    total_size_bytes: 20_000_000_000,
  },
};

const allVolumesSummaryResponse = {
  total_volumes_tracked: 2,
  volumes_with_growth: 1,
  volumes_with_decline: 0,
  average_growth_rate: 5.2,
  total_storage_growth: 1_073_741_824,
  volumes: [
    {
      volume_id: 'media-storage',
      statistics: {
        total_growth: 1_073_741_824,
        growth_rate_percent: 5.2,
        current_size: 10_737_418_240,
      },
      data_points: [
        { date: '2026-07-10', total_size: 10_737_418_240, file_count: 4213 },
      ],
    },
  ],
  period: { start: '2026-06-10', end: '2026-07-10', days: 30 },
  generated_at: '2026-07-10T00:00:00Z',
};

const volumeTrendsResponse = {
  volume_id: 'media-storage',
  summary: {
    current_size: 10_737_418_240,
    current_files: 4213,
    total_growth_bytes: 1_073_741_824,
    total_growth_files: 120,
    avg_daily_growth_bytes: 35_791_394,
    avg_daily_growth_files: 4,
  },
  daily_stats: [
    {
      date: '2026-07-10',
      total_bytes: 10_737_418_240,
      files_count: 4213,
      added_bytes: 500_000,
      removed_bytes: 0,
      added_files: 5,
      removed_files: 0,
      disk_total_bytes: 1_000_000_000_000,
      disk_available_bytes: 400_000_000_000,
    },
  ],
  media_composition: [
    { media_kind: 'video', date: '2026-07-10', files_count: 812, total_bytes: 8_589_934_592 },
  ],
  top_growing_folders: [],
  capacity_forecast: {
    daily_growth_bytes: 35_791_394,
    current_size_bytes: 10_737_418_240,
    disk_available_bytes: 400_000_000_000,
    days_until_capacity: 42,
    series: Array.from({ length: 90 }, (_, i) => ({
      date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      projected_size_bytes: 10_737_418_240 + i * 35_791_394,
    })),
  },
};

const server = setupServer(
  http.get('/api/v1/volumes', () => HttpResponse.json(volumesResponse)),
  http.get('/api/v1/trends/summary', () =>
    HttpResponse.json(allVolumesSummaryResponse),
  ),
  http.get('/api/v1/trends/volumes/:volumeId', () =>
    HttpResponse.json(volumeTrendsResponse),
  ),
);

beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});
afterAll(() => server.close());

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

    it('renders export CSV and JSON buttons', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByRole('button', { name: /export csv/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /export json/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
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
      expect(monthButton.className).toContain('bg-blue-600');
    });

    it('changes time range when button clicked', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const weekButton = screen.getByRole('button', { name: 'Week' });
      fireEvent.click(weekButton);
      expect(weekButton.className).toContain('bg-blue-600');
    });

    it('renders aggregation selector with only Daily/Weekly/Monthly options', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const select = screen.getByDisplayValue('Daily');
      expect(select).toBeInTheDocument();
      expect(screen.queryByText('Hourly')).not.toBeInTheDocument();
    });

    it('changes aggregation when option selected', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const select = screen.getByDisplayValue('Daily');
      fireEvent.change(select, { target: { value: 'week' } });
      expect(select).toHaveValue('week');
    });

    it('renders a volume selector populated from the real volumes list', async () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      const volumeSelect = screen.getByDisplayValue(/all volumes/i);
      await waitFor(() => {
        expect(
          within(volumeSelect).getByText('media-storage'),
        ).toBeInTheDocument();
      });
      expect(within(volumeSelect).getByText('backups')).toBeInTheDocument();
    });
  });

  describe('Key Metrics (all-volumes view)', () => {
    it('renders total growth from the real summary endpoint', async () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Total Growth')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('1 GB')).toBeInTheDocument();
      });
    });

    it('shows a placeholder forecast stat until a volume is selected', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Forecast Alert')).toBeInTheDocument();
      expect(screen.getByText('Select a volume to forecast')).toBeInTheDocument();
    });
  });

  describe('Per-volume view', () => {
    it('shows the real forecast once a volume is selected', async () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      const volumeSelect = screen.getByDisplayValue(/all volumes/i);
      await waitFor(() => {
        expect(
          within(volumeSelect).getByText('media-storage'),
        ).toBeInTheDocument();
      });
      fireEvent.change(volumeSelect, {
        target: { value: 'media-storage' },
      });

      await waitFor(() => {
        expect(screen.getByText('42 days')).toBeInTheDocument();
      });
      expect(screen.getByText('Until host disk capacity')).toBeInTheDocument();
    });

    it('replaces the file type empty-state once a volume with real media_composition data is selected', async () => {
      render(<TrendsPage />, { wrapper: createWrapper() });

      expect(
        screen.getByText('Select a volume above to see its file type breakdown'),
      ).toBeInTheDocument();

      const volumeSelect = screen.getByDisplayValue(/all volumes/i);
      await waitFor(() => {
        expect(
          within(volumeSelect).getByText('media-storage'),
        ).toBeInTheDocument();
      });
      fireEvent.change(volumeSelect, {
        target: { value: 'media-storage' },
      });

      await waitFor(() => {
        expect(
          screen.queryByText('Select a volume above to see its file type breakdown'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('No file type data yet for this volume'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('exports JSON via a real file download, not a console.log stub', async () => {
      const clickSpy = vi.fn();
      const realCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string, ...rest: any[]) => {
          const el = realCreateElement(tag, ...rest);
          if (tag === 'a') {
            el.click = clickSpy;
          }
          return el;
        });
      if (!URL.createObjectURL) {
        (URL as any).createObjectURL = () => 'blob:mock';
      }
      if (!URL.revokeObjectURL) {
        (URL as any).revokeObjectURL = () => {};
      }
      const createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock');
      const revokeObjectURLSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {});

      render(<TrendsPage />, { wrapper: createWrapper() });

      const exportButton = screen.getByRole('button', { name: /export json/i });
      fireEvent.click(exportButton);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Charts', () => {
    it('renders storage growth chart section', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Historical Storage Growth')).toBeInTheDocument();
    });

    it('renders file type distribution chart section', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('File Type Distribution')).toBeInTheDocument();
    });

    it('renders volume growth comparison chart section', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Volume Growth Comparison')).toBeInTheDocument();
    });

    it('renders capacity forecast chart section', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Predictive Capacity Planning (90-Day Forecast)'),
      ).toBeInTheDocument();
    });

    it('shows an empty-state prompt instead of a chart when no volume is selected', () => {
      render(<TrendsPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Select a volume above to see its storage history'),
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
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
