import React, { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';

import { useWebSocket } from '../../../providers/WebSocketProvider';
import type {
  SubtleProgressIndicatorProps,
  ScanProgressState,
} from './SubtleProgressIndicator.types';

/**
 * SubtleProgressIndicator - A subtle bottom border progress bar for volume scan progress
 *
 * Displays scan progress as a colored bottom border that grows from left to right.
 * Shows different colors for different phases and states:
 * - Blue: Active scanning
 * - Green: Completed successfully
 * - Red: Failed
 * - Yellow: Pending/Queued
 * - Gray: Idle/No scan
 *
 * Features:
 * - WebSocket-powered real-time updates
 * - Multi-phase progress visualization (3 segments for 3 scan phases)
 * - Smooth animations
 * - Minimal UI footprint (just a border)
 * - Auto-hide when not scanning
 */
export const SubtleProgressIndicator: React.FC<
  SubtleProgressIndicatorProps
> = ({
  volumeId,
  show = true,
  progress: externalProgress,
  status: externalStatus,
  className,
  testId = 'subtle-progress-indicator',
  animationDuration = 300,
  showPhases = true,
  onProgressUpdate,
  onComplete,
  asTableRow = false,
}) => {
  // Determine initial status based on whether external status/progress is provided
  const getInitialStatus = () => {
    if (externalStatus) return externalStatus;
    if (externalProgress !== undefined) {
      // If we have external progress, determine status based on progress value
      if (externalProgress === 100) return 'completed';
      if (externalProgress > 0) return 'running';
    }
    return 'never_scanned'; // Default to never_scanned (gray) for volumes without scan history
  };

  const [progressState, setProgressState] = useState<ScanProgressState>({
    overall_progress: externalProgress || 0,
    overall_status: getInitialStatus(),
    phases: [],
  });

  // Use global WebSocket connection
  const { isConnected, on } = useWebSocket();

  // Subscribe to scan progress updates for this volume
  useEffect(() => {
    if (!isConnected || !show || externalProgress !== undefined) return;

    const handleProgressUpdate = (data: any) => {
      if (!data || data.volume_id !== volumeId) return;

      const newState: ScanProgressState = {
        overall_progress: data.overall_progress || 0,
        overall_status: data.overall_status || 'pending',
        phases: data.phases || [],
      };

      setProgressState(newState);
      onProgressUpdate?.(newState.overall_progress, newState.overall_status);

      if (newState.overall_status === 'completed') {
        onComplete?.();
      }
    };

    // Listen to scan progress events
    on('scan_progress', handleProgressUpdate);

    // No cleanup needed - the global WebSocket provider handles this
  }, [
    isConnected,
    volumeId,
    show,
    on,
    onProgressUpdate,
    onComplete,
    externalProgress,
  ]);

  // Use external progress if provided, otherwise use WebSocket state
  const currentProgress = externalProgress ?? progressState.overall_progress;
  const currentStatus = externalStatus ?? progressState.overall_status;

  // Don't render if not showing
  if (!show) {
    return null;
  }

  // Get color based on status
  const getProgressColor = (status: string, isActive: boolean = false) => {
    switch (status) {
      case 'running':
        return isActive ? 'bg-blue-500' : 'bg-blue-400';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'idle':
      case 'never_scanned':
        return 'bg-gray-300 dark:bg-gray-600';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  // Render multi-phase progress (3 segments)
  const renderMultiPhaseProgress = () => {
    const phases = progressState.phases || [];
    const phaseWidth = 100 / 3; // 3 phases: volume_scan, filesystem_indexing, media_enrichment

    return (
      <div className="flex w-full h-full">
        {[0, 1, 2].map((phaseIndex) => {
          const phase = phases[phaseIndex];
          const phaseProgress = phase ? phase.progress : 0;
          let phaseStatus = phase ? phase.status : 'pending';

          // Handle overall scan status when no phase data
          if (!phase && currentStatus === 'completed') {
            phaseStatus = 'completed';
          } else if (
            !phase &&
            (currentStatus === 'idle' || currentProgress === 0)
          ) {
            phaseStatus = 'idle';
          }

          // Calculate this phase's contribution to overall progress
          const isActive = phaseStatus === 'running';
          const isCompleted = phaseStatus === 'completed';
          let segmentProgress = isCompleted
            ? 100
            : isActive
              ? phaseProgress
              : 0;

          // For completed overall scans, show full segment
          if (currentStatus === 'completed') {
            segmentProgress = 100;
          } else if (currentStatus === 'failed') {
            segmentProgress = isCompleted ? 100 : isActive ? phaseProgress : 0;
          } else if (
            currentStatus === 'idle' ||
            currentStatus === 'never_scanned'
          ) {
            segmentProgress = 2; // Show minimal progress for idle volumes
          }

          return (
            <div
              key={phaseIndex}
              className="relative flex-1"
              style={{ width: `${phaseWidth}%` }}
            >
              <div
                className={clsx(
                  'h-full transition-all ease-out',
                  getProgressColor(phaseStatus, isActive),
                  isActive && 'animate-pulse',
                )}
                style={{
                  width: `${segmentProgress}%`,
                  transitionDuration: `${animationDuration}ms`,
                }}
              />
              {/* Subtle separator between phases */}
              {phaseIndex < 2 && (
                <div className="absolute top-0 right-0 w-px h-full bg-gray-200 dark:bg-gray-700 opacity-30" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render single progress bar
  const renderSingleProgress = () => {
    const isActive = currentStatus === 'running';

    // Show actual progress for running scans, 100% for completed, and minimal width for idle/never scanned
    let displayProgress = currentProgress;
    if (currentStatus === 'completed') {
      displayProgress = 100;
    } else if (currentStatus === 'failed') {
      displayProgress = currentProgress || 25; // Show some progress for failed scans
    } else if (
      currentStatus === 'idle' ||
      currentStatus === 'never_scanned' ||
      currentProgress === 0
    ) {
      displayProgress = 2; // Show minimal progress for idle volumes (just a thin line)
    }

    return (
      <div
        className={clsx(
          'h-full transition-all ease-out',
          getProgressColor(currentStatus, isActive),
          isActive && 'animate-pulse',
        )}
        style={{
          width: `${displayProgress}%`,
          transitionDuration: `${animationDuration}ms`,
        }}
      />
    );
  };

  if (asTableRow) {
    // Render as table row for use inside tables
    return (
      <tr data-testid={`${testId}-table-row`} className="h-1">
        <td
          colSpan={999}
          className="p-0 h-1"
          data-testid={testId}
          data-volume-id={volumeId}
          data-progress={currentProgress}
          data-status={currentStatus}
        >
          <div
            className={clsx(
              'h-1 bg-gray-100 dark:bg-gray-800 overflow-hidden',
              className,
            )}
          >
            {showPhases && progressState.phases?.length
              ? renderMultiPhaseProgress()
              : renderSingleProgress()}

            {/* Scanning animation overlay - constrained to progress bar */}
            {currentStatus === 'running' && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 h-1 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div
      className={clsx(
        'absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 overflow-hidden',
        className,
      )}
      data-testid={testId}
      data-volume-id={volumeId}
      data-progress={currentProgress}
      data-status={currentStatus}
      aria-label={`Scan progress: ${currentProgress}% (${currentStatus})`}
      role="progressbar"
      aria-valuenow={currentProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {showPhases && progressState.phases?.length
        ? renderMultiPhaseProgress()
        : renderSingleProgress()}

      {/* Scanning animation overlay - constrained to progress bar */}
      {currentStatus === 'running' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 h-1 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  );
};

SubtleProgressIndicator.displayName = 'SubtleProgressIndicator';
