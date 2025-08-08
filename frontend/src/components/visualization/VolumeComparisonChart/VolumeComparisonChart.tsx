import React, { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Eye,
  EyeOff,
  Settings,
  Download,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  VolumeComparisonChartProps,
  VolumeComparisonData,
  ComparisonMetric,
  ComparisonStatistics,
  ChartConfiguration,
} from './VolumeComparisonChart.types';
import { COMPARISON_METRICS } from './VolumeComparisonChart.types';
import { formatBytes, formatDate, formatPercentage } from '../../../utils/formatters';

/**
 * VolumeComparisonChart component for side-by-side historical analysis of multiple volumes.
 * 
 * Features:
 * - Multiple chart types (line, area, bar, normalized)
 * - Metric switching (size, growth rate, file count)
 * - Volume visibility toggling with statistics
 * - Baseline comparison and normalization
 * - Interactive timeline with brushing and zooming
 */
export const VolumeComparisonChart: React.FC<VolumeComparisonChartProps> = ({
  data = [],
  chartType = 'line',
  timeRange = '1m',
  normalize = false,
  showBaseline = false,
  metric = 'size',
  interactive = true,
  height = 400,
  showLegend = true,
  showDataPoints = false,
  maxVolumes = 5,
  onVolumeToggle,
  onTimeRangeChange,
  onMetricChange,
  className,
}) => {
  const [activeChartType, setActiveChartType] = useState(chartType);
  const [activeMetric, setActiveMetric] = useState(metric);
  const [volumeVisibility, setVolumeVisibility] = useState<Record<string, boolean>>({});
  const [chartConfig, setChartConfig] = useState<ChartConfiguration>({
    showGrid: true,
    showTooltip: true,
    showBrush: interactive,
    enableZoom: interactive,
    syncTooltips: true,
    smoothLines: true,
  });

  // Filter data to max volumes and add visibility state
  const filteredData = useMemo(() => {
    return data.slice(0, maxVolumes).map(volume => ({
      ...volume,
      visible: volumeVisibility[volume.volumeId] !== false,
    }));
  }, [data, maxVolumes, volumeVisibility]);

  // Process data for chart display
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];

    // Create timestamp map
    const timestampMap = new Map<string, any>();

    filteredData.forEach(volume => {
      if (!volume.visible) return;

      volume.historicalData.forEach(point => {
        const timestamp = point.timestamp;
        
        if (!timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, {
            timestamp,
            date: point.date,
          });
        }

        const entry = timestampMap.get(timestamp);
        
        // Add data based on selected metric
        switch (activeMetric) {
          case 'size':
            entry[`${volume.volumeId}_value`] = point.size;
            break;
          case 'growth':
            entry[`${volume.volumeId}_value`] = point.size - (volume.startSize || point.size);
            break;
          case 'rate':
            entry[`${volume.volumeId}_value`] = point.growthRate || 0;
            break;
          case 'files':
            entry[`${volume.volumeId}_value`] = point.fileCount;
            break;
        }
      });
    });

    const sortedData = Array.from(timestampMap.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Normalize data if requested
    if (normalize && sortedData.length > 0) {
      const firstEntry = sortedData[0];
      
      return sortedData.map(entry => {
        const normalizedEntry = { ...entry };
        
        filteredData.forEach(volume => {
          if (!volume.visible) return;
          
          const currentKey = `${volume.volumeId}_value`;
          const currentValue = entry[currentKey];
          const baseValue = firstEntry[currentKey];
          
          if (baseValue && baseValue !== 0) {
            normalizedEntry[currentKey] = ((currentValue - baseValue) / baseValue) * 100;
          }
        });
        
        return normalizedEntry;
      });
    }

    return sortedData;
  }, [filteredData, activeMetric, normalize]);

  // Calculate comparison statistics
  const comparisonStats: ComparisonStatistics[] = useMemo(() => {
    return filteredData
      .filter(volume => volume.visible)
      .map(volume => {
        const metricConfig = COMPARISON_METRICS[activeMetric];
        let currentValue = volume.currentSize;
        let startValue = volume.startSize;

        switch (activeMetric) {
          case 'growth':
            currentValue = volume.totalGrowth;
            startValue = 0;
            break;
          case 'rate':
            currentValue = volume.averageGrowthRate;
            startValue = 0;
            break;
          case 'files':
            const latestData = volume.historicalData[volume.historicalData.length - 1];
            const earliestData = volume.historicalData[0];
            currentValue = latestData?.fileCount || 0;
            startValue = earliestData?.fileCount || 0;
            break;
        }

        const changeAbsolute = currentValue - startValue;
        const changePercentage = startValue !== 0 ? (changeAbsolute / startValue) * 100 : 0;

        return {
          volumeId: volume.volumeId,
          volumeName: volume.volumeName,
          currentValue,
          startValue,
          changeAbsolute,
          changePercentage,
          rank: 0, // Will be set after sorting
          trend: changeAbsolute > 0 ? 'up' : changeAbsolute < 0 ? 'down' : 'stable',
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((stat, index) => ({ ...stat, rank: index + 1 }));
  }, [filteredData, activeMetric]);

  // Handle volume visibility toggle
  const handleVolumeToggle = useCallback((volumeId: string) => {
    setVolumeVisibility(prev => {
      const newVisibility = { ...prev, [volumeId]: !(prev[volumeId] !== false) };
      onVolumeToggle?.(volumeId, newVisibility[volumeId]);
      return newVisibility;
    });
  }, [onVolumeToggle]);

  // Handle metric change
  const handleMetricChange = useCallback((newMetric: string) => {
    setActiveMetric(newMetric);
    onMetricChange?.(newMetric);
  }, [onMetricChange]);

  // Render chart based on type
  const renderChart = () => {
    const visibleVolumes = filteredData.filter(v => v.visible);
    const metricConfig = COMPARISON_METRICS[activeMetric];

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-30" />}
          
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(value) => formatDate(value, 'short')}
            className="text-xs"
          />
          <YAxis 
            tickFormatter={(value) => 
              normalize ? `${value.toFixed(1)}%` : metricConfig.formatter(value)
            }
            className="text-xs"
          />

          {chartConfig.showTooltip && (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !label) return null;

                return (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      {formatDate(label)}
                    </p>
                    {payload.map((entry: any, index: number) => {
                      const volumeId = entry.dataKey.replace('_value', '');
                      const volume = visibleVolumes.find(v => v.volumeId === volumeId);
                      if (!volume) return null;

                      return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-gray-600 dark:text-gray-300">
                            {volume.volumeName}: {
                              normalize ? `${entry.value.toFixed(1)}%` : metricConfig.formatter(entry.value)
                            }
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          )}

          {showLegend && <Legend />}

          {/* Baseline reference line */}
          {showBaseline && normalize && (
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
          )}

          {/* Render chart elements based on type */}
          {visibleVolumes.map(volume => {
            const dataKey = `${volume.volumeId}_value`;
            
            switch (activeChartType) {
              case 'area':
                return (
                  <Area
                    key={volume.volumeId}
                    type={chartConfig.smoothLines ? 'monotone' : 'linear'}
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
                    key={volume.volumeId}
                    dataKey={dataKey}
                    fill={volume.color}
                  />
                );
              default: // line
                return (
                  <Line
                    key={volume.volumeId}
                    type={chartConfig.smoothLines ? 'monotone' : 'linear'}
                    dataKey={dataKey}
                    stroke={volume.color}
                    strokeWidth={2}
                    dot={showDataPoints}
                    connectNulls={false}
                  />
                );
            }
          })}

          {/* Brush for time selection */}
          {chartConfig.showBrush && (
            <Brush
              dataKey="timestamp"
              height={30}
              stroke="#8884d8"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  if (!data.length) {
    return (
      <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6', className)}>
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No comparison data available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Select multiple volumes to compare their historical trends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* Header with controls */}
      <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Volume Comparison
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Side-by-side analysis of {filteredData.filter(v => v.visible).length} volumes
            </p>
          </div>

          {/* Export and settings */}
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <Download className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Control bar */}
        <div className="flex items-center justify-between">
          {/* Metric selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Metric:</span>
            <select
              value={activeMetric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.entries(COMPARISON_METRICS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart type selector */}
          <div className="flex items-center gap-1">
            {['line', 'area', 'bar'].map(type => (
              <button
                key={type}
                onClick={() => setActiveChartType(type)}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                  activeChartType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setActiveChartType(e.target.checked ? 'normalized' : 'line')}
                className="rounded"
              />
              Normalize
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showBaseline}
                onChange={(e) => setChartConfig(prev => ({ ...prev, showBaseline: e.target.checked }))}
                className="rounded"
              />
              Baseline
            </label>
          </div>
        </div>
      </div>

      {/* Volume controls */}
      <div className="p-6 pb-4">
        <div className="flex flex-wrap gap-3">
          {filteredData.map(volume => (
            <button
              key={volume.volumeId}
              onClick={() => handleVolumeToggle(volume.volumeId)}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                volume.visible
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              )}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: volume.visible ? volume.color : '#9CA3AF' }}
              />
              <span className="font-medium truncate max-w-[120px]">
                {volume.volumeName}
              </span>
              {volume.visible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-6">
        {renderChart()}
      </div>

      {/* Statistics table */}
      {comparisonStats.length > 0 && (
        <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Comparison Statistics
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Volume</th>
                  <th className="pb-2">Current</th>
                  <th className="pb-2">Change</th>
                  <th className="pb-2">% Change</th>
                  <th className="pb-2">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {comparisonStats.map(stat => {
                  const metricConfig = COMPARISON_METRICS[activeMetric];
                  
                  return (
                    <tr key={stat.volumeId} className="text-gray-900 dark:text-white">
                      <td className="py-2 font-mono">#{stat.rank}</td>
                      <td className="py-2 font-medium">{stat.volumeName}</td>
                      <td className="py-2 font-mono">{metricConfig.formatter(stat.currentValue)}</td>
                      <td className={clsx(
                        'py-2 font-mono',
                        stat.changeAbsolute > 0 ? 'text-green-600' :
                        stat.changeAbsolute < 0 ? 'text-red-600' : 'text-gray-600'
                      )}>
                        {stat.changeAbsolute > 0 ? '+' : ''}{metricConfig.formatter(stat.changeAbsolute)}
                      </td>
                      <td className={clsx(
                        'py-2 font-mono',
                        stat.changePercentage > 0 ? 'text-green-600' :
                        stat.changePercentage < 0 ? 'text-red-600' : 'text-gray-600'
                      )}>
                        {stat.changePercentage > 0 ? '+' : ''}{formatPercentage(stat.changePercentage)}
                      </td>
                      <td className="py-2">
                        <TrendingUp className={clsx(
                          'w-4 h-4',
                          stat.trend === 'up' ? 'text-green-500' :
                          stat.trend === 'down' ? 'text-red-500 rotate-180' : 'text-gray-400'
                        )} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeComparisonChart;