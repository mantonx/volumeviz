import { useAtom } from 'jotai';
import * as React from 'react';
import { createContext, useCallback } from 'react';
import { logger } from '@/utils/logger';
import {
  WebSocketProvider,
  useWebSocketContext,
  useWebSocketEventListener,
  type MessageHandler,
  type WebSocketConfig,
} from '../websocket';
import {
  addCapacityAlertAtom,
  addErrorEventAtom,
  addHistoricalUpdateAtom,
  updateScanProgressAtom,
  updateSystemHealthAtom,
  updateSystemStatisticsAtom,
} from './atoms';
import type { RealtimeContextValue } from './types';

interface RealtimeProviderProps {
  children: React.ReactNode;
  websocketUrl?: string;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const DEFAULT_WEBSOCKET_URL = (() => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8080/api/v1/ws';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.hostname === 'localhost' ? ':8080' : '';

  return `${protocol}//${host}${port}/api/v1/ws`;
})();

// VolumeViz-specific message handlers
const createVolumeVizMessageHandlers = (
  addHistoricalUpdate: any,
  updateSystemStatistics: any,
  updateSystemHealth: any,
  addErrorEvent: any,
  updateScanProgress: any,
  addCapacityAlert: any,
): MessageHandler[] => [
  {
    type: 'scan.progress',
    handler: (data) => {
      if (data?.volume_id) {
        updateScanProgress({
          volumeId: data.volume_id,
          progress: data,
        });
      }
    },
  },
  {
    type: 'historical.updated',
    handler: (data) => {
      addHistoricalUpdate(data);
    },
  },
  {
    type: 'statistics.usage_updated',
    handler: (data) => {
      updateSystemStatistics(data);
    },
  },
  {
    type: 'statistics.performance_updated',
    handler: (data) => {
      updateSystemStatistics(data);
    },
  },
  {
    type: 'statistics.alert',
    handler: (data) => {
      updateSystemStatistics(data);
      // Handle capacity alerts specifically
      if (data?.alert_data?.alert_type === 'capacity') {
        addCapacityAlert(data);
      }
    },
  },
  {
    type: 'health.updated',
    handler: (data) => {
      updateSystemHealth(data);
    },
  },
  {
    type: 'health.critical',
    handler: (data) => {
      updateSystemHealth(data);
    },
  },
  {
    type: 'error.occurred',
    handler: (data) => {
      addErrorEvent(data);
    },
  },
  {
    type: 'error.critical',
    handler: (data) => {
      addErrorEvent(data);
    },
  },
  {
    type: 'volume.state',
    handler: (data) => {
      logger.debug('[RealtimeProvider] volume.state handler triggered:', data);
      // Convert volume state to scan progress format for the atom
      if (data?.volume_id) {
        const progressData = {
          scan_id: 'current-state',
          volume_id: data.volume_id,
          overall_status: data.status || 'idle',
          overall_progress: 100, // Volume state is current state, so 100%
          phases: [],
          recent_errors: [],
          started_at: data.last_scanned || new Date().toISOString(),
          metadata: {
            message: data.message || 'Current volume state',
            volume_name: data.volume_name,
            total_size: data.total_size,
            driver: data.driver,
            mountpoint: data.mountpoint,
            is_active: data.is_active,
          },
        };
        logger.debug('[RealtimeProvider] Calling updateScanProgress with:', { volumeId: data.volume_id, progress: progressData });
        updateScanProgress({
          volumeId: data.volume_id,
          progress: progressData,
        });
      }
    },
  },
  {
    type: 'scan.status',
    handler: (data) => {
      logger.debug('[RealtimeProvider] scan.status handler triggered:', data);
      // Convert scan status to scan progress format for the atom
      if (data?.volume_id) {
        const progressData = {
          scan_id: 'status-update',
          volume_id: data.volume_id,
          overall_status: data.status || 'idle',
          overall_progress: data.progress || 100,
          phases: [],
          recent_errors: [],
          started_at: data.last_scanned || new Date().toISOString(),
          metadata: {
            message: data.message || 'Current scan status',
            volume_name: data.volume_name,
            total_size: data.total_size,
            driver: data.driver,
            mountpoint: data.mountpoint,
            is_active: data.is_active,
          },
        };
        logger.debug('[RealtimeProvider] Calling updateScanProgress with:', { volumeId: data.volume_id, progress: progressData });
        updateScanProgress({
          volumeId: data.volume_id,
          progress: progressData,
        });
      }
    },
  },
];

