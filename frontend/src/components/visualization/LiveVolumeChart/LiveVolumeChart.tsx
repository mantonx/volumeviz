import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, Activity, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import type {
  LiveVolumeChartProps,
  VolumeChartData,
  ChartTooltipData,
} from './LiveVolumeChart.types';
import { formatBytes } from '../../../utils/formatters';
import { useWebSocketConnection } from '../../../hooks/useWebSocketConnection';
import type { VolumeResponseType } from '../../../api/generated/volumeviz-api';

// Predefined color palette for volume segments
const VOLUME_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

/**
 * LiveVolumeChart component for real-time volume size visualization.
 *
 * Displays volume sizes in an interactive chart format with:
 * - Real-time updates with configurable refresh intervals
 * - Multiple chart types (donut, pie, bar)
 * - Interactive tooltips and click handlers
 * - Automatic color assignment and legend
 * - Performance optimizations with memoization
 *
 * @example
 * ```tsx
 * <LiveVolumeChart
 *   volumes={volumes}
 *   variant="donut"
 *   refreshInterval={5000}
 *   onVolumeClick={(id) => navigate(`/volumes/${id}`)}
 *   onRefresh={fetchLatestData}
 * />
 * ```
 */
export const LiveVolumeChart: React.FC<LiveVolumeChartProps> = ({
  volumes,
  variant = 'donut',
  size = 'md',
  showLegend = true,
  showTooltip = true,
  enableAnimation = true,
  refreshInterval = 30000, // 30 seconds default
  maxVolumes = 10,
  onVolumeClick,
  onRefresh,
  className,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [realtimeVolumes, setRealtimeVolumes] = useState<VolumeResponseType[]>([]);

  // WebSocket connection for real-time updates
  const { isConnected, connectionStatus } = useWebSocketConnection({
    onVolumeUpdate: (volumes: VolumeResponseType[]) => {
      setRealtimeVolumes(volumes);
      setLastUpdated(new Date());
    },
    onScanComplete: (data) => {
      // Update the specific volume with new size data
      setRealtimeVolumes(prev => 
        prev.map(vol => 
          vol.id === data.volume_id 
            ? { ...vol, size: data.result.total_size }
            : vol
        )
      );
      setLastUpdated(new Date());
    }
  });

  // Use real-time data if available, otherwise fallback to props
  const volumeData = realtimeVolumes.length > 0 ? realtimeVolumes : volumes;

  // Transform volume data for chart consumption
  const chartData = useMemo<VolumeChartData[]>(() => {
    if (!volumeData?.length) return [];

    const totalSize = volumeData.reduce((sum, vol) => sum + (vol.size || 0), 0);

    return volumeData
      .slice(0, maxVolumes)
      .map((volume, index) => ({
        id: volume.id,
        name: volume.name,
        size: volume.size || 0,
        percentage: totalSize > 0 ? ((volume.size || 0) / totalSize) * 100 : 0,
        color: VOLUME_COLORS[index % VOLUME_COLORS.length],
        driver: volume.driver,
        mountCount: volume.mount_count || 0,
        lastScanned: volume.created_at,
      }))
      .filter((item) => item.size > 0)
      .sort((a, b) => b.size - a.size);
  }, [volumeData, maxVolumes]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const interval = setInterval(async () => {
      if (onRefresh) {
        setIsRefreshing(true);
        try {
          await onRefresh();
          setLastUpdated(new Date());
        } catch (error) {
          console.error('Failed to refresh volume data:', error);
        } finally {
          setIsRefreshing(false);
        }
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, onRefresh]);

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

  // Chart click handler
  const handleChartClick = useCallback(
    (data: any) => {
      if (onVolumeClick && data?.payload?.id) {
        onVolumeClick(data.payload.id);
      }
    },
    [onVolumeClick],
  );

  // Custom tooltip component
  const CustomTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.[0]) return null;

      const data = payload[0].payload as VolumeChartData;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4" style={{ color: data.color }} />
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {data.name}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Size:</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatBytes(data.size)}
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
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Driver:</span>
              <span className="text-gray-900 dark:text-white">
                {data.driver}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Mounts:</span>
              <span className="text-gray-900 dark:text-white">
                {data.mountCount}
              </span>
            </div>
          </div>
          {onVolumeClick && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500">
              Click to view details
            </div>
          )}
        </div>
      );
    },
    [onVolumeClick],
  );

  // Chart size configurations
  const sizeConfigs = {
    sm: { height: 200, fontSize: 'text-xs' },
    md: { height: 300, fontSize: 'text-sm' },
    lg: { height: 400, fontSize: 'text-base' },
  };

  const config = sizeConfigs[size];

  if (!chartData.length) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
          config.fontSize,
          className,
        )}
        style={{ height: config.height }}
      >
        <HardDrive className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No volume data available
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-center">
          Volume data will appear here once volumes are scanned
        </p>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <RefreshCw
              className={clsx('w-4 h-4', isRefreshing && 'animate-spin')}
            />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        )}
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
          <Activity className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Volume Usage
          </h3>
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" title="WebSocket Connected" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" title="WebSocket Disconnected" />
            )}
            <span className={`text-xs px-2 py-1 rounded-full ${
              isConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {connectionStatus}
            </span>
          </div>
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

      {/* Chart Container */}
      <div style={{ height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'bar' ? (
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatBytes(value)}
              />
              {showTooltip && <Tooltip content={<CustomTooltip />} />}
              <Bar
                dataKey="size"
                onClick={handleChartClick}
                cursor={onVolumeClick ? 'pointer' : 'default'}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={variant === 'donut' ? 60 : 0}
                outerRadius={120}
                paddingAngle={2}
                dataKey="size"
                onClick={handleChartClick}
                cursor={onVolumeClick ? 'pointer' : 'default'}
                animationBegin={0}
                animationDuration={enableAnimation ? 800 : 0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              {showTooltip && <Tooltip content={<CustomTooltip />} />}
              {showLegend && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {value} ({formatBytes(entry.payload?.size || 0)})
                    </span>
                  )}
                />
              )}
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {chartData.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Active Volumes
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatBytes(chartData.reduce((sum, vol) => sum + vol.size, 0))}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Size
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {chartData.reduce((sum, vol) => sum + vol.mountCount, 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Mounts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVolumeChart;
