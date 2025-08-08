import React, { useMemo, useCallback } from 'react';
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
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import type {
  SizeComparisonChartProps,
  SizeComparisonData,
  ChartMargins,
} from './SizeComparisonChart.types';
import { COMPARISON_COLORS } from './SizeComparisonChart.types';
import { formatBytes } from '../../../utils/formatters';

/**
 * SizeComparisonChart component for comparing volume sizes with change indicators.
 *
 * Features:
 * - Side-by-side comparison of current vs previous volume sizes
 * - Visual change indicators (increased, decreased, unchanged)
 * - Multiple chart orientations (horizontal, vertical, grouped)
 * - Sorting and filtering capabilities
 * - Interactive tooltips with detailed change information
 * - Performance optimized with memoization
 *
 * @example
 * ```tsx
 * <SizeComparisonChart
 *   volumes={currentVolumes}
 *   previousData={previousVolumes}
 *   variant="horizontal"
 *   showChange={true}
 *   onVolumeClick={(id) => navigate(`/volumes/${id}`)}
 * />
 * ```
 */
export const SizeComparisonChart: React.FC<SizeComparisonChartProps> = ({
  volumes,
  previousData = [],
  variant = 'horizontal',
  sortBy = 'size',
  sortOrder = 'desc',
  showChange = true,
  showPercentage = true,
  maxItems = 10,
  height = 400,
  onVolumeClick,
  className,
}) => {
  // Transform data for comparison chart
  const comparisonData = useMemo<SizeComparisonData[]>(() => {
    if (!volumes?.length) return [];

    const previousMap = new Map(
      previousData.map((vol) => [vol.id, vol.size || 0]),
    );

    return volumes
      .map((volume) => {
        const currentSize = volume.size || 0;
        const previousSize = previousMap.get(volume.id) || currentSize;
        const change = currentSize - previousSize;
        const changePercent =
          previousSize > 0 ? (change / previousSize) * 100 : 0;

        let status: 'increased' | 'decreased' | 'unchanged';
        let color: string;

        if (Math.abs(change) < currentSize * 0.01) {
          // Less than 1% change
          status = 'unchanged';
          color = COMPARISON_COLORS.unchanged;
        } else if (change > 0) {
          status = 'increased';
          color = COMPARISON_COLORS.increased;
        } else {
          status = 'decreased';
          color = COMPARISON_COLORS.decreased;
        }

        return {
          id: volume.id,
          name: volume.name,
          currentSize,
          previousSize: previousData.length > 0 ? previousSize : undefined,
          change,
          changePercent,
          driver: volume.driver,
          color,
          status,
        };
      })
      .filter((item) => item.currentSize > 0)
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return sortOrder === 'asc'
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          case 'change':
            return sortOrder === 'asc'
              ? a.change - b.change
              : b.change - a.change;
          case 'size':
          default:
            return sortOrder === 'asc'
              ? a.currentSize - b.currentSize
              : b.currentSize - a.currentSize;
        }
      })
      .slice(0, maxItems);
  }, [volumes, previousData, sortBy, sortOrder, maxItems]);

  // Chart click handler
  const handleBarClick = useCallback(
    (data: any) => {
      if (onVolumeClick && data?.id) {
        onVolumeClick(data.id);
      }
    },
    [onVolumeClick],
  );

  // Custom tooltip component
  const CustomTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.[0]) return null;

      const data = payload[0].payload as SizeComparisonData;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {data.name}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Current Size:
              </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatBytes(data.currentSize)}
              </span>
            </div>

            {data.previousSize !== undefined && showChange && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Previous Size:
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {formatBytes(data.previousSize)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    Change:
                  </span>
                  <div className="flex items-center gap-1">
                    {data.status === 'increased' && (
                      <TrendingUp className="w-3 h-3 text-red-500" />
                    )}
                    {data.status === 'decreased' && (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    )}
                    {data.status === 'unchanged' && (
                      <Minus className="w-3 h-3 text-gray-500" />
                    )}
                    <span
                      className={clsx(
                        'font-mono text-sm',
                        data.status === 'increased' && 'text-red-600',
                        data.status === 'decreased' && 'text-green-600',
                        data.status === 'unchanged' && 'text-gray-600',
                      )}
                    >
                      {data.change > 0 ? '+' : ''}
                      {formatBytes(data.change)}
                    </span>
                  </div>
                </div>

                {showPercentage && Math.abs(data.changePercent) > 0.1 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Percentage:
                    </span>
                    <span
                      className={clsx(
                        'font-mono',
                        data.status === 'increased' && 'text-red-600',
                        data.status === 'decreased' && 'text-green-600',
                        data.status === 'unchanged' && 'text-gray-600',
                      )}
                    >
                      {data.changePercent > 0 ? '+' : ''}
                      {data.changePercent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Driver:</span>
              <span className="text-gray-900 dark:text-white">
                {data.driver}
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
    [showChange, showPercentage, onVolumeClick],
  );

  // Chart margins based on variant
  const margins: ChartMargins = useMemo(() => {
    if (variant === 'horizontal') {
      return { top: 20, right: 30, bottom: 5, left: 100 };
    }
    return { top: 20, right: 30, bottom: 60, left: 20 };
  }, [variant]);

  if (!comparisonData.length) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
          className,
        )}
        style={{ height }}
      >
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No comparison data available
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-center">
          Volume size comparison will appear here once data is available
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
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Volume Size Comparison
          </h3>
        </div>

        <div className="flex items-center gap-4">
          {showChange && previousData.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-red-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Increased
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-green-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Decreased
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="w-3 h-3 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Unchanged
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: height - 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={comparisonData}
            layout={variant === 'horizontal' ? 'horizontal' : 'vertical'}
            margin={margins}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />

            {variant === 'horizontal' ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatBytes}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={90}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={formatBytes} />
              </>
            )}

            <Tooltip content={<CustomTooltip />} />

            {variant === 'grouped' && showChange && previousData.length > 0 ? (
              <>
                <Bar
                  dataKey="previousSize"
                  name="Previous Size"
                  fill="#E5E7EB"
                  onClick={handleBarClick}
                  cursor={onVolumeClick ? 'pointer' : 'default'}
                />
                <Bar
                  dataKey="currentSize"
                  name="Current Size"
                  onClick={handleBarClick}
                  cursor={onVolumeClick ? 'pointer' : 'default'}
                >
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </>
            ) : (
              <Bar
                dataKey="currentSize"
                onClick={handleBarClick}
                cursor={onVolumeClick ? 'pointer' : 'default'}
              >
                {comparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {comparisonData.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Volumes Shown
            </div>
          </div>

          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatBytes(
                comparisonData.reduce((sum, vol) => sum + vol.currentSize, 0),
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Current Size
            </div>
          </div>

          {showChange && previousData.length > 0 && (
            <>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {
                    comparisonData.filter((vol) => vol.status === 'increased')
                      .length
                  }
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Increased
                </div>
              </div>

              <div>
                <div className="text-lg font-bold text-green-600">
                  {
                    comparisonData.filter((vol) => vol.status === 'decreased')
                      .length
                  }
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Decreased
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SizeComparisonChart;
