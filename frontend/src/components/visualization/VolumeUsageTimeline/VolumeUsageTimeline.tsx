import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { Clock, TrendingUp, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { clsx } from 'clsx';
import type {
  VolumeUsageTimelineProps,
  TimelineDataPoint,
  TimeRangeOption,
  BrushSelection,
} from './VolumeUsageTimeline.types';
import { TIME_RANGE_OPTIONS } from './VolumeUsageTimeline.types';
import { formatBytes } from '../../../utils/formatters';

// Color palette for volume lines
const VOLUME_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#EC4899',
  '#6B7280',
];

/**
 * VolumeUsageTimeline component for displaying historical volume size data over time.
 *
 * Features:
 * - Interactive timeline chart with zoom and pan capabilities
 * - Time range selector (1h, 6h, 24h, 7d, 30d)
 * - Individual volume tracking with toggle functionality
 * - Brush selection for detailed time period analysis
 * - Real-time updates with smooth animations
 * - Performance optimizations for large datasets
 *
 * @example
 * ```tsx
 * <VolumeUsageTimeline
 *   data={timelineData}
 *   timeRange="24h"
 *   selectedVolumes={['vol-1', 'vol-2']}
 *   enableZoom={true}
 *   onTimeRangeChange={(range) => fetchData(range)}
 * />
 * ```
 */
