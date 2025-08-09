import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'jotai';
import { VolumesPage } from '../VolumesPage';
import { ToastProvider } from '@/components/ui';

// Mock the API services
vi.mock('@/api/services', () => ({
  useVolumes: vi.fn(),
  useVolumeScanning: vi.fn(),
}));

// Mock the URL state hook
vi.mock('@/hooks', () => ({
  useVolumeListUrlState: vi.fn(),
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock error handling utilities
vi.mock('@/utils/errorHandling', () => ({
  getErrorMessage: vi.fn((error) => error?.message || 'Mock error'),
  getErrorDetails: vi.fn((error) => ({
    message: error?.message || 'Mock error',
    code: error?.code,
    requestId: error?.requestId,
  })),
  getHttpStatusCode: vi.fn((error) => error?.status),
  formatErrorForDisplay: vi.fn((error) => ({
    title: 'Error',
    message: error?.message || 'Mock error',
    variant: 'error',
    showRetry: true,
  })),
}));

import { useVolumes, useVolumeScanning } from '@/api/services';
import { useVolumeListUrlState } from '@/hooks';

// Create test wrapper with all providers
const createTestWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <Provider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </Provider>
    </BrowserRouter>
  );
};

// Mock volume data
const mockVolume = {
  id: 1,
  volume_id: 'vol_123',
  name: 'test-volume',
  driver: 'local',
  created_at: '2024-01-01T00:00:00Z',
  mountpoint: '/var/lib/docker/volumes/test-volume/_data',
  labels: { env: 'test' },
  size_bytes: 1024 * 1024, // 1MB
  attachments_count: 2,
  is_system: false,
  is_orphaned: false,
  is_active: true,
};

const mockPaginationMeta = {
  page: 1,
  pageSize: 25,
  total: 1,
  sort: 'name:asc',
  filters: {},
};

// Default mock implementations
const defaultUseVolumesMock = {
  fetchVolumes: vi.fn(),
  refreshVolumes: vi.fn(),
  volumes: [mockVolume],
  loading: false,
  error: null,
  paginationMeta: mockPaginationMeta,
};

const defaultUseScanningMock = {
  scanVolume: vi.fn(),
  scanResults: {},
  scanLoading: {},
  scanError: {},
  getVolumeSize: vi.fn(),
  getScanStatus: vi.fn(),
  asyncScans: {},
};

const defaultUseUrlStateMock = [
  {
    page: 1,
    page_size: 25,
    sort: 'name:asc',
    q: '',
    driver: '',
    orphaned: false,
    system: false,
  },
  vi.fn(),
];

describe('VolumesPage Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (useVolumes as any).mockReturnValue(defaultUseVolumesMock);
    (useVolumeScanning as any).mockReturnValue(defaultUseScanningMock);
    (useVolumeListUrlState as any).mockReturnValue(defaultUseUrlStateMock);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering and Basic Layout', () => {
    it('should render page header and title', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /docker volumes/i })).toBeInTheDocument();
      expect(screen.getByText(/manage and monitor your docker volume storage/i)).toBeInTheDocument();
    });

    it('should render statistics overview', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText('Total Volumes')).toBeInTheDocument();
      expect(screen.getByText('Current Page')).toBeInTheDocument();
      expect(screen.getByText('Page Size')).toBeInTheDocument();
      expect(screen.getByText('Showing')).toBeInTheDocument();
    });

    it('should render search and filters section', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/search volumes by name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by driver type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort volumes by/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /orphaned only/i })).toBeInTheDocument();
    });

    it('should render volume cards when volumes exist', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText('test-volume')).toBeInTheDocument();
      expect(screen.getByText('local driver')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rescan size/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton when loading and no volumes', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        loading: true,
        volumes: [],
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText(/loading volumes/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('should show refresh button with spinner when loading', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        loading: true,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no volumes exist', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [],
        paginationMeta: { ...mockPaginationMeta, total: 0 },
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText(/no volumes found/i)).toBeInTheDocument();
      expect(screen.getByText(/no docker volumes are currently available/i)).toBeInTheDocument();
    });

    it('should show filtered empty state when search has no results', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [],
        paginationMeta: { ...mockPaginationMeta, total: 0 },
      });

      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], q: 'nonexistent' },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText(/no matching volumes/i)).toBeInTheDocument();
      expect(screen.getByText(/no volumes match your current search criteria/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });

    it('should clear filters when clear filters button is clicked', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], q: 'test' },
        mockSetUrlState,
      ]);

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [],
        paginationMeta: { ...mockPaginationMeta, total: 0 },
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);

      expect(mockSetUrlState).toHaveBeenCalledWith({
        q: '',
        driver: '',
        orphaned: false,
        sort: 'name:asc',
        page: 1,
      });
    });
  });

  describe('Error States', () => {
    it('should show error state when fetch fails', () => {
      const mockError = new Error('Network error');
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network error',
        volumes: [],
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should call refreshVolumes when retry button is clicked', async () => {
      const mockRefreshVolumes = vi.fn();
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network error',
        volumes: [],
        refreshVolumes: mockRefreshVolumes,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockRefreshVolumes).toHaveBeenCalled();
    });

    it('should show error details when error details are available', () => {
      const mockError = {
        message: 'API Error',
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req_123',
      };

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: mockError,
        volumes: [],
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should update URL state when search input changes', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        defaultUseUrlStateMock[0],
        mockSetUrlState,
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search volumes by name/i);
      await user.type(searchInput, 'test');

      expect(mockSetUrlState).toHaveBeenCalledWith({
        q: 't',
        page: 1,
      });
    });

    it('should display current search query in input', () => {
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], q: 'test-search' },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search volumes by name/i);
      expect(searchInput).toHaveValue('test-search');
    });
  });

  describe('Filter Functionality', () => {
    it('should update URL state when driver filter changes', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        defaultUseUrlStateMock[0],
        mockSetUrlState,
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const driverSelect = screen.getByLabelText(/filter by driver type/i);
      await user.selectOptions(driverSelect, 'local');

      expect(mockSetUrlState).toHaveBeenCalledWith({
        driver: 'local',
        page: 1,
      });
    });

    it('should update URL state when sort changes', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        defaultUseUrlStateMock[0],
        mockSetUrlState,
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const sortSelect = screen.getByLabelText(/sort volumes by/i);
      await user.selectOptions(sortSelect, 'size_bytes:desc');

      expect(mockSetUrlState).toHaveBeenCalledWith({
        sort: 'size_bytes:desc',
        page: 1,
      });
    });

    it('should toggle orphaned filter when button is clicked', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        defaultUseUrlStateMock[0],
        mockSetUrlState,
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const orphanedButton = screen.getByRole('button', { name: /orphaned only/i });
      await user.click(orphanedButton);

      expect(mockSetUrlState).toHaveBeenCalledWith({
        orphaned: true,
        page: 1,
      });
    });

    it('should show "Show All" when orphaned filter is active', () => {
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], orphaned: true },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /show all/i })).toBeInTheDocument();
    });
  });

  describe('Volume Actions', () => {
    it('should navigate to volume details when details button is clicked', async () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const detailsButton = screen.getByRole('button', { name: /view details/i });
      await user.click(detailsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/volumes/test-volume');
    });

    it('should call scanVolume when scan button is clicked', async () => {
      const mockScanVolume = vi.fn().mockResolvedValue({});
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      expect(mockScanVolume).toHaveBeenCalledWith('vol_123', { async: false });
    });

    it('should show scanning state when volume is being scanned', () => {
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanLoading: { vol_123: true },
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /scanning.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /scanning.../i })).toBeDisabled();
    });

    it('should not allow scan when volume is already being scanned', async () => {
      const mockScanVolume = vi.fn();
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanLoading: { vol_123: true },
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const scanButton = screen.getByRole('button', { name: /scanning.../i });
      expect(scanButton).toBeDisabled();

      // Clicking should not trigger scan
      await user.click(scanButton);
      expect(mockScanVolume).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        paginationMeta: {
          page: 2,
          pageSize: 25,
          total: 100,
          sort: 'name:asc',
          filters: {},
        },
      });
    });

    it('should render pagination when there are multiple pages', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation', { name: /volume pagination/i })).toBeInTheDocument();
      expect(screen.getByText(/showing 26-50 of 100 volumes/i)).toBeInTheDocument();
    });

    it('should handle page navigation', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], page: 2 },
        mockSetUrlState,
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const nextButton = screen.getByRole('button', { name: /go to next page/i });
      await user.click(nextButton);

      expect(mockSetUrlState).toHaveBeenCalledWith({ page: 3 });
    });

    it('should disable previous button on first page', () => {
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], page: 1 },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /go to previous page/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        paginationMeta: {
          page: 4,
          pageSize: 25,
          total: 100,
        },
      });

      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], page: 4 },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const nextButton = screen.getByRole('button', { name: /go to next page/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for form elements', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/search volumes by name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by driver type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort volumes by/i)).toBeInTheDocument();
    });

    it('should have screen reader announcements', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have proper landmark regions', () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /volume pagination/i })).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for pagination', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        paginationMeta: {
          page: 2,
          pageSize: 25,
          total: 100,
        },
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      // Check for proper aria-current on current page
      expect(screen.getByRole('button', { name: /current page, page 2/i })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Toast Notifications', () => {
    it('should show success toast when scan completes', async () => {
      const mockScanVolume = vi.fn().mockResolvedValue({});
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/successfully scanned test-volume/i)).toBeInTheDocument();
      });
    });

    it('should show error toast when scan fails', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue(new Error('Scan failed'));
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to scan test-volume/i)).toBeInTheDocument();
      });
    });

    it('should show info toast when scan starts', async () => {
      const mockScanVolume = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      expect(screen.getByText(/starting scan for test-volume/i)).toBeInTheDocument();
    });
  });

  describe('URL State Integration', () => {
    it('should call fetchVolumes when URL parameters change', () => {
      const mockFetchVolumes = vi.fn();
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        fetchVolumes: mockFetchVolumes,
      });

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(mockFetchVolumes).toHaveBeenCalledWith({
        page: 1,
        page_size: 25,
        sort: 'name:asc',
        q: undefined,
        driver: undefined,
        orphaned: undefined,
        system: undefined,
      });
    });

    it('should sync form values with URL state', () => {
      (useVolumeListUrlState as any).mockReturnValue([
        {
          page: 2,
          page_size: 50,
          sort: 'size_bytes:desc',
          q: 'test-query',
          driver: 'nfs',
          orphaned: true,
          system: false,
        },
        defaultUseUrlStateMock[1],
      ]);

      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('test-query')).toBeInTheDocument();
      expect(screen.getByDisplayValue('nfs')).toBeInTheDocument();
      expect(screen.getByDisplayValue('size_bytes:desc')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show all/i })).toBeInTheDocument();
    });
  });
});