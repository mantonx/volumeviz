import { clsx } from 'clsx';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useWebSocket } from '../../../providers/WebSocketProvider';
import { formatBytes, formatDuration } from '../../../utils/format';
import { Badge } from '../Badge';
import { ProgressBar } from '../ProgressBar';

import type {
  PhaseConfig,
  PhaseStatus,
  ScanPhase,
  ScanProgressData,
  ScanProgressDisplayProps,
  ScanStatus,
} from './ScanProgressDisplay.types';

// Phase configurations with proper color coding
const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  volume_scan: {
    name: 'volume_scan',
    label: 'Volume Scan',
    description: 'Calculating volume size and basic statistics',
    color: {
      pending: 'bg-gray-200 text-gray-600',
      running: 'bg-blue-500 text-white',
      completed: 'bg-green-500 text-white',
      failed: 'bg-red-500 text-white',
    },
    weight: 0.15,
  },
  filesystem_indexing: {
    name: 'filesystem_indexing',
    label: 'Filesystem Indexing',
    description: 'Analyzing file structure and metadata',
    color: {
      pending: 'bg-gray-200 text-gray-600',
      running: 'bg-blue-500 text-white',
      completed: 'bg-green-500 text-white',
      failed: 'bg-red-500 text-white',
    },
    weight: 0.7,
  },
  media_enrichment: {
    name: 'media_enrichment',
    label: 'Media Enrichment',
    description: 'Extracting metadata from images, videos, and audio',
    color: {
      pending: 'bg-gray-200 text-gray-600',
      running: 'bg-blue-500 text-white',
      completed: 'bg-green-500 text-white',
      failed: 'bg-red-500 text-white',
    },
    weight: 0.15,
  },
};

