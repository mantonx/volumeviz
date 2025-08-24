import React, { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { MetricCard } from '../../ui/MetricCard';
import { StatusBadge } from '../../ui/StatusBadge';
import { ProgressBar } from '../../ui/ProgressBar';
import { Button } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { formatBytes, formatNumber } from '../../../utils';
import type {
  ScanManagerDashboardProps,
  ScanOperation,
} from './ScanManagerDashboard.types';

export const ScanManagerDashboard: React.FC<ScanManagerDashboardProps> = ({
  scans,
  systemMetrics,
  onScanPause,
  onScanResume,
  onScanStop,
  onScanRetry,
  onViewScanDetails,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
  className,
  testId = 'scan-manager-dashboard',
}) => {
  const activeScans = useMemo(
    () => scans.filter((s) => s.status === 'running' || s.status === 'paused'),
    [scans],
  );

  const queuedScans = useMemo(
    () => scans.filter((s) => s.status === 'pending'),
    [scans],
  );

  const completedScans = useMemo(
    () => scans.filter((s) => s.status === 'completed'),
    [scans],
  );

  const failedScans = useMemo(
    () => scans.filter((s) => s.status === 'failed'),
    [scans],
  );

  const hasActiveScans = activeScans.length > 0;
  const hasCompletedScans = completedScans.length > 0;

  const getStatusVariant = (status: ScanOperation['status']) => {
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

  const getPhaseLabel = (phase?: string) => {
    switch (phase) {
      case 'volume_scan':
        return 'Volume Scan';
      case 'filesystem_indexing':
        return 'File Indexing';
      case 'media_enrichment':
        return 'Media Enrichment';
      default:
        return 'Processing';
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '-';

    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const columns = [
    {
      key: 'volumeName',
      header: 'Volume',
      render: (scan: ScanOperation) => (
        <div className="font-medium">{scan.volumeName}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (scan: ScanOperation) => (
        <StatusBadge
          variant={getStatusVariant(scan.status)}
          label={scan.status}
          size="sm"
        />
      ),
    },
    {
      key: 'phase',
      header: 'Phase',
      render: (scan: ScanOperation) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {getPhaseLabel(scan.phase)}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (scan: ScanOperation) => (
        <div className="w-32">
          <ProgressBar
            value={scan.progress}
            max={100}
            variant={scan.status === 'paused' ? 'warning' : 'primary'}
            animated={scan.status === 'running'}
            size="sm"
            showLabel
          />
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Statistics',
      render: (scan: ScanOperation) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {scan.filesScanned !== undefined && (
            <div>{formatNumber(scan.filesScanned)} files</div>
          )}
          {scan.filesPerSecond !== undefined && scan.filesPerSecond > 0 && (
            <div>{formatNumber(scan.filesPerSecond)} files/s</div>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (scan: ScanOperation) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatDuration(scan.startedAt, scan.completedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (scan: ScanOperation) => (
        <div className="flex items-center space-x-2">
          {scan.status === 'running' && (
            <>
              {onScanPause && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScanPause(scan.scanId)}
                >
                  Pause
                </Button>
              )}
              {onScanStop && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScanStop(scan.scanId)}
                >
                  Stop
                </Button>
              )}
            </>
          )}
          {scan.status === 'paused' && onScanResume && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onScanResume(scan.scanId)}
            >
              Resume
            </Button>
          )}
          {scan.status === 'failed' && onScanRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onScanRetry(scan.scanId)}
            >
              Retry
            </Button>
          )}
          {onViewScanDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewScanDetails(scan.scanId)}
            >
              Details
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={className} data-testid={testId}>
      {systemMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Active Scans"
            value={systemMetrics.activeScans}
            trend={systemMetrics.activeScans > 0 ? 'up' : undefined}
            trendValue={
              systemMetrics.activeScans > 0
                ? `${systemMetrics.activeScans} running`
                : undefined
            }
          />
          <MetricCard
            title="Queued Scans"
            value={systemMetrics.queuedScans}
            trend={systemMetrics.queuedScans > 5 ? 'down' : undefined}
            trendValue={
              systemMetrics.queuedScans > 0
                ? `${systemMetrics.queuedScans} waiting`
                : undefined
            }
          />
          <MetricCard
            title="Total Files"
            value={formatNumber(systemMetrics.totalFilesScanned)}
            trend="up"
            trendValue={
              systemMetrics.averageScanSpeed > 0
                ? `${formatNumber(systemMetrics.averageScanSpeed)} files/s`
                : undefined
            }
          />
          <MetricCard
            title="System Load"
            value={
              systemMetrics.systemLoad
                ? `${systemMetrics.systemLoad.toFixed(1)}%`
                : 'N/A'
            }
            trend={
              systemMetrics.systemLoad && systemMetrics.systemLoad > 80
                ? 'down'
                : 'up'
            }
            variant={
              systemMetrics.systemLoad && systemMetrics.systemLoad > 80
                ? 'error'
                : 'success'
            }
          />
        </div>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scan Operations
          </h2>
          <div className="flex items-center space-x-2">
            {hasActiveScans && (
              <>
                {onPauseAll && (
                  <Button variant="secondary" size="sm" onClick={onPauseAll}>
                    Pause All
                  </Button>
                )}
                {onResumeAll && (
                  <Button variant="secondary" size="sm" onClick={onResumeAll}>
                    Resume All
                  </Button>
                )}
              </>
            )}
            {hasCompletedScans && onClearCompleted && (
              <Button variant="ghost" size="sm" onClick={onClearCompleted}>
                Clear Completed
              </Button>
            )}
          </div>
        </div>

        {scans.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No scan operations
          </div>
        ) : (
          <div className="space-y-4">
            {activeScans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Active ({activeScans.length})
                </h3>
                <DataGrid
                  data={activeScans}
                  columns={columns}
                  keyField="scanId"
                />
              </div>
            )}

            {queuedScans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Queued ({queuedScans.length})
                </h3>
                <DataGrid
                  data={queuedScans}
                  columns={columns}
                  keyField="scanId"
                />
              </div>
            )}

            {failedScans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  Failed ({failedScans.length})
                </h3>
                <DataGrid
                  data={failedScans}
                  columns={columns}
                  keyField="scanId"
                />
              </div>
            )}

            {completedScans.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Completed ({completedScans.length})
                </h3>
                <DataGrid
                  data={completedScans.slice(0, 5)}
                  columns={columns}
                  keyField="scanId"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {systemMetrics &&
        (systemMetrics.memoryUsage || systemMetrics.diskIORate) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              System Resources
            </h3>
            <div className="space-y-3">
              {systemMetrics.memoryUsage !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      Memory Usage
                    </span>
                    <span className="font-medium">
                      {systemMetrics.memoryUsage.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={systemMetrics.memoryUsage}
                    max={100}
                    variant={
                      systemMetrics.memoryUsage > 80
                        ? 'error'
                        : systemMetrics.memoryUsage > 60
                          ? 'warning'
                          : 'primary'
                    }
                    size="sm"
                  />
                </div>
              )}
              {systemMetrics.diskIORate !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      Disk I/O
                    </span>
                    <span className="font-medium">
                      {formatBytes(systemMetrics.diskIORate)}/s
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(
                      (systemMetrics.diskIORate / (1024 * 1024 * 100)) * 100,
                      100,
                    )}
                    max={100}
                    variant="primary"
                    size="sm"
                  />
                </div>
              )}
            </div>
          </Card>
        )}
    </div>
  );
};
