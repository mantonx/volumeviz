/**
 * VolumeRowProgressBar
 *
 * A full-width hairline progress bar pinned to the bottom edge of a volume
 * table row, visible only while that volume is actively scanning (and for a
 * brief green "done" flash on completion). Reads live scan state from the
 * shared WebSocket atom via useVolumeScanState — no per-row subscription, no
 * transport change; the data is already table-wide.
 *
 * Rendered as an absolutely-positioned element; the host <tr> must be
 * position: relative for it to span the row.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import type { VolumeScanState } from '@/hooks/useVolumeScanState';

interface VolumeRowProgressBarProps {
  scanState: VolumeScanState;
}

export const VolumeRowProgressBar: React.FC<VolumeRowProgressBarProps> = ({
  scanState,
}) => {
  const { isScanning, progress, justCompleted, failed } = scanState;

  // Nothing to show when idle and not in the brief post-scan flash.
  if (!isScanning && !justCompleted) {
    return null;
  }

  // Width: live % while scanning; a full bar during the completion flash.
  const width = justCompleted ? 100 : (progress ?? 0);

  const barColor = justCompleted
    ? failed
      ? 'bg-red-500'
      : 'bg-green-500'
    : 'bg-blue-500';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-transparent"
      aria-hidden="true"
      data-testid="volume-row-progress"
    >
      <div
        className={cn(
          'h-full transition-all ease-out',
          barColor,
          // Width animates smoothly as progress ticks up; the completion flash
          // then fades the whole bar out.
          justCompleted ? 'opacity-0 duration-700' : 'opacity-100 duration-300',
        )}
        style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }}
      />
    </div>
  );
};
