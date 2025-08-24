import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Activity } from 'lucide-react';
import { clsx } from 'clsx';

import { ProgressBar } from '../ProgressBar';
import { Badge } from '../Badge';
import { useWebSocket } from '../../../providers/WebSocketProvider';
import { formatBytes, formatDuration } from '../../../utils/format';
import { usePhaseTransitionNotifications } from '../../../hooks/usePhaseTransitionNotifications';

import type {
  MultiPhaseProgressBarProps,
  ComprehensiveScanProgress,
  ScanPhaseProgress,
} from './MultiPhaseProgressBar.types';

// Default phase configurations
const DEFAULT_PHASE_CONFIG = {
  volume_scan: {
    label: 'Volume Scan',
    description: 'Calculating volume size and basic statistics',
    icon: Activity,
    weight: 0.15, // 15% of total progress
  },
  filesystem_indexing: {
    label: 'Filesystem Indexing',
    description: 'Analyzing file structure and metadata',
    icon: Activity,
    weight: 0.70, // 70% of total progress
  },
  media_enrichment: {
    label: 'Media Enrichment',
    description: 'Extracting metadata from images, videos, and audio',
    icon: Activity,
    weight: 0.15, // 15% of total progress
  },
};

/**
 * MultiPhaseProgressBar - WebSocket-powered multi-phase scan progress visualization
 *
 * Displays real-time progress for volume scans with three phases:
 * 1. Volume Scan - Basic volume statistics
 * 2. Filesystem Indexing - File structure analysis  
 * 3. Media Enrichment - Metadata extraction
 *
 * Features:
 * - Real-time WebSocket updates for active scans
 * - Historical data fetching for completed/failed scans
 * - Detailed per-phase progress and metrics
 * - Error handling and display
 * - Performance statistics
 * - Estimated completion times
 * - Responsive design with multiple size variants
 */
