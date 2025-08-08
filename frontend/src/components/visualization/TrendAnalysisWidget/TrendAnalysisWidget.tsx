import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
  Calendar,
  Target,
  Download,
  ArrowUp,
  ArrowDown,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type {
  TrendAnalysisWidgetProps,
  TrendAnalysisData,
  TrendIndicator,
} from './TrendAnalysisWidget.types';
import { TREND_INDICATORS } from './TrendAnalysisWidget.types';
import { formatBytes, formatPercentage } from '../../../utils/formatters';

/**
 * TrendAnalysisWidget component for displaying volume growth trends and insights.
 *
 * Features:
 * - Growth rate calculations with visual indicators
 * - Trend pattern detection (linear, exponential, cyclical)
 * - Anomaly detection and highlighting
 * - Growth projections (30d, 90d)
 * - Sortable volume list with detailed metrics
 */
export const TrendAnalysisWidget: React.FC<TrendAnalysisWidgetProps> = ({
  data = [],
  maxVolumes = 10,
  sortBy = 'growthRate',
  sortDirection = 'desc',
  showProjections = true,
  showAnomalies = true,
  showConfidence = false,
  analysisPeriod = '30d',
  onVolumeSelect,
  onExport,
  className,
}) => {
  const [activeSortBy, setActiveSortBy] = useState(sortBy);
  const [activeSortDirection, setActiveSortDirection] = useState(sortDirection);

  // Sort and filter data
  const sortedData = useMemo(() => {
    const filtered = data.slice(0, maxVolumes);

    return filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (activeSortBy) {
        case 'name':
          aValue = a.volumeName.toLowerCase();
          bValue = b.volumeName.toLowerCase();
          break;
        case 'currentSize':
          aValue = a.currentSize;
          bValue = b.currentSize;
          break;
        case 'growthPercentage':
          aValue = a.growthPercentage;
          bValue = b.growthPercentage;
          break;
        case 'anomalyScore':
          aValue = a.anomalyScore;
          bValue = b.anomalyScore;
          break;
        default: // growthRate
          aValue = a.growthRate;
          bValue = b.growthRate;
      }

      if (typeof aValue === 'string') {
        return activeSortDirection === 'asc'
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      }

      return activeSortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [data, maxVolumes, activeSortBy, activeSortDirection]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!data.length) return null;

    const totalGrowth = data.reduce((sum, item) => sum + item.growthRate, 0);
    const averageGrowth = totalGrowth / data.length;
    const growingVolumes = data.filter(
      (item) => item.trend === 'increasing',
    ).length;
    const shrinkingVolumes = data.filter(
      (item) => item.trend === 'decreasing',
    ).length;
    const anomalousVolumes = data.filter(
      (item) => item.anomalyScore > 0.7,
    ).length;

    return {
      totalVolumes: data.length,
      averageGrowth,
      growingVolumes,
      shrinkingVolumes,
      stableVolumes: data.length - growingVolumes - shrinkingVolumes,
      anomalousVolumes,
    };
  }, [data]);

  // Handle sort change
  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (newSortBy === activeSortBy) {
      setActiveSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setActiveSortBy(newSortBy);
      setActiveSortDirection('desc');
    }
  };

  // Get trend indicator
  const getTrendIndicator = (trend: string): TrendIndicator => {
    return TREND_INDICATORS[trend] || TREND_INDICATORS.stable;
  };

  // Render trend icon
  const renderTrendIcon = (trend: string, size = 'w-4 h-4') => {
    const indicator = getTrendIndicator(trend);
    const iconProps = { className: `${size} text-current` };

    switch (indicator.icon) {
      case 'trending-up':
        return <TrendingUp {...iconProps} />;
      case 'trending-down':
        return <TrendingDown {...iconProps} />;
      case 'trending-up-down':
        return <BarChart3 {...iconProps} />;
      default:
        return <Minus {...iconProps} />;
    }
  };

  // Render sort header
  const renderSortHeader = (label: string, sortKey: typeof sortBy) => (
    <button
      onClick={() => handleSortChange(sortKey)}
      className="flex items-center gap-1 text-left text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      {label}
      {activeSortBy === sortKey &&
        (activeSortDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        ))}
    </button>
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
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No trend data available
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Historical scan data is needed to analyze growth trends
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Growth Trend Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {analysisPeriod} analysis across {data.length} volumes
            </p>
          </div>

          {onExport && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExport('csv')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        {summaryStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summaryStats.growingVolumes}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Growing
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {summaryStats.shrinkingVolumes}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Shrinking
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {summaryStats.stableVolumes}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Stable
              </div>
            </div>
            {showAnomalies && (
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {summaryStats.anomalousVolumes}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Anomalies
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Volume List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                {renderSortHeader('Volume', 'name')}
              </th>
              <th className="px-6 py-3 text-left">Trend</th>
              <th className="px-6 py-3 text-right">
                {renderSortHeader('Current Size', 'currentSize')}
              </th>
              <th className="px-6 py-3 text-right">
                {renderSortHeader('Growth Rate', 'growthRate')}
              </th>
              <th className="px-6 py-3 text-right">
                {renderSortHeader('Growth %', 'growthPercentage')}
              </th>
              {showProjections && (
                <th className="px-6 py-3 text-right">30d Projection</th>
              )}
              {showAnomalies && (
                <th className="px-6 py-3 text-center">
                  {renderSortHeader('Anomaly', 'anomalyScore')}
                </th>
              )}
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((volume) => {
              const indicator = getTrendIndicator(volume.trend);

              return (
                <tr
                  key={volume.volumeId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Volume Name */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                        {volume.volumeName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {volume.lastUpdated.toLocaleDateString()}
                      </div>
                    </div>
                  </td>

                  {/* Trend Indicator */}
                  <td className="px-6 py-4">
                    <div
                      className="flex items-center gap-2"
                      style={{ color: indicator.color }}
                    >
                      {renderTrendIcon(volume.trend)}
                      <span className="text-sm font-medium">
                        {indicator.label}
                      </span>
                      {showConfidence && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({Math.round(volume.confidence * 100)}%)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Current Size */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono text-sm">
                      {formatBytes(volume.currentSize)}
                    </div>
                  </td>

                  {/* Growth Rate */}
                  <td className="px-6 py-4 text-right">
                    <div
                      className={clsx(
                        'font-mono text-sm',
                        volume.growthRate > 0
                          ? 'text-green-600'
                          : volume.growthRate < 0
                            ? 'text-red-600'
                            : 'text-gray-600',
                      )}
                    >
                      {volume.growthRate > 0 ? '+' : ''}
                      {formatBytes(volume.growthRate)}/day
                    </div>
                  </td>

                  {/* Growth Percentage */}
                  <td className="px-6 py-4 text-right">
                    <div
                      className={clsx(
                        'font-mono text-sm',
                        volume.growthPercentage > 0
                          ? 'text-green-600'
                          : volume.growthPercentage < 0
                            ? 'text-red-600'
                            : 'text-gray-600',
                      )}
                    >
                      {volume.growthPercentage > 0 ? '+' : ''}
                      {formatPercentage(volume.growthPercentage)}
                    </div>
                  </td>

                  {/* 30d Projection */}
                  {showProjections && (
                    <td className="px-6 py-4 text-right">
                      <div className="font-mono text-sm text-blue-600">
                        {formatBytes(volume.projectedSize30d)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {volume.projectedSize30d > volume.currentSize
                          ? '+'
                          : ''}
                        {formatBytes(
                          volume.projectedSize30d - volume.currentSize,
                        )}
                      </div>
                    </td>
                  )}

                  {/* Anomaly Score */}
                  {showAnomalies && (
                    <td className="px-6 py-4 text-center">
                      {volume.anomalyScore > 0.7 ? (
                        <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                      ) : volume.anomalyScore > 0.3 ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mx-auto" />
                      ) : (
                        <div className="w-2 h-2 bg-green-500 rounded-full mx-auto" />
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {onVolumeSelect && (
                      <button
                        onClick={() => onVolumeSelect(volume.volumeId)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div>
            Showing {sortedData.length} of {data.length} volumes
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Analysis period: {analysisPeriod}
            </div>
            {summaryStats && (
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Avg growth: {formatBytes(summaryStats.averageGrowth)}/day
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendAnalysisWidget;
