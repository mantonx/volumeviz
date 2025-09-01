/**
 * Comprehensive unit tests for useVolumeOperations hook
 * Tests the modern Orval-generated API integration with background sync
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { ReactNode } from 'react';
import { useVolumeOperations } from '../useVolumeOperations';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { backgroundSyncManager } from '@/utils/background-sync';

// Mock background sync manager
jest.mock('@/utils/background-sync', () => ({
  backgroundSyncManager: {
    addPendingOperation: jest.fn(),
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

// MSW server for testing
const server = setupServer(
  // Volume size refresh endpoint
  http.post('/api/v1/volumes/:volumeId/size/refresh', ({ params }) => {
    const volumeId = params.volumeId as string;
    return HttpResponse.json({
      volume_id: volumeId,
      size_bytes: 1048576000, // 1GB
      file_count: 10000,
      last_updated: new Date().toISOString()
    });
  }),

  // Filesystem index endpoint
  http.post('/api/v1/volumes/:volumeId/filesystem/index', ({ params }) => {
    const volumeId = params.volumeId as string;
    return HttpResponse.json({
      index_id: `index_${volumeId}_${Date.now()}`,
      status: 'started',
      volume_id: volumeId,
      started_at: new Date().toISOString()
    });
  }),

  // Bulk scan endpoint
  http.post('/api/v1/volumes/bulk-scan', async ({ request }) => {
    const body = await request.json() as { volume_ids: string[]; async?: boolean; method?: string };
    const { volume_ids } = body;
    
    return HttpResponse.json({
      results: volume_ids.map(id => ({
        volume_id: id,
        size_bytes: Math.floor(Math.random() * 2147483648),
        file_count: Math.floor(Math.random() * 50000),
        last_updated: new Date().toISOString()
      }))
    });
  }),

  // Error simulation
  http.post('/api/v1/volumes/error-test/size/refresh', () => {
    return HttpResponse.json(
      { error: 'Simulated server error' },
      { status: 500 }
    );
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
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </JotaiProvider>
  );
}

describe('useVolumeOperations', () => {
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

  describe('scanVolume (size refresh)', () => {
    it('should successfully refresh volume size when online', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.scanVolume.isLoading).toBe(false);

      // Trigger volume scan
      const promise = result.current.scanVolume.mutateAsync('test-volume');

      // Should be loading during the request
      expect(result.current.scanVolume.isLoading).toBe(true);

      // Wait for completion
      const response = await promise;

      expect(response).toEqual({
        volume_id: 'test-volume',
        size_bytes: 1048576000,
        file_count: 10000,
        last_updated: expect.any(String)
      });

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.scanVolume.isLoading).toBe(false);
      });
    });

    it('should queue operation for background sync when offline', async () => {
      // Mock offline state
      jest.mocked(require('@/utils/background-sync').useBackgroundSync).mockReturnValue({
        isOnline: false,
        pendingCount: 0,
        syncInProgress: false,
        addPendingOperation: jest.fn(),
        forceSync: jest.fn(),
        clearPending: jest.fn(),
      });

      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const response = await result.current.scanVolume.mutateAsync('test-volume');

      expect(response).toEqual({
        queued: true,
        offline: true
      });

      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledWith({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });
    });

    it('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      await expect(
        result.current.scanVolume.mutateAsync('error-test')
      ).rejects.toThrow();
    });
  });

  describe('refreshVolumeSize', () => {
    it('should successfully refresh volume size', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const response = await result.current.refreshVolumeSize.mutateAsync('test-volume');

      expect(response).toEqual({
        volume_id: 'test-volume',
        size_bytes: 1048576000,
        file_count: 10000,
        last_updated: expect.any(String)
      });
    });

    it('should track loading state correctly', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.refreshVolumeSize.isLoading).toBe(false);

      const promise = result.current.refreshVolumeSize.mutateAsync('test-volume');
      expect(result.current.refreshVolumeSize.isLoading).toBe(true);

      await promise;

      await waitFor(() => {
        expect(result.current.refreshVolumeSize.isLoading).toBe(false);
      });
    });
  });

  describe('indexFilesystem', () => {
    it('should successfully start filesystem indexing', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const response = await result.current.indexFilesystem.mutateAsync('test-volume');

      expect(response).toEqual({
        index_id: expect.stringMatching(/^index_test-volume_\d+$/),
        status: 'started',
        volume_id: 'test-volume',
        started_at: expect.any(String)
      });
    });

    it('should queue filesystem indexing when offline with higher retry count', async () => {
      // Mock offline state
      jest.mocked(require('@/utils/background-sync').useBackgroundSync).mockReturnValue({
        isOnline: false,
        pendingCount: 0,
        syncInProgress: false,
        addPendingOperation: jest.fn(),
        forceSync: jest.fn(),
        clearPending: jest.fn(),
      });

      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const response = await result.current.indexFilesystem.mutateAsync('test-volume');

      expect(response).toEqual({
        queued: true,
        offline: true
      });

      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledWith({
        type: 'index',
        volumeId: 'test-volume',
        maxRetries: 5, // Higher retry count for filesystem operations
      });
    });
  });

  describe('bulkScan', () => {
    it('should successfully perform bulk scan when online', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const volumeIds = ['vol1', 'vol2', 'vol3'];
      const response = await result.current.bulkScan.mutateAsync(volumeIds, {
        async: false,
        method: 'du'
      });

      expect(response).toEqual({
        results: expect.arrayContaining([
          expect.objectContaining({
            volume_id: expect.any(String),
            size_bytes: expect.any(Number),
            file_count: expect.any(Number),
            last_updated: expect.any(String)
          })
        ])
      });
    });

    it('should queue individual volumes when offline', async () => {
      // Mock offline state
      jest.mocked(require('@/utils/background-sync').useBackgroundSync).mockReturnValue({
        isOnline: false,
        pendingCount: 0,
        syncInProgress: false,
        addPendingOperation: jest.fn(),
        forceSync: jest.fn(),
        clearPending: jest.fn(),
      });

      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      const volumeIds = ['vol1', 'vol2'];
      const response = await result.current.bulkScan.mutateAsync(volumeIds);

      expect(response).toEqual({
        queued: true,
        offline: true,
        count: 2
      });

      // Should queue each volume individually
      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledTimes(2);
      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledWith({
        type: 'scan',
        volumeId: 'vol1',
        data: { async: false, method: 'du' },
        maxRetries: 3,
      });
      expect(backgroundSyncManager.addPendingOperation).toHaveBeenCalledWith({
        type: 'scan',
        volumeId: 'vol2',
        data: { async: false, method: 'du' },
        maxRetries: 3,
      });
    });

    it('should handle custom options', async () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      // Test with custom options
      await result.current.bulkScan.mutateAsync(['vol1'], {
        async: true,
        method: 'find'
      });

      // Verify the request was made with correct options
      // The test server would validate this in a real scenario
    });
  });

  describe('refreshVolumes', () => {
    it('should provide refresh volumes function', () => {
      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      expect(typeof result.current.refreshVolumes).toBe('function');
      
      // This function should trigger query invalidation
      // In a real test, we'd verify the QueryClient invalidation
      expect(() => result.current.refreshVolumes()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should propagate network errors', async () => {
      // Simulate network error
      server.use(
        http.post('/api/v1/volumes/:volumeId/size/refresh', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      await expect(
        result.current.refreshVolumeSize.mutateAsync('test-volume')
      ).rejects.toThrow();
    });

    it('should propagate API errors with status codes', async () => {
      // Simulate API error
      server.use(
        http.post('/api/v1/volumes/:volumeId/size/refresh', () => {
          return HttpResponse.json(
            { error: 'Volume not found' },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useVolumeOperations(), {
        wrapper: createTestWrapper(),
      });

      await expect(
        result.current.refreshVolumeSize.mutateAsync('nonexistent-volume')
      ).rejects.toThrow();
    });
  });
});