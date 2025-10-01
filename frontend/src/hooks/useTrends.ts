/**
 * Trends data hooks
 *
 * Provides hooks for fetching and managing storage trends data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getTrendsSummary,
  getTrendsVolumesVolumeId,
  getTrendsVolumesVolumeId30day,
} from '@/api/orval-generated/api';

export interface TrendsData {
  storageGrowthData: any[];
  fileTypeData: any[];
  capacityForecast: any[];
  trendStats: {
    totalGrowth: number;
    growthRate: number;
    averageSize: number;
    topGrowingVolumes: Array<{ id: string; name: string; growthRate: number }>;
  };
}

export const useTrends = (volumeId?: string) => {
  const [data, setData] = useState<TrendsData>({
    storageGrowthData: [],
    fileTypeData: [],
    capacityForecast: [],
    trendStats: {
      totalGrowth: 0,
      growthRate: 0,
      averageSize: 0,
      topGrowingVolumes: [],
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrendsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (volumeId) {
        // Fetch specific volume trends
        const response = await getTrendsVolumesVolumeId30day(volumeId);
        const trendsData = response as any;

        // Transform API response to match component expectations
        const storageGrowthData =
          trendsData?.data_points?.map((point: any) => ({
            timestamp: new Date(point.date),
            totalSize: point.total_size || 0,
            volumeCount: 1,
            fileCount: point.file_count || 0,
          })) || [];

        // Calculate stats from data
        const stats = trendsData?.statistics || {};
        const trendStats = {
          totalGrowth: stats.total_growth || 0,
          growthRate: stats.growth_rate_percent || 0,
          averageSize: stats.avg_daily_size || 0,
          topGrowingVolumes: [],
        };

        setData({
          storageGrowthData,
          fileTypeData: [], // TODO: Fetch from file metadata
          capacityForecast: [], // TODO: Implement forecasting
          trendStats,
        });
      } else {
        // Fetch summary trends for all volumes
        const response = await getTrendsSummary();
        const summaryData = response as any;

        // Transform summary data
        const volumes = summaryData?.volumes || [];

        // Aggregate data from all volumes
        const storageGrowthData: any[] = [];
        let totalGrowth = 0;
        let totalSize = 0;

        volumes.forEach((volume: any) => {
          if (volume.data_points) {
            volume.data_points.forEach((point: any) => {
              const existing = storageGrowthData.find(
                (p) =>
                  new Date(p.timestamp).toDateString() ===
                  new Date(point.date).toDateString(),
              );
              if (existing) {
                existing.totalSize += point.total_size || 0;
                existing.fileCount += point.file_count || 0;
              } else {
                storageGrowthData.push({
                  timestamp: new Date(point.date),
                  totalSize: point.total_size || 0,
                  volumeCount: 1,
                  fileCount: point.file_count || 0,
                });
              }
            });
          }

          if (volume.statistics) {
            totalGrowth += volume.statistics.total_growth || 0;
            totalSize += volume.statistics.current_size || 0;
          }
        });

        // Sort by date
        storageGrowthData.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
        );

        const trendStats = {
          totalGrowth,
          growthRate: totalSize > 0 ? (totalGrowth / totalSize) * 100 : 0,
          averageSize:
            storageGrowthData.length > 0
              ? storageGrowthData.reduce(
                  (sum: number, p: any) => sum + p.totalSize,
                  0,
                ) / storageGrowthData.length
              : 0,
          topGrowingVolumes: volumes
            .map((v: any) => ({
              id: v.volume_id,
              name: v.volume_id,
              growthRate: v.statistics?.growth_rate_percent || 0,
            }))
            .sort((a: any, b: any) => b.growthRate - a.growthRate)
            .slice(0, 3),
        };

        setData({
          storageGrowthData,
          fileTypeData: [], // TODO: Fetch from file metadata aggregates
          capacityForecast: [], // TODO: Implement forecasting
          trendStats,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch trends data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [volumeId]);

  // Fetch data on mount
  useEffect(() => {
    fetchTrendsData();
  }, [fetchTrendsData]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchTrendsData,
  };
};

// Hook for volume-specific trends
export const useVolumeTrends = (volumeId: string, days: number = 30) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!volumeId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getTrendsVolumesVolumeId(volumeId, { days });
      setData(response);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch volume trends';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [volumeId, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
};
