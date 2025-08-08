import React, { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
  BarChart3,
  Calendar,
  Gauge,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  GrowthRateChartProps,
  GrowthRateDataPoint,
  GrowthRateStats,
  RateThreshold,
  MovingAveragePoint,
} from './GrowthRateChart.types';
import { DEFAULT_RATE_THRESHOLDS } from './GrowthRateChart.types';
import {
  formatBytes,
  formatDate,
  formatPercentage,
} from '../../../utils/formatters';

// Color palette for volumes
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
 * GrowthRateChart component for visualizing volume growth rates over time.
 *
 * Features:
 * - Rate of change visualization (MB/day, GB/week, etc.)
 * - Moving averages and trend analysis
 * - Threshold-based color coding
 * - Multiple chart types (line, bar, area, combo)
 * - Growth rate statistics and projections
 */
export const GrowthRateChart: React.FC<GrowthRateChartProps> = ({
  data = [],
  mode = 'absolute',
  rateUnit = 'day',
  chartType = 'line',
  selectedVolumes = [],
  showMovingAverage = true,
  movingAveragePeriod = 7,
  showTrendLines = false,
  colorByRate = true,
  significanceThreshold = 10, // 10% change
  height = 400,
  showDataLabels = false,
  interactive = true,
  onTimeSelectionChange,
  onVolumeSelectionChange,
  onRateUnitChange,
  className,
}) => {
  const [activeMode, setActiveMode] = useState(mode);
  const [activeRateUnit, setActiveRateUnit] = useState(rateUnit);
  const [activeChartType, setActiveChartType] = useState(chartType);
  const [volumeVisibility, setVolumeVisibility] = useState<
    Record<string, boolean>
  >({});

  // Filter data based on selected volumes
  const filteredData = useMemo(() => {
    const volumesToShow =
      selectedVolumes.length > 0
        ? selectedVolumes
        : Array.from(new Set(data.map((d) => d.volumeId)));

    return data.filter((point) => {
      const shouldShow = volumesToShow.includes(point.volumeId);
      const isVisible = volumeVisibility[point.volumeId] !== false;
      return shouldShow && isVisible;
    });
  }, [data, selectedVolumes, volumeVisibility]);

  // Process data for chart display
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];

    // Group by timestamp
    const timestampMap = new Map<string, any>();

    filteredData.forEach((point) => {
      const timestamp = point.timestamp;

      if (!timestampMap.has(timestamp)) {
        timestampMap.set(timestamp, {
          timestamp,
          date: point.date,
        });
      }

      const entry = timestampMap.get(timestamp);

      // Convert rate to requested unit
      let rateValue = point.growthRate;
      switch (activeRateUnit) {
        case 'hour':
          rateValue = point.growthRate / 24; // Convert daily to hourly
          break;
        case 'week':
          rateValue = point.growthRate * 7; // Convert daily to weekly
          break;
        case 'month':
          rateValue = point.growthRate * 30; // Convert daily to monthly
          break;
        // 'day' is already the base unit
      }

      // Store both absolute and percentage values
      entry[`${point.volumeId}_rate`] = rateValue;
      entry[`${point.volumeId}_percentage`] = point.growthPercentage;
      entry[`${point.volumeId}_size`] = point.size;

      // Color coding based on rate
      if (colorByRate) {
        entry[`${point.volumeId}_color`] = getRateColor(rateValue);
      }
    });

    return Array.from(timestampMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [filteredData, activeRateUnit, colorByRate]);

  // Calculate moving averages
  const chartDataWithAverages = useMemo(() => {
    if (!showMovingAverage || chartData.length < movingAveragePeriod) {
      return chartData;
    }

    const volumeIds = Array.from(new Set(filteredData.map((d) => d.volumeId)));

    return chartData.map((entry, index) => {
      const avgEntry = { ...entry };

      volumeIds.forEach((volumeId) => {
        const rateKey = `${volumeId}_rate`;
        const avgKey = `${volumeId}_avg`;

        // Calculate moving average
        const startIndex = Math.max(0, index - movingAveragePeriod + 1);
        const values = chartData
          .slice(startIndex, index + 1)
          .map((d) => d[rateKey] || 0)
          .filter((v) => !isNaN(v));

        if (values.length > 0) {
          avgEntry[avgKey] =
            values.reduce((sum, val) => sum + val, 0) / values.length;
        }
      });

      return avgEntry;
    });
  }, [chartData, showMovingAverage, movingAveragePeriod, filteredData]);

  // Calculate statistics
  const rateStats: GrowthRateStats[] = useMemo(() => {
    const volumeIds = Array.from(new Set(filteredData.map((d) => d.volumeId)));

    return volumeIds
      .map((volumeId) => {
        const volumeData = filteredData.filter((d) => d.volumeId === volumeId);
        if (!volumeData.length) return null;

        const rates = volumeData.map((d) => d.growthRate);
        const averageRate =
          rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        const maxRate = Math.max(...rates);
        const minRate = Math.min(...rates);

        // Calculate volatility (standard deviation)
        const variance =
          rates.reduce(
            (sum, rate) => sum + Math.pow(rate - averageRate, 2),
            0,
          ) / rates.length;
        const volatility = Math.sqrt(variance);

        // Determine trend
        const recentData = volumeData.slice(-5); // Last 5 points
        const earlyAvg =
          recentData.slice(0, 2).reduce((sum, d) => sum + d.growthRate, 0) / 2;
        const lateAvg =
          recentData.slice(-2).reduce((sum, d) => sum + d.growthRate, 0) / 2;

        let trend: GrowthRateStats['trend'] = 'stable';
        if (lateAvg > earlyAvg * 1.2) trend = 'accelerating';
        else if (lateAvg < earlyAvg * 0.8) trend = 'decelerating';
        else if (volatility > averageRate * 0.5) trend = 'volatile';

        const currentRate = rates[rates.length - 1] || 0;

        return {
          volumeId,
          volumeName: volumeData[0].volumeName,
          averageGrowthRate: averageRate,
          maxGrowthRate: maxRate,
          minGrowthRate: minRate,
          volatility,
          trend,
          currentRate,
          projectedGrowth24h: currentRate,
          projectedGrowth7d: currentRate * 7,
          projectedGrowth30d: currentRate * 30,
        };
      })
      .filter(Boolean) as GrowthRateStats[];
  }, [filteredData]);

  // Get color for growth rate
  const getRateColor = (rate: number): string => {
    const thresholds = DEFAULT_RATE_THRESHOLDS.sort(
      (a, b) => b.value - a.value,
    );

    for (const threshold of thresholds) {
      if (Math.abs(rate) >= threshold.value) {
        return threshold.color;
      }
    }

    return rate > 0 ? '#10B981' : rate < 0 ? '#EF4444' : '#6B7280';
  };

  // Handle volume visibility toggle
  const handleVolumeToggle = useCallback((volumeId: string) => {
    setVolumeVisibility((prev) => ({
      ...prev,
      [volumeId]: !(prev[volumeId] !== false),
    }));
  }, []);

  // Handle rate unit change
  const handleRateUnitChange = useCallback(
    (newUnit: string) => {
      setActiveRateUnit(newUnit);
      onRateUnitChange?.(newUnit);
    },
    [onRateUnitChange],
  );

  // Get unique volumes for controls
  const uniqueVolumes = useMemo(() => {
    const volumeMap = new Map();
    filteredData.forEach((point, index) => {
      if (!volumeMap.has(point.volumeId)) {
        volumeMap.set(point.volumeId, {
          id: point.volumeId,
          name: point.volumeName,
          color: VOLUME_COLORS[volumeMap.size % VOLUME_COLORS.length],
          visible: volumeVisibility[point.volumeId] !== false,
        });
      }
    });
    return Array.from(volumeMap.values());
  }, [filteredData, volumeVisibility]);

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
            if (
              !entry.dataKey.includes('_rate') &&
              !entry.dataKey.includes('_percentage')
            )
              return null;

            const volumeId = entry.dataKey
              .replace('_rate', '')
              .replace('_percentage', '');
            const volume = uniqueVolumes.find((v) => v.id === volumeId);
            if (!volume || !volume.visible) return null;

            const isPercentage = entry.dataKey.includes('_percentage');
            const value = isPercentage
              ? formatPercentage(entry.value)
              : `${formatBytes(entry.value)}/${activeRateUnit}`;

            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600 dark:text-gray-300">
                  {volume.name}: {value}
                </span>
              </div>
            );
          })}
        </div>
      );
    },
    [uniqueVolumes, activeRateUnit],
  );

  if (!data.length) {
    return (
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6',
          className,
        )}
      >
        <div className="text-center py-8">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No growth rate data available
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Multiple scans are needed to calculate growth rates
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
        className,
      )}
    >
      {/* Header */}
      <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Growth Rate Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Rate of change visualization per {activeRateUnit}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Mode selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Mode:
            </span>
            <select
              value={activeMode}
              onChange={(e) => setActiveMode(e.target.value as any)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700"
            >
              <option value="absolute">Absolute Rate</option>
              <option value="percentage">Percentage Change</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Rate unit selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Per:
            </span>
            {['hour', 'day', 'week', 'month'].map((unit) => (
              <button
                key={unit}
                onClick={() => handleRateUnitChange(unit)}
                className={clsx(
                  'px-2 py-1 text-sm rounded-md transition-colors capitalize',
                  activeRateUnit === unit
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                )}
              >
                {unit}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="flex items-center gap-1">
            {['line', 'bar', 'area'].map((type) => (
              <button
                key={type}
                onClick={() => setActiveChartType(type)}
                className={clsx(
                  'px-2 py-1 text-sm rounded-md transition-colors capitalize',
                  activeChartType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Volume controls */}
      <div className="p-6 pb-4">
        <div className="flex flex-wrap gap-3">
          {uniqueVolumes.map((volume) => (
            <button
              key={volume.id}
              onClick={() => handleVolumeToggle(volume.id)}
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
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-6">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={chartDataWithAverages}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => formatDate(value, 'short')}
              className="text-xs"
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) =>
                `${formatBytes(value)}/${activeRateUnit}`
              }
              className="text-xs"
            />
            {activeMode === 'both' && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                className="text-xs"
              />
            )}

            <Tooltip content={renderTooltip} />
            <Legend />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />

            {/* Threshold lines */}
            {DEFAULT_RATE_THRESHOLDS.map((threshold) => (
              <ReferenceLine
                key={threshold.label}
                y={threshold.value}
                stroke={threshold.color}
                strokeDasharray="1 1"
                strokeOpacity={0.3}
              />
            ))}

            {/* Render chart elements for each volume */}
            {uniqueVolumes
              .filter((volume) => volume.visible)
              .map((volume) => {
                const dataKey =
                  activeMode === 'percentage'
                    ? `${volume.id}_percentage`
                    : `${volume.id}_rate`;
                const yAxisId =
                  activeMode === 'both' && dataKey.includes('percentage')
                    ? 'right'
                    : 'left';

                switch (activeChartType) {
                  case 'area':
                    return (
                      <Area
                        key={`${volume.id}_${dataKey}`}
                        yAxisId={yAxisId}
                        type="monotone"
                        dataKey={dataKey}
                        fill={volume.color}
                        fillOpacity={0.3}
                        stroke={volume.color}
                        strokeWidth={2}
                      />
                    );
                  case 'bar':
                    return (
                      <Bar
                        key={`${volume.id}_${dataKey}`}
                        yAxisId={yAxisId}
                        dataKey={dataKey}
                        fill={volume.color}
                      />
                    );
                  default: // line
                    return (
                      <React.Fragment key={volume.id}>
                        <Line
                          yAxisId={yAxisId}
                          type="monotone"
                          dataKey={dataKey}
                          stroke={volume.color}
                          strokeWidth={2}
                          dot={showDataLabels}
                          connectNulls={false}
                        />
                        {/* Moving average line */}
                        {showMovingAverage && (
                          <Line
                            yAxisId={yAxisId}
                            type="monotone"
                            dataKey={`${volume.id}_avg`}
                            stroke={volume.color}
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            connectNulls={false}
                          />
                        )}
                      </React.Fragment>
                    );
                }
              })}

            {/* Brush for time selection */}
            {interactive && (
              <Brush dataKey="timestamp" height={30} stroke="#8884d8" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Statistics */}
      {rateStats.length > 0 && (
        <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Growth Rate Statistics
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rateStats.map((stats) => (
              <div
                key={stats.volumeId}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900 dark:text-white truncate">
                    {stats.volumeName}
                  </h5>
                  <span
                    className={clsx(
                      'text-xs px-2 py-1 rounded-full',
                      stats.trend === 'accelerating'
                        ? 'bg-red-100 text-red-800'
                        : stats.trend === 'decelerating'
                          ? 'bg-blue-100 text-blue-800'
                          : stats.trend === 'volatile'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800',
                    )}
                  >
                    {stats.trend}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span className="font-mono">
                      {formatBytes(stats.currentRate)}/{activeRateUnit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average:</span>
                    <span className="font-mono">
                      {formatBytes(stats.averageGrowthRate)}/{activeRateUnit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>30d projection:</span>
                    <span className="font-mono text-blue-600">
                      {formatBytes(stats.projectedGrowth30d)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GrowthRateChart;
