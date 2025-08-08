import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown,
  Medal,
  Award,
  HardDrive,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Scan,
  Plug,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  TopVolumesWidgetProps,
  TopVolumeData,
} from './TopVolumesWidget.types';
import { SIZE_CATEGORIES, RANKING_COLORS } from './TopVolumesWidget.types';
import { formatBytes } from '../../../utils/formatters';

/**
 * TopVolumesWidget component displays largest volumes with ranking and visual indicators.
 *
 * Features:
 * - Ranked list of volumes by size, mount count, or creation date
 * - Visual ranking indicators (crown, medal, award icons)
 * - Size progress bars and category indicators
 * - Interactive elements with click handlers
 * - Real-time updates and refresh capabilities
 * - Trend indicators for growth tracking
 * - Responsive design with multiple size variants
 *
 * @example
 * ```tsx
 * <TopVolumesWidget
 *   volumes={volumes}
 *   maxVolumes={10}
 *   sortBy="size"
 *   showIndicators={true}
 *   onVolumeClick={(id) => navigate(`/volumes/${id}`)}
 *   onVolumeScan={(id) => startScan(id)}
 * />
 * ```
 */
export const TopVolumesWidget: React.FC<TopVolumesWidgetProps> = ({
  volumes,
  maxVolumes = 10,
  sortBy = 'size',
  sortOrder = 'desc',
  showIndicators = true,
  showDetails = true,
  enableRefresh = false,
  refreshInterval = 30000,
  size = 'md',
  onRefresh,
  onVolumeClick,
  onVolumeScan,
  className,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [scanningVolumes, setScanningVolumes] = useState<Set<string>>(
    new Set(),
  );

  // Transform and rank volume data
  const topVolumes = useMemo<TopVolumeData[]>(() => {
    if (!volumes?.length) return [];

    const totalSize = volumes.reduce((sum, vol) => sum + (vol.size || 0), 0);

    return volumes
      .map((volume) => {
        const size = volume.size || 0;
        const mountCount = volume.mount_count || 0;
        const createdAt = new Date(volume.created_at);

        // Determine size category
        let sizeCategory: 'small' | 'medium' | 'large' | 'huge' = 'small';
        if (size >= SIZE_CATEGORIES.large.threshold) sizeCategory = 'huge';
        else if (size >= SIZE_CATEGORIES.medium.threshold)
          sizeCategory = 'large';
        else if (size >= SIZE_CATEGORIES.small.threshold)
          sizeCategory = 'medium';

        return {
          id: volume.id,
          name: volume.name,
          driver: volume.driver,
          size,
          mountCount,
          createdAt,
          mountPoint: volume.mount_point,
          percentage: totalSize > 0 ? (size / totalSize) * 100 : 0,
          rank: 0, // Will be set after sorting
          sizeCategory,
          status:
            mountCount > 0 ? ('mounted' as const) : ('unmounted' as const),
          color: SIZE_CATEGORIES[sizeCategory].color,
        };
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'mount_count':
            comparison = a.mountCount - b.mountCount;
            break;
          case 'created_at':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'size':
          default:
            comparison = a.size - b.size;
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      })
      .slice(0, maxVolumes)
      .map((volume, index) => ({
        ...volume,
        rank: index + 1,
        color: RANKING_COLORS[Math.min(index, RANKING_COLORS.length - 1)],
      }));
  }, [volumes, maxVolumes, sortBy, sortOrder]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!enableRefresh || !refreshInterval || refreshInterval <= 0) return;

    const interval = setInterval(async () => {
      if (onRefresh) {
        setIsRefreshing(true);
        try {
          await onRefresh();
          setLastUpdated(new Date());
        } catch (error) {
          console.error('Failed to refresh top volumes:', error);
        } finally {
          setIsRefreshing(false);
        }
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enableRefresh, refreshInterval, onRefresh]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  // Volume click handler
  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      onVolumeClick?.(volumeId);
    },
    [onVolumeClick],
  );

  // Volume scan handler
  const handleVolumeScan = useCallback(
    async (volumeId: string) => {
      if (!onVolumeScan || scanningVolumes.has(volumeId)) return;

      setScanningVolumes((prev) => new Set(prev).add(volumeId));
      try {
        await onVolumeScan(volumeId);
      } catch (error) {
        console.error('Scan failed for volume:', volumeId, error);
      } finally {
        setScanningVolumes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(volumeId);
          return newSet;
        });
      }
    },
    [onVolumeScan, scanningVolumes],
  );

  // Get ranking icon
  const getRankingIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Award className="w-4 h-4 text-orange-600" />;
      default:
        return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
    }
  };

  // Size configurations
  const sizeConfigs = {
    sm: { itemHeight: 'h-12', spacing: 'space-y-2', fontSize: 'text-sm' },
    md: { itemHeight: 'h-16', spacing: 'space-y-3', fontSize: 'text-base' },
    lg: { itemHeight: 'h-20', spacing: 'space-y-4', fontSize: 'text-lg' },
  };

  const config = sizeConfigs[size];

  if (!topVolumes.length) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
          config.fontSize,
          className,
        )}
      >
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No volumes to rank
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-center">
          Volume rankings will appear here once data is available
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4',
        config.fontSize,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top Volumes
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            (by{' '}
            {sortBy === 'mount_count'
              ? 'mounts'
              : sortBy === 'created_at'
                ? 'age'
                : 'size'}
            )
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Refresh data"
            >
              <RefreshCw
                className={clsx('w-4 h-4', isRefreshing && 'animate-spin')}
              />
            </button>
          )}
        </div>
      </div>

      {/* Volume List */}
      <div className={clsx('space-y-1', config.spacing)}>
        {topVolumes.map((volume) => (
          <div
            key={volume.id}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 transition-colors',
              config.itemHeight,
              onVolumeClick &&
                'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer',
            )}
            onClick={() => handleVolumeClick(volume.id)}
          >
            {/* Ranking Icon */}
            <div className="flex-shrink-0 w-8 flex items-center justify-center">
              {showIndicators && getRankingIcon(volume.rank)}
            </div>

            {/* Volume Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {volume.name}
                </span>

                {volume.status === 'mounted' && (
                  <Plug className="w-3 h-3 text-green-500 flex-shrink-0" />
                )}

                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {volume.driver}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span className="font-mono">{formatBytes(volume.size)}</span>
                  {volume.percentage > 0.1 && (
                    <span className="text-gray-500">
                      ({volume.percentage.toFixed(1)}%)
                    </span>
                  )}
                </div>

                {showDetails && (
                  <>
                    {volume.mountCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Plug className="w-3 h-3" />
                        <span>{volume.mountCount} mounts</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{volume.createdAt.toLocaleDateString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Bar */}
              {showIndicators && volume.percentage > 0.1 && (
                <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(volume.percentage, 100)}%`,
                      backgroundColor: volume.color,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Size Category Indicator */}
            {showIndicators && (
              <div className="flex-shrink-0 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: volume.color }}
                  title={`${volume.sizeCategory} volume`}
                />

                {/* Trend Indicator */}
                {volume.trend && (
                  <div className="flex items-center">
                    {volume.trend === 'up' && (
                      <TrendingUp className="w-3 h-3 text-red-500" />
                    )}
                    {volume.trend === 'down' && (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    )}
                    {volume.trend === 'stable' && (
                      <Minus className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Scan Button */}
            {onVolumeScan && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVolumeScan(volume.id);
                }}
                disabled={scanningVolumes.has(volume.id)}
                className="flex-shrink-0 p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                title="Scan volume"
              >
                <Scan
                  className={clsx(
                    'w-3 h-3',
                    scanningVolumes.has(volume.id) && 'animate-spin',
                  )}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {topVolumes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {topVolumes.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ranked Volumes
              </div>
            </div>

            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatBytes(
                  topVolumes.reduce((sum, vol) => sum + vol.size, 0),
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Size
              </div>
            </div>

            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {topVolumes.filter((vol) => vol.status === 'mounted').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Mounted
              </div>
            </div>

            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatBytes(Math.max(...topVolumes.map((vol) => vol.size)))}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Largest
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopVolumesWidget;
