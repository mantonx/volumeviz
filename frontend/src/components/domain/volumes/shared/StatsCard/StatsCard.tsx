import React from 'react';
import type { StatsCardProps } from './StatsCard.types';

/**
 * StatsCard component for displaying statistics with an icon and optional subtitle.
 *
 * Used throughout the volumes page to display key metrics such as:
 * - Total volume count across all pages
 * - Storage size on current page
 * - Number of tracked vs untracked volumes
 *
 * Provides consistent styling with color-coded icons and responsive layout.
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="bg-surface overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={`w-10 h-10 ${colorClasses[color]} rounded-md flex items-center justify-center text-white`}
            >
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-tertiary truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-primary">{value}</dd>
              {subtitle && (
                <dd className="text-xs text-tertiary mt-1">{subtitle}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};
