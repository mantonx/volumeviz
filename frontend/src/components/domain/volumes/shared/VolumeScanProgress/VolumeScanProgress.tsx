/**
 * VolumeScanProgress Component
 *
 * Displays volume scan progress and file count information.
 * Shows different states: scanning, completed, or not scanned.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SCAN_STATUS } from '../constants';
import type { VolumeScanProgressProps } from './VolumeScanProgress.types';

/**
 * VolumeScanProgress displays scan status and file count
 */
export const VolumeScanProgress: React.FC<VolumeScanProgressProps> = ({
  scanStatus,
  fileCount,
  lastScanAt,
  showLastScan = true,
  size = 'md',
  className,
}) => {
  const textSizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const iconSizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';

  // Scanning state
  if (scanStatus === SCAN_STATUS.RUNNING || scanStatus === SCAN_STATUS.PENDING) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Activity className={cn(iconSizeClass, 'text-blue-600 dark:text-blue-400 animate-pulse')} />
        <span className={cn(textSizeClass, 'text-blue-600 dark:text-blue-400 font-medium')}>
          Scanning...
        </span>
      </div>
    );
  }

  // Completed scan with file count
  if (fileCount !== null && fileCount !== undefined) {
    return (
      <div className={cn('space-y-0.5', className)}>
        <div className={cn(textSizeClass, 'font-medium text-primary')}>
          {fileCount.toLocaleString()} files
        </div>
        {showLastScan && lastScanAt && (
          <div className={cn(
            size === 'sm' ? 'text-[10px]' : 'text-xs',
            'text-secondary'
          )}>
            {formatDistanceToNow(new Date(lastScanAt), { addSuffix: true })}
          </div>
        )}
      </div>
    );
  }

  // Not scanned state
  return (
    <span className={cn(textSizeClass, 'text-tertiary italic', className)}>
      Not scanned
    </span>
  );
};
