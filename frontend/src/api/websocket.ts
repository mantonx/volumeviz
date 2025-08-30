/**
 * WebSocket API Integration
 *
 * WebSocket integration for live updates in the API client.
 * Provides real-time data synchronization and notifications.
 */

import { useRealtime } from '@/providers/realtime';

export const useWebSocketAPI = () => {
  const { isConnected, sendMessage, onScanProgress, onScanEvent } = useRealtime();

  // WebSocket integration for live updates
  const subscribeToVolumeUpdates = (
    volumeId: string,
    callback: (data: any) => void,
  ) => {
    if (isConnected) {
      // WebSocket live updates integration
      sendMessage({
        type: 'subscribe',
        event: 'volume-update',
        data: { volumeId },
      });
      return onScanProgress(callback);
    }
    return () => {}; // Return cleanup function
  };

  const subscribeToFileChanges = (callback: (data: any) => void) => {
    if (isConnected) {
      // WebSocket for file changes
      sendMessage({
        type: 'subscribe',
        event: 'file-change',
        data: {},
      });
      return onScanEvent((type: string, data: any) => {
        if (type === 'file-change') {
          callback(data);
        }
      });
    }
    return () => {}; // Return cleanup function
  };

  return {
    isConnected,
    sendMessage,
    subscribeToVolumeUpdates,
    subscribeToFileChanges,
    onScanProgress,
    onScanEvent,
  };
};

export default useWebSocketAPI;
