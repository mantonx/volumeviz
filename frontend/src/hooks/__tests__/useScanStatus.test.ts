import { useScanStatus } from '@/hooks/useScanStatus';
import {
    activeScansAtom
} from '@/store/atoms/scanStatus';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useScanStatus', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    mockFetch.mockReset();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('initializes with correct default state', () => {
      const { result } = renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
        }),
      );

      expect(result.current.scanStatus).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isPending).toBe(false);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.isCancelled).toBe(false);
      expect(result.current.isFinished).toBe(false);
    });

    it('starts tracking scan when enabled', () => {
      const scanId = 'test-scan-123';
      const volumeId = 'vol-123';

      renderHook(() =>
        useScanStatus({
          scanId,
          volumeId,
          enabled: true,
        }),
      );

      // Check if scan is being tracked
      const activeScans = store.get(activeScansAtom);
      expect(activeScans.has(scanId)).toBe(true);
    });
  });

  describe('Scan Status Polling', () => {
    it('fetches scan status when enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'test-scan-123',
            volume_id: 'vol-123',
            status: 'running',
            progress: 50,
            started_at: '2025-01-15T10:00:00Z',
          }),
      });

      renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
        }),
      );

      // Fast forward to trigger polling
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/scans/test-scan-123/status',
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: 'application/json',
            }),
          }),
        );
      });
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const mockOnError = vi.fn();
      const { result } = renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
          onError: mockOnError,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(result.current.error).toContain('Network error');
        expect(mockOnError).toHaveBeenCalledWith('Network error');
      });
    });
  });

  describe('Scan Actions', () => {
    describe('startScan', () => {
      it('starts a new scan successfully', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              scan_id: 'new-scan-456',
              volume_id: 'vol-123',
              status: 'pending',
            }),
        });

        const { result } = renderHook(() =>
          useScanStatus({
            scanId: 'test-scan-123',
            volumeId: 'vol-123',
          }),
        );

        let scanId: string;
        await act(async () => {
          scanId = await result.current.startScan('vol-123');
        });

        expect(scanId!).toBe('new-scan-456');
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/volumes/vol-123/scan',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Accept: 'application/json',
            }),
            body: JSON.stringify({ async: true }),
          }),
        );
      });

      it('handles start scan failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const { result } = renderHook(() =>
          useScanStatus({
            scanId: 'test-scan-123',
            volumeId: 'vol-123',
          }),
        );

        await expect(
          act(async () => {
            await result.current.startScan('vol-123');
          }),
        ).rejects.toThrow('HTTP 500: Internal Server Error');
      });
    });

    describe('cancelScan', () => {
      it('cancels a running scan successfully', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: 'Scan cancelled' }),
        });

        const { result } = renderHook(() =>
          useScanStatus({
            scanId: 'test-scan-123',
            volumeId: 'vol-123',
          }),
        );

        await act(async () => {
          await result.current.cancelScan();
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/scans/test-scan-123/cancel',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Accept: 'application/json',
            }),
          }),
        );
      });

      it('handles cancel scan failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        const { result } = renderHook(() =>
          useScanStatus({
            scanId: 'test-scan-123',
            volumeId: 'vol-123',
          }),
        );

        await expect(
          act(async () => {
            await result.current.cancelScan();
          }),
        ).rejects.toThrow('HTTP 404: Not Found');
      });
    });
  });

  describe('Status Computed Properties', () => {
    it('correctly computes status flags for pending scan', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'test-scan-123',
            status: 'pending',
          }),
      });

      const { result } = renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
        expect(result.current.isRunning).toBe(false);
        expect(result.current.isCompleted).toBe(false);
        expect(result.current.isFinished).toBe(false);
      });
    });

    it('calculates duration correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'test-scan-123',
            status: 'completed',
            started_at: '2025-01-15T10:00:00Z',
            completed_at: '2025-01-15T10:05:00Z',
          }),
      });

      const { result } = renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(result.current.duration).toBe(5 * 60 * 1000); // 5 minutes in ms
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onComplete when scan completes', async () => {
      const mockOnComplete = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'test-scan-123',
            status: 'completed',
            result: { total_size: 1024000 },
          }),
      });

      renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
          onComplete: mockOnComplete,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scan_id: 'test-scan-123',
            status: 'completed',
            result: { total_size: 1024000 },
          }),
        );
      });
    });
  });

  describe('WebSocket Mode', () => {
    beforeEach(() => {
      import.meta.env.VITE_ENABLE_WEBSOCKET = 'true';
    });

    afterEach(() => {
      import.meta.env.VITE_ENABLE_WEBSOCKET = 'false';
    });

    it('disables polling when WebSocket is enabled', () => {
      const { result } = renderHook(() =>
        useScanStatus({
          scanId: 'test-scan-123',
          volumeId: 'vol-123',
          enabled: true,
        }),
      );

      expect(result.current.isWebSocketMode).toBe(true);
      expect(result.current.isPollingEnabled).toBe(false);

      // Advance timers - fetch should not be called in WebSocket mode
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
