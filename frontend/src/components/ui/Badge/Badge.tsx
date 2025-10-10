import React from 'react';
import { cn } from '@/utils';
import type { BadgeProps, BadgeVariant, BadgeSize } from './Badge.types';

/**
 * Badge variants with their corresponding Tailwind CSS classes
 */
const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-blue-100 text-blue-800',
  secondary: 'bg-surface-secondary text-secondary',
  success: 'bg-green-100 text-green-800',
  warning:
    'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  outline:
    'border border-line text-secondary',
  primary: 'bg-blue-500 text-white',
};

/**
 * Badge sizes with their corresponding Tailwind CSS classes
 */
const badgeSizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

/**
 * Badge component used throughout VolumeViz for status indicators and labels.
 *
 * Primary use cases:
 * - Volume status indicators (active/inactive)
 * - Container health states (healthy/unhealthy)
 * - Docker driver types (local, nfs, etc.)
 * - Scan status (scanning, completed, failed)
 * - Database connection status
 *
 * The component automatically handles dark mode theming and provides
 * semantic color coding for different states.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
