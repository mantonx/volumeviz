import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { atom } from 'jotai';
import type { ScanOperation } from '../components/domain/ScanManagerDashboard';

// Atoms for managing scan progress state
const scanOperationsAtom = atom<Record<string, ScanOperation>>({});
const scanWebSocketAtom = atom<WebSocket | null>(null);

type ScanWebSocketMessage = 
  | { type: 'scan_progress', data: ScanOperation }
  | { type: 'scan_started', data: { scanId: string; volumeId: string; volumeName: string } }
  | { type: 'scan_completed', data: { scanId: string; volumeId: string; status: 'completed' | 'failed' } }
  | { type: 'scan_error', data: { scanId: string; volumeId: string; error: string } };

export interface UseScanProgressOptions {
  /** WebSocket URL for scan updates */
  wsUrl?: string;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Reconnection options */
  reconnect?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
  };
}

export interface UseScanProgressReturn {
  /** All active scan operations */
  scanOperations: ScanOperation[];
  /** Get scan progress for specific volume */
  getScanProgress: (volumeId: string) => ScanOperation | undefined;
  /** Start a new scan */
  startScan: (volumeId: string, volumeName: string) => Promise<string>;
  /** Pause a scan */
  pauseScan: (scanId: string) => Promise<void>;
  /** Resume a scan */
  resumeScan: (scanId: string) => Promise<void>;
  /** Stop a scan */
  stopScan: (scanId: string) => Promise<void>;
  /** WebSocket connection status */
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Connect to WebSocket */
  connect: () => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
}

export const useScanProgress = (options: UseScanProgressOptions = {}): UseScanProgressReturn => {
  const {
    wsUrl = `ws://${window.location.host}/api/v1/ws/scan`,
    autoConnect = true,
    reconnect = { enabled: true, maxAttempts: 5, delay: 3000 }
  } = options;

  const [scanOperations, setScanOperations] = useAtom(scanOperationsAtom);
  const [webSocket, setWebSocket] = useAtom(scanWebSocketAtom);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[useScanProgress] WebSocket connected');
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setWebSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const message: ScanWebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'scan_progress':
              setScanOperations(prev => ({
                ...prev,
                [message.data.scanId]: message.data
              }));
              break;
              
            case 'scan_started':
              setScanOperations(prev => ({
                ...prev,
                [message.data.scanId]: {
                  scanId: message.data.scanId,
                  volumeId: message.data.volumeId,
                  volumeName: message.data.volumeName,
                  status: 'running',
                  progress: 0,
                  startedAt: new Date().toISOString(),
                }
              }));
              break;
              
            case 'scan_completed':
              setScanOperations(prev => {
                const scan = prev[message.data.scanId];
                if (scan) {
                  return {
                    ...prev,
                    [message.data.scanId]: {
                      ...scan,
                      status: message.data.status,
                      progress: message.data.status === 'completed' ? 100 : scan.progress,
                      completedAt: new Date().toISOString(),
                    }
                  };
                }
                return prev;
              });
              break;
              
            case 'scan_error':
              setScanOperations(prev => {
                const scan = prev[message.data.scanId];
                if (scan) {
                  return {
                    ...prev,
                    [message.data.scanId]: {
                      ...scan,
                      status: 'failed',
                      errorsCount: (scan.errorsCount || 0) + 1,
                    }
                  };
                }
                return prev;
              });
              break;
          }
        } catch (error) {
          console.error('[useScanProgress] Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[useScanProgress] WebSocket disconnected');
        setConnectionStatus('disconnected');
        setWebSocket(null);

        // Attempt reconnection if enabled
        if (reconnect.enabled && reconnectAttempts < reconnect.maxAttempts) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnect.delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[useScanProgress] WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('[useScanProgress] Failed to create WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [wsUrl, webSocket, reconnect, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (webSocket) {
      webSocket.close();
      setWebSocket(null);
    }
    setConnectionStatus('disconnected');
  }, [webSocket, setWebSocket]);

  const getScanProgress = useCallback((volumeId: string): ScanOperation | undefined => {
    return Object.values(scanOperations).find(scan => scan.volumeId === volumeId);
  }, [scanOperations]);

  const startScan = useCallback(async (volumeId: string, volumeName: string): Promise<string> => {
    try {
      // Make API call to start scan
      const response = await fetch(`/api/v1/volumes/${volumeId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          volumeId,
          volumeName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.statusText}`);
      }

      const result = await response.json();
      return result.scanId;
    } catch (error) {
      console.error('[useScanProgress] Failed to start scan:', error);
      throw error;
    }
  }, []);

  const pauseScan = useCallback(async (scanId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/scans/${scanId}/pause`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to pause scan: ${response.statusText}`);
      }

      // Update local state immediately for better UX
      setScanOperations(prev => {
        const scan = prev[scanId];
        if (scan) {
          return {
            ...prev,
            [scanId]: { ...scan, status: 'paused' }
          };
        }
        return prev;
      });
    } catch (error) {
      console.error('[useScanProgress] Failed to pause scan:', error);
      throw error;
    }
  }, [setScanOperations]);

  const resumeScan = useCallback(async (scanId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/scans/${scanId}/resume`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to resume scan: ${response.statusText}`);
      }

      // Update local state immediately for better UX
      setScanOperations(prev => {
        const scan = prev[scanId];
        if (scan) {
          return {
            ...prev,
            [scanId]: { ...scan, status: 'running' }
          };
        }
        return prev;
      });
    } catch (error) {
      console.error('[useScanProgress] Failed to resume scan:', error);
      throw error;
    }
  }, [setScanOperations]);

  const stopScan = useCallback(async (scanId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/scans/${scanId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to stop scan: ${response.statusText}`);
      }

      // Remove from local state
      setScanOperations(prev => {
        const { [scanId]: removed, ...remaining } = prev;
        return remaining;
      });
    } catch (error) {
      console.error('[useScanProgress] Failed to stop scan:', error);
      throw error;
    }
  }, [setScanOperations]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    scanOperations: Object.values(scanOperations),
    getScanProgress,
    startScan,
    pauseScan,
    resumeScan,
    stopScan,
    connectionStatus,
    connect,
    disconnect,
  };
};