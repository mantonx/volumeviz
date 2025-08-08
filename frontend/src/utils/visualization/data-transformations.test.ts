/**
 * Tests for visualization data transformation utilities
 */

import {
  transformVolumesToChartData,
  generateSystemStorageData,
  generateTopVolumesData,
  getTimeRangeCutoff,
  SIZE_RANGES,
} from './data-transformations';
import type { VolumeResponse, ScanResponse } from '../../api/client';

const mockVolumes: VolumeResponse[] = [
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
  {
    id: 'volume-3',
    name: 'test-volume-3',
    driver: 'local',
    mountpoint: '/var/data',
    created_at: '2023-01-03T00:00:00Z',
  },
];

const mockScanResults: Record<string, ScanResponse> = {
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
  'volume-3': {
    volume_id: 'volume-3',
    result: {
      total_size: 2 * 1024 * 1024 * 1024, // 2GB
      scanned_at: '2023-01-03T12:00:00Z',
    },
  },
};

describe('data-transformations', () => {
  describe('transformVolumesToChartData', () => {
    it('should return empty array for empty volumes', () => {
      const result = transformVolumesToChartData([], {});
      expect(result).toEqual([]);
    });

    it('should transform volumes to chart data correctly', () => {
      const result = transformVolumesToChartData(mockVolumes, mockScanResults);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'volume-3',
          name: 'test-volume-3',
          size: 2 * 1024 * 1024 * 1024,
          driver: 'local',
          mountCount: 1,
        }),
      );

      // Should be sorted by size descending
      expect(result[0].size).toBeGreaterThan(result[1].size);
      expect(result[1].size).toBeGreaterThan(result[2].size);
    });

    it('should calculate percentages correctly', () => {
      const result = transformVolumesToChartData(mockVolumes, mockScanResults);
      const totalSize = (1 + 0.5 + 2) * 1024 * 1024 * 1024; // 3.5GB

      expect(result[0].percentage).toBeCloseTo((2 / 3.5) * 100, 2);
      expect(result[1].percentage).toBeCloseTo((1 / 3.5) * 100, 2);
      expect(result[2].percentage).toBeCloseTo((0.5 / 3.5) * 100, 2);
    });

    it('should filter out volumes with zero size', () => {
      const volumesWithZero = [...mockVolumes];
      const scanResultsWithZero = {
        ...mockScanResults,
        'volume-2': {
          volume_id: 'volume-2',
          result: { total_size: 0 },
        },
      };

      const result = transformVolumesToChartData(
        volumesWithZero,
        scanResultsWithZero,
      );
      expect(result).toHaveLength(2);
    });

    it('should handle volumes without scan results', () => {
      const result = transformVolumesToChartData(mockVolumes, {});
      expect(result).toEqual([]);
    });
  });

  describe('generateSystemStorageData', () => {
    const mockVolumeStats = { totalSize: 3.5 * 1024 * 1024 * 1024 };

    it('should return empty data for empty volumes', () => {
      const result = generateSystemStorageData([], {}, { totalSize: 0 });

      expect(result).toEqual({
        totalSize: 0,
        volumeCount: 0,
        mountedCount: 0,
        unmountedCount: 0,
        byDriver: [],
        bySizeRange: [],
      });
    });

    it('should group volumes by driver correctly', () => {
      const result = generateSystemStorageData(
        mockVolumes,
        mockScanResults,
        mockVolumeStats,
      );

      const localDriver = result.byDriver.find((d) => d.driver === 'local');
      const nfsDriver = result.byDriver.find((d) => d.driver === 'nfs');

      expect(localDriver).toBeDefined();
      expect(localDriver?.volumeCount).toBe(2);
      expect(localDriver?.totalSize).toBe(3 * 1024 * 1024 * 1024); // 3GB

      expect(nfsDriver).toBeDefined();
      expect(nfsDriver?.volumeCount).toBe(1);
      expect(nfsDriver?.totalSize).toBe(512 * 1024 * 1024); // 512MB
    });

    it('should group volumes by size range correctly', () => {
      const result = generateSystemStorageData(
        mockVolumes,
        mockScanResults,
        mockVolumeStats,
      );

      expect(result.bySizeRange).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: '100MB - 1GB',
            count: 1, // volume-2 (512MB)
          }),
          expect.objectContaining({
            label: '1GB - 10GB',
            count: 2, // volume-1 (1GB) and volume-3 (2GB)
          }),
        ]),
      );
    });

    it('should calculate mounted/unmounted counts correctly', () => {
      const result = generateSystemStorageData(
        mockVolumes,
        mockScanResults,
        mockVolumeStats,
      );

      expect(result.volumeCount).toBe(3);
      expect(result.mountedCount).toBe(2); // volume-1 and volume-3 have mountpoint
      expect(result.unmountedCount).toBe(1); // volume-2 has no mountpoint
    });
  });

  describe('generateTopVolumesData', () => {
    it('should limit to 10 volumes', () => {
      const manyVolumes = Array.from({ length: 15 }, (_, i) => ({
        id: `vol-${i}`,
        name: `Volume ${i}`,
        size: 1000 - i,
        percentage: 10,
        color: '#000000',
        driver: 'local',
        mountCount: 1,
        lastScanned: '2023-01-01T00:00:00Z',
      }));

      const result = generateTopVolumesData(manyVolumes);
      expect(result).toHaveLength(10);
    });

    it('should assign correct ranks', () => {
      const chartData = [
        {
          id: '1',
          name: 'First',
          size: 1000,
          percentage: 50,
          color: '#000',
          driver: 'local',
          mountCount: 1,
          lastScanned: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Second',
          size: 500,
          percentage: 25,
          color: '#000',
          driver: 'local',
          mountCount: 0,
          lastScanned: '2023-01-01T00:00:00Z',
        },
      ];

      const result = generateTopVolumesData(chartData);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[0].status).toBe('mounted');
      expect(result[1].status).toBe('unmounted');
    });
  });

  describe('getTimeRangeCutoff', () => {
    const now = new Date('2023-01-01T12:00:00Z');
    const originalNow = Date.now;

    beforeEach(() => {
      Date.now = jest.fn(() => now.getTime());
    });

    afterEach(() => {
      Date.now = originalNow;
    });

    it('should calculate 1h cutoff correctly', () => {
      const result = getTimeRangeCutoff('1h');
      const expected = new Date(now.getTime() - 60 * 60 * 1000);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should calculate 6h cutoff correctly', () => {
      const result = getTimeRangeCutoff('6h');
      const expected = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should calculate 24h cutoff correctly', () => {
      const result = getTimeRangeCutoff('24h');
      const expected = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should default to 24h for unknown time range', () => {
      const result = getTimeRangeCutoff('unknown');
      const expected = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('SIZE_RANGES', () => {
    it('should have correct size ranges defined', () => {
      expect(SIZE_RANGES).toHaveLength(5);

      expect(SIZE_RANGES[0]).toEqual({
        label: '< 100MB',
        minSize: 0,
        maxSize: 100 * 1024 * 1024,
      });

      expect(SIZE_RANGES[4]).toEqual({
        label: '> 100GB',
        minSize: 100 * 1024 * 1024 * 1024,
        maxSize: null,
      });
    });
  });
});
