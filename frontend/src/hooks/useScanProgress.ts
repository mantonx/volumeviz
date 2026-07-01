import { useRealtime } from '@/providers/realtime';
import { getScanProgressForVolumeAtom } from '@/providers/realtime/atoms';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';

export interface ScanPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  itemsProcessed: number;
  itemsTotal: number;
}

export interface PerformanceStats {
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  itemsPerSecond: number;
  bytesPerSecond: number;
}

export interface ScanProgress {
  scanId: string;
  volumeId: string;
  status: 'running' | 'completed' | 'failed';
  overallProgress: number;
  phases: ScanPhase[];
  startedAt: string;
  completedAt?: string;
  performanceStats?: PerformanceStats;
}

/**
 * Hook to track scan progress for a specific volume via WebSocket
 *
 * @param volumeId - The ID of the volume to track scan progress for
 * @returns Object containing scan progress data and scanning status
 */
export function useScanProgress(volumeId: string) {
  const { sendMessage, isConnected } = useRealtime();

  // Get realtime progress data from WebSocket via Jotai atom
  // Memoize the atom to prevent creating a new atom on every render
  const progressAtom = useMemo(
    () => getScanProgressForVolumeAtom(volumeId),
    [volumeId],
  );
  const progress = useAtomValue(progressAtom);

  // Request current scan status when volume is first displayed
  // Note: Global subscription in RealtimeProvider already receives ALL scan updates
  useEffect(() => {
    if (!isConnected || !volumeId) {
      return;
    }

    // Request current scan status on mount (only if not already in cache)
    if (!progress) {
      sendMessage({
        action: 'get_scan_status',
        volume_id: volumeId,
      });
    }
  }, [volumeId, isConnected, sendMessage, progress]);

  return {
    progress,
    isScanning: progress?.overall_status === 'running',
    isConnected,
  };
}
