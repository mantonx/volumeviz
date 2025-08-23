/**
 * Growth Indicator Component
 * Shows volume growth trends with arrows and color coding
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils';

interface GrowthIndicatorProps {
  growthRate?: number; // Percentage growth rate (0.1 = 10%)
  showLabel?: boolean;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

const getGrowthColor = (rate: number): string => {
  const percentage = rate * 100;
  if (percentage < 1) return 'text-green-600 dark:text-green-400';
  if (percentage < 5) return 'text-yellow-600 dark:text-yellow-400';
  if (percentage < 10) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

const getGrowthBgColor = (rate: number): string => {
  const percentage = rate * 100;
  if (percentage < 1) return 'bg-green-100 dark:bg-green-900/30';
  if (percentage < 5) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (percentage < 10) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

const getGrowthIcon = (rate: number) => {
  const percentage = rate * 100;
  if (percentage > 5) return TrendingUp;
  if (percentage < -5) return TrendingDown;
  return Minus;
};

const getGrowthLabel = (rate: number): string => {
  const percentage = rate * 100;
  if (percentage > 10) return 'Growing Fast';
  if (percentage > 5) return 'Growing';
  if (percentage > 1) return 'Moderate Growth';
  if (percentage > -1) return 'Stable';
  if (percentage > -5) return 'Shrinking';
  return 'Shrinking Fast';
};

export const GrowthIndicator: React.FC<GrowthIndicatorProps> = ({
  growthRate,
  showLabel = true,
  showIcon = true,
  compact = false,
  className,
}) => {
  if (growthRate === undefined || growthRate === null) {
    return (
      <span className={cn('text-sm text-gray-500 dark:text-gray-400', className)}>
        —
      </span>
    );
  }

  const percentage = growthRate * 100;
  const Icon = getGrowthIcon(growthRate);
  const color = getGrowthColor(growthRate);
  const bgColor = getGrowthBgColor(growthRate);
  const label = getGrowthLabel(growthRate);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {showIcon && (
          <Icon className={cn('h-3 w-3', color)} />
        )}
        <span className={cn('text-xs font-medium', color)}>
          {percentage > 0 ? '+' : ''}{percentage.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
      bgColor,
      className
    )}>
      {showIcon && (
        <Icon className={cn('h-3.5 w-3.5', color)} />
      )}
      <div className="flex flex-col">
        <span className={cn('text-xs font-medium', color)}>
          {percentage > 0 ? '+' : ''}{percentage.toFixed(1)}%
        </span>
        {showLabel && (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

// Alert for volumes growing too fast
interface GrowthAlertProps {
  growthRate: number;
  volumeName: string;
  className?: string;
}

export const GrowthAlert: React.FC<GrowthAlertProps> = ({
  growthRate,
  volumeName,
  className,
}) => {
  const percentage = growthRate * 100;
  
  if (percentage < 10) return null;

  return (
    <div className={cn(
      'flex items-start gap-2 p-3 rounded-lg',
      'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800',
      className
    )}>
      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
          High Growth Rate Detected
        </p>
        <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
          {volumeName} is growing at {percentage.toFixed(1)}% rate. Consider investigating disk usage.
        </p>
      </div>
    </div>
  );
};