// Internal provider that wraps the WebSocket functionality
function RealtimeProviderInternal({ children }: { children: React.ReactNode }) {
  const webSocketContext = useWebSocketContext();

  // Note: Domain-specific atoms are used in message handlers created in parent component

  // Event listener management using refs to avoid recreating functions
  const eventListeners = React.useRef<Map<string, Set<Function>>>(new Map());

  const addEventListenerInternal = useCallback(
    (event: string, callback: Function) => {
      if (!eventListeners.current.has(event)) {
        eventListeners.current.set(event, new Set());
      }
      eventListeners.current.get(event)!.add(callback);

      // Return cleanup function
      return () => {
        const listeners = eventListeners.current.get(event);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            eventListeners.current.delete(event);
          }
        }
      };
    },
    [],
  );

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================

  // Scan Events
  const onScanProgress = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('scan.progress', callback);
    },
    [addEventListenerInternal],
  );

  const onScanEvent = useCallback(
    (callback: (type: string, data: any) => void) => {
      const startedCleanup = addEventListenerInternal(
        'scan.started',
        (data: any) => callback('started', data),
      );
      const completedCleanup = addEventListenerInternal(
        'scan.completed',
        (data: any) => callback('completed', data),
      );
      const failedCleanup = addEventListenerInternal(
        'scan.failed',
        (data: any) => callback('failed', data),
      );

      return () => {
        startedCleanup();
        completedCleanup();
        failedCleanup();
      };
    },
    [addEventListenerInternal],
  );

  const onVolumeUpdate = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('volume.updated', callback);
    },
    [addEventListenerInternal],
  );

  const onVolumeState = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('volume.state', callback);
    },
    [addEventListenerInternal],
  );

  const onScanStatus = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('scan.status', callback);
    },
    [addEventListenerInternal],
  );

  // Comprehensive Real-time Events
  const onHistoricalDataUpdate = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('historical.updated', callback);
    },
    [addEventListenerInternal],
  );

  const onStatisticsUpdate = useCallback(
    (callback: (data: any) => void) => {
      const usageCleanup = addEventListenerInternal(
        'statistics.usage_updated',
        callback,
      );
      const performanceCleanup = addEventListenerInternal(
        'statistics.performance_updated',
        callback,
      );
      const alertCleanup = addEventListenerInternal(
        'statistics.alert',
        callback,
      );

      return () => {
        usageCleanup();
        performanceCleanup();
        alertCleanup();
      };
    },
    [addEventListenerInternal],
  );

  const onSystemHealthUpdate = useCallback(
    (callback: (data: any) => void) => {
      const healthCleanup = addEventListenerInternal(
        'health.updated',
        callback,
      );
      const criticalCleanup = addEventListenerInternal(
        'health.critical',
        callback,
      );

      return () => {
        healthCleanup();
        criticalCleanup();
      };
    },
    [addEventListenerInternal],
  );

  const onErrorEvent = useCallback(
    (callback: (data: any) => void) => {
      const errorCleanup = addEventListenerInternal('error.occurred', callback);
      const criticalErrorCleanup = addEventListenerInternal(
        'error.critical',
        callback,
      );

      return () => {
        errorCleanup();
        criticalErrorCleanup();
      };
    },
    [addEventListenerInternal],
  );

  // Convenience Event Listeners
  const onUsageSnapshot = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('statistics.usage_updated', callback);
    },
    [addEventListenerInternal],
  );

  const onPerformanceMetrics = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal(
        'statistics.performance_updated',
        callback,
      );
    },
    [addEventListenerInternal],
  );

  const onCapacityAlert = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('statistics.alert', (data: any) => {
        if (data.alert_data?.alert_type === 'capacity') {
          callback(data);
        }
      });
    },
    [addEventListenerInternal],
  );

  const onSystemAlert = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('health.critical', callback);
    },
    [addEventListenerInternal],
  );

  const onCriticalError = useCallback(
    (callback: (data: any) => void) => {
      return addEventListenerInternal('error.critical', callback);
    },
    [addEventListenerInternal],
  );

  // Set up event listeners to trigger internal handlers
  useWebSocketEventListener('scan.progress', (data) => {
    eventListeners.current
      .get('scan.progress')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('scan.started', (data) => {
    eventListeners.current
      .get('scan.started')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('scan.completed', (data) => {
    eventListeners.current
      .get('scan.completed')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('scan.failed', (data) => {
    eventListeners.current
      .get('scan.failed')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('historical.updated', (data) => {
    eventListeners.current
      .get('historical.updated')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('statistics.usage_updated', (data) => {
    eventListeners.current
      .get('statistics.usage_updated')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('statistics.performance_updated', (data) => {
    eventListeners.current
      .get('statistics.performance_updated')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('statistics.alert', (data) => {
    eventListeners.current
      .get('statistics.alert')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('health.updated', (data) => {
    eventListeners.current
      .get('health.updated')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('health.critical', (data) => {
    eventListeners.current
      .get('health.critical')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('error.occurred', (data) => {
    eventListeners.current
      .get('error.occurred')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('error.critical', (data) => {
    eventListeners.current
      .get('error.critical')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('volume.updated', (data) => {
    eventListeners.current
      .get('volume.updated')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('volume.state', (data) => {
    eventListeners.current
      .get('volume.state')
      ?.forEach((callback) => callback(data));
  });

  useWebSocketEventListener('scan.status', (data) => {
    eventListeners.current
      .get('scan.status')
      ?.forEach((callback) => callback(data));
  });

  // Context value
  const contextValue: RealtimeContextValue = {
    // Connection state
    connectionStatus: webSocketContext.connectionState.status,
    isConnected: webSocketContext.isConnected,
    latency: webSocketContext.connectionState.latency,
    reconnectAttempts: webSocketContext.connectionState.reconnectAttempts,
    connectedAt: webSocketContext.connectionState.connectedAt,

    // Message handling
    lastMessage: webSocketContext.lastMessage,
    sendMessage: webSocketContext.sendMessage,

    // Subscription management
    subscribe: webSocketContext.subscribe,
    unsubscribe: webSocketContext.unsubscribe,

    // Event listeners
    onScanProgress,
    onScanEvent,
    onVolumeUpdate,
    onVolumeState,
    onScanStatus,
    onHistoricalDataUpdate,
    onStatisticsUpdate,
    onSystemHealthUpdate,
    onErrorEvent,
    onUsageSnapshot,
    onPerformanceMetrics,
    onCapacityAlert,
    onSystemAlert,
    onCriticalError,
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function RealtimeProvider({
  children,
  websocketUrl = DEFAULT_WEBSOCKET_URL,
}: RealtimeProviderProps) {
  // Domain-specific atoms (for message handler creation)
  const [, addHistoricalUpdate] = useAtom(addHistoricalUpdateAtom);
  const [, updateSystemStatistics] = useAtom(updateSystemStatisticsAtom);
  const [, updateSystemHealth] = useAtom(updateSystemHealthAtom);
  const [, addErrorEvent] = useAtom(addErrorEventAtom);
  const [, updateScanProgress] = useAtom(updateScanProgressAtom);
  const [, addCapacityAlert] = useAtom(addCapacityAlertAtom);

  logger.debug(
    '[RealtimeProvider] Initializing with WebSocket URL:',
    websocketUrl,
  );

  // Memoize message handlers to prevent recreating on every render
  const messageHandlers = React.useMemo(
    () => createVolumeVizMessageHandlers(
      addHistoricalUpdate,
      updateSystemStatistics,
      updateSystemHealth,
      addErrorEvent,
      updateScanProgress,
      addCapacityAlert,
    ),
    [
      addHistoricalUpdate,
      updateSystemStatistics,
      updateSystemHealth,
      addErrorEvent,
      updateScanProgress,
      addCapacityAlert,
    ],
  );

  const config: WebSocketConfig = React.useMemo(
    () => ({
      url: websocketUrl,
      shouldReconnect: true,
      reconnectInterval: 3000,
      reconnectAttempts: 10,
      messageHandlers,
    }),
    [websocketUrl, messageHandlers],
  );

  return (
    <WebSocketProvider config={config}>
      <RealtimeProviderInternal>{children}</RealtimeProviderInternal>
    </WebSocketProvider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = React.useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
