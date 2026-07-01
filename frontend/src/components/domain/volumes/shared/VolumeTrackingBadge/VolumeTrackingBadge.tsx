/**
 * VolumeTrackingBadge Component
 *
 * Displays whether a volume is being tracked with consistent styling.
 * Used to show tracking status across the application.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import { EyeOff } from 'lucide-react';
import type { VolumeTrackingBadgeProps } from './VolumeTrackingBadge.types';

/**
 * VolumeTrackingBadge displays a volume's tracking status
 */
export const VolumeTrackingBadge: React.FC<VolumeTrackingBadgeProps> = ({
  isTracked,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const iconSizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  if (isTracked) {
    // Don't show badge for tracked volumes (it's the default state)
    return null;
  }

  // Show "Untracked" badge for untracked volumes
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showIcon && (
        <EyeOff className={cn(iconSizeClass, 'text-gray-600 dark:text-gray-400')} />
      )}
      <span
        className={cn(
          'font-medium rounded-full',
          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          sizeClasses[size]
        )}
      >
        Untracked
      </span>
    </div>
  );
};
