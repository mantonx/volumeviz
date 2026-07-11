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
  removeScanProgressAtom,
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
  removeScanProgress: any,
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
    type: 'scan.completed',
    handler: (data) => {
      logger.debug('[RealtimeProvider] scan.completed handler triggered:', data);
      if (data?.volume_id) {
        // Update one final time with completed status
        updateScanProgress({
          volumeId: data.volume_id,
          progress: {
            ...data,
            overall_status: 'completed',
            overall_progress: 100,
          },
        });
        // Remove from atom after a short delay to allow UI to show completion
        setTimeout(() => {
          removeScanProgress(data.volume_id);
        }, 3000);
      }
    },
  },
  {
    type: 'scan.failed',
    handler: (data) => {
      logger.debug('[RealtimeProvider] scan.failed handler triggered:', data);
      if (data?.volume_id) {
        // Update with failed status
        updateScanProgress({
          volumeId: data.volume_id,
          progress: {
            ...data,
            overall_status: 'failed',
          },
        });
        // Remove from atom after a delay to allow user to see the error
        setTimeout(() => {
          removeScanProgress(data.volume_id);
        }, 5000);
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
      // volume.state is a periodic broadcast of current volume status
      // Do NOT update scan progress unless volume is actually scanning
      // These periodic updates were causing the progress UI to flicker
    },
  },
  {
    type: 'scan.status',
    handler: (data) => {
      // Only update scan progress if there's actual scan activity
      if (data?.volume_id && data?.status === 'running') {
        const progressData = {
          scan_id: data.scan_id || 'status-update',
          volume_id: data.volume_id,
          overall_status: data.status,
          overall_progress: data.progress || 0,
          phases: data.phases || [],
          recent_errors: [],
          started_at: data.started_at || new Date().toISOString(),
          metadata: {
            message: data.message || 'Scan in progress',
            volume_name: data.volume_name,
          },
        };
        logger.debug('[RealtimeProvider] Updating scan progress for running scan:', {
          volumeId: data.volume_id,
          progress: progressData,
        });
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

  // Relay a WebSocket event to whatever internal listeners have registered
  // for it via addEventListenerInternal. Each of the 14 relays below must be
  // a referentially-stable function across renders (useCallback with `[]`
  // deps, capturing eventType directly since it's a compile-time literal
  // string, not a variable) — useWebSocketEventListener's effect depends on
  // `callback`, so a fresh inline arrow function per render (as this file
  // used to pass) makes that dependency array "change" every render,
  // forcing a cleanup+resubscribe cycle 14 times per render. Combined with a
  // backend that could legitimately burst dozens of messages in quick
  // succession, that was enough churn to trip React's "Maximum update depth
  // exceeded" guard (see FIXES.md item 9b).
  const relayScanProgress = useCallback((data: unknown) => {
    eventListeners.current.get('scan.progress')?.forEach((cb) => cb(data));
  }, []);
  const relayScanStarted = useCallback((data: unknown) => {
    eventListeners.current.get('scan.started')?.forEach((cb) => cb(data));
  }, []);
  const relayScanCompleted = useCallback((data: unknown) => {
    eventListeners.current.get('scan.completed')?.forEach((cb) => cb(data));
  }, []);
  const relayScanFailed = useCallback((data: unknown) => {
    eventListeners.current.get('scan.failed')?.forEach((cb) => cb(data));
  }, []);
  const relayHistoricalUpdated = useCallback((data: unknown) => {
    eventListeners.current.get('historical.updated')?.forEach((cb) => cb(data));
  }, []);
  const relayStatisticsUsageUpdated = useCallback((data: unknown) => {
    eventListeners.current
      .get('statistics.usage_updated')
      ?.forEach((cb) => cb(data));
  }, []);
  const relayStatisticsPerformanceUpdated = useCallback((data: unknown) => {
    eventListeners.current
      .get('statistics.performance_updated')
      ?.forEach((cb) => cb(data));
  }, []);
  const relayStatisticsAlert = useCallback((data: unknown) => {
    eventListeners.current.get('statistics.alert')?.forEach((cb) => cb(data));
  }, []);
  const relayHealthUpdated = useCallback((data: unknown) => {
    eventListeners.current.get('health.updated')?.forEach((cb) => cb(data));
  }, []);
  const relayHealthCritical = useCallback((data: unknown) => {
    eventListeners.current.get('health.critical')?.forEach((cb) => cb(data));
  }, []);
  const relayErrorOccurred = useCallback((data: unknown) => {
    eventListeners.current.get('error.occurred')?.forEach((cb) => cb(data));
  }, []);
  const relayErrorCritical = useCallback((data: unknown) => {
    eventListeners.current.get('error.critical')?.forEach((cb) => cb(data));
  }, []);
  const relayVolumeUpdated = useCallback((data: unknown) => {
    eventListeners.current.get('volume.updated')?.forEach((cb) => cb(data));
  }, []);
  const relayVolumeState = useCallback((data: unknown) => {
    eventListeners.current.get('volume.state')?.forEach((cb) => cb(data));
  }, []);
  const relayScanStatus = useCallback((data: unknown) => {
    eventListeners.current.get('scan.status')?.forEach((cb) => cb(data));
  }, []);

  // Set up event listeners to trigger internal handlers
  useWebSocketEventListener('scan.progress', relayScanProgress);
  useWebSocketEventListener('scan.started', relayScanStarted);
  useWebSocketEventListener('scan.completed', relayScanCompleted);
  useWebSocketEventListener('scan.failed', relayScanFailed);
  useWebSocketEventListener('historical.updated', relayHistoricalUpdated);
  useWebSocketEventListener(
    'statistics.usage_updated',
    relayStatisticsUsageUpdated,
  );
  useWebSocketEventListener(
    'statistics.performance_updated',
    relayStatisticsPerformanceUpdated,
  );
  useWebSocketEventListener('statistics.alert', relayStatisticsAlert);
  useWebSocketEventListener('health.updated', relayHealthUpdated);
  useWebSocketEventListener('health.critical', relayHealthCritical);
  useWebSocketEventListener('error.occurred', relayErrorOccurred);
  useWebSocketEventListener('error.critical', relayErrorCritical);
  useWebSocketEventListener('volume.updated', relayVolumeUpdated);
  useWebSocketEventListener('volume.state', relayVolumeState);
  useWebSocketEventListener('scan.status', relayScanStatus);

  // Global subscription to ALL scan progress updates (no filters)
  // This ensures progress data is always available when volumes are expanded
  React.useEffect(() => {
    if (!webSocketContext.isConnected) {
      return;
    }

    // Subscribe to all scan progress updates globally
    webSocketContext.sendMessage({
      action: 'subscribe',
      event: 'scan.progress',
      // No filters - receive updates for ALL volumes
    });

    return () => {
      // Unsubscribe on unmount
      webSocketContext.sendMessage({
        action: 'unsubscribe',
        event: 'scan.progress',
      });
    };
  }, [webSocketContext.isConnected, webSocketContext.sendMessage]);

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

// Wrapper component that properly initializes atoms
function RealtimeProviderWrapper({
  children,
  websocketUrl,
}: {
  children: React.ReactNode;
  websocketUrl: string;
}) {
  // Domain-specific atoms (for message handler creation)
  const [, addHistoricalUpdate] = useAtom(addHistoricalUpdateAtom);
  const [, updateSystemStatistics] = useAtom(updateSystemStatisticsAtom);
  const [, updateSystemHealth] = useAtom(updateSystemHealthAtom);
  const [, addErrorEvent] = useAtom(addErrorEventAtom);
  const [, updateScanProgress] = useAtom(updateScanProgressAtom);
  const [, addCapacityAlert] = useAtom(addCapacityAlertAtom);
  const [, removeScanProgress] = useAtom(removeScanProgressAtom);

  // Memoize message handlers to prevent recreating on every render
  // Note: Jotai atom setters are stable and don't need to be in dependencies
  const messageHandlers = React.useMemo(
    () =>
      createVolumeVizMessageHandlers(
        addHistoricalUpdate,
        updateSystemStatistics,
        updateSystemHealth,
        addErrorEvent,
        updateScanProgress,
        addCapacityAlert,
        removeScanProgress,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // RealtimeProvider mounts once near the app root, before login happens —
  // a plain one-time localStorage read here would permanently miss the
  // token. Track it as state and refresh on the same-tab 'auth-token-changed'
  // event (dispatched by useAuth's login/logout) and the cross-tab native
  // 'storage' event, so the WebSocket URL updates once a token appears.
  const [authToken, setAuthToken] = React.useState(() =>
    localStorage.getItem('auth_token'),
  );

  React.useEffect(() => {
    const refreshToken = () => setAuthToken(localStorage.getItem('auth_token'));
    window.addEventListener('auth-token-changed', refreshToken);
    window.addEventListener('storage', refreshToken);
    return () => {
      window.removeEventListener('auth-token-changed', refreshToken);
      window.removeEventListener('storage', refreshToken);
    };
  }, []);

  // Append JWT token to WebSocket URL
  const authenticatedWebSocketUrl = React.useMemo(() => {
    if (!authToken) {
      logger.warn('[RealtimeProvider] No auth token found in localStorage');
      return websocketUrl;
    }

    // Append token as query parameter
    const separator = websocketUrl.includes('?') ? '&' : '?';
    const urlWithToken = `${websocketUrl}${separator}token=${encodeURIComponent(authToken)}`;
    logger.debug('[RealtimeProvider] WebSocket URL with auth token prepared');
    return urlWithToken;
  }, [websocketUrl, authToken]);

  const config: WebSocketConfig = React.useMemo(
    () => ({
      url: authenticatedWebSocketUrl,
      shouldReconnect: true,
      reconnectInterval: 3000,
      reconnectAttempts: 10,
      messageHandlers,
    }),
    [authenticatedWebSocketUrl, messageHandlers],
  );

  return (
    <WebSocketProvider config={config}>
      <RealtimeProviderInternal>{children}</RealtimeProviderInternal>
    </WebSocketProvider>
  );
}

export function RealtimeProvider({
  children,
  websocketUrl = DEFAULT_WEBSOCKET_URL,
}: RealtimeProviderProps) {
  logger.debug(
    '[RealtimeProvider] Initializing with WebSocket URL:',
    websocketUrl,
  );

  return (
    <RealtimeProviderWrapper websocketUrl={websocketUrl}>
      {children}
    </RealtimeProviderWrapper>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = React.useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
