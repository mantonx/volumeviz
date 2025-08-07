import React from 'react';
import { cn } from '@/utils';
import type { CardProps } from './Card.types';

/**
 * Card component providing consistent container styling across VolumeViz.
 *
 * Used throughout the application for:
 * - Volume information cards on the volumes page
 * - Dashboard metric widgets (storage usage, container counts)
 * - Settings panels and configuration sections
 * - Container listing cards with status and details
 * - Health check result displays
 * - Error and status message containers
 *
 * Provides consistent elevation, borders, and dark mode support.
 * All cards automatically adapt to the current theme.
 */
export const Card: React.FC<CardProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
