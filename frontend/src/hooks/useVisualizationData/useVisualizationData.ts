/**
 * Visualization data management hook
 *
 * Provides real-time data aggregation and formatting for visualization components.
 * Integrates with real-time scanning and handles data transformation for charts.
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  volumesAtom,
  scanResultsAtom,
  volumeStatsAtom,
} from '../../store/atoms/volumes';
import { useRealTimeScans } from '../useRealTimeScans';
import type {
  VisualizationDataOptions,
  VisualizationDataReturn,
  TimelineDataPoint,
} from './useVisualizationData.types';
import {
  transformVolumesToChartData,
  generateSystemStorageData,
  generateTopVolumesData,
  getTimeRangeCutoff,
} from '../../utils/visualization/data-transformations';

/**
 * Hook for managing visualization-ready data with real-time updates
 */
export const useVisualizationData = (
  options: VisualizationDataOptions = {},
): VisualizationDataReturn => {
  const {
    enableRealTime = true,
    refreshInterval = 30000,
    maxHistoryPoints = 100,
    autoScanNew = true,
  } = options;

  // Atom state
  const volumes = useAtomValue(volumesAtom);
  const scanResults = useAtomValue(scanResultsAtom);
  const volumeStats = useAtomValue(volumeStatsAtom);

  // Historical data storage
  const [timelineHistory, setTimelineHistory] = useState<TimelineDataPoint[]>(
    [],
  );
  const [lastVolumeCount, setLastVolumeCount] = useState(0);

  // Real-time scanning integration
  const realTimeScans = useRealTimeScans({
    enablePolling: enableRealTime,
    pollingInterval: refreshInterval,
    maxConcurrentScans: 5,
  });

  // Auto-scan new volumes when enabled
  useEffect(() => {
    if (autoScanNew) {
      const newVolumes = volumes.filter(
        (volume) => volume.id && !scanResults[volume.id],
      );

      newVolumes.forEach((volume) => {
        if (volume.id) {
          realTimeScans.queueScan(volume.id);
        }
      });
    }
  }, [volumes, scanResults, autoScanNew, realTimeScans]);

  // Transform volumes to chart-ready format
  const volumeChartData = useMemo(() => {
    return transformVolumesToChartData(volumes, scanResults);
  }, [volumes, scanResults]);

  // Generate system storage overview
  const systemStorageData = useMemo(() => {
    return generateSystemStorageData(volumes, scanResults, volumeStats);
  }, [volumes, scanResults, volumeStats]);

  // Generate top volumes data
  const topVolumesData = useMemo(() => {
    return generateTopVolumesData(volumeChartData);
  }, [volumeChartData]);

  // Update timeline history when data changes
  useEffect(() => {
    if (volumes.length !== lastVolumeCount) {
      const now = new Date();
      const timelinePoint: TimelineDataPoint = {
        timestamp: now.toISOString(),
        date: now,
        totalSize: volumeStats.totalSize,
        volumeCount: volumes.length,
        volumes: volumeChartData.map((vol) => ({
          id: vol.id,
          name: vol.name,
          size: vol.size,
        })),
      };

      setTimelineHistory((prev) => {
        const updated = [...prev, timelinePoint];
        return updated.slice(-maxHistoryPoints); // Keep only recent points
      });

      setLastVolumeCount(volumes.length);
    }
  }, [
    volumes.length,
    volumeStats.totalSize,
    volumeChartData,
    maxHistoryPoints,
    lastVolumeCount,
  ]);

  // Get timeline data for a specific time range
  const getTimelineData = useCallback(
    (timeRange: string = '24h') => {
      const cutoffTime = getTimeRangeCutoff(timeRange);
      return timelineHistory.filter((point) => point.date >= cutoffTime);
    },
    [timelineHistory],
  );

  // Manual scan trigger
  const triggerScan = useCallback(
    (volumeId?: string) => {
      if (volumeId) {
        realTimeScans.queueScan(volumeId);
      } else {
        realTimeScans.scanAllVolumes();
      }
    },
    [realTimeScans],
  );

  // Force data refresh
  const refreshData = useCallback(async () => {
    await realTimeScans.forceRefresh();
  }, [realTimeScans]);

  return {
    // Data for visualization components
    volumeChartData,
    systemStorageData,
    topVolumesData,
    timelineHistory,

    // Data access methods
    getTimelineData,

    // Actions
    triggerScan,
    refreshData,

    // Real-time status
    realTimeStatus: {
      isActive: realTimeScans.isActive,
      isWebSocketConnected: realTimeScans.isWebSocketConnected,
      activeScans: realTimeScans.activeScans,
      lastUpdate: realTimeScans.lastUpdate,
      status: realTimeScans.status,
      error: realTimeScans.error,
    },

    // Raw data access
    rawData: {
      volumes,
      scanResults,
      volumeStats,
    },
  };
};

export default useVisualizationData;