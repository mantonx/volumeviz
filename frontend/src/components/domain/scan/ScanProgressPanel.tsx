import React from 'react';
import { X, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useScanProgress, type ScanPhase } from '@/hooks/useScanProgress';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { formatBytes, formatDuration } from '@/utils/format';
import { cn } from '@/utils';

interface ScanProgressPanelProps {
  volumeId: string;
  onClose?: () => void;
  autoClose?: boolean; // Auto-close when scan completes
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
}

function PhaseRow({ phase }: { phase: ScanPhase }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(phase.status)}
          <span className="font-medium">{phase.name}</span>
        </div>
        <Badge
          variant={
            phase.status === 'running'
              ? 'primary'
              : phase.status === 'completed'
                ? 'success'
                : phase.status === 'failed'
                  ? 'error'
                  : 'secondary'
          }
        >
          {phase.status === 'running'
            ? `${phase.progress}%`
            : phase.status === 'completed'
              ? 'Done'
              : phase.status === 'failed'
                ? 'Failed'
                : 'Pending'}
        </Badge>
      </div>

      {phase.status !== 'pending' && (
        <>
          <ProgressBar
            value={phase.progress}
            variant={phase.status === 'failed' ? 'error' : 'info'}
          />
          <div className="text-sm text-gray-600">
            {phase.itemsProcessed.toLocaleString()} /{' '}
            {phase.itemsTotal.toLocaleString()} items
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Detailed scan progress panel with phases, performance stats, and overall progress
 */
export function ScanProgressPanel({
  volumeId,
  onClose,
  autoClose = false,
}: ScanProgressPanelProps) {
  const { progress, isScanning, isLoading } = useScanProgress(volumeId);

  // Auto-close when scan completes
  React.useEffect(() => {
    if (autoClose && progress?.status === 'completed' && onClose) {
      const timer = setTimeout(onClose, 2000); // Close after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [autoClose, progress?.status, onClose]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <Activity className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading scan progress...
        </div>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          No scan in progress for this volume
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {getStatusIcon(progress.status)}
          <div>
            <h3 className="font-semibold">Scan Progress</h3>
            <p className="text-sm text-gray-600">
              Volume: {volumeId} • Scan ID:{' '}
              {progress.scan_id?.slice(0, 8) || 'N/A'}...
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Overall Progress */}
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {progress.overall_progress}%
            </span>
          </div>
          <ProgressBar value={progress.overall_progress} size="lg" />
        </div>

        {/* Phases */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Phases</h4>
          {progress.phases.map((phase, index) => (
            <PhaseRow key={index} phase={phase} />
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      {progress.performance_stats && (
        <div className="p-4 border-t bg-gray-50">
          <h4 className="font-medium mb-3">Performance</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Elapsed:</span>
              <div>
                {formatDuration(
                  progress.performance_stats.elapsed_seconds * 1000,
                )}
              </div>
            </div>
            {progress.performance_stats.estimated_remaining_seconds > 0 && (
              <div>
                <span className="font-medium text-gray-600">Remaining:</span>
                <div>
                  {formatDuration(
                    progress.performance_stats.estimated_remaining_seconds *
                      1000,
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Items/sec:</span>
              <div>
                {Math.round(
                  progress.performance_stats.overall_items_per_second,
                )}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Data/sec:</span>
              <div>
                {formatBytes(
                  progress.performance_stats.overall_bytes_per_second,
                )}
                /s
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
