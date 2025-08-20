import React, { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';
import { Button } from '../../ui/Button';
import { formatBytes, formatNumber } from '../../../utils';
import type { VolumeCardWithProgressProps } from './VolumeCardWithProgress.types';

export const VolumeCardWithProgress: React.FC<VolumeCardWithProgressProps> = ({
  volume,
  scanProgress,
  onScanStart,
  onScanStop,
  onScanPause,
  onScanResume,
  onClick,
  onViewDetails,
  className,
  testId = 'volume-card-with-progress',
}) => {
  const isScanning = scanProgress?.status === 'running';
  const isPaused = scanProgress?.status === 'paused';
  const canStartScan = !isScanning && !isPaused && scanProgress?.status !== 'pending';

  const scanStats = useMemo(() => {
    if (!scanProgress) return null;

    const stats = [];
    if (scanProgress.filesScanned !== undefined) {
      stats.push(`${formatNumber(scanProgress.filesScanned)} files`);
    }
    if (scanProgress.foldersScanned !== undefined) {
      stats.push(`${formatNumber(scanProgress.foldersScanned)} folders`);
    }
    if (scanProgress.filesPerSecond !== undefined && scanProgress.filesPerSecond > 0) {
      stats.push(`${formatNumber(scanProgress.filesPerSecond)} files/s`);
    }
    if (scanProgress.bytesPerSecond !== undefined && scanProgress.bytesPerSecond > 0) {
      stats.push(`${formatBytes(scanProgress.bytesPerSecond)}/s`);
    }
    return stats;
  }, [scanProgress]);

  const getPhaseLabel = (phase?: string) => {
    switch (phase) {
      case 'volume_scan':
        return 'Scanning Volume';
      case 'filesystem_indexing':
        return 'Indexing Files';
      case 'media_enrichment':
        return 'Enriching Media';
      default:
        return 'Processing';
    }
  };

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
      case 'pending':
      default:
        return 'secondary';
    }
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s remaining`;
    } else {
      return `${secs}s remaining`;
    }
  };

  return (
    <Card
      className={className}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex flex-col space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {volume.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {volume.mount_point || volume.path}
            </p>
          </div>
          
          {scanProgress && (
            <StatusBadge 
              variant={getStatusVariant(scanProgress.status)}
              label={scanProgress.status}
              size="sm"
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Size</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatBytes(volume.total_size || 0)}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Files</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatNumber(volume.file_count || 0)}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Folders</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatNumber(volume.folder_count || 0)}
            </p>
          </div>
        </div>

        {scanProgress && (isScanning || isPaused) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {getPhaseLabel(scanProgress.phase)}
              </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {scanProgress.progress}%
              </span>
            </div>
            
            <ProgressBar
              value={scanProgress.progress}
              max={100}
              variant={isPaused ? 'warning' : 'primary'}
              animated={isScanning}
              size="sm"
            />

            {scanStats && scanStats.length > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{scanStats.join(' • ')}</span>
                {scanProgress.estimatedRemaining && (
                  <span>{formatTimeRemaining(scanProgress.estimatedRemaining)}</span>
                )}
              </div>
            )}

            {scanProgress.currentPath && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {scanProgress.currentPath}
              </div>
            )}

            {scanProgress.errorsCount > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {scanProgress.errorsCount} error{scanProgress.errorsCount !== 1 ? 's' : ''} occurred
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {canStartScan && onScanStart && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onScanStart();
                }}
              >
                Start Scan
              </Button>
            )}
            
            {isScanning && (
              <>
                {onScanPause && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScanPause();
                    }}
                  >
                    Pause
                  </Button>
                )}
                {onScanStop && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScanStop();
                    }}
                  >
                    Stop
                  </Button>
                )}
              </>
            )}

            {isPaused && onScanResume && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onScanResume();
                }}
              >
                Resume
              </Button>
            )}
          </div>

          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
            >
              View Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};