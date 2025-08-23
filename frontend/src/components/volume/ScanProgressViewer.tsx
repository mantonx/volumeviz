import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import { DetailedScanButton } from './ScanButton/DetailedScanButton';

export interface ScanProgressViewerProps {
  volumeId: string;
  className?: string;
}

/**
 * Toggle-able scan progress viewer that shows current scan status
 * without needing to initiate a scan through the UI.
 */
export const ScanProgressViewer: React.FC<ScanProgressViewerProps> = ({
  volumeId,
  className,
}) => {
  return (
    <div className={clsx('space-y-2', className)}>
      {/* Progress Display - Always visible when component is rendered */}
      <DetailedScanButton
        volumeId={volumeId}
        variant="view-only"
        viewOnly={true}
        showProgress={true}
        showPhases={true}
        className="w-full"
      />
    </div>
  );
};