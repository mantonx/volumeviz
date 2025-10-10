import React, { useMemo } from 'react';
import { useScanProgress } from '@/hooks/useScanProgress';
import { cn } from '@/utils';
import { formatBytes } from '@/utils/formatters';
import { Clock, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ScanPhaseProgress } from '@/providers/realtime/types';

interface ScanProgressDetailProps {
  volumeId: string;
  volumeName?: string;
  className?: string;
}

/**
 * Detailed scan progress display showing phases, performance stats, and current progress
 *
 * Key improvements:
 * - All hooks at top level (no conditional hooks)
 * - Phase sorting ensures consistent order (filesystem_indexing first)
 * - Improved accessibility colors
 * - Memoized calculations to prevent unnecessary re-renders
 */
export function ScanProgressDetail({
  volumeId,
  volumeName,
  className,
}: ScanProgressDetailProps) {
  // ALL HOOKS AT TOP LEVEL - Never conditional
  const { progress } = useScanProgress(volumeId);

  // Memoize all expensive calculations
  const scanData = useMemo(() => {
    if (!progress) return null;

    const data = progress as any;
    const phases = data.phases || [];

    // Sort phases consistently: filesystem_indexing first, then media_enrichment
    const sortedPhases = [...phases].sort((a, b) => {
      const order: Record<string, number> = {
        'filesystem_indexing': 0,
        'media_enrichment': 1,
      };
      const orderA = order[a.phase_name] ?? 999;
      const orderB = order[b.phase_name] ?? 999;
      return orderA - orderB;
    });

    // Filter to meaningful phases
    const meaningfulPhases = sortedPhases.filter(
      (p) => p.phase_name === 'filesystem_indexing' || p.phase_name === 'media_enrichment'
    );

    const runningPhases = meaningfulPhases.filter((p) => p.status === 'running');
    const allPhasesPending = meaningfulPhases.every((p) => p.status === 'pending');
    const hasNoProgress = (data.overall_progress || 0) === 0 && meaningfulPhases.every((p) => p.progress === 0);
    const scanJustStarted = allPhasesPending && hasNoProgress;

    const totalFilesProcessed = phases.reduce((sum: number, p: any) => sum + (p.items_processed || 0), 0) || data.files_scanned || 0;
    const totalBytesProcessed = phases.reduce((sum: number, p: any) => sum + (p.bytes_processed || 0), 0) || data.bytes_processed || 0;
    const totalBytesTotal = phases.reduce((sum: number, p: any) => sum + (p.bytes_total || 0), 0) || data.total_bytes || 0;

    return {
      overall_status: data.overall_status,
      overall_progress: data.overall_progress || 0,
      meaningfulPhases,
      runningPhases,
      scanJustStarted,
      totalFilesProcessed,
      totalBytesProcessed,
      totalBytesTotal,
      performance_stats: data.performance_stats,
    };
  }, [progress]);

  // Early return AFTER all hooks
  if (!scanData) {
    return null;
  }

  if (scanData.overall_status !== 'running' && scanData.overall_status !== 'pending') {
    return null;
  }

  return (
    <div className={cn('bg-blue-50 dark:bg-slate-800 border-2 border-blue-600 dark:border-blue-500 rounded-lg p-4 shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Scanning {volumeName || volumeId}
          </span>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 bg-blue-200 dark:bg-blue-900 px-2 py-1 rounded">
          {Math.round(scanData.overall_progress)}%
        </span>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(scanData.overall_progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Scan Statistics */}
      {!scanData.scanJustStarted && (
        <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {scanData.totalFilesProcessed > 0 && (
            <StatCard label="Items Processed" value={scanData.totalFilesProcessed.toLocaleString()} />
          )}
          {scanData.totalBytesProcessed > 0 && (
            <StatCard label="Data Processed" value={formatBytes(scanData.totalBytesProcessed)} />
          )}
          {scanData.totalBytesTotal > 0 && (
            <StatCard label="Total Size" value={formatBytes(scanData.totalBytesTotal)} />
          )}
          {scanData.performance_stats?.elapsed_seconds && (
            <StatCard label="Elapsed Time" value={formatTimeRemaining(scanData.performance_stats.elapsed_seconds)} />
          )}
        </div>
      )}

      {/* Running Phases */}
      {scanData.runningPhases.map((phase) => (
        <PhaseDisplay key={phase.phase_name} phase={phase} />
      ))}

      {/* Performance Stats */}
      {scanData.performance_stats && !scanData.scanJustStarted && (
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
          {scanData.performance_stats.estimated_remaining_seconds > 0 && scanData.performance_stats.overall_items_per_second > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeRemaining(scanData.performance_stats.estimated_remaining_seconds)}</span>
            </div>
          )}
          {scanData.performance_stats.overall_items_per_second > 0 && (
            <div>{Math.round(scanData.performance_stats.overall_items_per_second)} items/sec avg</div>
          )}
        </div>
      )}

      {/* Initial state message */}
      {scanData.scanJustStarted && (
        <div className="text-xs text-gray-700 dark:text-gray-300 italic font-medium">
          Initializing scan...
        </div>
      )}

      {/* All Phases Summary */}
      {scanData.meaningfulPhases.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 gap-2">
            {scanData.meaningfulPhases.map((phase) => (
              <PhaseIndicator key={phase.phase_name} phase={phase} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoized sub-components
const StatCard = React.memo<{ label: string; value: string }>(({ label, value }) => (
  <div className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
    <div className="text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
  </div>
));

const PhaseDisplay = React.memo<{ phase: ScanPhaseProgress }>(({ phase }) => (
  <div className="mb-3 bg-white dark:bg-gray-800 rounded p-3 border border-blue-100 dark:border-blue-900">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {formatPhaseName(phase.phase_name)}
      </span>
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {Math.round(phase.progress)}%
      </span>
    </div>

    {/* Phase Progress Bar */}
    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
      <div
        className="h-full bg-blue-500 transition-all duration-300"
        style={{ width: `${Math.min(phase.progress, 100)}%` }}
      />
    </div>

    {/* Current Sub-Phase */}
    {phase.sub_phase && (
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-medium">
          {formatSubPhaseName(phase.sub_phase)}
        </span>
      </div>
    )}

    {/* Phase Details */}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
      {phase.items_total > 0 && (
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>
            {phase.items_processed.toLocaleString()} / {phase.items_total.toLocaleString()} items
          </span>
        </div>
      )}
      {phase.bytes_total > 0 && (
        <div>
          {formatBytes(phase.bytes_processed)} / {formatBytes(phase.bytes_total)}
        </div>
      )}
      {phase.items_per_second > 0 && <div>{Math.round(phase.items_per_second)} items/sec</div>}
      {phase.bytes_per_second > 0 && <div>{formatBytes(phase.bytes_per_second)}/sec</div>}
    </div>

    {/* Current Item */}
    {phase.current_item && (
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
        {phase.current_item.replace(/^\[.*?\]\s*/, '').replace(/^Processing:\s*/, '').trim()}
      </div>
    )}
  </div>
));

const PhaseIndicator = React.memo<{ phase: ScanPhaseProgress }>(({ phase }) => {
  const getIcon = () => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />;
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-400 dark:text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (phase.status) {
      case 'completed':
        return 'text-green-700 dark:text-green-300';
      case 'failed':
        return 'text-red-700 dark:text-red-300';
      case 'running':
        return 'text-blue-700 dark:text-blue-300';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {getIcon()}
      <span className={cn('truncate', getStatusColor())}>
        {formatPhaseName(phase.phase_name)}
      </span>
      {phase.status === 'running' && (
        <span className="text-gray-700 dark:text-gray-300 ml-auto font-medium">
          {Math.round(phase.progress)}%
        </span>
      )}
    </div>
  );
});

// Utility functions
function formatPhaseName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSubPhaseName(name: string): string {
  if (name === 'database_reconciliation') return 'Reconciling';
  if (name === 'filesystem_walking') return 'Scanning Files';
  if (name === 'preparation') return 'Preparing';
  if (name === 'ffprobe') return 'Extracting Media Info';
  if (name === 'exif' || name === 'exiftool') return 'Reading Image Metadata';
  if (name === 'subtitle') return 'Parsing Subtitles';

  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTimeRemaining(seconds: number): string {
  if (!seconds || seconds < 0) return 'Calculating...';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s remaining`;
  } else {
    return `${secs}s remaining`;
  }
}
