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
  ReferenceDot,
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  ZoomIn,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  VolumeGrowthTimelineProps,
  HistoricalDataPoint,
  VolumeInfo,
  TimeRangeOption,
  ChartAnnotation,
} from './VolumeGrowthTimeline.types';
import { TIME_RANGE_OPTIONS } from './VolumeGrowthTimeline.types';
import { formatBytes, formatDate } from '../../../utils/formatters';

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

// Trend indicator colors
const TREND_COLORS = {
  increasing: '#10B981',
  decreasing: '#EF4444',
  stable: '#6B7280',
  volatile: '#F59E0B',
};

/**
 * VolumeGrowthTimeline component for displaying volume size growth over time.
 *
 * Features:
 * - Multi-line chart showing growth trends for multiple volumes
 * - Interactive time range selection with brushing
 * - Growth rate indicators and anomaly detection
 * - Configurable time granularity and data aggregation
 * - Volume visibility toggle and color coding
 */
export const VolumeGrowthTimeline: React.FC<VolumeGrowthTimelineProps> = ({
  data = [],
  timeRange = '1m',
  selectedVolumes = [],
  showGrowthRate = true,
  showAnomalies = true,
  enableBrushing = true,
  enableZoom = true,
  height = 400,
  showDataPoints = false,
  showArea = false,
  onTimeRangeChange,
  onVolumeSelectionChange,
  onDataPointClick,
  className,
}) => {
  const [activeTimeRange, setActiveTimeRange] = useState(timeRange);
  const [volumeVisibility, setVolumeVisibility] = useState<
    Record<string, boolean>
  >({});
  const [brushSelection, setBrushSelection] = useState<{
    startIndex?: number;
    endIndex?: number;
  }>({});

  // Process and filter data based on time range
  const filteredData = useMemo(() => {
    if (!data.length) return [];

    const timeRangeConfig = TIME_RANGE_OPTIONS.find(
      (opt) => opt.value === activeTimeRange,
    );
    if (!timeRangeConfig || timeRangeConfig.value === 'all') return data;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRangeConfig.days);

    return data.filter((point) => point.date >= cutoffDate);
  }, [data, activeTimeRange]);

  // Group data by timestamp for multi-line chart
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];

    const timestampMap = new Map<string, any>();

    filteredData.forEach((point) => {
      const timestamp = point.timestamp;

      if (!timestampMap.has(timestamp)) {
        timestampMap.set(timestamp, {
          timestamp,
          date: point.date,
          _annotations: [],
        });
      }

      const entry = timestampMap.get(timestamp);
      entry[`${point.volumeId}_size`] = point.totalSize;
      entry[`${point.volumeId}_growthRate`] = point.growthRate || 0;

      if (point.isAnomaly && showAnomalies) {
        entry._annotations.push({
          volumeId: point.volumeId,
          type: 'anomaly',
          value: point.totalSize,
        });
      }
    });

    return Array.from(timestampMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [filteredData, showAnomalies]);

  // Extract unique volumes with metadata
  const volumes: VolumeInfo[] = useMemo(() => {
    const volumeMap = new Map<string, VolumeInfo>();

    filteredData.forEach((point, index) => {
      if (!volumeMap.has(point.volumeId)) {
        volumeMap.set(point.volumeId, {
          id: point.volumeId,
          name: point.volumeName,
          color: VOLUME_COLORS[volumeMap.size % VOLUME_COLORS.length],
          visible: volumeVisibility[point.volumeId] !== false,
          totalGrowth: 0,
          averageGrowthRate: 0,
        });
      }
    });

    // Calculate growth statistics
    volumeMap.forEach((volumeInfo, volumeId) => {
      const volumeData = filteredData.filter((p) => p.volumeId === volumeId);
      if (volumeData.length < 2) return;

      const firstPoint = volumeData[0];
      const lastPoint = volumeData[volumeData.length - 1];
      const totalGrowth = lastPoint.totalSize - firstPoint.totalSize;
      const growthRates = volumeData
        .map((p) => p.growthRate || 0)
        .filter((r) => r !== 0);
      const averageGrowthRate =
        growthRates.length > 0
          ? growthRates.reduce((sum, rate) => sum + rate, 0) /
            growthRates.length
          : 0;

      volumeInfo.totalGrowth = totalGrowth;
      volumeInfo.averageGrowthRate = averageGrowthRate;
    });

    return Array.from(volumeMap.values());
  }, [filteredData, volumeVisibility]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((newRange: string) => {
    setActiveTimeRange(newRange);
  }, []);

  // Handle volume visibility toggle
  const handleVolumeVisibilityToggle = useCallback(
    (volumeId: string) => {
      setVolumeVisibility((prev) => ({
        ...prev,
        [volumeId]: !(prev[volumeId] !== false),
      }));

      const newSelection = volumes
        .filter((v) => (v.id === volumeId ? !v.visible : v.visible))
        .map((v) => v.id);
      onVolumeSelectionChange?.(newSelection);
    },
    [volumes, onVolumeSelectionChange],
  );

  // Handle brush selection
  const handleBrushChange = useCallback(
    (brushData: any) => {
      if (!brushData || !onTimeRangeChange) return;

      const { startIndex, endIndex } = brushData;
      if (
        startIndex !== undefined &&
        endIndex !== undefined &&
        chartData.length > 0
      ) {
        const startDate = chartData[startIndex].date;
        const endDate = chartData[endIndex].date;
        onTimeRangeChange(startDate, endDate);
        setBrushSelection({ startIndex, endIndex });
      }
    },
    [chartData, onTimeRangeChange],
  );

  // Custom tooltip
  const renderTooltip = useCallback(
    (props: any) => {
      if (!props.active || !props.payload || !props.label) return null;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {formatDate(props.label)}
          </p>
          {props.payload.map((entry: any, index: number) => {
            const volumeId = entry.dataKey.replace('_size', '');
            const volume = volumes.find((v) => v.id === volumeId);
            if (!volume || !volume.visible) return null;

            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600 dark:text-gray-300">
                  {volume.name}: {formatBytes(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    },
    [volumes],
  );

  // Render volume legend with controls
  const renderVolumeLegend = () => (
    <div className="flex flex-wrap gap-3 mb-4">
      {volumes.map((volume) => (
        <div key={volume.id} className="flex items-center gap-2">
          <button
            onClick={() => handleVolumeVisibilityToggle(volume.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
              volume.visible
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
            )}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: volume.visible ? volume.color : '#9CA3AF',
              }}
            />
            <span className="font-medium truncate max-w-[120px]">
              {volume.name}
            </span>
            {volume.visible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>

          {/* Growth indicator */}
          {showGrowthRate && volume.visible && (
            <div className="flex items-center gap-1 text-xs">
              {volume.averageGrowthRate > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : volume.averageGrowthRate < 0 ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : (
                <div className="w-3 h-3 bg-gray-400 rounded-full" />
              )}
              <span className="text-gray-600 dark:text-gray-400">
                {formatBytes(Math.abs(volume.totalGrowth))}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (!chartData.length) {
    return (
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6',
          className,
        )}
      >
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No historical data available
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Volume scan data will appear here once scans are performed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6',
        className,
      )}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Volume Growth Timeline
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Historical size trends across {volumes.length} volumes
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-2">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleTimeRangeChange(option.value)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeTimeRange === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume legend */}
      {renderVolumeLegend()}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => formatDate(value, 'short')}
            className="text-xs"
          />
          <YAxis tickFormatter={formatBytes} className="text-xs" />
          <Tooltip content={renderTooltip} />

          {/* Render lines for each visible volume */}
          {volumes
            .filter((volume) => volume.visible)
            .map((volume) => (
              <React.Fragment key={volume.id}>
                {showArea && (
                  <Area
                    type="monotone"
                    dataKey={`${volume.id}_size`}
                    fill={volume.color}
                    fillOpacity={0.1}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={`${volume.id}_size`}
                  stroke={volume.color}
                  strokeWidth={2}
                  dot={showDataPoints}
                  connectNulls={false}
                />
              </React.Fragment>
            ))}

          {/* Brushing for time selection */}
          {enableBrushing && (
            <Brush
              dataKey="timestamp"
              height={30}
              stroke="#8884d8"
              onChange={handleBrushChange}
            />
          )}

          {/* Anomaly markers */}
          {showAnomalies &&
            chartData.map((point, index) =>
              point._annotations?.map(
                (annotation: any, annotationIndex: number) => (
                  <ReferenceDot
                    key={`${index}-${annotationIndex}`}
                    x={point.timestamp}
                    y={annotation.value}
                    r={4}
                    fill="#F59E0B"
                    stroke="#F59E0B"
                    strokeWidth={2}
                  />
                ),
              ),
            )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Chart controls */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          {showAnomalies && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span>Anomalies detected</span>
            </div>
          )}
          {enableBrushing && (
            <div className="flex items-center gap-1">
              <ZoomIn className="w-4 h-4" />
              <span>Drag to zoom</span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Showing {chartData.length} data points
        </div>
      </div>
    </div>
  );
};

export default VolumeGrowthTimeline;
