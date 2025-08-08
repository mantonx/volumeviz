/**
 * Real-time scan management hook
 *
 * Provides real-time polling, WebSocket integration, and scan orchestration
 * for VolumeViz visualization components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
  volumesAtom,
  scanLoadingAtom,
  scanResultsAtom,
  scanErrorAtom,
  asyncScansAtom,
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
  volumesLastUpdatedAtom,
} from '../../store/atoms/volumes';
import { useVolumes, useVolumeScanning } from '../../api/services';
import type { VolumeResponse, ScanResponse } from '../../api/client';
import type {
  RealTimeScanOptions,
  RealTimeScanState,
  RealTimeScanReturn,
} from './useRealTimeScans.types';

/**
 * Hook for managing real-time volume scanning and updates
 */
export const useRealTimeScans = (
  options: RealTimeScanOptions = {},
): RealTimeScanReturn => {
  const {
    enablePolling = true,
    pollingInterval = 30000, // 30 seconds
    enableWebSocket = false,
    webSocketUrl,
    maxConcurrentScans = 3,
    onScanComplete,
    onScanError,
    onPollingUpdate,
  } = options;

  // Atoms
  const [volumes, setVolumes] = useAtom(volumesAtom);
  const [scanLoading, setScanLoading] = useAtom(scanLoadingAtom);
  const [scanResults, setScanResults] = useAtom(scanResultsAtom);
  const [scanErrors, setScanErrors] = useAtom(scanErrorAtom);
  const asyncScans = useAtomValue(asyncScansAtom);
  const setLastUpdated = useSetAtom(volumesLastUpdatedAtom);

  const autoRefreshEnabled = useAtomValue(autoRefreshEnabledAtom);
  const autoRefreshInterval = useAtomValue(autoRefreshIntervalAtom);

  // API hooks
  const { fetchVolumes } = useVolumes();
  const { scanVolume } = useVolumeScanning();

  // Internal state
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const webSocketRef = useRef<WebSocket | null>(null);
  const scanQueueRef = useRef<string[]>([]);
  const activeScanCountRef = useRef(0);
  const mountedRef = useRef(true);

  // Real-time state
  const [state, setState] = useState<RealTimeScanState>({
    isActive: false,
    isWebSocketConnected: false,
    activeScans: 0,
    lastUpdate: null,
    status: 'idle',
    error: null,
  });

  // Update active scan count
  const updateActiveScans = useCallback(() => {
    const activeCount = Object.values(scanLoading).filter(Boolean).length;
    activeScanCountRef.current = activeCount;

    if (mountedRef.current) {
      setState((prev) => ({ ...prev, activeScans: activeCount }));
    }
  }, [scanLoading]);

  // Process scan queue
  const processScanQueue = useCallback(async () => {
    if (
      !mountedRef.current ||
      activeScanCountRef.current >= maxConcurrentScans ||
      scanQueueRef.current.length === 0
    ) {
      return;
    }

    const volumeId = scanQueueRef.current.shift();
    if (!volumeId) return;

    try {
      activeScanCountRef.current++;
      updateActiveScans();

      const result = await scanVolume(volumeId);

      if (mountedRef.current) {
        setScanResults((prev) => ({
          ...prev,
          [volumeId]: result,
        }));

        setScanErrors((prev) => ({
          ...prev,
          [volumeId]: null,
        }));

        onScanComplete?.(volumeId, result);
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage =
          error instanceof Error ? error.message : 'Scan failed';
        setScanErrors((prev) => ({
          ...prev,
          [volumeId]: errorMessage,
        }));

        onScanError?.(
          volumeId,
          error instanceof Error ? error : new Error(errorMessage),
        );
      }
    } finally {
      if (mountedRef.current) {
        activeScanCountRef.current--;
        updateActiveScans();
        setScanLoading((prev) => ({
          ...prev,
          [volumeId]: false,
        }));

        // Process next item in queue
        setTimeout(processScanQueue, 100);
      }
    }
  }, [
    maxConcurrentScans,
    scanVolume,
    onScanComplete,
    onScanError,
    updateActiveScans,
    setScanResults,
    setScanErrors,
    setScanLoading,
  ]);

  // Add scan to queue
  const queueScan = useCallback(
    (volumeId: string) => {
      if (!scanQueueRef.current.includes(volumeId) && !scanLoading[volumeId]) {
        scanQueueRef.current.push(volumeId);
        setScanLoading((prev) => ({
          ...prev,
          [volumeId]: true,
        }));
        processScanQueue();
      }
    },
    [scanLoading, setScanLoading, processScanQueue],
  );

  // Polling update handler
  const performPollingUpdate = useCallback(async () => {
    if (!mountedRef.current || !autoRefreshEnabled) return;

    try {
      await fetchVolumes();

      if (mountedRef.current) {
        setLastUpdated(new Date());
        onPollingUpdate?.(volumes);

        setState((prev) => ({
          ...prev,
          lastUpdate: new Date(),
          error: null,
          status: 'connected',
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage =
          error instanceof Error ? error.message : 'Polling failed';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          status: 'error',
        }));
      }
    }
  }, [
    autoRefreshEnabled,
    fetchVolumes,
    setLastUpdated,
    onPollingUpdate,
    volumes,
  ]);

  // WebSocket connection handler
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket || !webSocketUrl) return;

    setState((prev) => ({ ...prev, status: 'connecting' }));

    // Import and use the WebSocket client
    import('../../api/websocket-client').then(({ getWebSocketClient }) => {
      try {
        const wsClient = getWebSocketClient(webSocketUrl);

        // Set up event listeners
        wsClient.on('connected', () => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              isWebSocketConnected: true,
              status: 'connected',
              error: null,
            }));
          }
        });

        wsClient.on('disconnected', () => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              isWebSocketConnected: false,
              status: 'idle',
            }));
          }
        });

        wsClient.on('error', (error) => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              error: error.message || 'WebSocket connection error',
              status: 'error',
            }));
          }
        });

        wsClient.on('volume_update', (volumes) => {
          if (!mountedRef.current) return;

          setVolumes(volumes);
          setLastUpdated(new Date());
          onPollingUpdate?.(volumes);
          setState((prev) => ({ ...prev, lastUpdate: new Date() }));
        });

        wsClient.on('scan_complete', ({ volume_id, result }) => {
          if (!mountedRef.current) return;

          setScanResults((prev) => ({
            ...prev,
            [volume_id]: result,
          }));
          setScanLoading((prev) => ({
            ...prev,
            [volume_id]: false,
          }));
          onScanComplete?.(volume_id, result);
        });

        wsClient.on('scan_progress', ({ volume_id, progress }) => {
          if (!mountedRef.current) return;

          // Handle scan progress updates
          console.log(`Scan progress for ${volume_id}: ${progress}%`);
        });

        wsClient.on('scan_error', ({ volume_id, error }) => {
          if (!mountedRef.current) return;

          setScanErrors((prev) => ({
            ...prev,
            [volume_id]: error,
          }));
          setScanLoading((prev) => ({
            ...prev,
            [volume_id]: false,
          }));
          onScanError?.(volume_id, new Error(error));
        });

        wsClient.on('reconnecting', ({ attempt, delay }) => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              status: 'reconnecting',
              error: `Reconnecting... (attempt ${attempt})`,
            }));
          }
        });

        // Connect
        wsClient.connect();
        webSocketRef.current = wsClient as any;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: 'Failed to create WebSocket connection',
          status: 'error',
        }));
      }
    });
  }, [
    enableWebSocket,
    webSocketUrl,
    setVolumes,
    setLastUpdated,
    setScanResults,
    setScanErrors,
    setScanLoading,
    onPollingUpdate,
    onScanComplete,
    onScanError,
  ]);

  // Start real-time updates
  const startRealTimeUpdates = useCallback(() => {
    setState((prev) => ({ ...prev, isActive: true, status: 'connecting' }));

    // Start polling
    if (enablePolling && autoRefreshEnabled) {
      const effectiveInterval = pollingInterval || autoRefreshInterval;
      pollingIntervalRef.current = setInterval(
        performPollingUpdate,
        effectiveInterval,
      );
      // Perform initial update
      performPollingUpdate();
    }

    // Connect WebSocket
    if (enableWebSocket) {
      connectWebSocket();
    }
  }, [
    enablePolling,
    enableWebSocket,
    autoRefreshEnabled,
    pollingInterval,
    autoRefreshInterval,
    performPollingUpdate,
    connectWebSocket,
  ]);

  // Stop real-time updates
  const stopRealTimeUpdates = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      isWebSocketConnected: false,
      status: 'idle',
    }));

    // Clear polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Disconnect WebSocket
    if (webSocketRef.current) {
      // Import and close WebSocket client
      import('../../api/websocket-client').then(({ closeWebSocketClient }) => {
        closeWebSocketClient();
        webSocketRef.current = null;
      });
    }
  }, []);

  // Scan all volumes
  const scanAllVolumes = useCallback(() => {
    volumes.forEach((volume) => {
      if (volume.id) {
        queueScan(volume.id);
      }
    });
  }, [volumes, queueScan]);

  // Force refresh
  const forceRefresh = useCallback(async () => {
    await performPollingUpdate();
  }, [performPollingUpdate]);

  // Setup and cleanup
  useEffect(() => {
    mountedRef.current = true;

    if (autoRefreshEnabled) {
      startRealTimeUpdates();
    }

    return () => {
      mountedRef.current = false;
      stopRealTimeUpdates();
    };
  }, [autoRefreshEnabled, startRealTimeUpdates, stopRealTimeUpdates]);

  // Update active scans when scan loading changes
  useEffect(() => {
    updateActiveScans();
  }, [scanLoading, updateActiveScans]);

  return {
    // State
    ...state,

    // Actions
    startRealTimeUpdates,
    stopRealTimeUpdates,
    queueScan,
    scanAllVolumes,
    forceRefresh,

    // Data
    volumes,
    scanResults,
    scanErrors,
    asyncScans,
  };
};

export default useRealTimeScans;
