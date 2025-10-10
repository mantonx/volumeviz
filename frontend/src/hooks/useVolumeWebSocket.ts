/**
 * Custom hook for listening to volume WebSocket events
 * Phase 3: Real-time volume updates
 */

import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/providers/websocket/useWebSocketContext';
import {
  VolumeSizeUpdatedEvent,
  VolumeMetadataUpdatedEvent,
  VolumeScanProgressEvent,
  VolumeEventTypes,
} from '@/providers/websocket/volumeEvents';

export interface UseVolumeWebSocketOptions {
  /**
   * Filter events to specific volume IDs
   * If not provided, all volume events will be received
   */
  volumeIds?: string[];

  /**
   * Enable/disable the hook
   */
  enabled?: boolean;
}

export function useVolumeWebSocket(options: UseVolumeWebSocketOptions = {}) {
  const { enabled = true, volumeIds } = options;
  const { addEventListener, isConnected } = useWebSocketContext();
  const listenersRef = useRef<(() => void)[]>([]);

  /**
   * Listen for volume size updates
   */
  const onSizeUpdate = useCallback(
    (callback: (event: VolumeSizeUpdatedEvent) => void) => {
      if (!enabled) return () => {};

      const cleanup = addEventListener<VolumeSizeUpdatedEvent>(
        VolumeEventTypes.SIZE_UPDATED,
        (data) => {
          // Filter by volume IDs if specified
          if (volumeIds && !volumeIds.includes(data.volume_id)) {
            return;
          }
          callback(data);
        },
      );

      listenersRef.current.push(cleanup);
      return cleanup;
    },
    [addEventListener, enabled, volumeIds],
  );

  /**
   * Listen for volume metadata updates
   */
  const onMetadataUpdate = useCallback(
    (callback: (event: VolumeMetadataUpdatedEvent) => void) => {
      if (!enabled) return () => {};

      const cleanup = addEventListener<VolumeMetadataUpdatedEvent>(
        VolumeEventTypes.METADATA_UPDATED,
        (data) => {
          if (volumeIds && !volumeIds.includes(data.volume_id)) {
            return;
          }
          callback(data);
        },
      );

      listenersRef.current.push(cleanup);
      return cleanup;
    },
    [addEventListener, enabled, volumeIds],
  );

  /**
   * Listen for scan progress updates
   */
  const onScanProgress = useCallback(
    (callback: (event: VolumeScanProgressEvent) => void) => {
      if (!enabled) return () => {};

      const cleanup = addEventListener<VolumeScanProgressEvent>(
        VolumeEventTypes.SCAN_PROGRESS,
        (data) => {
          if (volumeIds && !volumeIds.includes(data.volume_id)) {
            return;
          }
          callback(data);
        },
      );

      listenersRef.current.push(cleanup);
      return cleanup;
    },
    [addEventListener, enabled, volumeIds],
  );

  /**
   * Cleanup all listeners on unmount
   */
  useEffect(() => {
    return () => {
      listenersRef.current.forEach((cleanup) => cleanup());
      listenersRef.current = [];
    };
  }, []);

  return {
    isConnected,
    onSizeUpdate,
    onMetadataUpdate,
    onScanProgress,
  };
}
