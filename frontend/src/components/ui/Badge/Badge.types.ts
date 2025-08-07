import React from 'react';

/**
 * Badge variants mapped to their semantic meaning in VolumeViz:
 * - default: General informational badges (blue)
 * - secondary: Neutral states, driver types (gray)
 * - success: Healthy/active states, completed operations (green)
 * - warning: Attention needed, pending operations (yellow)
 * - error: Failed states, unhealthy conditions (red)
 * - outline: Inactive/disabled states, subtle labels (outlined)
 */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline'
  | 'primary';

/**
 * Badge size options
 */
export type BadgeSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Badge component extending HTML span attributes
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual and semantic variant of the badge.
   * Choose based on the type of information being conveyed:
   * - Use 'success' for positive states (active volumes, healthy containers)
   * - Use 'error' for negative states (failed scans, disconnected)
   * - Use 'warning' for attention states (scanning in progress)
   * - Use 'secondary' for neutral info (driver types, labels)
   */
  variant?: BadgeVariant;
  /**
   * Size of the badge
   * - 'sm': Small size for compact displays
   * - 'md': Default medium size
   * - 'lg': Large size for emphasis
   */
  size?: BadgeSize;
  /** Text or elements to display inside the badge */
  children: React.ReactNode;
}