export const VolumeUsageTimeline: React.FC<VolumeUsageTimelineProps> = ({
  data,
  timeRange = '24h',
  selectedVolumes = [],
  showTotalOnly = false,
  enableZoom = true,
  enableBrush = false,
  height = 400,
  onTimeRangeChange,
  onDataPointClick,
  onVolumeToggle,
  className,
}) => {
  const [_brushSelection, setBrushSelection] = useState<BrushSelection>({});
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // Get unique volumes from data for legend
  const availableVolumes = useMemo(() => {
    const volumeMap = new Map();

    data.forEach((point) => {
      point.volumes.forEach((vol) => {
        if (!volumeMap.has(vol.id)) {
          volumeMap.set(vol.id, {
            id: vol.id,
            name: vol.name,
            driver: vol.driver,
            color: VOLUME_COLORS[volumeMap.size % VOLUME_COLORS.length],
          });
        }
      });
    });

    return Array.from(volumeMap.values());
  }, [data]);

  // Transform data for chart display
  const chartData = useMemo(() => {
    return data.map((point) => {
      const transformed: any = {
        timestamp: point.timestamp,
        date: point.date,
        totalSize: point.totalSize,
        volumeCount: point.volumeCount,
        formattedTime: point.date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        formattedDate: point.date.toLocaleDateString(),
      };

      // Add individual volume sizes
      availableVolumes.forEach((vol) => {
        const volumeData = point.volumes.find((v) => v.id === vol.id);
        transformed[vol.id] = volumeData?.size || 0;
      });

      return transformed;
    });
  }, [data, availableVolumes]);

  // Handle time range change
  const handleTimeRangeChange = useCallback(
    (newRange: string) => {
      onTimeRangeChange?.(newRange);
      setZoomDomain(null); // Reset zoom when changing time range
      setBrushSelection({});
    },
    [onTimeRangeChange],
  );

  // Handle chart click
  const handleChartClick = useCallback(
    (chartData: any) => {
      if (onDataPointClick && chartData?.activePayload?.[0]?.payload) {
        const dataPoint = chartData.activePayload[0]
          .payload as TimelineDataPoint;
        onDataPointClick(dataPoint);
      }
    },
    [onDataPointClick],
  );

  // Custom tooltip component
  const CustomTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;

      const dataPoint = payload[0].payload;
      const date = new Date(dataPoint.timestamp);

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              {date.toLocaleString()}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Total Size:
              </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatBytes(dataPoint.totalSize)}
              </span>
            </div>

            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                Volume Count:
              </span>
              <span className="text-gray-900 dark:text-white">
                {dataPoint.volumeCount}
              </span>
            </div>

            {!showTotalOnly && selectedVolumes.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Individual Volumes:
                  </div>
                  <div className="space-y-1">
                    {availableVolumes
                      .filter((vol) => selectedVolumes.includes(vol.id))
                      .map((vol) => (
                        <div
                          key={vol.id}
                          className="flex justify-between items-center"
                        >
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: vol.color }}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {vol.name}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-gray-900 dark:text-white">
                            {formatBytes(dataPoint[vol.id] || 0)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    },
    [showTotalOnly, selectedVolumes, availableVolumes],
  );

  // Handle brush selection
  const handleBrushChange = useCallback((brushData: any) => {
    if (
      brushData?.startIndex !== undefined &&
      brushData?.endIndex !== undefined
    ) {
      setBrushSelection({
        startIndex: brushData.startIndex,
        endIndex: brushData.endIndex,
      });
    }
  }, []);

  // Handle zoom
  const handleZoom = useCallback(
    (type: 'in' | 'out' | 'reset') => {
      if (type === 'reset') {
        setZoomDomain(null);
        return;
      }

      if (!zoomDomain && chartData.length > 0) {
        const minTime = Math.min(...chartData.map((d) => d.date.getTime()));
        const maxTime = Math.max(...chartData.map((d) => d.date.getTime()));
        const center = (minTime + maxTime) / 2;
        const range = maxTime - minTime;

        if (type === 'in') {
          setZoomDomain([center - range * 0.25, center + range * 0.25]);
        }
      } else if (zoomDomain) {
        const [currentMin, currentMax] = zoomDomain;
        const center = (currentMin + currentMax) / 2;
        const range = currentMax - currentMin;

        if (type === 'in') {
          setZoomDomain([center - range * 0.375, center + range * 0.375]);
        } else {
          setZoomDomain([center - range * 1.33, center + range * 1.33]);
        }
      }
    },
    [zoomDomain, chartData],
  );

  if (!data.length) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
          className,
        )}
        style={{ height }}
      >
        <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No timeline data available
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-center">
          Historical volume usage data will appear here once available
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
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Volume Usage Timeline
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeRangeChange(option.value)}
                className={clsx(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  timeRange === option.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          {enableZoom && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleZoom('in')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom('out')}
                disabled={!zoomDomain}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom('reset')}
                disabled={!zoomDomain}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                title="Reset zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: height - 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: enableBrush ? 60 : 20,
            }}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />

            <XAxis
              dataKey="timestamp"
              type="category"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return timeRange === '30d' || timeRange === '7d'
                  ? date.toLocaleDateString()
                  : date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
              }}
              domain={zoomDomain || ['dataMin', 'dataMax']}
            />

            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatBytes} />

            <Tooltip content={<CustomTooltip />} />

            {!showTotalOnly && (
              <Legend
                verticalAlign="top"
                height={36}
                iconType="line"
                onClick={(data: any) => onVolumeToggle?.(data.dataKey)}
                wrapperStyle={{
                  cursor: onVolumeToggle ? 'pointer' : 'default',
                }}
              />
            )}

            {/* Total size line */}
            <Line
              type="monotone"
              dataKey="totalSize"
              name="Total Size"
              stroke="#3B82F6"
              strokeWidth={showTotalOnly ? 3 : 2}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
            />

            {/* Individual volume lines */}
            {!showTotalOnly &&
              availableVolumes
                .filter(
                  (vol) =>
                    selectedVolumes.length === 0 ||
                    selectedVolumes.includes(vol.id),
                )
                .map((vol) => (
                  <Line
                    key={vol.id}
                    type="monotone"
                    dataKey={vol.id}
                    name={vol.name}
                    stroke={vol.color}
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray={
                      selectedVolumes.length > 0 &&
                      !selectedVolumes.includes(vol.id)
                        ? '5 5'
                        : undefined
                    }
                    opacity={
                      selectedVolumes.length > 0 &&
                      !selectedVolumes.includes(vol.id)
                        ? 0.3
                        : 1
                    }
                  />
                ))}

            {/* Current time reference line */}
            <ReferenceLine
              x={new Date().toISOString()}
              stroke="#EF4444"
              strokeDasharray="2 2"
              label={{ value: 'Now', position: 'top' }}
            />

            {/* Brush for time selection */}
            {enableBrush && (
              <Brush
                dataKey="timestamp"
                height={30}
                stroke="#3B82F6"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                onChange={handleBrushChange}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {data.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Data Points
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatBytes(Math.max(...data.map((d) => d.totalSize)))}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Peak Usage
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatBytes(data[data.length - 1]?.totalSize || 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Current Total
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {availableVolumes.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Tracked Volumes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolumeUsageTimeline;
