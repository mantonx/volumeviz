/**
 * Age Timeline Chart Component
 *
 * Area chart showing file modification activity over time
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TimelineDataPoint, TimeRange } from './FileAgeAnalysis.types';
import { formatFileSize } from './fileAgeUtils';

interface AgeTimelineChartProps {
  timelineData: TimelineDataPoint[];
  timeRange: TimeRange;
  isDarkMode?: boolean;
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {label}
      </p>
      <div className="space-y-1 text-sm">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">
              {entry.name}:
            </span>
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name === 'Modifications'
                ? entry.value.toLocaleString()
                : formatFileSize(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AgeTimelineChart: React.FC<AgeTimelineChartProps> = ({
  timelineData,
  timeRange,
  isDarkMode = false,
  height = 250,
}) => {
  const chartData = useMemo(() => {
    return timelineData.map((point) => ({
      date: point.label,
      modifications: point.count,
      size: point.size,
    }));
  }, [timelineData]);

  const formatXAxisTick = (value: string) => {
    // For larger time ranges, reduce tick density
    return value;
  };

  // Reduce tick count for longer time ranges
  const tickCount = timeRange <= 30 ? 7 : timeRange <= 90 ? 10 : 12;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorModifications" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDarkMode ? '#374151' : '#e5e7eb'}
        />
        <XAxis
          dataKey="date"
          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={60}
          tickFormatter={formatXAxisTick}
          interval={Math.floor(chartData.length / tickCount)}
        />
        <YAxis
          yAxisId="left"
          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
          fontSize={11}
          label={{
            value: 'File Count',
            angle: -90,
            position: 'insideLeft',
            style: { fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 11 },
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
          fontSize={11}
          tickFormatter={(value) => {
            // Short format for axis
            const gb = value / (1024 ** 3);
            if (gb >= 1) return `${gb.toFixed(0)}GB`;
            const mb = value / (1024 ** 2);
            if (mb >= 1) return `${mb.toFixed(0)}MB`;
            return `${(value / 1024).toFixed(0)}KB`;
          }}
          label={{
            value: 'Size',
            angle: 90,
            position: 'insideRight',
            style: { fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 11 },
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="modifications"
          stroke="#3B82F6"
          fillOpacity={1}
          fill="url(#colorModifications)"
          name="Modifications"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="size"
          stroke="#10B981"
          fillOpacity={1}
          fill="url(#colorSize)"
          name="Total Size"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
