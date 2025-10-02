/**
 * Enhanced utility to calculate volume percentage and display text with filesystem capacity information
 */

import { formatBytes } from './formatters';

export interface FilesystemCapacity {
  total_bytes?: number;
  available_bytes?: number;
  usage_percent?: number;
}

export interface VolumePercentageResult {
  percentage: number;
  displayText: string;
  tooltipText: string;
  capacityInfo?: {
    usedBytes: number;
    totalBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
}

export function calculateVolumePercentage(
  volumeSize: number,
  filesystemCapacity?: FilesystemCapacity,
  maxVolumeSize?: number,
): VolumePercentageResult {
  if (filesystemCapacity?.total_bytes) {
    // Calculate THIS VOLUME's percentage of the total filesystem capacity
    const volumePercentOfTotal =
      (volumeSize / filesystemCapacity.total_bytes) * 100;

    return {
      percentage: volumePercentOfTotal,
      displayText: `${volumePercentOfTotal.toFixed(1)}% of ${formatBytes(filesystemCapacity.total_bytes)} capacity`,
      tooltipText: `This volume: ${formatBytes(volumeSize)} (${volumePercentOfTotal.toFixed(1)}%) of ${formatBytes(filesystemCapacity.total_bytes)} total filesystem capacity`,
      capacityInfo: {
        usedBytes: volumeSize, // This volume's size
        totalBytes: filesystemCapacity.total_bytes, // Total filesystem capacity
        availableBytes: filesystemCapacity.available_bytes || 0,
        usagePercent: volumePercentOfTotal, // This volume as % of total
      },
    };
  } else if (maxVolumeSize) {
    // Fallback to relative size among volumes
    const percentage = (volumeSize / maxVolumeSize) * 100;
    return {
      percentage,
      displayText: `${percentage.toFixed(1)}% of max volume`,
      tooltipText: `${formatBytes(volumeSize)} of ${formatBytes(maxVolumeSize)} (relative to largest volume)`,
    };
  } else {
    return {
      percentage: 0,
      displayText: 'Size unknown',
      tooltipText: 'Filesystem capacity information unavailable',
    };
  }
}

// formatBytes is now imported from './formatters' at the top of the file
