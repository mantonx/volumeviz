/**
 * Integration tests for volume management user flows
 * Tests the complete user journey from volume discovery to scanning
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { BrowserRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';
import VolumesPage from '@/pages/VolumesPage/VolumesPage';
import { AppProvider } from '@/providers/AppProvider';

// MSW server with handlers
const server = setupServer(...handlers);

// Custom render function with all providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>
      </JotaiProvider>
    </BrowserRouter>
  );
}

describe('Volume Management Integration', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('Volume Discovery and Display', () => {
    it('should display volumes list on page load', async () => {
      renderWithProviders(<VolumesPage />);

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Verify volume cards are displayed
      expect(screen.getByText('redis-cache-vol')).toBeInTheDocument();
      expect(screen.getByText('orphaned-volume')).toBeInTheDocument();

      // Verify volume details are shown
      const productionVolume = screen.getByText('production-db-data').closest('[data-testid="volume-card"]');
      if (productionVolume) {
        expect(within(productionVolume).getByText(/2\.00 GB/i)).toBeInTheDocument();
      }
    });

    it('should filter volumes by search term', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Search for specific volume
      const searchInput = screen.getByPlaceholderText(/search volumes/i);
      await user.type(searchInput, 'redis');

      // Verify filtering
      await waitFor(() => {
        expect(screen.getByText('redis-cache-vol')).toBeInTheDocument();
        expect(screen.queryByText('production-db-data')).not.toBeInTheDocument();
      });
    });

    it('should toggle between card and table view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click view toggle button
      const toggleButton = screen.getByTestId('view-toggle');
      await user.click(toggleButton);

      // Verify table view is shown
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Verify table headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Volume Scanning', () => {
    it('should trigger volume scan and show progress', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find scan button for specific volume
      const volumeCard = screen.getByText('production-db-data').closest('[data-testid="volume-card"]');
      const scanButton = within(volumeCard!).getByTestId('scan-button');

      // Click scan button
      await user.click(scanButton);

      // Verify scan started
      await waitFor(() => {
        expect(screen.getByText(/scanning/i)).toBeInTheDocument();
      });

      // Verify progress indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle scan errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Override handler to return error
      server.use(
        http.post('/api/v1/volumes/:volumeId/scan', () => {
          return HttpResponse.json(
            { error: 'Scan failed: Volume busy' },
            { status: 503 }
          );
        })
      );

      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      const volumeCard = screen.getByText('production-db-data').closest('[data-testid="volume-card"]');
      const scanButton = within(volumeCard!).getByTestId('scan-button');

      await user.click(scanButton);

      // Verify error message is shown
      await waitFor(() => {
        expect(screen.getByText(/scan failed/i)).toBeInTheDocument();
      });
    });

    it('should perform bulk scan operations', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Select multiple volumes
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk actions button
      const bulkActionsButton = screen.getByText(/bulk actions/i);
      await user.click(bulkActionsButton);

      // Select scan all from dropdown
      const scanAllOption = screen.getByText(/scan selected/i);
      await user.click(scanAllOption);

      // Verify bulk scan started
      await waitFor(() => {
        expect(screen.getByText(/scanning 2 volumes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Volume Details Navigation', () => {
    it('should navigate to volume details on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Click on volume name to navigate
      const volumeName = screen.getByText('production-db-data');
      await user.click(volumeName);

      // Verify navigation (in real app, would check URL change)
      await waitFor(() => {
        expect(screen.getByTestId('volume-details-page')).toBeInTheDocument();
      });

      // Verify details are shown
      expect(screen.getByText(/mount point/i)).toBeInTheDocument();
      expect(screen.getByText(/last scanned/i)).toBeInTheDocument();
    });

    it('should show file explorer in volume details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Navigate to details
      await user.click(screen.getByText('production-db-data'));

      // Click on files tab
      const filesTab = screen.getByRole('tab', { name: /files/i });
      await user.click(filesTab);

      // Verify file browser is shown
      await waitFor(() => {
        expect(screen.getByTestId('file-browser')).toBeInTheDocument();
      });

      // Verify files are listed
      expect(screen.getByText('config.json')).toBeInTheDocument();
      expect(screen.getByText('data.db')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should receive WebSocket updates for scan progress', async () => {
      // Mock WebSocket
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Simulate WebSocket message
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        messageHandler({
          data: JSON.stringify({
            type: 'scan_progress_update',
            data: {
              volume_id: 'production-db-data',
              progress: 75,
              status: 'running'
            }
          })
        });
      }

      // Verify UI updates with progress
      await waitFor(() => {
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });
    });
  });

  describe('Organization Context', () => {
    it('should filter volumes by organization', async () => {
      renderWithProviders(<VolumesPage />);

      // Verify organization context is applied
      await waitFor(() => {
        expect(screen.getByText(/volumeviz demo organization/i)).toBeInTheDocument();
      });

      // Verify only org volumes are shown
      const volumes = screen.getAllByTestId('volume-card');
      expect(volumes).toHaveLength(3);
    });

    it('should show organization statistics', async () => {
      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('org-stats')).toBeInTheDocument();
      });

      const stats = screen.getByTestId('org-stats');
      expect(within(stats).getByText(/total volumes: 3/i)).toBeInTheDocument();
      expect(within(stats).getByText(/total size:/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error state when API is unavailable', async () => {
      // Override all handlers to return errors
      server.use(
        http.get('/api/v1/volumes', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<VolumesPage />);

      // Verify error message is shown
      await waitFor(() => {
        expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      });

      // Verify retry button is available
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should retry failed requests', async () => {
      const user = userEvent.setup();
      let attemptCount = 0;

      server.use(
        http.get('/api/v1/volumes', () => {
          attemptCount++;
          if (attemptCount === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            success: true,
            data: [],
            pagination: { page: 1, page_size: 25, total: 0, has_more: false }
          });
        })
      );

      renderWithProviders(<VolumesPage />);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Verify successful retry
      await waitFor(() => {
        expect(screen.queryByText(/failed to load volumes/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Offline Support', () => {
    it('should queue operations when offline', async () => {
      const user = userEvent.setup();
      
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      renderWithProviders(<VolumesPage />);

      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Try to scan while offline
      const volumeCard = screen.getByText('production-db-data').closest('[data-testid="volume-card"]');
      const scanButton = within(volumeCard!).getByTestId('scan-button');
      await user.click(scanButton);

      // Verify offline message
      await waitFor(() => {
        expect(screen.getByText(/operation queued for sync/i)).toBeInTheDocument();
      });

      // Verify sync indicator
      expect(screen.getByTestId('sync-status')).toHaveTextContent(/1 pending/i);
    });

    it('should sync queued operations when back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      renderWithProviders(<VolumesPage />);

      // Queue some operations...

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Trigger online event
      window.dispatchEvent(new Event('online'));

      // Verify sync starts
      await waitFor(() => {
        expect(screen.getByText(/syncing/i)).toBeInTheDocument();
      });

      // Verify sync completes
      await waitFor(() => {
        expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('sync-status')).toHaveTextContent(/synced/i);
      });
    });
  });
});