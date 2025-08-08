/**
 * Type definitions for real-time scan management hook
 */

import type { VolumeResponse, ScanResponse } from '../../api/client';

export interface RealTimeScanOptions {
  /** Enable automatic polling for volume updates */
  enablePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Enable WebSocket connection for real-time updates */
  enableWebSocket?: boolean;
  /** WebSocket endpoint URL */
  webSocketUrl?: string;
  /** Maximum number of concurrent scans */
  maxConcurrentScans?: number;
  /** Callback when scan completes */
  onScanComplete?: (volumeId: string, result: ScanResponse) => void;
  /** Callback when scan fails */
  onScanError?: (volumeId: string, error: Error) => void;
  /** Callback when polling update received */
  onPollingUpdate?: (volumes: VolumeResponse[]) => void;
}

export interface RealTimeScanState {
  /** Whether real-time updates are active */
  isActive: boolean;
  /** Whether WebSocket is connected */
  isWebSocketConnected: boolean;
  /** Number of active scans */
  activeScans: number;
  /** Last update timestamp */
  lastUpdate: Date | null;
  /** Connection status */
  status: 'idle' | 'connecting' | 'connected' | 'error';
  /** Error message if any */
  error: string | null;
}

export interface RealTimeScanReturn extends RealTimeScanState {
  // Actions
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  queueScan: (volumeId: string) => void;
  scanAllVolumes: () => void;
  forceRefresh: () => Promise<void>;

  // Data
  volumes: VolumeResponse[];
  scanResults: Record<string, ScanResponse>;
  scanErrors: Record<string, string | null>;
  asyncScans: Record<string, any>;
}
