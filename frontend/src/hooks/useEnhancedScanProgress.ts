import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import type { ComprehensiveScanProgress } from '../components/ui/MultiPhaseProgressBar/MultiPhaseProgressBar.types';

interface UseEnhancedScanProgressOptions {
  /** Polling interval for historical data (in ms) */
  pollInterval?: number;
  /** Enable automatic refresh of historical data */
  enablePolling?: boolean;
  /** Callback when progress updates */
  onProgressUpdate?: (progress: ComprehensiveScanProgress) => void;
  /** Callback when scan completes */
  onScanComplete?: (scanId: string) => void;
  /** Callback when scan fails */
  onScanError?: (scanId: string, error: string) => void;
}

interface UseEnhancedScanProgressReturn {
  /** Current progress data */
  progress: ComprehensiveScanProgress | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Whether connected to WebSocket for real-time updates */
  isConnected: boolean;
  /** Manually refresh progress data */
  refresh: () => Promise<void>;
  /** Clear current progress data */
  clear: () => void;
}

/**
 * Enhanced hook for managing scan progress data with real-time WebSocket updates
 *
 * Features:
 * - Real-time WebSocket progress updates
 * - Historical data fetching for completed scans
 * - Automatic fallback polling when WebSocket disconnected
 * - Error handling and retry logic
 * - Progress caching and optimization
 */
export const useEnhancedScanProgress = (
  volumeId?: string,
  scanId?: string,
  options: UseEnhancedScanProgressOptions = {},
): UseEnhancedScanProgressReturn => {
  const {
    pollInterval = 2000,
    enablePolling = true,
    onProgressUpdate,
    onScanComplete,
    onScanError,
  } = options;

  const [progress, setProgress] = useState<ComprehensiveScanProgress | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const { isConnected, on, off } = useWebSocket();

  // Fetch historical progress data
  const fetchProgress = useCallback(async () => {
    if (!scanId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/scans/${scanId}/progress`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch progress: ${response.status} ${response.statusText}`,
        );
      }

      const data: ComprehensiveScanProgress = await response.json();
      setProgress(data);
      setLastFetchTime(Date.now());

      onProgressUpdate?.(data);

      // Handle completion callbacks
      if (data.overall_status === 'completed') {
        onScanComplete?.(scanId);
      } else if (data.overall_status === 'failed') {
        onScanError?.(scanId, 'Scan failed');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch progress';
      setError(errorMessage);
      console.error('Failed to fetch scan progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [scanId, onProgressUpdate, onScanComplete, onScanError]);

  // Handle real-time WebSocket updates
  useEffect(() => {
    if (!isConnected || (!volumeId && !scanId)) return;

    const handleProgressUpdate = (data: ComprehensiveScanProgress) => {
      // Filter by volume_id or scan_id
      const isRelevantUpdate =
        (volumeId && data.volume_id === volumeId) ||
        (scanId && data.scan_id === scanId);

      if (isRelevantUpdate) {
        setProgress(data);
        setLastFetchTime(Date.now());
        setError(null); // Clear any existing errors
        onProgressUpdate?.(data);

        // Handle completion callbacks
        if (data.overall_status === 'completed') {
          onScanComplete?.(data.scan_id);
        } else if (data.overall_status === 'failed') {
          onScanError?.(data.scan_id, 'Scan failed');
        }
      }
    };

    const handleScanComplete = (data: {
      scan_id: string;
      volume_id: string;
    }) => {
      const isRelevantEvent =
        (volumeId && data.volume_id === volumeId) ||
        (scanId && data.scan_id === scanId);

      if (isRelevantEvent) {
        onScanComplete?.(data.scan_id);
        // Fetch final progress state
        fetchProgress();
      }
    };

    const handleScanError = (data: {
      scan_id: string;
      volume_id: string;
      error: string;
    }) => {
      const isRelevantEvent =
        (volumeId && data.volume_id === volumeId) ||
        (scanId && data.scan_id === scanId);

      if (isRelevantEvent) {
        onScanError?.(data.scan_id, data.error);
        setError(data.error);
      }
    };

    // Subscribe to WebSocket events
    on('scan_progress', handleProgressUpdate);
    on('scan_complete', handleScanComplete);
    on('scan_error', handleScanError);

    // Cleanup function
    return () => {
      off('scan_progress', handleProgressUpdate);
      off('scan_complete', handleScanComplete);
      off('scan_error', handleScanError);
    };
  }, [
    isConnected,
    volumeId,
    scanId,
    onProgressUpdate,
    onScanComplete,
    onScanError,
    fetchProgress,
    on,
    off,
  ]);

  // Initial data fetch
  useEffect(() => {
    if (scanId && !progress) {
      fetchProgress();
    }
  }, [scanId, progress, fetchProgress]);

  // Polling fallback when WebSocket is disconnected
  useEffect(() => {
    if (!enablePolling || isConnected || !scanId) return;

    const shouldPoll =
      progress?.overall_status === 'running' ||
      progress?.overall_status === 'pending' ||
      !progress;

    if (!shouldPoll) return;

    const pollTimer = setInterval(() => {
      // Only poll if we haven't received recent data
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      if (timeSinceLastFetch >= pollInterval) {
        fetchProgress();
      }
    }, pollInterval);

    return () => clearInterval(pollTimer);
  }, [
    enablePolling,
    isConnected,
    scanId,
    pollInterval,
    lastFetchTime,
    progress,
    fetchProgress,
  ]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchProgress();
  }, [fetchProgress]);

  // Clear function
  const clear = useCallback(() => {
    setProgress(null);
    setError(null);
    setLastFetchTime(0);
  }, []);

  return {
    progress,
    isLoading,
    error,
    isConnected,
    refresh,
    clear,
  };
};

export default useEnhancedScanProgress;
