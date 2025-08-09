import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock error handling utilities with realistic implementations
vi.mock('@/utils/errorHandling', () => ({
  getErrorMessage: vi.fn((error) => {
    if (error?.response?.status) {
      const status = error.response.status;
      switch (status) {
        case 400:
          return 'Bad request. Please check your input and try again.';
        case 401:
          return 'Authentication required. Please log in and try again.';
        case 403:
          return "Access denied. You don't have permission to perform this action.";
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Internal server error. Please try again later.';
        case 502:
          return 'Service temporarily unavailable. Please try again later.';
        case 503:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return `HTTP ${status} error occurred`;
      }
    }
    return error?.message || 'An unexpected error occurred';
  }),
  getErrorDetails: vi.fn((error) => {
    const details = {
      message: error?.message || 'Unknown error',
      code: error?.code,
      requestId: error?.requestId,
    };

    if (error?.response?.status) {
      details.statusCode = error.response.status;
    }

    return details;
  }),
  getHttpStatusCode: vi.fn((error) => error?.response?.status || error?.status),
  formatErrorForDisplay: vi.fn((error) => {
    const statusCode = error?.response?.status || error?.status;

    if (statusCode === 429) {
      return {
        title: 'Rate Limited',
        message: 'Too many requests. Please wait a moment and try again.',
        variant: 'warning',
        showRetry: true,
      };
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        title: 'Access Denied',
        message:
          statusCode === 401
            ? 'Authentication required. Please log in and try again.'
            : "You don't have permission to perform this action.",
        variant: 'error',
        showRetry: false,
      };
    }

    if (statusCode >= 500) {
      return {
        title: 'Server Error',
        message: 'Internal server error. Please try again later.',
        variant: 'error',
        showRetry: true,
      };
    }

    return {
      title: 'Error',
      message: error?.message || 'An error occurred',
      variant: 'error',
      showRetry: true,
    };
  }),
}));

import { useVolumes, useVolumeScanning } from '@/api/services';
import { useVolumeListUrlState } from '@/hooks';

// Create test wrapper with all providers
const createTestWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <Provider>
        <ToastProvider>{children}</ToastProvider>
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
  size_bytes: 1024 * 1024,
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
  volumes: [],
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

