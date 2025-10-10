import { useScanProgress } from '@/hooks/useScanProgress';
import { cn } from '@/utils';
import { formatBytes } from '@/utils/formatters';
import { Clock, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ScanProgressData, ScanPhaseProgress } from '@/providers/realtime/types';

interface ScanProgressDetailProps {
  volumeId: string;
  volumeName?: string;
  className?: string;
}

/**
 * Detailed scan progress display showing phases, performance stats, and current progress
 */
export function ScanProgressDetail({
  volumeId,
  volumeName,
  className,
}: ScanProgressDetailProps) {
  const { progress, isScanning } = useScanProgress(volumeId);

  if (!progress) {
    return null;
  }

  const scanData = progress as any; // Use any to access all fields
  const {
    overall_status,
    overall_progress,
    phases,
    performance_stats,
    started_at,
    current_path,
    files_scanned,
    folders_scanned,
    bytes_processed,
    total_bytes,
  } = scanData;

  // Don't show if not actively scanning
  if (overall_status !== 'running' && overall_status !== 'pending') {
    return null;
  }

  // Filter to only meaningful phases (filesystem_indexing and media_enrichment)
  const meaningfulPhases = phases?.filter((p) =>
    p.phase_name === 'filesystem_indexing' || p.phase_name === 'media_enrichment'
  ) || [];

  // Find all running and pending phases to show status
  const runningPhases = meaningfulPhases.filter((p) => p.status === 'running');
  const pendingPhases = meaningfulPhases.filter((p) => p.status === 'pending');
  const completedPhases = meaningfulPhases.filter((p) => p.status === 'completed').length || 0;
  const totalPhases = meaningfulPhases.length || 0;

  // Check if scan just started (all phases pending, 0% progress, no items processed)
  const allPhasesPending = meaningfulPhases.every((p) => p.status === 'pending');
  const hasNoProgress = overall_progress === 0 && meaningfulPhases.every((p) => p.progress === 0);
  const scanJustStarted = allPhasesPending && hasNoProgress;

  // Calculate total stats from all phases
  const totalFilesProcessed = phases?.reduce((sum, p) => sum + (p.items_processed || 0), 0) || files_scanned || 0;
  const totalFoldersProcessed = folders_scanned || 0;
  const totalBytesProcessed = phases?.reduce((sum, p) => sum + (p.bytes_processed || 0), 0) || bytes_processed || 0;
  const totalBytesTotal = phases?.reduce((sum, p) => sum + (p.bytes_total || 0), 0) || total_bytes || 0;

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
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
  };

  return (
    <div className={cn('bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
          <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            Scanning {volumeName || volumeId}
          </span>
        </div>
        <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
          {Math.round(overall_progress)}%
        </span>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${overall_progress}%` }}
          />
        </div>
      </div>

      {/* Scan Statistics */}
      <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {totalFilesProcessed > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
            <div className="text-gray-500 dark:text-gray-400">Items Processed</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {totalFilesProcessed.toLocaleString()}
            </div>
          </div>
        )}
        {totalBytesProcessed > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
            <div className="text-gray-500 dark:text-gray-400">Data Processed</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatBytes(totalBytesProcessed)}
            </div>
          </div>
        )}
        {totalBytesTotal > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
            <div className="text-gray-500 dark:text-gray-400">Total Size</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatBytes(totalBytesTotal)}
            </div>
          </div>
        )}
        {performance_stats?.elapsed_seconds && (
          <div className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
            <div className="text-gray-500 dark:text-gray-400">Elapsed Time</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatTimeRemaining(performance_stats.elapsed_seconds)}
            </div>
          </div>
        )}
      </div>

      {/* Running Phases - Show all running phases simultaneously */}
      {runningPhases.map((phase, index) => (
        <div key={phase.phase_name} className="mb-3 bg-white dark:bg-gray-800 rounded p-3 border border-blue-100 dark:border-blue-900">
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
              style={{ width: `${phase.progress}%` }}
            />
          </div>

          {/* Current Sub-Phase - Show prominently if present */}
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

            {phase.items_per_second > 0 && (
              <div>
                {Math.round(phase.items_per_second)} items/sec
              </div>
            )}

            {phase.bytes_per_second > 0 && (
              <div>
                {formatBytes(phase.bytes_per_second)}/sec
              </div>
            )}
          </div>

          {/* Current Item */}
          {phase.current_item && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
              {/* Clean up current_item by removing prefixes like [filesystem_walking] or "Processing:" */}
              {phase.current_item
                .replace(/^\[.*?\]\s*/, '') // Remove [brackets] prefix
                .replace(/^Processing:\s*/, '') // Remove "Processing:" prefix
                .trim()}
            </div>
          )}
        </div>
      ))}

      {/* Performance Stats - Only show when we have meaningful data */}
      {performance_stats && !scanJustStarted && (
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          {performance_stats.estimated_remaining_seconds > 0 && performance_stats.overall_items_per_second > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeRemaining(performance_stats.estimated_remaining_seconds)}</span>
            </div>
          )}

          {performance_stats.overall_items_per_second > 0 && (
            <div>
              {Math.round(performance_stats.overall_items_per_second)} items/sec avg
            </div>
          )}
        </div>
      )}

      {/* Initial state message when scan just started */}
      {scanJustStarted && (
        <div className="text-xs text-gray-700 dark:text-gray-300 italic font-medium">
          Initializing scan...
        </div>
      )}

      {/* All Phases Summary - Only show meaningful phases */}
      {phases && phases.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 gap-2">
            {phases
              .filter((phase) =>
                phase.phase_name === 'filesystem_indexing' ||
                phase.phase_name === 'media_enrichment'
              )
              .map((phase, idx) => (
                <PhaseIndicator key={idx} phase={phase} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: ScanPhaseProgress }) {
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
}

function formatPhaseName(name: string): string {
  // Convert snake_case to Title Case
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSubPhaseName(name: string): string {
  // Format sub-phase names to be more user-friendly
  const formatted = name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Special cases for better readability - filesystem indexing sub-phases
  if (name === 'database_reconciliation') return 'Reconciling';
  if (name === 'filesystem_walking') return 'Scanning Files';
  if (name === 'preparation') return 'Preparing';

  // Media enrichment sub-phases (enricher names)
  if (name === 'ffprobe') return 'Extracting Media Info';
  if (name === 'exif' || name === 'exiftool') return 'Reading Image Metadata';
  if (name === 'subtitle') return 'Parsing Subtitles';

  return formatted;
}
