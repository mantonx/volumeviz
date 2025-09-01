/**
 * Integration tests for Volume Management workflows
 * Tests complete user flows from loading volumes to performing operations
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import Dashboard from '@/pages/Dashboard/Dashboard';
import { backgroundSyncManager } from '@/utils/background-sync';

// Mock background sync manager
jest.mock('@/utils/background-sync', () => ({
  backgroundSyncManager: {
    addPendingOperation: jest.fn(),
    getSyncStatus: jest.fn(() => ({
      isOnline: true,
      pendingCount: 0,
      syncInProgress: false,
    })),
  },
  useBackgroundSync: () => ({
    isOnline: true,
    pendingCount: 0,
    syncInProgress: false,
    addPendingOperation: jest.fn(),
    forceSync: jest.fn(),
    clearPending: jest.fn(),
  }),
}));

// Mock notification system
jest.mock('@/utils/notifications', () => ({
  showNotification: jest.fn(),
  showError: jest.fn(),
}));

// Test server setup
const server = setupServer(
  // Organization endpoint
  http.get('/api/v1/organizations/me', () => {
    return HttpResponse.json({
      id: 'org-123',
      name: 'Test Organization',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      users: [
        {
          id: 'user-456',
          email: 'test@example.com',
          role: 'admin',
        },
      ],
    });
  }),

  // Volumes list endpoint
  http.get('/api/v1/volumes', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');

    const allVolumes = [
      {
        name: 'production-db-data',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/production-db-data/_data',
        created_at: '2024-01-15T10:30:00Z',
        size_bytes: 2147483648,
        attachments_count: 1,
        is_orphaned: false,
        scan_status: 'completed',
        filesystem_capacity: {
          total: 107374182400,
          used: 21474836480,
          available: 85899345920,
          percentage: 20,
        },
      },
      {
        name: 'app-logs',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/app-logs/_data',
        created_at: '2024-01-20T14:45:00Z',
        size_bytes: 524288000,
        attachments_count: 0,
        is_orphaned: true,
        scan_status: 'pending',
        filesystem_capacity: {
          total: 107374182400,
          used: 10737418240,
          available: 96636764160,
          percentage: 10,
        },
      },
      {
        name: 'cache-volume',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/cache-volume/_data',
        created_at: '2024-02-01T09:15:00Z',
        size_bytes: 1073741824,
        attachments_count: 2,
        is_orphaned: false,
        scan_status: 'scanning',
        filesystem_capacity: {
          total: 107374182400,
          used: 5368709120,
          available: 102005473280,
          percentage: 5,
        },
      },
    ];

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVolumes = allVolumes.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedVolumes,
      pagination: {
        page,
        page_size: pageSize,
        total_items: allVolumes.length,
        total_pages: Math.ceil(allVolumes.length / pageSize),
      },
    });
  }),

  // Volume size refresh endpoint
  http.post('/api/v1/volumes/:volumeName/size/refresh', ({ params }) => {
    const volumeName = params.volumeName as string;
    return HttpResponse.json({
      volume_id: volumeName,
      size_bytes: Math.floor(Math.random() * 5368709120) + 1048576000,
      file_count: Math.floor(Math.random() * 10000) + 1000,
      last_updated: new Date().toISOString(),
    });
  }),

  // Volume scan endpoint
  http.post('/api/v1/volumes/:volumeName/scan', ({ params }) => {
    const volumeName = params.volumeName as string;
    return HttpResponse.json({
      scan_id: `scan_${volumeName}_${Date.now()}`,
      volume_name: volumeName,
      status: 'started',
      started_at: new Date().toISOString(),
    });
  }),

  // Filesystem index endpoint
  http.post('/api/v1/volumes/:volumeName/filesystem/index', ({ params }) => {
    const volumeName = params.volumeName as string;
    return HttpResponse.json({
      index_id: `index_${volumeName}_${Date.now()}`,
      volume_name: volumeName,
      status: 'started',
      started_at: new Date().toISOString(),
    });
  }),

  // Volume files endpoint
  http.get('/api/v1/volumes/:volumeName/files', ({ params, request }) => {
    const volumeName = params.volumeName as string;
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';

    return HttpResponse.json({
      files: [
        {
          name: 'data.db',
          path: `${path}data.db`,
          type: 'file',
          size: 1048576000,
          modified_at: '2024-01-15T10:30:00Z',
          permissions: 'rw-r--r--',
        },
        {
          name: 'logs',
          path: `${path}logs`,
          type: 'directory',
          size: 0,
          modified_at: '2024-01-15T10:30:00Z',
          permissions: 'drwxr-xr-x',
        },
        {
          name: 'config.json',
          path: `${path}config.json`,
          type: 'file',
          size: 2048,
          modified_at: '2024-01-15T10:30:00Z',
          permissions: 'rw-r--r--',
        },
      ],
      current_path: path,
      volume_name: volumeName,
    });
  })
);

// Test wrapper component
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </JotaiProvider>
    </MemoryRouter>
  );
}

describe('Volume Management Integration', () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('Dashboard Loading and Display', () => {
    it('should load and display volumes with organization info', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for organization data to load
      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      });

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
        expect(screen.getByText('app-logs')).toBeInTheDocument();
        expect(screen.getByText('cache-volume')).toBeInTheDocument();
      });

      // Verify volume details are displayed
      expect(screen.getByText('2.0 GB')).toBeInTheDocument(); // production-db-data size
      expect(screen.getByText('500.0 MB')).toBeInTheDocument(); // app-logs size
      expect(screen.getByText('1.0 GB')).toBeInTheDocument(); // cache-volume size

      // Verify attachment counts
      expect(screen.getByText('1 container')).toBeInTheDocument();
      expect(screen.getByText('0 containers')).toBeInTheDocument();
      expect(screen.getByText('2 containers')).toBeInTheDocument();

      // Verify orphaned status
      expect(screen.getByText('Orphaned')).toBeInTheDocument();
    });

    it('should handle loading states gracefully', async () => {
      // Mock delayed response
      server.use(
        http.get('/api/v1/volumes', () => {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  HttpResponse.json({
                    data: [],
                    pagination: {
                      page: 1,
                      page_size: 20,
                      total_items: 0,
                      total_pages: 0,
                    },
                  })
                ),
              100
            )
          );
        })
      );

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Volume Operations', () => {
    it('should successfully refresh volume size', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click refresh button for production-db-data
      const refreshButton = screen.getByRole('button', {
        name: /refresh.*production-db-data/i,
      });
      
      await user.click(refreshButton);

      // Should show loading state
      expect(refreshButton).toBeDisabled();

      // Wait for operation to complete
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      // Verify success feedback (this would be shown via notification)
      // In a real app, we'd verify the notification was called
    });

    it('should successfully start volume scan', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click scan button
      const scanButton = screen.getByRole('button', {
        name: /scan.*production-db-data/i,
      });
      
      await user.click(scanButton);

      // Should show loading state
      expect(scanButton).toBeDisabled();

      // Wait for operation to complete
      await waitFor(() => {
        expect(scanButton).not.toBeDisabled();
      });
    });

    it('should handle offline operations by queuing them', async () => {
      // Mock offline state
      jest.mocked(require('@/utils/background-sync').useBackgroundSync).mockReturnValue({
        isOnline: false,
        pendingCount: 0,
        syncInProgress: false,
        addPendingOperation: jest.fn(),
        forceSync: jest.fn(),
        clearPending: jest.fn(),
      });

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click refresh button
      const refreshButton = screen.getByRole('button', {
        name: /refresh.*production-db-data/i,
      });
      
      await user.click(refreshButton);

      // Verify operation was queued
      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledWith({
        type: 'refresh',
        volumeId: 'production-db-data',
        maxRetries: 3,
      });
    });
  });

  describe('File Browser Navigation', () => {
    it('should navigate through volume file system', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click browse files button
      const browseButton = screen.getByRole('button', {
        name: /browse.*production-db-data/i,
      });
      
      await user.click(browseButton);

      // Should navigate to file browser and show files
      await waitFor(() => {
        expect(screen.getByText('data.db')).toBeInTheDocument();
        expect(screen.getByText('logs')).toBeInTheDocument();
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });

      // Verify file details are shown
      expect(screen.getByText('1.0 GB')).toBeInTheDocument(); // data.db size
      expect(screen.getByText('2.0 KB')).toBeInTheDocument(); // config.json size

      // Click on directory to navigate deeper
      const logsDirectory = screen.getByRole('button', { name: /logs/ });
      await user.click(logsDirectory);

      // Should navigate to subdirectory
      await waitFor(() => {
        expect(screen.getByText('/logs')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock server error
      server.use(
        http.post('/api/v1/volumes/:volumeName/size/refresh', () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
      });

      // Find and click refresh button
      const refreshButton = screen.getByRole('button', {
        name: /refresh.*production-db-data/i,
      });
      
      await user.click(refreshButton);

      // Wait for error to be handled
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      // In a real app, we'd verify error notification was shown
      // expect(showError).toHaveBeenCalledWith(expect.stringContaining('error'));
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      server.use(
        http.get('/api/v1/volumes', () => {
          return HttpResponse.error();
        })
      );

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Should show error state or empty state
      await waitFor(() => {
        expect(
          screen.queryByText('production-db-data')
        ).not.toBeInTheDocument();
      });

      // Should handle the error gracefully without crashing
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk scan operations', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Wait for volumes to load
      await waitFor(() => {
        expect(screen.getByText('production-db-data')).toBeInTheDocument();
        expect(screen.getByText('app-logs')).toBeInTheDocument();
      });

      // Select multiple volumes (assuming checkboxes exist)
      const checkbox1 = screen.getByRole('checkbox', {
        name: /select.*production-db-data/i,
      });
      const checkbox2 = screen.getByRole('checkbox', {
        name: /select.*app-logs/i,
      });

      await user.click(checkbox1);
      await user.click(checkbox2);

      // Find and click bulk scan button
      const bulkScanButton = screen.getByRole('button', {
        name: /bulk scan/i,
      });
      
      await user.click(bulkScanButton);

      // Should show progress indicator
      expect(bulkScanButton).toBeDisabled();

      // Wait for bulk operation to complete
      await waitFor(() => {
        expect(bulkScanButton).not.toBeDisabled();
      });
    });
  });
});