describe('VolumesPage Error Handling', () => {
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

  describe('HTTP 400 - Bad Request', () => {
    it('should display bad request error message', () => {
      const mockError = {
        response: { status: 400 },
        message: 'Invalid parameters',
      };

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Bad request. Please check your input and try again.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /bad request\. please check your input and try again/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /try again/i }),
      ).toBeInTheDocument();
    });
  });

  describe('HTTP 401 - Unauthorized', () => {
    it('should display authentication required error message', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Authentication required. Please log in and try again.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /authentication required\. please log in and try again/i,
        ),
      ).toBeInTheDocument();
    });

    it('should handle 401 error during volume scan', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to scan test-volume: unauthorized/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('HTTP 403 - Forbidden', () => {
    it('should display access denied error message', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error:
          "Access denied. You don't have permission to perform this action.",
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /access denied\. you don't have permission to perform this action/i,
        ),
      ).toBeInTheDocument();
    });

    it('should handle 403 error during volume scan', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 403 },
        message: 'Forbidden',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to scan test-volume: forbidden/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('HTTP 404 - Not Found', () => {
    it('should display resource not found error message', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'The requested resource was not found.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(/the requested resource was not found/i),
      ).toBeInTheDocument();
    });
  });

  describe('HTTP 429 - Rate Limited', () => {
    it('should display rate limit error message', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Too many requests. Please wait a moment and try again.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /too many requests\. please wait a moment and try again/i,
        ),
      ).toBeInTheDocument();
    });

    it('should handle 429 error during volume scan', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 429 },
        message: 'Too Many Requests',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to scan test-volume: too many requests/i),
        ).toBeInTheDocument();
      });
    });

    it('should show warning toast for rate limit errors', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 429 },
        message: 'Rate limited',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        // Toast should show error
        expect(
          screen.getByText(/failed to scan test-volume/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('HTTP 500 - Internal Server Error', () => {
    it('should display internal server error message', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Internal server error. Please try again later.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(/internal server error\. please try again later/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /try again/i }),
      ).toBeInTheDocument();
    });

    it('should handle 500 error during volume scan', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 500 },
        message: 'Internal Server Error',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            /failed to scan test-volume: internal server error/i,
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('HTTP 502/503 - Service Unavailable', () => {
    it('should display service unavailable error message for 502', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Service temporarily unavailable. Please try again later.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /service temporarily unavailable\. please try again later/i,
        ),
      ).toBeInTheDocument();
    });

    it('should display service unavailable error message for 503', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Service temporarily unavailable. Please try again later.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /service temporarily unavailable\. please try again later/i,
        ),
      ).toBeInTheDocument();
    });

    it('should handle 502 error during volume scan', async () => {
      const mockScanVolume = vi.fn().mockRejectedValue({
        response: { status: 502 },
        message: 'Bad Gateway',
      });

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to scan test-volume: bad gateway/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Network Errors', () => {
    it('should handle network connection errors', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network Error',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('should handle timeout errors', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Request timeout',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
    });

    it('should handle network errors during volume scan', async () => {
      const mockScanVolume = vi
        .fn()
        .mockRejectedValue(new Error('Network Error'));

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanVolume: mockScanVolume,
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const scanButton = screen.getByRole('button', { name: /rescan size/i });
      await user.click(scanButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to scan test-volume: network error/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('API Error Responses with Details', () => {
    it('should handle structured API error responses', () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid sort parameter',
              request_id: 'req_123',
              details: {
                field: 'sort',
                value: 'invalid_field:asc',
              },
            },
          },
        },
      };

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Bad request. Please check your input and try again.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /bad request\. please check your input and try again/i,
        ),
      ).toBeInTheDocument();
    });

    it('should show error details when available', () => {
      const mockError = {
        response: { status: 500 },
        code: 'INTERNAL_ERROR',
        requestId: 'req_456',
        message: 'Database connection failed',
      };

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Internal server error. Please try again later.',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /show details/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should clear error state when retry is successful', async () => {
      const mockRefreshVolumes = vi.fn();

      // Start with error state
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network error',
        refreshVolumes: mockRefreshVolumes,
      });

      const TestWrapper = createTestWrapper();

      const { rerender } = render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByText(/failed to load volumes/i)).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockRefreshVolumes).toHaveBeenCalled();

      // Simulate successful retry
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: null,
        volumes: [mockVolume],
        refreshVolumes: mockRefreshVolumes,
      });

      rerender(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(
        screen.queryByText(/failed to load volumes/i),
      ).not.toBeInTheDocument();
      expect(screen.getByText('test-volume')).toBeInTheDocument();
    });

    it('should handle partial failures gracefully', () => {
      // Simulate scenario where volumes load but scanning fails
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        volumes: [mockVolume],
        error: null,
      });

      (useVolumeScanning as any).mockReturnValue({
        ...defaultUseScanningMock,
        scanError: { vol_123: 'Scan service unavailable' },
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      // Should show volumes despite scan error
      expect(screen.getByText('test-volume')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /rescan size/i }),
      ).toBeInTheDocument();
    });

    it('should maintain user input during error states', async () => {
      const mockSetUrlState = vi.fn();
      (useVolumeListUrlState as any).mockReturnValue([
        { ...defaultUseUrlStateMock[0], q: 'test-search' },
        mockSetUrlState,
      ]);

      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network error',
        volumes: [],
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      // Should maintain search value even in error state
      expect(screen.getByDisplayValue('test-search')).toBeInTheDocument();
    });
  });

  describe('Accessibility during Errors', () => {
    it('should announce errors to screen readers', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Network error',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'Error loading volumes',
      );
    });

    it('should maintain focus management during error states', () => {
      (useVolumes as any).mockReturnValue({
        ...defaultUseVolumesMock,
        error: 'Service unavailable',
      });

      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <VolumesPage />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      // Button should be focusable
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });
  });
});
