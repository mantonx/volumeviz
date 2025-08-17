import {
    scanStatusAtomFamily,
    scanStatusErrorAtomFamily,
    scanStatusLoadingAtomFamily,
    setScanErrorAtom,
    startScanTrackingAtom,
    stopScanTrackingAtom,
    updateScanStatusAtom,
    type ScanStatus,
} from '@/store/atoms/scanStatus';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { usePolling } from './usePolling';

export interface UseScanStatusOptions {
  scanId: string;
  volumeId?: string;
  enabled?: boolean;
  onComplete?: (result: ScanStatus) => void;
  onError?: (error: string) => void;
}

export function useScanStatus({
  scanId,
  volumeId,
  enabled = true,
  onComplete,
  onError,
}: UseScanStatusOptions) {
  const scanStatus = useAtomValue(scanStatusAtomFamily(scanId));
  const [isLoading, setIsLoading] = useAtom(
    scanStatusLoadingAtomFamily(scanId),
  );
  const errorState = useAtomValue(scanStatusErrorAtomFamily(scanId));

  const startTracking = useSetAtom(startScanTrackingAtom);
  const stopTracking = useSetAtom(stopScanTrackingAtom);
  const updateStatus = useSetAtom(updateScanStatusAtom);
  const setError = useSetAtom(setScanErrorAtom);

  // For now, we'll assume online status. In the future, this could check network connectivity
  const isOnline = true;
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Check if WebSocket is enabled via environment variable
  const isWebSocketEnabled = import.meta.env.VITE_ENABLE_WEBSOCKET === 'true';

  // Polling configuration based on scan status
  const getPollingInterval = useCallback(() => {
    if (!scanStatus) return 2000; // Default 2s for new scans

    switch (scanStatus.status) {
      case 'running':
        return 1000; // Fast polling for active scans
      case 'pending':
        return 2000; // Medium polling for pending
      case 'completed':
      case 'failed':
      case 'cancelled':
        return 0; // Stop polling for finished scans
      default:
        return 2000;
    }
  }, [scanStatus]);

  // Fetch scan status from API
  const fetchScanStatus = useCallback(async (): Promise<void> => {
    if (!enabled || !isOnline) return;

    try {
      setIsLoading(true);

      // Use MSW in development, real API in production
      const response = await fetch(`/api/scans/${scanId}/status`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform API response to ScanStatus
      const status: ScanStatus = {
        scan_id: data.scan_id || scanId,
        volume_id: data.volume_id || volumeId || '',
        status: data.status || 'pending',
        progress: data.progress,
        started_at: data.started_at,
        completed_at: data.completed_at,
        error_message: data.error_message,
        result: data.result,
      };

      // Update the status
      updateStatus({ scanId, status });
      setLastFetchTime(Date.now());

      // Call completion callback
      if (status.status === 'completed' && onComplete) {
        onComplete(status);
      }

      console.debug('Scan status updated:', {
        scanId,
        status: status.status,
        progress: status.progress,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError({ scanId, error: message });

      if (onError) {
        onError(message);
      }

      console.error('Failed to fetch scan status:', { scanId, error: message });
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    isOnline,
    scanId,
    volumeId,
    setIsLoading,
    updateStatus,
    setError,
    onComplete,
    onError,
  ]);

  // Handle polling errors
  const handlePollingError = useCallback(
    (error: Error) => {
      const message = error.message;
      setError({ scanId, error: message });

      if (onError) {
        onError(message);
      }
    },
    [scanId, setError, onError],
  );

  // Use polling hook for status updates
  const polling = usePolling({
    pollFn: fetchScanStatus,
    enabled: enabled && !isWebSocketEnabled && isOnline,
    interval: getPollingInterval(),
    onError: handlePollingError,
    startOnMount: true,
  });

  // Initialize scan tracking when component mounts
  useEffect(() => {
    if (enabled && volumeId) {
      startTracking({ scanId, volumeId });
      console.debug('Started tracking scan:', { scanId, volumeId });
    }

    return () => {
      if (enabled) {
        stopTracking(scanId);
        console.debug('Stopped tracking scan:', { scanId });
      }
    };
  }, [enabled, scanId, volumeId, startTracking, stopTracking]);

  // Start scan function
  const startScan = useCallback(
    async (volumeIdToScan: string): Promise<string> => {
      if (!isOnline) {
        throw new Error('Cannot start scan while offline');
      }

      try {
        setIsLoading(true);

        const response = await fetch(`/api/volumes/${volumeIdToScan}/scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ async: true }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const newScanId = data.scan_id || data.id;

        // Start tracking the new scan
        startTracking({ scanId: newScanId, volumeId: volumeIdToScan });

        console.info('Scan started:', {
          scanId: newScanId,
          volumeId: volumeIdToScan,
        });

        return newScanId;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start scan';
        setError({ scanId, error: message });
        console.error('Failed to start scan:', { scanId, error: message });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [isOnline, scanId, setIsLoading, setError, startTracking],
  );

  // Cancel scan function
  const cancelScan = useCallback(async (): Promise<void> => {
    if (!isOnline) {
      throw new Error('Cannot cancel scan while offline');
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/scans/${scanId}/cancel`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update status to cancelled
      updateStatus({
        scanId,
        status: { status: 'cancelled', completed_at: new Date().toISOString() },
      });

      console.info('Scan cancelled:', { scanId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to cancel scan';
      setError({ scanId, error: message });
      console.error('Failed to cancel scan:', { scanId, error: message });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, scanId, setIsLoading, setError, updateStatus]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (!enabled || !isOnline) return;
    await fetchScanStatus();
  }, [enabled, isOnline, fetchScanStatus]);

  return {
    // Status data
    scanStatus,
    isLoading: isLoading || polling.state.isPolling,
    error: errorState || null,

    // Computed status flags
    isPending: scanStatus?.status === 'pending',
    isRunning: scanStatus?.status === 'running',
    isCompleted: scanStatus?.status === 'completed',
    isFailed: scanStatus?.status === 'failed',
    isCancelled: scanStatus?.status === 'cancelled',
    isFinished: ['completed', 'failed', 'cancelled'].includes(
      scanStatus?.status || '',
    ),

    // Progress information
    progress: scanStatus?.progress,
    startedAt: scanStatus?.started_at ? new Date(scanStatus.started_at) : null,
    completedAt: scanStatus?.completed_at
      ? new Date(scanStatus.completed_at)
      : null,
    duration:
      scanStatus?.started_at && scanStatus?.completed_at
        ? new Date(scanStatus.completed_at).getTime() -
          new Date(scanStatus.started_at).getTime()
        : null,

    // Actions
    startScan,
    cancelScan,
    refetch,

    // Metadata
    isPollingEnabled: enabled && !isWebSocketEnabled && isOnline,
    isWebSocketMode: isWebSocketEnabled,
    lastFetchTime: lastFetchTime > 0 ? new Date(lastFetchTime) : null,
    polling,
  };
}