export const MultiPhaseProgressBar: React.FC<MultiPhaseProgressBarProps> = ({
  volumeId,
  scanId,
  size = 'md',
  showPhaseDescriptions = true,
  showDetailedMetrics = false,
  showErrors = true,
  animated = true,
  showEstimatedTime = true,
  compact = false,
  phaseLabels = {},
  phaseDescriptions = {},
  onScanStart,
  onScanComplete,
  onScanError,
  onProgressUpdate,
  onPhaseTransition,
  className,
  testId = 'multi-phase-progress-bar',
  headerContent,
  footerContent,
}) => {
  const [progress, setProgress] = useState<ComprehensiveScanProgress | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [historicalLoadError, setHistoricalLoadError] = useState<string | null>(null);
  
  const { isConnected, on } = useWebSocket();
  
  // Phase transition detection
  const { detectTransition } = usePhaseTransitionNotifications({
    enabled: !!onPhaseTransition,
    volumeId,
    scanId,
    onTransition: onPhaseTransition,
  });

  // Fetch historical scan data for completed/failed scans
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!scanId || progress) return; // Don't fetch if we already have progress data
      
      setIsLoadingHistorical(true);
      setHistoricalLoadError(null);
      
      try {
        const response = await fetch(`/api/v1/scans/${scanId}/progress`);
        if (!response.ok) {
          throw new Error(`Failed to fetch scan progress: ${response.status}`);
        }
        
        const data: ComprehensiveScanProgress = await response.json();
        console.log('MultiPhaseProgressBar: Loaded historical data:', data);
        
        setProgress(data);
        setLastUpdateTime(new Date());
        onProgressUpdate?.(data);
        
        // If it's a completed scan, trigger the complete callback
        if (data.overall_status === 'completed') {
          const duration = data.started_at && data.completed_at
            ? new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()
            : 0;
          onScanComplete?.(scanId, duration);
        } else if (data.overall_status === 'failed') {
          onScanError?.(scanId, 'Scan failed');
        }
        
      } catch (error) {
        console.error('Failed to fetch historical scan data:', error);
        setHistoricalLoadError(error instanceof Error ? error.message : 'Failed to load scan data');
      } finally {
        setIsLoadingHistorical(false);
      }
    };

    fetchHistoricalData();
  }, [scanId, progress, onProgressUpdate, onScanComplete, onScanError]);

  // Subscribe to scan progress updates
  useEffect(() => {
    if (!isConnected || !volumeId) return;

    const handleProgressUpdate = (data: ComprehensiveScanProgress) => {
      console.log('MultiPhaseProgressBar: Received progress update:', data);
      // Filter by volume_id - only process events for this volume
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        setProgress(data);
        setLastUpdateTime(new Date());
        onProgressUpdate?.(data);
        
        // Detect phase transitions
        if (onPhaseTransition) {
          detectTransition(data);
        }
      }
    };

    const handleScanStart = (data: any) => {
      console.log('MultiPhaseProgressBar: Scan started:', data);
      // Filter by volume_id
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        onScanStart?.(data.scan_id);
      }
    };

    const handleScanComplete = (data: any) => {
      console.log('MultiPhaseProgressBar: Scan completed:', data);
      // Filter by volume_id
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        if (progress) {
          const duration = progress.started_at 
            ? Date.now() - new Date(progress.started_at).getTime()
            : 0;
          onScanComplete?.(data.scan_id, duration);
        }
      }
    };

    const handleScanError = (data: any) => {
      console.log('MultiPhaseProgressBar: Scan error:', data);
      // Filter by volume_id
      if (data.volume_id === volumeId || (scanId && data.scan_id === scanId)) {
        onScanError?.(data.scan_id, data.error);
      }
    };

    // Listen to different scan events using global WebSocket provider
    on('scan_progress', handleProgressUpdate);
    on('scan_started', handleScanStart);
    on('scan_complete', handleScanComplete);
    on('scan_error', handleScanError);

    // No cleanup needed - global provider handles this
  }, [isConnected, volumeId, scanId, on, onScanStart, onScanComplete, onScanError, onProgressUpdate, progress]);

  // Calculate overall progress from phases
  const calculatedProgress = useMemo(() => {
    if (!progress?.phases?.length) return 0;

    let totalProgress = 0;
    for (const phase of progress.phases) {
      const phaseConfig = DEFAULT_PHASE_CONFIG[phase.phase_name as keyof typeof DEFAULT_PHASE_CONFIG];
      if (phaseConfig) {
        totalProgress += (phase.progress / 100) * phaseConfig.weight * 100;
      }
    }
    return Math.min(Math.round(totalProgress), 100);
  }, [progress]);

  // Get phase configuration with custom overrides
  const getPhaseConfig = useCallback((phaseName: string) => {
    const defaultConfig = DEFAULT_PHASE_CONFIG[phaseName as keyof typeof DEFAULT_PHASE_CONFIG];
    if (!defaultConfig) return null;

    return {
      ...defaultConfig,
      label: phaseLabels[phaseName as keyof typeof phaseLabels] || defaultConfig.label,
      description: phaseDescriptions[phaseName as keyof typeof phaseDescriptions] || defaultConfig.description,
    };
  }, [phaseLabels, phaseDescriptions]);

  // Get status icon
  const getStatusIcon = (status: string, size: string = 'md') => {
    const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    
    switch (status) {
      case 'completed':
        return <CheckCircle className={clsx(iconSize, 'text-green-500')} />;
      case 'failed':
        return <XCircle className={clsx(iconSize, 'text-red-500')} />;
      case 'running':
        return <Activity className={clsx(iconSize, 'text-blue-500', animated && 'animate-pulse')} />;
      case 'pending':
        return <Clock className={clsx(iconSize, 'text-gray-400')} />;
      default:
        return null;
    }
  };

  // Render individual phase
  const renderPhase = (phase: ScanPhaseProgress, index: number) => {
    const phaseConfig = getPhaseConfig(phase.phase_name);
    if (!phaseConfig) return null;

    // If overall scan failed, treat running/pending phases as failed
    let phaseStatus = phase.status;
    if (progress?.overall_status === 'failed' && (phase.status === 'running' || phase.status === 'pending')) {
      phaseStatus = 'failed';
    }

    const isActive = phaseStatus === 'running';
    const isCompleted = phaseStatus === 'completed';
    const isFailed = phaseStatus === 'failed';

    return (
      <div
        key={phase.phase_name}
        className={clsx(
          'flex flex-col space-y-2 p-3 rounded-lg border transition-all duration-200',
          {
            'bg-blue-50 border-blue-200': isActive,
            'bg-green-50 border-green-200': isCompleted,
            'bg-red-50 border-red-200': isFailed,
            'bg-gray-50 border-gray-200': !isActive && !isCompleted && !isFailed,
            'border-2': isActive,
          }
        )}
        data-testid={`${testId}-phase-${phase.phase_name}`}
      >
        {/* Phase header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(phaseStatus, size)}
            <span className={clsx(
              'font-medium',
              size === 'sm' && 'text-sm',
              size === 'lg' && 'text-lg',
              {
                'text-blue-700': isActive,
                'text-green-700': isCompleted,
                'text-red-700': isFailed,
                'text-gray-600': !isActive && !isCompleted && !isFailed,
              }
            )}>
              {phaseConfig.label}
            </span>
          </div>
          
          <Badge
            variant={
              isActive ? 'info' :
              isCompleted ? 'success' :
              isFailed ? 'error' :
              'secondary'
            }
            size={size}
          >
            {isActive && `${phase.progress}%`}
            {isCompleted && 'Done'}
            {isFailed && (phase.progress > 0 ? `Failed at ${phase.progress}%` : 'Failed')}
            {!isActive && !isCompleted && !isFailed && 'Pending'}
          </Badge>
        </div>

        {/* Phase description */}
        {showPhaseDescriptions && !compact && (
          <p className={clsx(
            'text-gray-600',
            size === 'sm' && 'text-xs',
            size === 'lg' && 'text-base',
            'text-sm'
          )}>
            {phaseConfig.description}
          </p>
        )}

        {/* Progress bar for active or failed phase */}
        {(isActive || (isFailed && phase.progress > 0)) && (
          <ProgressBar
            value={phase.progress}
            variant={isFailed ? "error" : "info"}
            size={size === 'lg' ? 'md' : 'sm'}
            showLabel={!compact}
            animated={animated && isActive}
            className="w-full"
          />
        )}

        {/* Detailed metrics */}
        {showDetailedMetrics && !compact && isActive && (
          <div className={clsx(
            'grid grid-cols-2 gap-2 text-xs text-gray-600',
            size === 'sm' && 'text-xs',
            size === 'lg' && 'text-sm'
          )}>
            {phase.items_processed > 0 && (
              <div>
                <span className="font-medium">Items:</span> {phase.items_processed.toLocaleString()}
                {phase.items_total > 0 && ` / ${phase.items_total.toLocaleString()}`}
              </div>
            )}
            {phase.bytes_processed > 0 && (
              <div>
                <span className="font-medium">Data:</span> {formatBytes(phase.bytes_processed)}
                {phase.bytes_total > 0 && ` / ${formatBytes(phase.bytes_total)}`}
              </div>
            )}
            {phase.items_per_second > 0 && (
              <div>
                <span className="font-medium">Rate:</span> {Math.round(phase.items_per_second)}/sec
              </div>
            )}
            {phase.current_item && (
              <div className="col-span-2 space-y-1">
                <div className="truncate">
                  <span className="font-medium">Current File:</span> {phase.current_item.split('|')[0] || phase.current_item}
                </div>
                {phase.current_item.includes('|') && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {phase.current_item.split('|')[1] && (
                      <div>
                        <span className="font-medium">Size:</span> {formatBytes(parseInt(phase.current_item.split('|')[1]))}
                      </div>
                    )}
                    {phase.current_item.split('|')[2] && (
                      <div>
                        <span className="font-medium">Type:</span> {phase.current_item.split('|')[2]}
                      </div>
                    )}
                    {phase.current_item.split('|')[3] && (
                      <div className="col-span-2">
                        <span className="font-medium">Step:</span> {phase.current_item.split('|')[3]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {showErrors && phase.error_message && (
          <div className="text-red-600 text-sm bg-red-100 p-2 rounded border">
            <div className="flex items-center space-x-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="mt-1 text-xs">{phase.error_message}</p>
          </div>
        )}
      </div>
    );
  };

  // Don't render if no progress data
  if (!progress) {
    return (
      <div className={clsx('text-center py-4 text-gray-500', className)} data-testid={testId}>
        {isLoadingHistorical ? (
          <>
            <Activity className="w-6 h-6 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">Loading scan progress...</p>
          </>
        ) : historicalLoadError ? (
          <>
            <XCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="text-sm text-red-600">Failed to load scan progress</p>
            <p className="text-xs text-red-500 mt-1">{historicalLoadError}</p>
          </>
        ) : (
          <>
            <Activity className="w-6 h-6 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">Waiting for scan progress...</p>
          </>
        )}
      </div>
    );
  }

  const isScanning = progress.overall_status === 'running';
  const isCompleted = progress.overall_status === 'completed';
  const isFailed = progress.overall_status === 'failed';
  const overallProgress = progress.overall_progress || calculatedProgress;

  return (
    <div className={clsx('w-full space-y-4', className)} data-testid={testId}>
      {/* Header */}
      {headerContent || (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(progress.overall_status, size)}
            <h3 className={clsx(
              'font-semibold',
              size === 'sm' && 'text-base',
              size === 'lg' && 'text-xl',
              'text-lg'
            )}>
              Scan Progress
              {progress.scan_id && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({progress.scan_id.slice(0, 8)})
                </span>
              )}
            </h3>
          </div>
          
          <div className="text-right">
            <div className={clsx(
              'font-bold',
              size === 'sm' && 'text-lg',
              size === 'lg' && 'text-2xl',
              'text-xl',
              {
                'text-blue-600': isScanning,
                'text-green-600': isCompleted,
                'text-red-600': isFailed,
                'text-gray-600': !isScanning && !isCompleted && !isFailed,
              }
            )}>
              {overallProgress}%
            </div>
            {lastUpdateTime && (
              <div className="text-xs text-gray-500">
                Updated {lastUpdateTime.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall progress bar */}
      <ProgressBar
        value={overallProgress}
        variant={
          isScanning ? 'info' :
          isCompleted ? 'success' :
          isFailed ? 'error' :
          'default'
        }
        size={size === 'sm' ? 'md' : 'lg'}
        showLabel={true}
        animated={animated && isScanning}
        striped={isScanning}
        className="w-full"
      />

      {/* Estimated completion time */}
      {showEstimatedTime && !compact && progress.estimated_end_time && isScanning && (
        <div className="text-center text-sm text-gray-600">
          <Clock className="w-4 h-4 inline mr-1" />
          Estimated completion: {new Date(progress.estimated_end_time).toLocaleTimeString()}
        </div>
      )}

      {/* Phases */}
      <div className={clsx(
        'space-y-3',
        compact && 'space-y-2'
      )}>
        {progress.phases
          .sort((a, b) => a.phase_order - b.phase_order)
          .map((phase, index) => renderPhase(phase, index))}
      </div>

      {/* Recent errors */}
      {showErrors && !compact && progress.recent_errors?.length && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="text-red-800 font-medium mb-2 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            Recent Errors ({progress.recent_errors.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {progress.recent_errors.slice(0, 3).map((error, index) => (
              <div key={index} className="text-red-700 text-sm bg-white/50 p-2 rounded border">
                <div className="font-medium">{error.item_name}</div>
                <div className="text-xs text-red-600">{error.error_message}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(error.occurred_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance stats */}
      {showDetailedMetrics && !compact && progress.performance_stats && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="text-gray-800 font-medium mb-2">Performance</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Elapsed:</span> {formatDuration(progress.performance_stats.elapsed_seconds * 1000)}
            </div>
            {progress.performance_stats.estimated_remaining_seconds > 0 && (
              <div>
                <span className="font-medium">Remaining:</span> {formatDuration(progress.performance_stats.estimated_remaining_seconds * 1000)}
              </div>
            )}
            <div>
              <span className="font-medium">Items/sec:</span> {Math.round(progress.performance_stats.overall_items_per_second)}
            </div>
            <div>
              <span className="font-medium">Data/sec:</span> {formatBytes(progress.performance_stats.overall_bytes_per_second)}/s
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {footerContent}
    </div>
  );
};

MultiPhaseProgressBar.displayName = 'MultiPhaseProgressBar';