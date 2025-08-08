/**
 * Utility functions for visualization data transformations
 */

import type { VolumeResponse, ScanResponse } from '../../api/client';
import type { VolumeChartData, SystemStorageData, TopVolumeData } from './useVisualizationData.types';
import { getVolumeColor, getDriverColor, getSizeRangeColor } from '../../utils/colors';

/**
 * Size ranges for categorizing volumes
 */
export const SIZE_RANGES = [
  { label: '< 100MB', minSize: 0, maxSize: 100 * 1024 * 1024 },
  {
    label: '100MB - 1GB',
    minSize: 100 * 1024 * 1024,
    maxSize: 1024 * 1024 * 1024,
  },
  {
    label: '1GB - 10GB',
    minSize: 1024 * 1024 * 1024,
    maxSize: 10 * 1024 * 1024 * 1024,
  },
  {
    label: '10GB - 100GB',
    minSize: 10 * 1024 * 1024 * 1024,
    maxSize: 100 * 1024 * 1024 * 1024,
  },
  { label: '> 100GB', minSize: 100 * 1024 * 1024 * 1024, maxSize: null },
] as const;

/**
 * Transform volumes to chart-ready format
 */
export const transformVolumesToChartData = (
  volumes: VolumeResponse[],
  scanResults: Record<string, ScanResponse>,
): VolumeChartData[] => {
  if (!volumes.length) return [];

  const totalSize = volumes.reduce((sum, vol) => {
    const scanResult = scanResults[vol.id || ''];
    return sum + (scanResult?.result?.total_size || 0);
  }, 0);

  return volumes
    .map((volume, index) => {
      const scanResult = scanResults[volume.id || ''];
      const size = scanResult?.result?.total_size || 0;

      return {
        id: volume.id || '',
        name: volume.name || 'Unknown',
        size,
        percentage: totalSize > 0 ? (size / totalSize) * 100 : 0,
        color: getVolumeColor(index),
        driver: volume.driver || 'unknown',
        mountCount: volume.mountpoint ? 1 : 0,
        lastScanned: scanResult?.result?.scanned_at || volume.created_at || '',
      };
    })
    .filter((item) => item.size > 0)
    .sort((a, b) => b.size - a.size);
};

/**
 * Generate system storage overview data
 */
export const generateSystemStorageData = (
  volumes: VolumeResponse[],
  scanResults: Record<string, ScanResponse>,
  volumeStats: { totalSize: number },
): SystemStorageData => {
  if (!volumes.length) {
    return {
      totalSize: 0,
      volumeCount: 0,
      mountedCount: 0,
      unmountedCount: 0,
      byDriver: [],
      bySizeRange: [],
    };
  }

  const totalSize = volumeStats.totalSize;
  const mountedCount = volumes.filter((vol) => vol.mountpoint).length;

  // Group by driver
  const driverMap = new Map<
    string,
    { volumes: VolumeResponse[]; totalSize: number }
  >();
  volumes.forEach((volume) => {
    const driver = volume.driver || 'unknown';
    if (!driverMap.has(driver)) {
      driverMap.set(driver, { volumes: [], totalSize: 0 });
    }
    const driverData = driverMap.get(driver)!;
    driverData.volumes.push(volume);
    const scanResult = scanResults[volume.id || ''];
    driverData.totalSize += scanResult?.result?.total_size || 0;
  });

  const byDriver = Array.from(driverMap.entries())
    .map(([driver, data]) => ({
      driver,
      volumeCount: data.volumes.length,
      totalSize: data.totalSize,
      percentage: totalSize > 0 ? (data.totalSize / totalSize) * 100 : 0,
      color: getDriverColor(driver),
      averageSize: data.totalSize / data.volumes.length,
    }))
    .sort((a, b) => b.totalSize - a.totalSize);

  // Group by size ranges
  const bySizeRange = SIZE_RANGES
    .map((range, index) => {
      const volumesInRange = volumes.filter((vol) => {
        const scanResult = scanResults[vol.id || ''];
        const size = scanResult?.result?.total_size || 0;
        return (
          size >= range.minSize &&
          (range.maxSize === null || size <= range.maxSize)
        );
      });

      const rangeTotalSize = volumesInRange.reduce((sum, vol) => {
        const scanResult = scanResults[vol.id || ''];
        return sum + (scanResult?.result?.total_size || 0);
      }, 0);

      return {
        label: range.label,
        count: volumesInRange.length,
        totalSize: rangeTotalSize,
        percentage:
          volumes.length > 0
            ? (volumesInRange.length / volumes.length) * 100
            : 0,
        color: getSizeRangeColor(index),
      };
    })
    .filter((range) => range.count > 0);

  return {
    totalSize,
    volumeCount: volumes.length,
    mountedCount,
    unmountedCount: volumes.length - mountedCount,
    byDriver,
    bySizeRange,
  };
};

/**
 * Generate top volumes data with ranking
 */
export const generateTopVolumesData = (
  volumeChartData: VolumeChartData[],
): TopVolumeData[] => {
  return volumeChartData.slice(0, 10).map((volume, index) => ({
    id: volume.id,
    name: volume.name,
    size: volume.size,
    mountCount: volume.mountCount,
    driver: volume.driver,
    createdAt: new Date(volume.lastScanned),
    percentage: volume.percentage,
    rank: index + 1,
    status: volume.mountCount > 0 ? ('mounted' as const) : ('unmounted' as const),
    color: volume.color,
  }));
};

/**
 * Calculate time range cutoff
 */
export const getTimeRangeCutoff = (timeRange: string): Date => {
  const now = new Date();
  
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '6h':
      return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
};