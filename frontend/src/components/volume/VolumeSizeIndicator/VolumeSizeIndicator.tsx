import React from 'react';
import { HardDrive, Database, Server } from 'lucide-react';
import { formatBytes } from '../../../utils/formatters';
import { clsx } from 'clsx';

export interface VolumeSizeIndicatorProps {
  size: number;
  maxSize?: number;
  variant?: 'bar' | 'circle' | 'compact';
  showLabel?: boolean;
  showIcon?: boolean;
  colorScheme?: 'default' | 'status' | 'gradient';
  className?: string;
}

/**
 * Visual component for displaying Docker volume sizes in VolumeViz.
 *
 * Features:
 * - Multiple display variants (bar, circle, compact)
 * - Size formatting with human-readable units
 * - Optional max size for percentage display
 * - Color schemes for different contexts
 * - Icon support for visual clarity
 * - Responsive design
 *
 * @example
 * ```tsx
 * // Simple size display
 * <VolumeSizeIndicator size={1073741824} />
 *
 * // With max size for percentage
 * <VolumeSizeIndicator
 *   size={5368709120}
 *   maxSize={10737418240}
 *   variant="bar"
 *   colorScheme="status"
 * />
 *
 * // Compact view for tables
 * <VolumeSizeIndicator
 *   size={268435456}
 *   variant="compact"
 *   showIcon={false}
 * />
 * ```
 */
export const VolumeSizeIndicator: React.FC<VolumeSizeIndicatorProps> = ({
  size,
  maxSize,
  variant = 'bar',
  showLabel = true,
  showIcon = true,
  colorScheme = 'default',
  className,
}) => {
  const percentage = maxSize ? (size / maxSize) * 100 : 0;
  const formattedSize = formatBytes(size);
  const formattedMaxSize = maxSize ? formatBytes(maxSize) : null;

  const getColor = () => {
    if (colorScheme === 'default') {
      return 'bg-blue-500';
    }

    if (colorScheme === 'gradient') {
      return 'bg-gradient-to-r from-blue-500 to-purple-500';
    }

    // Status-based colors
    if (!maxSize) return 'bg-blue-500';

    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getIcon = () => {
    if (!showIcon) return null;

    if (size > 10737418240) {
      // > 10GB
      return <Server className="w-4 h-4" />;
    } else if (size > 1073741824) {
      // > 1GB
      return <Database className="w-4 h-4" />;
    }
    return <HardDrive className="w-4 h-4" />;
  };

  if (variant === 'compact') {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        {getIcon()}
        <span className="text-sm font-medium">{formattedSize}</span>
        {maxSize && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            / {formattedMaxSize}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'circle') {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div
        className={clsx(
          'relative inline-flex items-center justify-center',
          className,
        )}
      >
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {maxSize && (
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={clsx('transition-all duration-500', {
                'text-green-500': percentage < 50,
                'text-blue-500': percentage >= 50 && percentage < 75,
                'text-yellow-500': percentage >= 75 && percentage < 90,
                'text-red-500': percentage >= 90,
              })}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {getIcon()}
          {showLabel && (
            <>
              <span className="text-lg font-semibold mt-1">
                {formattedSize}
              </span>
              {maxSize && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {percentage.toFixed(0)}%
                </span>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Default bar variant
  return (
    <div className={clsx('space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {getIcon()}
            <span className="font-medium">{formattedSize}</span>
          </div>
          {maxSize && (
            <span className="text-gray-500 dark:text-gray-400">
              {percentage.toFixed(0)}% of {formattedMaxSize}
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        {maxSize ? (
          <div
            className={clsx('h-full transition-all duration-500', getColor())}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        ) : (
          <div className={clsx('h-full', getColor())} />
        )}
      </div>
    </div>
  );
};
