import React, { useCallback, useEffect, useState } from 'react';
import { Scan, Loader2, Play, Pause } from 'lucide-react';
import { clsx } from 'clsx';
import { useVolumeScanning } from '../../../api/services';
import { useToast } from '../../ui/Toast/ToastProvider';
import { useMultiPhaseScanProgress } from '../../../hooks/useMultiPhaseScanProgress';
import { ProgressBar } from '../../ui/ProgressBar';
import { PhaseIndicator } from '../../ui/PhaseIndicator';

export interface DetailedScanButtonProps {
  volumeId: string;
  variant?: 'default' | 'icon' | 'compact' | 'detailed' | 'view-only';
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  showPhases?: boolean;
  disabled?: boolean;
  autoStartPolling?: boolean; // Start polling immediately (scan already initiated elsewhere)
  viewOnly?: boolean; // Only show progress, no scan trigger functionality
  onScanComplete?: (result: any) => void;
  onScanError?: (scanError: Error) => void;
  className?: string;
}

/**
 * Button component for initiating volume scans with multi-phase progress tracking.
 *
 * Features:
 * - Real-time multi-phase progress tracking
 * - Volume scan and filesystem indexing phases
 * - Detailed progress indicators with percentages
 * - Current file/directory being processed
 * - Performance metrics (files/second)
 * - Responsive design for different contexts
 *
 * @example
 * ```tsx
 * <DetailedScanButton
 *   volumeId={volume.id}
 *   variant="detailed"
 *   showProgress={true}
 *   showPhases={true}
 *   onScanComplete={(result) => {
 *     console.log('Multi-phase scan completed:', result);
 *   }}
 * />
 * ```
 */
