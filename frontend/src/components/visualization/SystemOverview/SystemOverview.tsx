import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  HardDrive,
  Database,
  TrendingUp,
  RefreshCw,
  Layers,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  SystemOverviewProps,
  SystemStorageBreakdown,
  DriverBreakdown,
  SizeRangeBreakdown,
} from './SystemOverview.types';
import { SIZE_RANGES, DRIVER_COLORS } from './SystemOverview.types';
import { formatBytes } from '../../../utils/formatters';

/**
 * SystemOverview component provides a comprehensive view of total storage usage.
 *
 * Features:
 * - Total storage breakdown by drivers and size ranges
 * - Visual distribution charts (pie and bar)
 * - Real-time statistics and growth tracking
 * - Interactive elements with click handlers
 * - Automatic refresh capabilities
 * - Responsive design with dark mode support
 *
 * @example
 * ```tsx
 * <SystemOverview
 *   volumes={volumes}
 *   showBreakdown={true}
 *   enableRefresh={true}
 *   onDriverClick={(driver) => filterByDriver(driver)}
 *   onVolumeClick={(id) => navigate(`/volumes/${id}`)}
 * />
 * ```
 */
export const SystemOverview: React.FC<SystemOverviewProps> = ({
  volumes,
  showBreakdown = true,
  enableRefresh = false,
  refreshInterval = 30000,
  height = 600,
  onRefresh,
  onDriverClick,
  className,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'overview' | 'drivers' | 'sizes'>(
    'overview',
  );

  // Calculate system storage breakdown
  const storageBreakdown = useMemo<SystemStorageBreakdown>(() => {
    if (!volumes?.length) {
      return {
        totalSize: 0,
        volumeCount: 0,
        mountedCount: 0,
        unmountedCount: 0,
        byDriver: [],
        bySizeRange: [],
        growth: {},
      };
    }

    const totalSize = volumes.reduce((sum, vol) => sum + (vol.size || 0), 0);
    const mountedCount = volumes.filter(
      (vol) => (vol.mount_count || 0) > 0,
    ).length;
    const unmountedCount = volumes.length - mountedCount;

    // Group by driver
    const driverMap = new Map<
      string,
      { volumes: typeof volumes; totalSize: number }
    >();
    volumes.forEach((volume) => {
      const driver = volume.driver || 'unknown';
      if (!driverMap.has(driver)) {
        driverMap.set(driver, { volumes: [], totalSize: 0 });
      }
      const driverData = driverMap.get(driver)!;
      driverData.volumes.push(volume);
      driverData.totalSize += volume.size || 0;
    });

    const byDriver: DriverBreakdown[] = Array.from(driverMap.entries())
      .map(([driver, data]) => ({
        driver,
        volumeCount: data.volumes.length,
        totalSize: data.totalSize,
        percentage: totalSize > 0 ? (data.totalSize / totalSize) * 100 : 0,
        color: DRIVER_COLORS[driver] || DRIVER_COLORS.default,
        averageSize: data.totalSize / data.volumes.length,
      }))
      .sort((a, b) => b.totalSize - a.totalSize);

    // Group by size ranges
    const bySizeRange: SizeRangeBreakdown[] = SIZE_RANGES.map((range) => {
      const volumesInRange = volumes.filter((vol) => {
        const size = vol.size || 0;
        return (
          size >= range.minSize &&
          (range.maxSize === null || size <= range.maxSize)
        );
      });

      const totalSize = volumesInRange.reduce(
        (sum, vol) => sum + (vol.size || 0),
        0,
      );

      return {
        label: range.label,
        minSize: range.minSize,
        maxSize: range.maxSize,
        count: volumesInRange.length,
        totalSize,
        percentage:
          volumes.length > 0
            ? (volumesInRange.length / volumes.length) * 100
            : 0,
        color: range.color,
      };
    }).filter((range) => range.count > 0);

    return {
      totalSize,
      volumeCount: volumes.length,
      mountedCount,
      unmountedCount,
      byDriver,
      bySizeRange,
      growth: {}, // TODO: Implement growth tracking with historical data
    };
  }, [volumes]);

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
          console.error('Failed to refresh system overview:', error);
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

  // Chart click handlers
  const handleDriverClick = useCallback(
    (data: any) => {
      if (onDriverClick && data?.payload?.driver) {
        onDriverClick(data.payload.driver);
      }
    },
    [onDriverClick],
  );

  // Custom tooltip for charts
  const CustomTooltip = useCallback(({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const isDriverData = 'driver' in data;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-medium text-gray-900 dark:text-white">
            {isDriverData ? data.driver : data.label}
          </span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              {isDriverData ? 'Volumes:' : 'Count:'}
            </span>
            <span className="font-mono text-gray-900 dark:text-white">
              {isDriverData ? data.volumeCount : data.count}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              Total Size:
            </span>
            <span className="font-mono text-gray-900 dark:text-white">
              {formatBytes(data.totalSize)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              Percentage:
            </span>
            <span className="font-mono text-gray-900 dark:text-white">
              {data.percentage.toFixed(1)}%
            </span>
          </div>

          {isDriverData && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Avg Size:
              </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatBytes(data.averageSize)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }, []);

  if (!volumes?.length) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
          className,
        )}
        style={{ height }}
      >
        <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No system data available
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-center">
          System overview will appear here once volumes are scanned
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Overview
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { key: 'overview', label: 'Overview', icon: Database },
              { key: 'drivers', label: 'Drivers', icon: PieChartIcon },
              { key: 'sizes', label: 'Sizes', icon: BarChart3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key as any)}
                className={clsx(
                  'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
                  viewMode === key
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
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

      {/* Key Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Total Storage
            </span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatBytes(storageBreakdown.totalSize)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Total Volumes
            </span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {storageBreakdown.volumeCount}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Mounted
            </span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {storageBreakdown.mountedCount}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Drivers
            </span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {storageBreakdown.byDriver.length}
          </div>
        </div>
      </div>

      {/* Charts and Breakdown */}
      {showBreakdown && (
        <div style={{ height: height - 200 }}>
          {viewMode === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Driver Distribution Pie Chart */}
              <div className="bg-gray-50 dark:bg-gray-700/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Storage by Driver
                </h4>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={storageBreakdown.byDriver}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="totalSize"
                      onClick={handleDriverClick}
                      cursor={onDriverClick ? 'pointer' : 'default'}
                    >
                      {storageBreakdown.byDriver.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Size Distribution Bar Chart */}
              <div className="bg-gray-50 dark:bg-gray-700/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Volumes by Size Range
                </h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storageBreakdown.bySizeRange}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count">
                      {storageBreakdown.bySizeRange.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {viewMode === 'drivers' && (
            <div className="h-full">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Driver Details
              </h4>
              <div className="space-y-3 h-full overflow-y-auto">
                {storageBreakdown.byDriver.map((driver) => (
                  <div
                    key={driver.driver}
                    className={clsx(
                      'bg-gray-50 dark:bg-gray-700/20 rounded-lg p-4 transition-colors',
                      onDriverClick &&
                        'hover:bg-gray-100 dark:hover:bg-gray-700/40 cursor-pointer',
                    )}
                    onClick={() => onDriverClick?.(driver.driver)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: driver.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {driver.driver}
                        </span>
                      </div>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {driver.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Volumes
                        </span>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {driver.volumeCount}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Total Size
                        </span>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {formatBytes(driver.totalSize)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Avg Size
                        </span>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {formatBytes(driver.averageSize)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'sizes' && (
            <div className="h-full">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Size Distribution
              </h4>
              <div className="space-y-3 h-full overflow-y-auto">
                {storageBreakdown.bySizeRange.map((range) => (
                  <div
                    key={range.label}
                    className="bg-gray-50 dark:bg-gray-700/20 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: range.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {range.label}
                        </span>
                      </div>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {range.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Volume Count
                        </span>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {range.count}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Total Size
                        </span>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {formatBytes(range.totalSize)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemOverview;
