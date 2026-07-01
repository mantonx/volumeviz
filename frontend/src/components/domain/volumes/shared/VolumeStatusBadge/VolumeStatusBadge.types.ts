/**
 * VolumeStatusBadge Component Types
 */

export interface VolumeStatusBadgeProps {
  /**
   * Volume status
   */
  status: string;

  /**
   * Show icon alongside status text
   * @default true
   */
  showIcon?: boolean;

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;
}