const getStatusColor = (status: ScanStatus): string => {
  switch (status) {
    case 'running':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

const getStatusIcon = (status: PhaseStatus, animated = true) => {
  const iconClass = 'w-4 h-4';

  switch (status) {
    case 'completed':
      return <CheckCircle className={clsx(iconClass, 'text-green-500')} />;
    case 'failed':
      return <XCircle className={clsx(iconClass, 'text-red-500')} />;
    case 'running':
      return (
        <Activity
          className={clsx(
            iconClass,
            'text-blue-500',
            animated && 'animate-pulse',
          )}
        />
      );
    case 'pending':
      return <Clock className={clsx(iconClass, 'text-gray-400')} />;
    default:
      return null;
  }
};

export const ScanProgressDisplay: React.FC<ScanProgressDisplayProps> = ({
  volumeId,
  scanId,
  variant = 'panel',
  size = 'md',
  showPerformanceStats = true,
  showErrors = true,
  animated = true,
  showEstimatedTime = true,
  compact = false,
  borderHeight = 4,
  showBorderProgress = false,
  autoExpandOnScanStart,
  isExpanded: controlledExpanded,
  onExpandedChange,
  onScanStart,
  onScanComplete,
  onScanError,
  onProgressUpdate,
  className,
  testId = 'scan-progress-display',
}) => {
  // State
  const [progress, setProgress] = useState<ScanProgressData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [autoCloseTimeout, setAutoCloseTimeout] =
    useState<NodeJS.Timeout | null>(null);

  // WebSocket connection
  const { isConnected, on, off, send } = useWebSocket();

  // Controlled vs uncontrolled expansion
  const isExpanded = controlledExpanded ?? internalExpanded;
  const setIsExpanded = useCallback(
    (expanded: boolean) => {
      if (onExpandedChange) {
        onExpandedChange(expanded);
      } else {
        setInternalExpanded(expanded);
      }
    },
    [onExpandedChange],
  );

  // Calculate overall progress from phases
  const overallProgress = useMemo(() => {
    if (!progress?.phases?.length) return 0;

    let totalProgress = 0;
    for (const phase of progress.phases) {
      const config = PHASE_CONFIGS[phase.name];
      if (config) {
        totalProgress += (phase.progress / 100) * config.weight * 100;
      }
    }
    return Math.min(Math.round(totalProgress), 100);
  }, [progress?.phases]);

  // Fetch historical data for completed/failed scans
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!scanId || progress) return;

      setIsLoadingHistorical(true);

      try {
        const response = await fetch(`/api/v1/scans/${scanId}/progress`);
        if (!response.ok) {
          if (response.status === 404) {
            // Scan doesn't exist yet, will rely on WebSocket updates
            return;
          }
          throw new Error(`Failed to fetch scan progress: ${response.status}`);
        }

        const data = await response.json();

        // Transform backend data to our interface
        const transformedData: ScanProgressData = {
          scanId: data.scan_id,
          volumeId: data.volume_id,
          overallStatus: data.overall_status,
          overallProgress: data.overall_progress,
          startedAt: data.started_at,
          completedAt: data.completed_at,
          estimatedEndTime: data.estimated_end_time,
          phases:
            data.phases?.map(
              (phase: any): ScanPhase => ({
                id:
                  phase.id?.toString() ||
                  `${phase.phase_name}-${phase.phase_order}`,
                name: phase.phase_name,
                label:
                  PHASE_CONFIGS[phase.phase_name]?.label || phase.phase_name,
                description: PHASE_CONFIGS[phase.phase_name]?.description || '',
                order: phase.phase_order,
                status: phase.status,
                progress: phase.progress,
                itemsProcessed: phase.items_processed || 0,
                itemsTotal: phase.items_total || 0,
                bytesProcessed: phase.bytes_processed || 0,
                bytesTotal: phase.bytes_total || 0,
                itemsPerSecond: phase.items_per_second || 0,
                bytesPerSecond: phase.bytes_per_second || 0,
                currentItem: phase.current_item,
                errorMessage: phase.error_message,
                errorCount: phase.error_count || 0,
                startedAt: phase.started_at,
                completedAt: phase.completed_at,
                estimatedEndTime: phase.estimated_end_time,
              }),
            ) || [],
          performanceStats: data.performance_stats
            ? {
                elapsedSeconds: data.performance_stats.elapsed_seconds,
                estimatedRemainingSeconds:
                  data.performance_stats.estimated_remaining_seconds,
                overallItemsPerSecond:
                  data.performance_stats.overall_items_per_second,
                overallBytesPerSecond:
                  data.performance_stats.overall_bytes_per_second,
                errorRate: data.performance_stats.error_rate,
                memoryUsageBytes: data.performance_stats.memory_usage_bytes,
                cpuUsagePercent: data.performance_stats.cpu_usage_percent,
              }
            : undefined,
          recentErrors:
            data.recent_errors?.map((error: any) => ({
              itemName: error.item_name,
              errorMessage: error.error_message,
              occurredAt: error.occurred_at,
            })) || [],
        };

        setProgress(transformedData);
        setLastUpdateTime(new Date());
        onProgressUpdate?.(transformedData);
      } catch (error) {
        console.error('Failed to fetch historical scan data:', error);
      } finally {
        setIsLoadingHistorical(false);
      }
    };

    fetchHistoricalData();
  }, [scanId, progress, onProgressUpdate]);

  // WebSocket real-time updates
  useEffect(() => {
    console.log('ScanProgressDisplay: WebSocket effect - Connected:', isConnected, 'VolumeId:', volumeId, 'ScanId:', scanId);
    if (!isConnected || !volumeId) return;

    const handleProgressUpdate = (message: any) => {
      console.log('ScanProgressDisplay: Received WebSocket message:', message);
      const data = message.data || message;

      // Filter by volume_id first, then scan_id as fallback
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        console.log('ScanProgressDisplay: Processing progress update for volume:', volumeId, 'data:', data);
        // Transform the data similar to historical data
        const transformedData: ScanProgressData = {
          scanId: data.scan_id,
          volumeId: data.volume_id,
          overallStatus: data.overall_status,
          overallProgress: data.overall_progress,
          startedAt: data.started_at,
          completedAt: data.completed_at,
          estimatedEndTime: data.estimated_end_time,
          phases:
            data.phases?.map(
              (phase: any): ScanPhase => ({
                id:
                  phase.id?.toString() ||
                  `${phase.phase_name}-${phase.phase_order}`,
                name: phase.phase_name,
                label:
                  PHASE_CONFIGS[phase.phase_name]?.label || phase.phase_name,
                description: PHASE_CONFIGS[phase.phase_name]?.description || '',
                order: phase.phase_order,
                status: phase.status,
                progress: phase.progress,
                itemsProcessed: phase.items_processed || 0,
                itemsTotal: phase.items_total || 0,
                bytesProcessed: phase.bytes_processed || 0,
                bytesTotal: phase.bytes_total || 0,
                itemsPerSecond: phase.items_per_second || 0,
                bytesPerSecond: phase.bytes_per_second || 0,
                currentItem: phase.current_item,
                errorMessage: phase.error_message,
                errorCount: phase.error_count || 0,
                startedAt: phase.started_at,
                completedAt: phase.completed_at,
                estimatedEndTime: phase.estimated_end_time,
              }),
            ) || [],
          performanceStats: data.performance_stats
            ? {
                elapsedSeconds: data.performance_stats.elapsed_seconds,
                estimatedRemainingSeconds:
                  data.performance_stats.estimated_remaining_seconds,
                overallItemsPerSecond:
                  data.performance_stats.overall_items_per_second,
                overallBytesPerSecond:
                  data.performance_stats.overall_bytes_per_second,
                errorRate: data.performance_stats.error_rate,
                memoryUsageBytes: data.performance_stats.memory_usage_bytes,
                cpuUsagePercent: data.performance_stats.cpu_usage_percent,
              }
            : undefined,
          recentErrors:
            data.recent_errors?.map((error: any) => ({
              itemName: error.item_name,
              errorMessage: error.error_message,
              occurredAt: error.occurred_at,
            })) || [],
        };

        setProgress(transformedData);
        setLastUpdateTime(new Date());
        onProgressUpdate?.(transformedData);
      }
    };

    const handleScanStart = (message: any) => {
      const data = message.data || message;
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        setProgress(null); // Clear old progress data
        setLastUpdateTime(new Date());
        onScanStart?.(data.scan_id);

        // Auto-expand if configured
        if (autoExpandOnScanStart?.enabled) {
          setIsExpanded(true);

          // Set auto-close timeout if configured
          if (
            autoExpandOnScanStart.autoCloseDuration &&
            autoExpandOnScanStart.autoCloseDuration > 0
          ) {
            if (autoCloseTimeout) {
              clearTimeout(autoCloseTimeout);
            }
            const timeout = setTimeout(() => {
              setIsExpanded(false);
              setAutoCloseTimeout(null);
            }, autoExpandOnScanStart.autoCloseDuration);
            setAutoCloseTimeout(timeout);
          }
        }
      }
    };

    const handleScanComplete = (message: any) => {
      const data = message.data || message;
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        if (progress?.startedAt) {
          const duration = Date.now() - new Date(progress.startedAt).getTime();
          onScanComplete?.(data.scan_id, duration);
        }
      }
    };

    const handleScanError = (message: any) => {
      const data = message.data || message;
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        onScanError?.(data.scan_id, data.error);
      }
    };

    // Subscribe to WebSocket events
    on('scan_progress_update', handleProgressUpdate);
    on('scan_started', handleScanStart);
    on('scan_complete', handleScanComplete);
    on('scan_error', handleScanError);

    // Subscribe to progress updates for this volume
    const subscribeMessage = {
      type: 'subscribe',
      data: {
        event: 'scan_progress',
        filters: volumeId
          ? { volume_id: volumeId }
          : scanId
            ? { scan_id: scanId }
            : {},
      },
    };

    send(subscribeMessage);

    // Cleanup
    return () => {
      // Remove event handlers
      off('scan_progress_update', handleProgressUpdate);
      off('scan_started', handleScanStart);
      off('scan_complete', handleScanComplete);
      off('scan_error', handleScanError);

      const unsubscribeMessage = {
        type: 'unsubscribe',
        data: {
          event: 'scan_progress',
          filters: subscribeMessage.data.filters,
        },
      };
      send(unsubscribeMessage);

      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
      }
    };
  }, [
    isConnected,
    volumeId,
    scanId,
    autoExpandOnScanStart,
    autoCloseTimeout,
    setIsExpanded,
    onScanStart,
    onScanComplete,
    onScanError,
    onProgressUpdate,
    progress?.startedAt,
    send,
    on,
    off,
  ]);

  // Render border-only mode
  if (variant === 'border' && progress) {
    const statusColor =
      progress.overallStatus === 'running'
        ? 'bg-blue-500'
        : progress.overallStatus === 'completed'
          ? 'bg-green-500'
          : progress.overallStatus === 'failed'
            ? 'bg-red-500'
            : 'bg-gray-300';

    return (
      <div
        className={clsx('relative overflow-hidden', className)}
        data-testid={testId}
        style={{ height: borderHeight }}
      >
        {/* Progress border background */}
        <div className="absolute inset-0 bg-gray-200" />

        {/* Progress fill */}
        <div
          className={clsx(
            'absolute inset-0 transition-all duration-300',
            statusColor,
            animated && 'transition-all duration-300',
          )}
          style={{ width: `${overallProgress}%` }}
        />

        {/* Optional progress text */}
        {showBorderProgress && (
          <div className="absolute right-2 top-0 h-full flex items-center">
            <span className="text-xs text-gray-600 bg-white/80 px-1 rounded">
              {overallProgress}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // Don't render panel if no progress data and not loading
  if (variant === 'panel' && !progress && !isLoadingHistorical) {
    return null;
  }

  // Loading state
  if (isLoadingHistorical) {
    return (
      <div
        className={clsx('flex items-center justify-center p-4', className)}
        data-testid={testId}
      >
        <Activity className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Loading scan progress...</span>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  return (
    <div className={clsx('w-full', className)} data-testid={testId}>
      {/* Panel header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-3">
          {getStatusIcon(progress.overallStatus as PhaseStatus, animated)}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Scan Progress
              {progress.scanId && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({progress.scanId.slice(0, 8)})
                </span>
              )}
            </h3>
            {lastUpdateTime && (
              <p className="text-xs text-gray-500">
                Updated {lastUpdateTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div
            className={clsx(
              'text-2xl font-bold',
              getStatusColor(progress.overallStatus),
            )}
          >
            {overallProgress}%
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="p-4 border-b">
        <ProgressBar
          value={overallProgress}
          variant={
            progress.overallStatus === 'running'
              ? 'info'
              : progress.overallStatus === 'completed'
                ? 'success'
                : progress.overallStatus === 'failed'
                  ? 'error'
                  : 'default'
          }
          size="lg"
          showLabel={false}
          animated={animated && progress.overallStatus === 'running'}
          striped={progress.overallStatus === 'running'}
          className="w-full"
        />
      </div>

      {/* Estimated completion time */}
      {showEstimatedTime &&
        progress.estimatedEndTime &&
        progress.overallStatus === 'running' && (
          <div className="px-4 py-2 text-center text-sm text-gray-600 border-b">
            <Clock className="w-4 h-4 inline mr-1" />
            Estimated completion:{' '}
            {new Date(progress.estimatedEndTime).toLocaleTimeString()}
          </div>
        )}

      {/* Phase progress */}
      <div className={clsx('space-y-4 p-4', compact && 'space-y-2')}>
        {progress.phases
          .sort((a, b) => a.order - b.order)
          .map((phase) => (
            <PhaseProgress
              key={phase.id}
              phase={phase}
              config={PHASE_CONFIGS[phase.name]}
              size={size}
              compact={compact}
              animated={animated}
            />
          ))}
      </div>

      {/* Performance stats */}
      {showPerformanceStats && !compact && progress.performanceStats && (
        <div className="p-4 border-t bg-blue-50/50 dark:bg-blue-900/20">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Performance</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Elapsed:</span>
              <div className="text-gray-900 dark:text-gray-100">
                {formatDuration(
                  progress.performanceStats.elapsedSeconds * 1000,
                )}
              </div>
            </div>
            {progress.performanceStats.estimatedRemainingSeconds > 0 && (
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Remaining:</span>
                <div className="text-gray-900 dark:text-gray-100">
                  {formatDuration(
                    progress.performanceStats.estimatedRemainingSeconds * 1000,
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Items/sec:</span>
              <div className="text-gray-900 dark:text-gray-100">
                {Math.round(progress.performanceStats.overallItemsPerSecond)}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Data/sec:</span>
              <div className="text-gray-900 dark:text-gray-100">
                {formatBytes(progress.performanceStats.overallBytesPerSecond)}/s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent errors */}
      {showErrors &&
        !compact &&
        progress.recentErrors &&
        progress.recentErrors.length > 0 && (
          <div className="p-4 border-t bg-red-50/30 dark:bg-red-900/20">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-3 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              Recent Errors ({progress.recentErrors.length})
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {progress.recentErrors.slice(0, 3).map((error, index) => (
                <div
                  key={index}
                  className="text-red-700 dark:text-red-300 text-sm bg-red-100/50 dark:bg-red-900/30 p-2 rounded"
                >
                  <div className="font-medium">{error.itemName}</div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {error.errorMessage}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(error.occurredAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

// Individual phase progress component
interface PhaseProgressProps {
  phase: ScanPhase;
  config?: PhaseConfig;
  size: 'sm' | 'md' | 'lg';
  compact: boolean;
  animated: boolean;
}

const PhaseProgress: React.FC<PhaseProgressProps> = ({
  phase,
  config,
  size,
  compact,
  animated,
}) => {
  if (!config) {
    return null;
  }

  const isActive = phase.status === 'running';
  const isCompleted = phase.status === 'completed';
  const isFailed = phase.status === 'failed';
  const isPending = phase.status === 'pending';

  return (
    <div
      className={clsx('p-3 rounded-lg border transition-all duration-200', {
        'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800': isActive,
        'bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800': isCompleted,
        'bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-800': isFailed,
        'bg-gray-50/30 dark:bg-gray-800/10 border-gray-200 dark:border-gray-700': isPending,
      })}
    >
      {/* Phase header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon(phase.status, animated)}
          <span className={clsx('font-medium text-gray-900 dark:text-gray-100', size === 'sm' && 'text-sm')}>
            {config.label}
          </span>
        </div>

        <Badge
          variant={
            isActive
              ? 'info'
              : isCompleted
                ? 'success'
                : isFailed
                  ? 'error'
                  : 'secondary'
          }
          size={size}
        >
          {isActive && `${phase.progress}%`}
          {isCompleted && 'Done'}
          {isFailed &&
            (phase.progress > 0 ? `Failed at ${phase.progress}%` : 'Failed')}
          {isPending && 'Pending'}
        </Badge>
      </div>

      {/* Phase description */}
      {!compact && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{config.description}</p>
      )}

      {/* Progress bar for active/failed phases */}
      {(isActive || (isFailed && phase.progress > 0)) && (
        <ProgressBar
          value={phase.progress}
          variant={isFailed ? 'error' : 'info'}
          size={size === 'lg' ? 'md' : 'sm'}
          showLabel={false}
          animated={animated && isActive}
          className="mb-2"
        />
      )}

      {/* Phase metrics */}
      {!compact && isActive && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
          {phase.itemsProcessed > 0 && (
            <div>
              <span className="font-medium">Items:</span>{' '}
              {phase.itemsProcessed.toLocaleString()}
              {phase.itemsTotal > 0 &&
                ` / ${phase.itemsTotal.toLocaleString()}`}
            </div>
          )}
          {phase.bytesProcessed > 0 && (
            <div>
              <span className="font-medium">Data:</span>{' '}
              {formatBytes(phase.bytesProcessed)}
              {phase.bytesTotal > 0 && ` / ${formatBytes(phase.bytesTotal)}`}
            </div>
          )}
          {phase.itemsPerSecond > 0 && (
            <div>
              <span className="font-medium">Rate:</span>{' '}
              {Math.round(phase.itemsPerSecond)}/sec
            </div>
          )}
          {phase.currentItem && (
            <div className="col-span-2">
              <span className="font-medium">Current:</span>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {phase.currentItem}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {phase.errorMessage && (
        <div className="mt-2 text-red-600 dark:text-red-300 text-sm bg-red-100 dark:bg-red-900/30 p-2 rounded">
          <div className="flex items-center space-x-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium">Error:</span>
          </div>
          <p className="text-xs mt-1">{phase.errorMessage}</p>
        </div>
      )}
    </div>
  );
};

ScanProgressDisplay.displayName = 'ScanProgressDisplay';
