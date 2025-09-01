/**
 * Integration tests for Search and Analytics workflows
 * Tests file search, analytics dashboard, and data visualization
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import SearchPage from '@/pages/Search/SearchPage';
import AnalyticsDashboard from '@/pages/Analytics/AnalyticsDashboard';

// Mock notification system
jest.mock('@/utils/notifications', () => ({
  showNotification: jest.fn(),
  showError: jest.fn(),
}));

// Test server setup
const server = setupServer(
  // File search endpoint
  http.get('/api/v1/search/files', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const volumeId = url.searchParams.get('volume_id');
    const fileType = url.searchParams.get('file_type');
    const minSize = url.searchParams.get('min_size');
    const maxSize = url.searchParams.get('max_size');
    const modifiedAfter = url.searchParams.get('modified_after');
    const modifiedBefore = url.searchParams.get('modified_before');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');

    // Mock search results based on query
    let results = [
      {
        path: '/var/lib/docker/volumes/app-data/_data/config.json',
        name: 'config.json',
        size: 2048,
        type: 'file',
        modified_at: '2024-01-20T10:30:00Z',
        volume_name: 'app-data',
        permissions: 'rw-r--r--',
        mime_type: 'application/json',
      },
      {
        path: '/var/lib/docker/volumes/app-data/_data/logs/app.log',
        name: 'app.log',
        size: 1048576,
        type: 'file',
        modified_at: '2024-01-21T15:45:00Z',
        volume_name: 'app-data',
        permissions: 'rw-r--r--',
        mime_type: 'text/plain',
      },
      {
        path: '/var/lib/docker/volumes/db-data/_data/database.db',
        name: 'database.db',
        size: 536870912,
        type: 'file',
        modified_at: '2024-01-19T08:15:00Z',
        volume_name: 'db-data',
        permissions: 'rw-rw-r--',
        mime_type: 'application/octet-stream',
      },
      {
        path: '/var/lib/docker/volumes/cache/_data/temp',
        name: 'temp',
        size: 0,
        type: 'directory',
        modified_at: '2024-01-22T12:00:00Z',
        volume_name: 'cache',
        permissions: 'drwxrwxr-x',
        mime_type: null,
      },
    ];

    // Filter by query
    if (query) {
      results = results.filter(file => 
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.path.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Filter by volume
    if (volumeId) {
      results = results.filter(file => file.volume_name === volumeId);
    }

    // Filter by file type
    if (fileType) {
      results = results.filter(file => file.type === fileType);
    }

    // Filter by size
    if (minSize) {
      results = results.filter(file => file.size >= parseInt(minSize));
    }
    if (maxSize) {
      results = results.filter(file => file.size <= parseInt(maxSize));
    }

    // Pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = results.slice(startIndex, endIndex);

    return HttpResponse.json({
      results: paginatedResults,
      total_results: results.length,
      query,
      filters: {
        volume_id: volumeId,
        file_type: fileType,
        min_size: minSize,
        max_size: maxSize,
        modified_after: modifiedAfter,
        modified_before: modifiedBefore,
      },
      pagination: {
        page,
        page_size: pageSize,
        total_items: results.length,
        total_pages: Math.ceil(results.length / pageSize),
      },
    });
  }),

  // Saved searches endpoint
  http.get('/api/v1/search/saved', () => {
    return HttpResponse.json({
      searches: [
        {
          id: 'search-1',
          name: 'Large Log Files',
          query: '*.log',
          filters: {
            min_size: '10485760', // 10MB
            file_type: 'file',
          },
          created_at: '2024-01-15T10:00:00Z',
          last_used: '2024-01-20T14:30:00Z',
        },
        {
          id: 'search-2',
          name: 'Configuration Files',
          query: 'config',
          filters: {
            file_type: 'file',
          },
          created_at: '2024-01-10T16:20:00Z',
          last_used: '2024-01-21T09:15:00Z',
        },
      ],
    });
  }),

  // Save search endpoint
  http.post('/api/v1/search/saved', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      id: `search-${Date.now()}`,
      name: body.name,
      query: body.query,
      filters: body.filters,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });
  }),

  // Delete saved search endpoint
  http.delete('/api/v1/search/saved/:searchId', ({ params }) => {
    return HttpResponse.json({ success: true });
  }),

  // Analytics - storage overview
  http.get('/api/v1/analytics/storage', () => {
    return HttpResponse.json({
      total_storage: 1099511627776, // 1TB
      used_storage: 549755813888, // 500GB
      available_storage: 549755813888, // 500GB
      storage_by_volume: [
        {
          volume_name: 'db-data',
          size_bytes: 214748364800, // 200GB
          percentage: 39.1,
        },
        {
          volume_name: 'app-logs',
          size_bytes: 107374182400, // 100GB
          percentage: 19.5,
        },
        {
          volume_name: 'cache',
          size_bytes: 53687091200, // 50GB
          percentage: 9.8,
        },
        {
          volume_name: 'uploads',
          size_bytes: 32212254720, // 30GB
          percentage: 5.9,
        },
      ],
      growth_trend: [
        {
          date: '2024-01-01',
          total_bytes: 429496729600, // 400GB
        },
        {
          date: '2024-01-08',
          total_bytes: 451467673600, // 420GB
        },
        {
          date: '2024-01-15',
          total_bytes: 483183820800, // 450GB
        },
        {
          date: '2024-01-22',
          total_bytes: 549755813888, // 500GB
        },
      ],
    });
  }),

  // Analytics - file type distribution
  http.get('/api/v1/analytics/file-types', () => {
    return HttpResponse.json({
      distribution: [
        {
          type: 'Database Files',
          extensions: ['.db', '.sqlite', '.sql'],
          count: 45,
          size_bytes: 268435456000, // 250GB
          percentage: 48.8,
        },
        {
          type: 'Log Files',
          extensions: ['.log', '.txt'],
          count: 1200,
          size_bytes: 107374182400, // 100GB
          percentage: 19.5,
        },
        {
          type: 'Media Files',
          extensions: ['.jpg', '.png', '.mp4', '.pdf'],
          count: 850,
          size_bytes: 85899345920, // 80GB
          percentage: 15.6,
        },
        {
          type: 'Configuration',
          extensions: ['.json', '.yaml', '.xml', '.conf'],
          count: 320,
          size_bytes: 1073741824, // 1GB
          percentage: 0.2,
        },
        {
          type: 'Other',
          extensions: ['*'],
          count: 2100,
          size_bytes: 87960930304, // 82GB
          percentage: 16.0,
        },
      ],
    });
  }),

  // Analytics - volume usage over time
  http.get('/api/v1/analytics/volume-usage', ({ request }) => {
    const url = new URL(request.url);
    const volumeId = url.searchParams.get('volume_id');
    const period = url.searchParams.get('period') || '30d';

    return HttpResponse.json({
      volume_id: volumeId,
      period,
      data_points: [
        {
          timestamp: '2024-01-01T00:00:00Z',
          size_bytes: 204010946560, // 190GB
          file_count: 15000,
        },
        {
          timestamp: '2024-01-05T00:00:00Z',
          size_bytes: 209715200000, // 195GB
          file_count: 15500,
        },
        {
          timestamp: '2024-01-10T00:00:00Z',
          size_bytes: 215419453440, // 200.5GB
          file_count: 16000,
        },
        {
          timestamp: '2024-01-15T00:00:00Z',
          size_bytes: 220123844608, // 205GB
          file_count: 16800,
        },
        {
          timestamp: '2024-01-20T00:00:00Z',
          size_bytes: 225828135936, // 210.2GB
          file_count: 17200,
        },
      ],
    });
  }),

  // Analytics - top files by size
  http.get('/api/v1/analytics/top-files', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const topFiles = [
      {
        path: '/var/lib/docker/volumes/db-data/_data/main.db',
        name: 'main.db',
        size_bytes: 85899345920, // 80GB
        volume_name: 'db-data',
        modified_at: '2024-01-20T10:30:00Z',
      },
      {
        path: '/var/lib/docker/volumes/db-data/_data/backup.db',
        name: 'backup.db',
        size_bytes: 64424509440, // 60GB
        volume_name: 'db-data',
        modified_at: '2024-01-19T22:15:00Z',
      },
      {
        path: '/var/lib/docker/volumes/app-logs/_data/application.log',
        name: 'application.log',
        size_bytes: 21474836480, // 20GB
        volume_name: 'app-logs',
        modified_at: '2024-01-21T18:45:00Z',
      },
      {
        path: '/var/lib/docker/volumes/uploads/_data/large-video.mp4',
        name: 'large-video.mp4',
        size_bytes: 10737418240, // 10GB
        volume_name: 'uploads',
        modified_at: '2024-01-18T14:20:00Z',
      },
    ];

    return HttpResponse.json({
      files: topFiles.slice(0, limit),
      total_count: topFiles.length,
    });
  }),
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

describe('Search and Analytics Integration', () => {
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

  describe('File Search', () => {
    it('should perform basic file search', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Find search input and enter query
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, 'config');

      // Submit search
      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });

      // Verify search results
      expect(screen.getByText('2.0 KB')).toBeInTheDocument(); // File size
      expect(screen.getByText('app-data')).toBeInTheDocument(); // Volume name
      expect(screen.getByText(/2024-01-20/)).toBeInTheDocument(); // Modified date
    });

    it('should apply search filters', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Open advanced filters
      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await user.click(filtersButton);

      // Set file type filter
      const fileTypeSelect = screen.getByLabelText(/file type/i);
      await user.selectOptions(fileTypeSelect, 'file');

      // Set minimum size filter
      const minSizeInput = screen.getByLabelText(/minimum size/i);
      await user.type(minSizeInput, '1000000'); // 1MB

      // Apply filters and search
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, 'log');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Wait for filtered results
      await waitFor(() => {
        expect(screen.getByText('app.log')).toBeInTheDocument();
      });

      // Should only show files matching filters
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.queryByText('config.json')).not.toBeInTheDocument(); // Too small
    });

    it('should handle pagination of search results', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Perform search that returns multiple pages
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, '*'); // Search all files

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/showing \d+-\d+ of \d+ results/i)).toBeInTheDocument();
      });

      // Navigate to next page if pagination exists
      const nextButton = screen.queryByRole('button', { name: /next/i });
      if (nextButton) {
        await user.click(nextButton);
        
        await waitFor(() => {
          expect(screen.getByText(/page 2/i)).toBeInTheDocument();
        });
      }
    });

    it('should save search queries', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Perform a search
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, 'important');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/results/i)).toBeInTheDocument();
      });

      // Save the search
      const saveButton = screen.getByRole('button', { name: /save search/i });
      await user.click(saveButton);

      // Enter save details
      const nameInput = screen.getByLabelText(/search name/i);
      await user.type(nameInput, 'Important Files Search');

      const confirmButton = screen.getByRole('button', { name: /save/i });
      await user.click(confirmButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/search saved/i)).toBeInTheDocument();
      });
    });

    it('should load and execute saved searches', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Open saved searches
      const savedButton = screen.getByRole('button', { name: /saved searches/i });
      await user.click(savedButton);

      // Wait for saved searches to load
      await waitFor(() => {
        expect(screen.getByText('Large Log Files')).toBeInTheDocument();
        expect(screen.getByText('Configuration Files')).toBeInTheDocument();
      });

      // Execute a saved search
      const executeButton = screen.getAllByRole('button', { name: /run search/i })[0];
      await user.click(executeButton);

      // Should execute the search and show results
      await waitFor(() => {
        expect(screen.getByText(/results for.*large log files/i)).toBeInTheDocument();
      });
    });

    it('should handle empty search results', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Search for something that doesn't exist
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, 'nonexistentfile.xyz');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Should show no results message
      await waitFor(() => {
        expect(screen.getByText(/no files found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Dashboard', () => {
    it('should load and display storage overview', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for analytics data to load
      await waitFor(() => {
        expect(screen.getByText('1.0 TB')).toBeInTheDocument(); // Total storage
        expect(screen.getByText('500.0 GB')).toBeInTheDocument(); // Used storage
      });

      // Verify storage breakdown by volume
      expect(screen.getByText('db-data')).toBeInTheDocument();
      expect(screen.getByText('200.0 GB')).toBeInTheDocument(); // db-data size
      expect(screen.getByText('39.1%')).toBeInTheDocument(); // db-data percentage

      expect(screen.getByText('app-logs')).toBeInTheDocument();
      expect(screen.getByText('100.0 GB')).toBeInTheDocument(); // app-logs size
      expect(screen.getByText('19.5%')).toBeInTheDocument(); // app-logs percentage
    });

    it('should display file type distribution', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for file type data to load
      await waitFor(() => {
        expect(screen.getByText('Database Files')).toBeInTheDocument();
        expect(screen.getByText('Log Files')).toBeInTheDocument();
        expect(screen.getByText('Media Files')).toBeInTheDocument();
      });

      // Verify file type statistics
      expect(screen.getByText('45 files')).toBeInTheDocument(); // Database files count
      expect(screen.getByText('1,200 files')).toBeInTheDocument(); // Log files count
      expect(screen.getByText('850 files')).toBeInTheDocument(); // Media files count

      expect(screen.getByText('250.0 GB')).toBeInTheDocument(); // Database files size
      expect(screen.getByText('48.8%')).toBeInTheDocument(); // Database files percentage
    });

    it('should display top files by size', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for top files data to load
      await waitFor(() => {
        expect(screen.getByText('main.db')).toBeInTheDocument();
        expect(screen.getByText('backup.db')).toBeInTheDocument();
        expect(screen.getByText('application.log')).toBeInTheDocument();
      });

      // Verify file sizes
      expect(screen.getByText('80.0 GB')).toBeInTheDocument(); // main.db
      expect(screen.getByText('60.0 GB')).toBeInTheDocument(); // backup.db
      expect(screen.getByText('20.0 GB')).toBeInTheDocument(); // application.log
      expect(screen.getByText('10.0 GB')).toBeInTheDocument(); // large-video.mp4
    });

    it('should show volume usage trends', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for growth trend data to load
      await waitFor(() => {
        expect(screen.getByText(/growth trend/i)).toBeInTheDocument();
      });

      // Should display trend chart with data points
      expect(screen.getByText('400.0 GB')).toBeInTheDocument(); // Jan 1 data point
      expect(screen.getByText('450.0 GB')).toBeInTheDocument(); // Jan 15 data point
    });

    it('should allow filtering analytics by time period', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText(/growth trend/i)).toBeInTheDocument();
      });

      // Change time period
      const periodSelect = screen.getByLabelText(/time period/i);
      await user.selectOptions(periodSelect, '7d');

      // Should reload data with new period
      await waitFor(() => {
        expect(screen.getByText(/last 7 days/i)).toBeInTheDocument();
      });
    });

    it('should allow drilling down into volume-specific analytics', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Wait for volume data to load
      await waitFor(() => {
        expect(screen.getByText('db-data')).toBeInTheDocument();
      });

      // Click on a volume for detailed view
      const volumeLink = screen.getByRole('button', { name: /view db-data details/i });
      await user.click(volumeLink);

      // Should show volume-specific analytics
      await waitFor(() => {
        expect(screen.getByText('db-data Usage Details')).toBeInTheDocument();
      });

      // Verify volume-specific data
      expect(screen.getByText('190.0 GB')).toBeInTheDocument(); // Historical data point
      expect(screen.getByText('15,000 files')).toBeInTheDocument(); // File count
    });
  });

  describe('Error Handling', () => {
    it('should handle search API errors', async () => {
      // Mock search error
      server.use(
        http.get('/api/v1/search/files', () => {
          return HttpResponse.json(
            { error: 'Search service unavailable' },
            { status: 503 }
          );
        })
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <SearchPage />
        </TestWrapper>
      );

      // Perform search
      const searchInput = screen.getByRole('textbox', { name: /search files/i });
      await user.type(searchInput, 'test');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/search.*unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle analytics API errors', async () => {
      // Mock analytics error
      server.use(
        http.get('/api/v1/analytics/storage', () => {
          return HttpResponse.error();
        })
      );

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Should show error state for storage analytics
      await waitFor(() => {
        expect(screen.getByText(/error loading.*analytics/i)).toBeInTheDocument();
      });
    });

    it('should provide retry functionality on errors', async () => {
      let callCount = 0;
      
      // Mock failing request that succeeds on retry
      server.use(
        http.get('/api/v1/analytics/storage', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            total_storage: 1099511627776,
            used_storage: 549755813888,
            available_storage: 549755813888,
            storage_by_volume: [],
            growth_trend: [],
          });
        })
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <AnalyticsDashboard />
        </TestWrapper>
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/error loading/i)).toBeInTheDocument();
      });

      // Find and click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should successfully load on retry
      await waitFor(() => {
        expect(screen.getByText('1.0 TB')).toBeInTheDocument();
      });
    });
  });
});