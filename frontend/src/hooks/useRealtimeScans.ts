import { useEffect, useState } from 'react';
import { useRealtime, type ScanProgressData } from '@/providers/realtime';

interface ScanProgress {
  [volumeId: string]: ScanProgressData;
}

interface UseRealtimeScansReturn {
  scanProgress: ScanProgress;
  isConnected: boolean;
}

export const useRealtimeScans = (): UseRealtimeScansReturn => {
  const { isConnected, subscribe, unsubscribe, onScanProgress, onScanEvent } =
    useRealtime();
  const [scanProgress, setScanProgress] = useState<ScanProgress>({});

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to all scan progress updates
    subscribe('scan.progress', {});

    // Listen for scan progress updates
    const cleanupProgress = onScanProgress((data: ScanProgressData) => {
      setScanProgress((prev) => ({
        ...prev,
        [data.volume_id]: data,
      }));
    });

    // Listen for scan events to update progress
    const cleanupEvents = onScanEvent((type: string, data: any) => {
      if (data.volume_id) {
        setScanProgress((prev) => {
          const currentProgress = prev[data.volume_id];
          if (!currentProgress) return prev;

          // Update the progress based on the event
          const updatedProgress: ScanProgressData = {
            ...currentProgress,
            overall_status:
              type === 'started'
                ? 'running'
                : type === 'completed'
                  ? 'completed'
                  : type === 'failed'
                    ? 'failed'
                    : currentProgress.overall_status,
            overall_progress:
              type === 'completed' ? 100 : currentProgress.overall_progress,
          };

          return {
            ...prev,
            [data.volume_id]: updatedProgress,
          };
        });
      }
    });

    return () => {
      cleanupProgress();
      cleanupEvents();
      unsubscribe('scan.progress', {});
    };
  }, [isConnected, subscribe, unsubscribe, onScanProgress, onScanEvent]);

  return {
    scanProgress,
    isConnected,
  };
};
