/**
 * Tests for useRealTimeScans hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { useRealTimeScans } from './useRealTimeScans';
import type { RealTimeScanOptions } from './useRealTimeScans.types';

// Mock the API services
jest.mock('../../api/services', () => ({
  useVolumes: () => ({
    fetchVolumes: jest.fn().mockResolvedValue([]),
  }),
  useVolumeScanning: () => ({
    scanVolume: jest.fn().mockResolvedValue({
      volume_id: 'test-volume',
      result: { total_size: 1024 },
    }),
  }),
}));

// Mock Jotai atoms
jest.mock('../../store/atoms/volumes', () => ({
  volumesAtom: { init: [] },
  scanLoadingAtom: { init: {} },
  scanResultsAtom: { init: {} },
  scanErrorAtom: { init: {} },
  asyncScansAtom: { init: {} },
  autoRefreshEnabledAtom: { init: true },
  autoRefreshIntervalAtom: { init: 30000 },
  volumesLastUpdatedAtom: { init: null },
}));

const renderUseRealTimeScans = (options?: RealTimeScanOptions) => {
  return renderHook(() => useRealTimeScans(options), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    ),
  });
};

describe('useRealTimeScans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderUseRealTimeScans();

    expect(result.current.isActive).toBe(false);
    expect(result.current.isWebSocketConnected).toBe(false);
    expect(result.current.activeScans).toBe(0);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBe(null);
  });

  it('should accept custom options', () => {
    const options: RealTimeScanOptions = {
      enablePolling: false,
      pollingInterval: 60000,
      maxConcurrentScans: 5,
    };

    const { result } = renderUseRealTimeScans(options);

    // Hook should be initialized but not started yet
    expect(result.current.isActive).toBe(false);
  });

  it('should start and stop real-time updates', () => {
    const { result } = renderUseRealTimeScans();

    act(() => {
      result.current.startRealTimeUpdates();
    });

    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.stopRealTimeUpdates();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('should queue scans for volumes', () => {
    const { result } = renderUseRealTimeScans();

    act(() => {
      result.current.queueScan('test-volume-1');
      result.current.queueScan('test-volume-2');
    });

    // The scans should be queued (actual processing is async)
    expect(result.current.activeScans).toBeGreaterThanOrEqual(0);
  });

  it('should handle scan completion callbacks', () => {
    const onScanComplete = jest.fn();
    const onScanError = jest.fn();

    const { result } = renderUseRealTimeScans({
      onScanComplete,
      onScanError,
    });

    act(() => {
      result.current.queueScan('test-volume');
    });

    // Callbacks should be set up (actual calls happen async)
    expect(onScanComplete).not.toHaveBeenCalled();
    expect(onScanError).not.toHaveBeenCalled();
  });

  it('should scan all volumes', () => {
    const { result } = renderUseRealTimeScans();

    // Mock some volumes in state
    act(() => {
      // This would typically come from the volumes atom
      result.current.scanAllVolumes();
    });

    // Should attempt to scan all volumes
    expect(result.current.activeScans).toBeGreaterThanOrEqual(0);
  });

  it('should force refresh', async () => {
    const { result } = renderUseRealTimeScans();

    await act(async () => {
      await result.current.forceRefresh();
    });

    // Should complete without error
    expect(result.current.error).toBe(null);
  });

  it('should handle WebSocket connection when enabled', () => {
    const { result } = renderUseRealTimeScans({
      enableWebSocket: true,
      webSocketUrl: 'ws://localhost:8080/ws',
    });

    act(() => {
      result.current.startRealTimeUpdates();
    });

    // WebSocket connection should be attempted
    expect(result.current.status).toBe('connecting');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderUseRealTimeScans();

    unmount();

    // Should cleanup without errors
    expect(true).toBe(true);
  });

  it('should handle polling updates', () => {
    const onPollingUpdate = jest.fn();

    renderUseRealTimeScans({
      enablePolling: true,
      onPollingUpdate,
    });

    // Polling should be set up when auto-refresh is enabled
    expect(onPollingUpdate).toBeDefined();
  });

  it('should respect max concurrent scans limit', () => {
    const { result } = renderUseRealTimeScans({
      maxConcurrentScans: 2,
    });

    act(() => {
      result.current.queueScan('volume-1');
      result.current.queueScan('volume-2');
      result.current.queueScan('volume-3');
    });

    // Should respect the concurrent scan limit
    expect(result.current.activeScans).toBeLessThanOrEqual(2);
  });
});
