/**
 * VolumeStatusBadge Component
 *
 * Displays a volume's status with consistent styling and iconography.
 * Centralizes status display logic across the application.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  VOLUME_STATUS,
  STATUS_BADGE_CLASSES,
  STATUS_ICON_COLORS,
} from '../constants';
import type { VolumeStatusBadgeProps } from './VolumeStatusBadge.types';

/**
 * Get icon component for volume status
 */
const getStatusIcon = (status: string, size: string = 'md') => {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const iconColor = STATUS_ICON_COLORS[status as keyof typeof STATUS_ICON_COLORS] ||
                    STATUS_ICON_COLORS[VOLUME_STATUS.INACTIVE];

  const iconProps = { className: cn(sizeClass, iconColor) };

  switch (status) {
    case VOLUME_STATUS.ACTIVE:
      return <CheckCircle2 {...iconProps} />;
    case VOLUME_STATUS.SCANNING:
      return <Activity {...iconProps} className={cn(iconProps.className, 'animate-pulse')} />;
    case VOLUME_STATUS.ERROR:
      return <AlertCircle {...iconProps} />;
    case VOLUME_STATUS.PENDING:
    case VOLUME_STATUS.INACTIVE:
    default:
      return <Clock {...iconProps} />;
  }
};

/**
 * VolumeStatusBadge displays a volume's status with icon and colored badge
 */
export const VolumeStatusBadge: React.FC<VolumeStatusBadgeProps> = ({
  status,
  showIcon = true,
  size = 'md',
  className,
}) => {
  const badgeClass = STATUS_BADGE_CLASSES[status as keyof typeof STATUS_BADGE_CLASSES] ||
                     STATUS_BADGE_CLASSES[VOLUME_STATUS.INACTIVE];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && getStatusIcon(status, size)}
      <span className={cn(
        'font-medium rounded-full',
        sizeClasses[size],
        badgeClass
      )}>
        {status}
      </span>
    </div>
  );
};
