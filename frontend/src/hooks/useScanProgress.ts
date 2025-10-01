import { useRealtime } from '@/providers/realtime';
import { getScanProgressForVolumeAtom } from '@/providers/realtime/atoms';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';

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
  const progress = useAtomValue(getScanProgressForVolumeAtom(volumeId));

  // Debug logging for all progress data
  console.log(`[useScanProgress] ${volumeId} progress:`, progress);

  // Subscribe to WebSocket updates for this volume
  useEffect(() => {
    if (!isConnected || !volumeId) return;

    // Subscribe to scan updates for this volume
    sendMessage({
      action: 'subscribe',
      event: 'scan.progress',
      filters: { volume_id: volumeId },
    });

    // Request current scan status on mount
    sendMessage({
      action: 'get_scan_status',
      volume_id: volumeId,
    });

    return () => {
      // Unsubscribe when component unmounts or volumeId changes
      sendMessage({
        action: 'unsubscribe',
        event: 'scan.progress',
        filters: { volume_id: volumeId },
      });
    };
  }, [volumeId, isConnected, sendMessage]);

  return {
    progress,
    isScanning: progress?.status === 'running',
    isConnected,
  };
}
