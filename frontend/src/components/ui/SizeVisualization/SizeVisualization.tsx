/**
 * Size Visualization Component
 * Displays volume/mount sizes with progress bars and color coding
 */

import React from 'react';
import { cn, formatBytes } from '@/utils';

const getSizeColor = (percentage: number): string => {
  if (percentage < 30) return 'bg-green-500';
  if (percentage < 60) return 'bg-yellow-500';
  if (percentage < 80) return 'bg-orange-500';
  return 'bg-red-500';
};

const getSizeTextColor = (percentage: number): string => {
  if (percentage < 30) return 'text-green-600';
  if (percentage < 60) return 'text-yellow-600';
  if (percentage < 80) return 'text-orange-600';
  return 'text-red-600';
};

interface SizeVisualizationProps {
  sizeBytes: number;
  maxSizeBytes?: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  className?: string;
  compact?: boolean;
}

export const SizeVisualization: React.FC<SizeVisualizationProps> = ({
  sizeBytes,
  maxSizeBytes,
  showLabel = true,
  showPercentage = false,
  className,
  compact = false,
}) => {
  const percentage = maxSizeBytes ? (sizeBytes / maxSizeBytes) * 100 : 0;
  const hasComparison = maxSizeBytes && maxSizeBytes > 0;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span
          className={cn(
            'text-sm font-medium',
            hasComparison
              ? getSizeTextColor(percentage)
              : 'text-primary',
          )}
        >
          {formatBytes(sizeBytes)}
        </span>
        {hasComparison && showPercentage && (
          <span className="text-xs text-tertiary">
            ({percentage.toFixed(1)}%)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-sm font-medium',
              hasComparison
                ? getSizeTextColor(percentage)
                : 'text-primary',
            )}
          >
            {formatBytes(sizeBytes)}
          </span>
          {hasComparison && showPercentage && (
            <span className="text-xs text-tertiary">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {hasComparison && (
        <div className="relative">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                getSizeColor(percentage),
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {/* Threshold indicators */}
          <div className="absolute inset-0 flex">
            <div className="w-[30%] border-r border-gray-300 h-2" />
            <div className="w-[30%] border-r border-gray-300 h-2" />
            <div className="w-[20%] border-r border-gray-300 h-2" />
          </div>
        </div>
      )}
    </div>
  );
};

// Size comparison chart for multiple volumes
interface SizeComparisonProps {
  items: Array<{
    id: string;
    name: string;
    sizeBytes: number;
  }>;
  maxItems?: number;
  className?: string;
}

export const SizeComparison: React.FC<SizeComparisonProps> = ({
  items,
  maxItems = 5,
  className,
}) => {
  const sortedItems = [...items]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, maxItems);

  const maxSize = sortedItems[0]?.sizeBytes || 1;

  return (
    <div className={cn('space-y-2', className)}>
      {sortedItems.map((item) => {
        const percentage = (item.sizeBytes / maxSize) * 100;
        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary truncate max-w-[150px]">
                {item.name}
              </span>
              <span className={cn('font-medium', getSizeTextColor(percentage))}>
                {formatBytes(item.sizeBytes)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300 rounded-full',
                  getSizeColor(percentage),
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