export const DetailedScanButton: React.FC<DetailedScanButtonProps> = ({
  volumeId,
  variant = 'icon',
  size = 'sm',
  showProgress = true,
  showPhases = false,
  disabled = false,
  autoStartPolling = false,
  viewOnly = false,
  onScanComplete,
  onScanError,
  className,
}) => {
  // Immediate logging to verify component is rendering
  console.log(
    `[DetailedScanButton] Component rendered for volume: ${volumeId}, variant: ${variant}, autoStartPolling: ${autoStartPolling}`,
  );
  const { scanVolume, scanLoading } = useVolumeScanning();
  const { success, error: showError, info } = useToast();
  const {
    progress,
    isScanning,
    isComplete,
    isFailed,
    currentPhase,
    startPolling,
    stopPolling,
    resetProgress,
  } = useMultiPhaseScanProgress(volumeId);

  const [showDetails, setShowDetails] = useState(false);
  const isDisabled = disabled || isScanning;

  // Debug logging to understand what's happening
  useEffect(() => {
    if (isScanning || progress.status !== 'idle') {
      console.log(`[DetailedScanButton] Progress update for ${volumeId}:`, {
        status: progress.status,
        overallProgress: progress.overallProgress,
        phases: progress.phases.map((p) => ({
          id: p.id,
          label: p.label,
          status: p.status,
          progress: p.progress,
        })),
        currentPhase: currentPhase?.label,
        isScanning,
        isComplete,
        isFailed,
      });
    }
  }, [progress, isScanning, isComplete, isFailed, currentPhase, volumeId]);

  // Auto-start polling if requested (scan already initiated elsewhere) or in view-only mode
  useEffect(() => {
    if (autoStartPolling || viewOnly) {
      console.log(
        `[DetailedScanButton] Auto-starting polling for volume: ${volumeId} (viewOnly: ${viewOnly})`,
      );
      setShowDetails(true);
      startPolling();
    }
  }, [autoStartPolling, viewOnly, volumeId, startPolling]);

  // Auto-collapse details when scan completes
  useEffect(() => {
    if (isComplete || isFailed) {
      const timeout = setTimeout(() => setShowDetails(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [isComplete, isFailed]);

  const handleScan = useCallback(async () => {
    console.log(
      `[DetailedScanButton] handleScan called for volume: ${volumeId}, disabled: ${isDisabled}`,
    );
    if (isDisabled) return;

    try {
      console.log(`[DetailedScanButton] Starting scan process...`);
      resetProgress();
      setShowDetails(variant === 'detailed' || showPhases);

      info('Starting volume scan...');
      startPolling();

      const result = await scanVolume(volumeId);
      console.log(`[DetailedScanButton] Scan completed:`, result);

      success('Volume scan initiated successfully');
      onScanComplete?.(result);
    } catch (err) {
      console.error(`[DetailedScanButton] Scan failed:`, err);
      const error = err instanceof Error ? err : new Error('Scan failed');
      showError(`Failed to start scan: ${error.message}`);
      stopPolling();
      onScanError?.(error);
    }
  }, [
    isDisabled,
    resetProgress,
    variant,
    showPhases,
    info,
    startPolling,
    scanVolume,
    volumeId,
    success,
    onScanComplete,
    showError,
    stopPolling,
    onScanError,
  ]);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  // View-only variant - just shows progress without scan button
  if (variant === 'view-only' || viewOnly) {
    if (!isScanning && progress.status === 'idle') {
      return (
        <div
          className={clsx(
            'text-sm text-gray-700 dark:text-gray-300',
            className,
          )}
          role="status"
          aria-live="polite"
        >
          No active scan
        </div>
      );
    }

    return (
      <div
        className={clsx(
          'space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700',
          className,
        )}
        role="region"
        aria-label={`Scan progress for volume ${volumeId}`}
        aria-live="polite"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100" id={`scan-progress-${volumeId}`}>
            Scan Progress
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300"
            {isScanning && <Loader2 className="w-3 h-3 animate-spin" />}
            <span
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium',
                isScanning
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : isComplete
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : isFailed
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
              )}
            >
              {isScanning
                ? 'Active'
                : isComplete
                  ? 'Complete'
                  : isFailed
                    ? 'Failed'
                    : 'Idle'}
            </span>
          </div>
        </div>

        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Overall Progress
            </span>
            <span className="text-gray-700 dark:text-gray-300" aria-label={`${progress.overallProgress} percent complete`}>
              {progress.overallProgress}%
            </span>
          </div>
          <ProgressBar
            progress={progress.overallProgress}
            size="md"
            showPercentage={false}
            animated={isScanning}
          />
        </div>

        {/* Phase indicators */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100" id={`scan-phases-${volumeId}`}>
            Scan Phases
          </div>
          <PhaseIndicator
            phases={progress.phases.map((phase) => ({
              id: phase.id,
              label: phase.label,
              description: phase.description,
              status: phase.status,
              progress: phase.progress,
              clickable: false,
            }))}
            orientation="vertical"
            size="sm"
            showDescriptions={true}
            showProgress={true}
            animated={true}
          />
        </div>

        {/* Current phase details */}
        {currentPhase && currentPhase.details && (
          <div className="space-y-2 text-sm">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {currentPhase.label}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-800 dark:text-gray-200" role="group" aria-labelledby={`scan-phases-${volumeId}`}>
              {currentPhase.details.filesProcessed !== undefined && (
                <div aria-label={`Files processed: ${currentPhase.details.filesProcessed.toLocaleString()}`}>
                  <span className="font-medium">Files:</span>{' '}
                  <span className="tabular-nums">{currentPhase.details.filesProcessed.toLocaleString()}</span>
                </div>
              )}

              {currentPhase.details.filesPerSecond !== undefined && (
                <div aria-label={`Processing speed: ${currentPhase.details.filesPerSecond.toFixed(1)} files per second`}>
                  <span className="font-medium">Speed:</span>{' '}
                  <span className="tabular-nums">{currentPhase.details.filesPerSecond.toFixed(1)} files/sec</span>
                </div>
              )}

              {currentPhase.details.bytesProcessed !== undefined && (
                <div className="col-span-2" aria-label={`Data processed: ${((currentPhase.details.bytesProcessed) / (1024 * 1024 * 1024)).toFixed(2)} gigabytes`}>
                  <span className="font-medium">Processed:</span>{' '}
                  <span className="tabular-nums">{(
                    currentPhase.details.bytesProcessed /
                    (1024 * 1024 * 1024)
                  ).toFixed(2)} GB</span>
                </div>
              )}
            </div>

            {currentPhase.details.currentFile && (
              <div className="text-xs text-gray-700 dark:text-gray-300 truncate" aria-label={`Currently processing: ${currentPhase.details.currentFile}`}>
                <span className="font-medium">Current:</span>{' '}
                <span className="font-mono text-xs break-all">{currentPhase.details.currentFile}</span>
              </div>
            )}
          </div>
        )}

        {/* Enrichment Errors */}
        {progress.phases.some(
          (phase) => phase.recentErrors && phase.recentErrors.length > 0,
        ) && (
          <div className="space-y-2 text-sm">
            <div className="font-medium text-red-900 dark:text-red-100" id={`enrichment-errors-${volumeId}`}>
              Enrichment Errors
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1">
              {progress.phases
                .filter(
                  (phase) =>
                    phase.recentErrors && phase.recentErrors.length > 0,
                )
                .map((phase) =>
                  phase.recentErrors!.map((error, idx) => (
                    <div
                      key={`${phase.id}-${idx}`}
                      className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-300 dark:border-red-700"
                      role="alert"
                      aria-labelledby={`enrichment-errors-${volumeId}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-red-900 dark:text-red-100">
                          {error.enricher_name}
                        </span>
                        <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 rounded text-xs font-medium">
                          {error.error_type.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-gray-800 dark:text-gray-200 mb-1">
                        <span className="font-medium">File:</span>{' '}
                        <span className="font-mono break-all">{error.file_name}</span>
                      </div>

                      <div className="text-red-800 dark:text-red-200 font-medium">
                        {error.error_message}
                      </div>

                      {error.technical_details && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded">
                          {error.technical_details}
                        </div>
                      )}
                    </div>
                  )),
                )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={handleScan}
        disabled={isDisabled}
        className={clsx(
          'rounded-lg transition-colors p-1',
          'hover:bg-blue-100 dark:hover:bg-blue-900/20',
          'hover:text-blue-600 dark:hover:text-blue-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'text-gray-500 dark:text-gray-400',
          className,
        )}
        title={
          disabled
            ? 'Volume is untracked - enable tracking to scan'
            : isScanning
              ? `Scanning ${currentPhase?.label || 'volume'}...`
              : 'Scan volume'
        }
      >
        {isScanning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Scan className="w-4 h-4" />
        )}
      </button>
    );
  }

  // Compact variant with progress
  if (variant === 'compact') {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        <button
          onClick={handleScan}
          disabled={isDisabled}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isScanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scan className="w-4 h-4" />
          )}
          <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
        </button>

        {isScanning && showProgress && (
          <div className="flex-1 min-w-[100px]">
            <ProgressBar
              progress={progress.overallProgress}
              size="sm"
              showPercentage={false}
              animated={true}
              className="h-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              {progress.overallProgress}% •{' '}
              {currentPhase?.label || 'Processing...'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default and detailed variants
  return (
    <div className={clsx('space-y-2', className)}>
      {/* Main button */}
      <button
        onClick={handleScan}
        disabled={isDisabled}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'lg' && 'px-6 py-3 text-lg',
          'bg-blue-600 hover:bg-blue-700 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600',
        )}
      >
        {isScanning ? (
          <Loader2
            className={clsx(
              'animate-spin',
              size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5',
            )}
          />
        ) : (
          <Scan
            className={clsx(
              size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5',
            )}
          />
        )}
        <span>
          {isScanning
            ? 'Scanning...'
            : isComplete
              ? 'Scan Complete'
              : isFailed
                ? 'Scan Failed'
                : 'Scan Volume'}
        </span>
        {isScanning && (
          <span className="text-blue-200 text-sm">
            {progress.overallProgress}%
          </span>
        )}
      </button>

      {/* Progress details */}
      {(isScanning || showDetails) &&
        (variant === 'detailed' || showProgress) && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* Overall progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Overall Progress
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {progress.overallProgress}%
                </span>
              </div>
              <ProgressBar
                progress={progress.overallProgress}
                size="md"
                showPercentage={false}
                animated={isScanning}
              />
            </div>

            {/* Phase indicators */}
            {(showPhases || variant === 'detailed') && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Scan Phases
                </div>
                <PhaseIndicator
                  phases={progress.phases.map((phase) => ({
                    id: phase.id,
                    label: phase.label,
                    description: phase.description,
                    status: phase.status,
                    progress: phase.progress,
                    clickable: false,
                  }))}
                  orientation="vertical"
                  size="sm"
                  showDescriptions={true}
                  showProgress={true}
                  animated={true}
                />
              </div>
            )}

            {/* Current phase details */}
            {currentPhase && currentPhase.details && (
              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300">
                  {currentPhase.label}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                  {currentPhase.details.filesProcessed !== undefined && (
                    <div>
                      <span className="font-medium">Files:</span>{' '}
                      {currentPhase.details.filesProcessed.toLocaleString()}
                    </div>
                  )}

                  {currentPhase.details.filesPerSecond !== undefined && (
                    <div>
                      <span className="font-medium">Speed:</span>{' '}
                      {currentPhase.details.filesPerSecond.toFixed(1)} files/sec
                    </div>
                  )}

                  {currentPhase.details.bytesProcessed !== undefined && (
                    <div className="col-span-2">
                      <span className="font-medium">Processed:</span>{' '}
                      {(
                        currentPhase.details.bytesProcessed /
                        (1024 * 1024 * 1024)
                      ).toFixed(2)}{' '}
                      GB
                    </div>
                  )}
                </div>

                {currentPhase.details.currentFile && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    <span className="font-medium">Current:</span>{' '}
                    {currentPhase.details.currentFile}
                  </div>
                )}
              </div>
            )}

            {/* Enrichment Errors */}
            {progress.phases.some(
              (phase) => phase.recentErrors && phase.recentErrors.length > 0,
            ) && (
              <div className="space-y-2 text-sm">
                <div className="font-medium text-red-700 dark:text-red-300">
                  Enrichment Errors
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1">
                  {progress.phases
                    .filter(
                      (phase) =>
                        phase.recentErrors && phase.recentErrors.length > 0,
                    )
                    .map((phase) =>
                      phase.recentErrors!.map((error, idx) => (
                        <div
                          key={`${phase.id}-${idx}`}
                          className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-300 dark:border-red-700"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">
                              {error.enricher_name}
                            </span>
                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                              {error.error_type.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="text-gray-600 dark:text-gray-400 mb-1">
                            <span className="font-medium">File:</span>{' '}
                            {error.file_name}
                          </div>

                          <div className="text-red-600 dark:text-red-400">
                            {error.error_message}
                          </div>

                          {error.technical_details && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                              {error.technical_details}
                            </div>
                          )}
                        </div>
                      )),
                    )}
                </div>
              </div>
            )}

            {/* Debug info - temporary */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-400 border-t pt-2">
                <div>Status: {progress.status}</div>
                <div>Current Phase: {currentPhase?.id || 'none'}</div>
                <div>API Responses: Check browser console</div>
              </div>
            )}

            {/* Toggle details button for default variant */}
            {variant === 'default' && (
              <button
                onClick={toggleDetails}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        )}
    </div>
  );
};
