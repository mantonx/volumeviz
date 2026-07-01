import React from 'react';

/**
 * Props for the StatsCard component.
 *
 * StatsCard is used to display key metrics and statistics throughout
 * the volumes page, providing consistent visual styling for numeric
 * data with icons and optional subtitles.
 */
export interface StatsCardProps {
  /** Title/label for the statistic */
  title: string;
  /** Primary value to display (number or formatted string) */
  value: string | number;
  /** Icon to display alongside the statistic */
  icon: React.ReactNode;
  /** Color theme for the icon background */
  color: 'blue' | 'green' | 'purple';
  /** Optional subtitle providing additional context */
  subtitle?: string;
}
