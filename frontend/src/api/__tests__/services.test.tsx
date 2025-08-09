import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'jotai';
import {
  useVolumes,
  useVolumeScanning,
  type VolumeListParams,
} from '../services';

vi.mock('../generated/volumeviz-api', () => {
  const mockApi = {
    volumes: {
      listVolumes: vi.fn(),
      getVolume: vi.fn(),
      getVolumeSize: vi.fn(),
      refreshVolumeSize: vi.fn(),
      getVolumeAttachments: vi.fn(),
      bulkScanVolumes: vi.fn(),
      getScanStatus: vi.fn(),
    },
    database: {
      getDatabaseHealth: vi.fn(),
    },
  };

  return {
    Api: vi.fn().mockImplementation(() => mockApi),
    __mockApi: mockApi, // Export mock for access in tests
  };
});

// Get reference to mocked API for tests
const { __mockApi: mockApi } = (await import(
  '../generated/volumeviz-api'
)) as any;

// Mock error handling utilities
vi.mock('@/utils/errorHandling', () => ({
  getErrorMessage: vi.fn((error) => error?.message || 'Mock error'),
  handleApiError: vi.fn(),
}));

// Create a test wrapper with Jotai Provider
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider>{children}</Provider>
  );
};

// Mock volume data
const mockVolume = {
  id: 1,
  volume_id: 'vol_123',
  name: 'test-volume',
  driver: 'local' as const,
  created_at: '2024-01-01T00:00:00Z',
  mountpoint: '/var/lib/docker/volumes/test-volume/_data',
  labels: { env: 'test' },
  size_bytes: 1024 * 1024, // 1MB
  attachments_count: 2,
  is_system: false,
  is_orphaned: false,
  is_active: true,
};

const mockPaginatedResponse = {
  data: [mockVolume],
  page: 1,
  page_size: 25,
  total: 1,
  sort: 'name:asc',
  filters: {},
};

describe('useVolumes Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful response
    mockApi.volumes.listVolumes.mockResolvedValue({
      data: mockPaginatedResponse,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchVolumes', () => {
    it('should fetch volumes with default parameters', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(mockApi.volumes.listVolumes).toHaveBeenCalledWith({
        page: 1,
        page_size: 25,
        sort: undefined,
        q: undefined,
        driver: undefined,
        orphaned: undefined,
        system: undefined,
        created_after: undefined,
        created_before: undefined,
      });

      expect(result.current.volumes).toEqual([mockVolume]);
      expect(result.current.paginationMeta).toEqual({
        page: 1,
        pageSize: 25,
        total: 1,
        sort: 'name:asc',
        filters: {},
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should fetch volumes with custom parameters', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const params: VolumeListParams = {
        page: 2,
        page_size: 50,
        sort: 'size_bytes:desc',
        q: 'test',
        driver: 'local',
        orphaned: true,
        system: false,
        created_after: '2024-01-01T00:00:00Z',
        created_before: '2024-12-31T23:59:59Z',
      };

      await act(async () => {
        await result.current.fetchVolumes(params);
      });

      expect(mockApi.volumes.listVolumes).toHaveBeenCalledWith(params);
    });

    it('should handle loading states correctly', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      // Initially not loading
      expect(result.current.loading).toBe(false);

      // Mock a delayed response
      mockApi.volumes.listVolumes.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: mockPaginatedResponse }), 100),
          ),
      );

      act(() => {
        result.current.fetchVolumes();
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle API errors', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const mockError = new Error('API Error');
      mockApi.volumes.listVolumes.mockRejectedValue(mockError);

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.volumes).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should store params for refresh functionality', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const params: VolumeListParams = {
        page: 1,
        q: 'test-search',
        driver: 'local',
      };

      await act(async () => {
        await result.current.fetchVolumes(params);
      });

      // Clear the mock to test refresh
      mockApi.volumes.listVolumes.mockClear();

      await act(async () => {
        await result.current.refreshVolumes();
      });

      // Should use the same params
      expect(mockApi.volumes.listVolumes).toHaveBeenCalledWith({
        page: 1,
        page_size: 25,
        sort: undefined,
        q: 'test-search',
        driver: 'local',
        orphaned: undefined,
        system: undefined,
        created_after: undefined,
        created_before: undefined,
      });
    });

    it('should handle empty response data', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const emptyResponse = {
        data: [],
        page: 1,
        page_size: 25,
        total: 0,
      };

      mockApi.volumes.listVolumes.mockResolvedValue({
        data: emptyResponse,
      });

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.volumes).toEqual([]);
      expect(result.current.paginationMeta.total).toBe(0);
    });

    it('should handle malformed API responses gracefully', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      // Mock malformed response
      mockApi.volumes.listVolumes.mockResolvedValue({
        data: null,
      });

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.volumes).toEqual([]);
      expect(result.current.error).toBe(
        "Cannot read properties of null (reading 'data')",
      );
    });
  });

  describe('pagination metadata', () => {
    it('should update pagination metadata correctly', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const paginatedResponse = {
        data: [mockVolume],
        page: 2,
        page_size: 10,
        total: 25,
        sort: 'size_bytes:desc',
        filters: { driver: 'local' },
      };

      mockApi.volumes.listVolumes.mockResolvedValue({
        data: paginatedResponse,
      });

      await act(async () => {
        await result.current.fetchVolumes({ page: 2, page_size: 10 });
      });

      expect(result.current.paginationMeta).toEqual({
        page: 2,
        pageSize: 10,
        total: 25,
        sort: 'size_bytes:desc',
        filters: { driver: 'local' },
      });
    });

    it('should maintain pagination state across multiple calls', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      // First call
      await act(async () => {
        await result.current.fetchVolumes({ page: 1 });
      });

      expect(result.current.paginationMeta.page).toBe(1);

      // Second call with different page
      const secondPageResponse = {
        ...mockPaginatedResponse,
        page: 2,
        data: [{ ...mockVolume, id: 2, name: 'second-volume' }],
      };

      mockApi.volumes.listVolumes.mockResolvedValue({
        data: secondPageResponse,
      });

      await act(async () => {
        await result.current.fetchVolumes({ page: 2 });
      });

      expect(result.current.paginationMeta.page).toBe(2);
      expect(result.current.volumes).toHaveLength(1);
      expect(result.current.volumes[0].name).toBe('second-volume');
    });
  });

  describe('error handling', () => {
    it('should clear errors on successful fetch', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      // First call that fails
      mockApi.volumes.listVolumes.mockRejectedValue(new Error('API Error'));

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.error).toBe('API Error');

      // Second call that succeeds
      mockApi.volumes.listVolumes.mockResolvedValue({
        data: mockPaginatedResponse,
      });

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.volumes).toEqual([mockVolume]);
    });

    it('should handle network errors', async () => {
      const { result } = renderHook(() => useVolumes(), {
        wrapper: createWrapper(),
      });

      const networkError = new Error('Network Error');
      mockApi.volumes.listVolumes.mockRejectedValue(networkError);

      await act(async () => {
        await result.current.fetchVolumes();
      });

      expect(result.current.error).toBe('Network Error');
      expect(result.current.loading).toBe(false);
      expect(result.current.volumes).toEqual([]);
    });
  });
});

