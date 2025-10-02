import { useScanProgress } from '@/hooks/useScanProgress';
import { cn } from '@/utils';

interface ScanProgressBarProps {
  volumeId: string;
  className?: string;
  volumeStatus?: string; // Volume status to check if untracked
}

/**
 * Minimal progress indicator that appears at the bottom of volume rows during scanning
 * Shows a sleek 2px progress bar with smooth animations
 */
export function ScanProgressBar({
  volumeId,
  className,
  volumeStatus,
}: ScanProgressBarProps) {
  const { progress, isScanning } = useScanProgress(volumeId);

  if (!progress || volumeStatus === 'untracked') {
    return null;
  }

  // Handle both normalized progress (ScanProgress) and raw realtime data (ScanProgressData)
  const effectiveProgress =
    (progress as any)?.overall_progress ??
    (progress as any)?.overallProgress ??
    0;
  const effectiveStatus =
    (progress as any)?.overall_status ?? (progress as any)?.status;

  // Only show for actively running scans
  if (effectiveStatus !== 'running' && effectiveStatus !== 'pending') {
    return null;
  }

  // Determine bar color
  const barColor =
    effectiveStatus === 'running' || effectiveStatus === 'pending'
      ? 'bg-blue-500 dark:bg-blue-400' // Blue for active scanning
      : 'bg-gray-400 dark:bg-gray-600'; // Gray fallback

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 h-0.5 bg-transparent z-10 pointer-events-none',
        className,
      )}
    >
      <div
        className={cn(
          'h-full transition-all duration-500 ease-out',
          barColor,
        )}
        style={{ width: `${effectiveProgress}%` }}
      />
    </div>
  );
}
