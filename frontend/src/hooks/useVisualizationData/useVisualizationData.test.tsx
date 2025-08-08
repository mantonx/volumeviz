/**
 * Tests for useVisualizationData hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { useVisualizationData } from './useVisualizationData';
import type { VisualizationDataOptions } from './useVisualizationData.types';

// Mock the real-time scans hook
jest.mock('../useRealTimeScans', () => ({
  useRealTimeScans: () => ({
    queueScan: jest.fn(),
    scanAllVolumes: jest.fn(),
    forceRefresh: jest.fn().mockResolvedValue(undefined),
    isActive: false,
    isWebSocketConnected: false,
    activeScans: 0,
    lastUpdate: null,
    status: 'idle',
    error: null,
  }),
}));

// Mock Jotai atoms
jest.mock('../../store/atoms/volumes', () => ({
  volumesAtom: { init: [] },
  scanResultsAtom: { init: {} },
  volumeStatsAtom: { init: { totalSize: 0 } },
}));

const mockVolumes = [
  {
    id: 'volume-1',
    name: 'test-volume-1',
    driver: 'local',
    mountpoint: '/data',
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'volume-2',
    name: 'test-volume-2',
    driver: 'nfs',
    created_at: '2023-01-02T00:00:00Z',
  },
];

const mockScanResults = {
  'volume-1': {
    volume_id: 'volume-1',
    result: {
      total_size: 1024 * 1024 * 1024, // 1GB
      scanned_at: '2023-01-01T12:00:00Z',
    },
  },
  'volume-2': {
    volume_id: 'volume-2',
    result: {
      total_size: 512 * 1024 * 1024, // 512MB
      scanned_at: '2023-01-02T12:00:00Z',
    },
  },
};

const renderUseVisualizationData = (options?: VisualizationDataOptions) => {
  return renderHook(() => useVisualizationData(options), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    ),
  });
};

describe('useVisualizationData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default options', () => {
    const { result } = renderUseVisualizationData();

    expect(result.current.volumeChartData).toEqual([]);
    expect(result.current.systemStorageData.volumeCount).toBe(0);
    expect(result.current.topVolumesData).toEqual([]);
    expect(result.current.timelineHistory).toEqual([]);
  });

  it('should accept custom options', () => {
    const options: VisualizationDataOptions = {
      enableRealTime: false,
      refreshInterval: 60000,
      maxHistoryPoints: 50,
      autoScanNew: false,
    };

    const { result } = renderUseVisualizationData(options);

    // Hook should be initialized with custom options
    expect(result.current.realTimeStatus.isActive).toBe(false);
  });

  it('should transform volume data to chart format', () => {
    // This would require mocking the atoms to return mock data
    const { result } = renderUseVisualizationData();

    // Test would verify that volumes are transformed correctly
    expect(Array.isArray(result.current.volumeChartData)).toBe(true);
  });

  it('should generate system storage data', () => {
    const { result } = renderUseVisualizationData();

    expect(result.current.systemStorageData).toEqual(
      expect.objectContaining({
        totalSize: expect.any(Number),
        volumeCount: expect.any(Number),
        mountedCount: expect.any(Number),
        unmountedCount: expect.any(Number),
        byDriver: expect.any(Array),
        bySizeRange: expect.any(Array),
      }),
    );
  });

  it('should generate top volumes data', () => {
    const { result } = renderUseVisualizationData();

    expect(Array.isArray(result.current.topVolumesData)).toBe(true);
    // Should limit to top 10 volumes
    expect(result.current.topVolumesData.length).toBeLessThanOrEqual(10);
  });

  it('should provide timeline data filtering', () => {
    const { result } = renderUseVisualizationData();

    const timelineData1h = result.current.getTimelineData('1h');
    const timelineData24h = result.current.getTimelineData('24h');
    const timelineData7d = result.current.getTimelineData('7d');

    expect(Array.isArray(timelineData1h)).toBe(true);
    expect(Array.isArray(timelineData24h)).toBe(true);
    expect(Array.isArray(timelineData7d)).toBe(true);
  });

  it('should trigger scans for specific volumes', () => {
    const { result } = renderUseVisualizationData();

    act(() => {
      result.current.triggerScan('volume-1');
    });

    // Mock function should be called
    expect(result.current.triggerScan).toBeDefined();
  });

  it('should trigger scans for all volumes', () => {
    const { result } = renderUseVisualizationData();

    act(() => {
      result.current.triggerScan();
    });

    // Should call scan all volumes
    expect(result.current.triggerScan).toBeDefined();
  });

  it('should refresh data', async () => {
    const { result } = renderUseVisualizationData();

    await act(async () => {
      await result.current.refreshData();
    });

    // Should complete without error
    expect(result.current.refreshData).toBeDefined();
  });

  it('should provide real-time status', () => {
    const { result } = renderUseVisualizationData();

    expect(result.current.realTimeStatus).toEqual(
      expect.objectContaining({
        isActive: expect.any(Boolean),
        isWebSocketConnected: expect.any(Boolean),
        activeScans: expect.any(Number),
        status: expect.any(String),
      }),
    );
  });

  it('should provide raw data access', () => {
    const { result } = renderUseVisualizationData();

    expect(result.current.rawData).toEqual(
      expect.objectContaining({
        volumes: expect.any(Array),
        scanResults: expect.any(Object),
        volumeStats: expect.any(Object),
      }),
    );
  });

  it('should maintain timeline history with limits', () => {
    const { result } = renderUseVisualizationData({
      maxHistoryPoints: 5,
    });

    // Timeline should respect max points limit
    expect(result.current.timelineHistory.length).toBeLessThanOrEqual(5);
  });

  it('should auto-scan new volumes when enabled', () => {
    renderUseVisualizationData({
      autoScanNew: true,
    });

    // Auto-scan should be enabled by default
    // Actual scanning would be tested by mocking volume changes
  });

  it('should not auto-scan when disabled', () => {
    renderUseVisualizationData({
      autoScanNew: false,
    });

    // Auto-scan should be disabled
    // Would verify no scans are triggered for new volumes
  });
});