describe('useVolumeScanning Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scanVolume', () => {
    it('should perform synchronous scan successfully', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      const mockScanResponse = {
        volume_id: 'vol_123',
        total_size: 1024 * 1024,
        scan_method: 'du' as const,
        scan_duration: 1000,
      };

      mockApi.volumes.refreshVolumeSize.mockResolvedValue({
        data: mockScanResponse,
      });

      await act(async () => {
        await result.current.scanVolume('vol_123', { async: false });
      });

      expect(mockApi.volumes.refreshVolumeSize).toHaveBeenCalledWith(
        'vol_123',
        { async: false },
      );

      expect(result.current.scanResults['vol_123']).toEqual(mockScanResponse);
      expect(result.current.scanLoading['vol_123']).toBe(false);
      expect(result.current.scanError['vol_123']).toBe(null);
    });

    it('should handle asynchronous scan response', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      const mockAsyncResponse = {
        scan_id: 'scan_123',
        volume_id: 'vol_123',
        status: 'started' as const,
      };

      mockApi.volumes.refreshVolumeSize.mockResolvedValue({
        data: mockAsyncResponse,
      });

      await act(async () => {
        await result.current.scanVolume('vol_123', { async: true });
      });

      expect(result.current.asyncScans['vol_123']).toEqual(mockAsyncResponse);
      expect(result.current.scanLoading['vol_123']).toBe(false);
    });

    it('should handle scan errors', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      const mockError = new Error('Scan failed');
      mockApi.volumes.refreshVolumeSize.mockRejectedValue(mockError);

      // Use a try-catch to handle the rejection without failing the test
      await act(async () => {
        try {
          await result.current.scanVolume('vol_123');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.scanError['vol_123']).toBe('Scan failed');
      expect(result.current.scanLoading['vol_123']).toBe(false);
    });

    it('should manage loading states correctly', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      // Initially not loading
      expect(result.current.scanLoading['vol_123']).toBe(undefined);

      // Mock delayed response
      mockApi.volumes.refreshVolumeSize.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { volume_id: 'vol_123', total_size: 1024 },
                }),
              50,
            ),
          ),
      );

      act(() => {
        result.current.scanVolume('vol_123');
      });

      // Should be loading
      expect(result.current.scanLoading['vol_123']).toBe(true);

      await waitFor(() => {
        expect(result.current.scanLoading['vol_123']).toBe(false);
      });
    });
  });

  describe('getVolumeSize', () => {
    it('should get cached volume size successfully', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      const mockSizeResponse = {
        volume_id: 'vol_123',
        total_size: 2048,
        file_count: 100,
      };

      mockApi.volumes.getVolumeSize.mockResolvedValue({
        data: mockSizeResponse,
      });

      await act(async () => {
        await result.current.getVolumeSize('vol_123');
      });

      expect(mockApi.volumes.getVolumeSize).toHaveBeenCalledWith('vol_123');
      expect(result.current.scanResults['vol_123']).toEqual(mockSizeResponse);
    });
  });

  describe('getScanStatus', () => {
    it('should get scan status successfully', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      const mockStatusResponse = {
        scan_id: 'scan_123',
        volume_id: 'vol_123',
        status: 'completed' as const,
        progress: 100,
      };

      mockApi.volumes.getScanStatus.mockResolvedValue({
        data: mockStatusResponse,
      });

      const status = await act(async () => {
        return await result.current.getScanStatus('vol_123', 'scan_123');
      });

      expect(mockApi.volumes.getScanStatus).toHaveBeenCalledWith('vol_123', {
        scan_id: 'scan_123',
      });
      expect(status).toEqual(mockStatusResponse);
    });

    it('should get scan status without scan_id', async () => {
      const { result } = renderHook(() => useVolumeScanning(), {
        wrapper: createWrapper(),
      });

      mockApi.volumes.getScanStatus.mockResolvedValue({
        data: { status: 'running', progress: 50 },
      });

      await act(async () => {
        await result.current.getScanStatus('vol_123');
      });

      expect(mockApi.volumes.getScanStatus).toHaveBeenCalledWith('vol_123', {
        scan_id: undefined,
      });
    });
  });
});
