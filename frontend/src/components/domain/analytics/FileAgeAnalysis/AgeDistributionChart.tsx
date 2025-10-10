/**
 * Age Distribution Chart Component
 *
 * Bar chart showing file count distribution across age buckets
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { AgeBucket } from './FileAgeAnalysis.types';
import { formatPercentage } from './fileAgeUtils';

interface AgeDistributionChartProps {
  buckets: AgeBucket[];
  isDarkMode?: boolean;
  onBucketClick?: (bucket: AgeBucket) => void;
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: AgeBucket;
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const bucket = payload[0].payload;

  return (
    <div className="bg-surface border border-line rounded-lg shadow-lg p-3 max-w-xs">
      <div className="mb-2">
        <p className="font-semibold text-primary">
          {bucket.label}
        </p>
        <p className="text-xs text-tertiary">
          {bucket.description}
        </p>
      </div>
      <div className="space-y-1 text-sm border-t border-line pt-2">
        <div className="flex justify-between gap-4">
          <span className="text-secondary">Files:</span>
          <span className="font-medium text-primary">
            {bucket.fileCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-secondary">Percentage:</span>
          <span className="font-medium text-primary">
            {formatPercentage(bucket.percentage)}
          </span>
        </div>
      </div>
      <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">
        Click to filter files
      </p>
    </div>
  );
};

export const AgeDistributionChart: React.FC<AgeDistributionChartProps> = ({
  buckets,
  isDarkMode = false,
  onBucketClick,
  height = 300,
}) => {
  const chartData = useMemo(() => {
    return buckets.map((bucket) => ({
      ...bucket,
      name: bucket.label,
      value: bucket.fileCount,
    }));
  }, [buckets]);

  const handleBarClick = (data: any) => {
    const bucket = buckets.find((b) => b.label === data.name);
    if (bucket && onBucketClick) {
      onBucketClick(bucket);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDarkMode ? '#374151' : '#e5e7eb'}
        />
        <XAxis
          dataKey="name"
          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
          fontSize={12}
          label={{
            value: 'File Count',
            angle: -90,
            position: 'insideLeft',
            style: { fill: isDarkMode ? '#9CA3AF' : '#6B7280' },
          }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }} />
        <Bar
          dataKey="value"
          onClick={handleBarClick}
          style={{ cursor: 'pointer' }}
          radius={[4, 4, 0, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={isDarkMode ? entry.darkColor : entry.color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
