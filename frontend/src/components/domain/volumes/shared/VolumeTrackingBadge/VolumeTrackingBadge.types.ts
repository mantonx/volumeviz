/**
 * VolumeTrackingBadge Component Types
 */

export interface VolumeTrackingBadgeProps {
  /**
   * Whether the volume is being tracked
   */
  isTracked: boolean;

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Show icon alongside text
   * @default true
   */
  showIcon?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}
