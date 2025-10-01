import { useScanProgress } from '@/hooks/useScanProgress';
import { cn } from '@/utils';

interface ScanProgressBarProps {
  volumeId: string;
  className?: string;
  volumeStatus?: string; // Volume status to check if untracked
}

/**
 * Simple progress bar that appears as a bottom border on volume rows during scanning
 */
export function ScanProgressBar({
  volumeId,
  className,
  volumeStatus,
}: ScanProgressBarProps) {
  const { progress, isScanning } = useScanProgress(volumeId);

  // Temporary debug logging to help verify progress data
  console.log(`[ScanProgressBar] ${volumeId}: `, {
    progress: (progress as any)?.overall_progress,
    status: (progress as any)?.overall_status,
    isScanning,
    hasProgress: !!progress,
    fullProgress: progress,
  });

  try {
    // Handle both normalized progress (ScanProgress) and raw realtime data (ScanProgressData)
    const effectiveProgress =
      (progress as any)?.overall_progress ??
      (progress as any)?.overallProgress ??
      0;
    const effectiveStatus =
      (progress as any)?.overall_status ?? (progress as any)?.status;

    // Show progress bar when we have any progress data from WebSocket
    const shouldShow =
      progress &&
      (isScanning ||
        effectiveStatus === 'running' ||
        effectiveStatus === 'completed' ||
        effectiveStatus === 'failed' ||
        effectiveStatus === 'idle' ||
        effectiveStatus === 'active'); // Show for active volumes (WebSocket continuous updates)

    if (!progress || volumeStatus === 'untracked') {
      // No progress data or volume is untracked - don't show progress bar
      return null;
    }

    if (!shouldShow) {
      // For debugging: show a yellow bar if we have progress but shouldShow is false
      return (
        <div className="absolute top-0 left-0 right-0 h-3 bg-yellow-200 z-20">
          <div className="h-full bg-yellow-500 w-full opacity-30" />
          <div className="absolute inset-0 flex items-center justify-start pl-2 text-xs text-black font-bold">
            SHOULDSHOW=FALSE: {effectiveStatus}
          </div>
        </div>
      );
    }

    // Determine bar color - make it clearly visible
    const barColor =
      effectiveStatus === 'completed'
        ? 'bg-green-500' // Bright green for completed
        : effectiveStatus === 'failed'
          ? 'bg-red-500' // Bright red for failed
          : effectiveStatus === 'running'
            ? 'bg-blue-500' // Bright blue for running
            : effectiveStatus === 'active' || effectiveProgress === 100
              ? 'bg-green-500' // Green for active volumes or 100% scanned
              : 'bg-yellow-400'; // Yellow for other states

    return (
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-3 bg-gray-200 z-20', // Temporarily move to TOP and make 3px for visibility
          className,
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out shadow-sm',
            barColor,
          )}
          style={{ width: `${effectiveProgress}%` }}
        />
        {/* Debug text */}
        <div className="absolute inset-0 flex items-center justify-start pl-2 text-xs text-black font-bold">
          {effectiveStatus} - {effectiveProgress}%
        </div>
      </div>
    );
  } catch (error) {
    console.error('ScanProgressBar error:', error);
    return null;
  }
}
