/**
 * WebSocket connection management hook
 *
 * Provides robust WebSocket connection with automatic reconnection,
 * message handling, and connection state management for real-time updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  volumesAtom,
  scanResultsAtom,
  scanErrorAtom,
  volumesLastUpdatedAtom,
} from '../../store/atoms/volumes';
import type { VolumeResponse, ScanResponse } from '../../api/client';
import type {
  WebSocketMessage,
  WebSocketOptions,
  WebSocketState,
  WebSocketReturn,
} from './useWebSocketConnection.types';

/**
 * Hook for managing WebSocket connections with VolumeViz backend
 */
export const useWebSocketConnection = (
  options: WebSocketOptions = {},
): WebSocketReturn => {
  const {
    url = `ws://${window.location.hostname}:8080/ws`,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    connectionTimeout = 10000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // Atoms for updating application state
  const setVolumes = useSetAtom(volumesAtom);
  const setScanResults = useSetAtom(scanResultsAtom);
  const setScanErrors = useSetAtom(scanErrorAtom);
  const setLastUpdated = useSetAtom(volumesLastUpdatedAtom);

  // WebSocket connection state
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    isConnected: false,
    error: null,
    reconnectAttempts: 0,
    lastMessage: null,
    latency: null,
  });

  // Refs for persistent values
  const wsRef = useRef<WebSocket>();
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const pingTimeRef = useRef<number>();

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Send heartbeat ping
  const sendHeartbeat = useCallback(() => {
    if (mountedRef.current && state.isConnected) {
      pingTimeRef.current = Date.now();
      sendMessage({ type: 'ping', timestamp: new Date().toISOString() });

      // Schedule next heartbeat
      heartbeatTimeoutRef.current = setTimeout(
        sendHeartbeat,
        heartbeatInterval,
      );
    }
  }, [state.isConnected, heartbeatInterval, sendMessage]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        setState((prev) => ({ ...prev, lastMessage: new Date() }));

        // Handle built-in message types
        switch (message.type) {
          case 'volume_update':
            if (message.data?.volumes) {
              setVolumes(message.data.volumes as VolumeResponse[]);
              setLastUpdated(new Date());
            }
            break;

          case 'scan_complete':
            if (message.volume_id && message.data) {
              setScanResults((prev) => ({
                ...prev,
                [message.volume_id!]: message.data as ScanResponse,
              }));

              // Clear any error for this volume
              setScanErrors((prev) => ({
                ...prev,
                [message.volume_id!]: null,
              }));
            }
            break;

          case 'scan_error':
            if (message.volume_id && message.data?.error) {
              setScanErrors((prev) => ({
                ...prev,
                [message.volume_id!]: message.data.error,
              }));
            }
            break;

          case 'pong':
            // Calculate latency
            if (pingTimeRef.current) {
              const latency = Date.now() - pingTimeRef.current;
              setState((prev) => ({ ...prev, latency }));
              pingTimeRef.current = undefined;
            }
            break;

          case 'ping':
            // Respond to server ping
            sendMessage({ type: 'pong', timestamp: new Date().toISOString() });
            break;
        }

        // Call custom message handler
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [
      setVolumes,
      setScanResults,
      setScanErrors,
      setLastUpdated,
      onMessage,
      sendMessage,
    ],
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current) {
      return; // Already connecting/connected
    }

    setState((prev) => ({
      ...prev,
      status: prev.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
      error: null,
    }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Connection timeout',
          }));
        }
      }, connectionTimeout);

      ws.onopen = () => {
        if (!mountedRef.current) return;

        clearTimers();

        setState((prev) => ({
          ...prev,
          status: 'connected',
          isConnected: true,
          error: null,
          reconnectAttempts: 0,
        }));

        // Start heartbeat
        sendHeartbeat();

        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        if (!mountedRef.current) return;

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'WebSocket connection error',
        }));

        onError?.(event);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        clearTimers();
        wsRef.current = undefined;

        setState((prev) => ({
          ...prev,
          status: 'disconnected',
          isConnected: false,
          latency: null,
        }));

        onDisconnect?.();

        // Attempt reconnection if enabled and not a clean close
        if (
          autoReconnect &&
          event.code !== 1000 &&
          state.reconnectAttempts < maxReconnectAttempts
        ) {
          setState((prev) => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1,
            status: 'reconnecting',
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectDelay);
        }
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: `Failed to create WebSocket: ${error}`,
      }));
    }
  }, [
    url,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    connectionTimeout,
    state.reconnectAttempts,
    clearTimers,
    sendHeartbeat,
    handleMessage,
    onConnect,
    onDisconnect,
    onError,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = undefined;
    }

    setState((prev) => ({
      ...prev,
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    }));
  }, [clearTimers]);

  // Force reconnection
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Send scan request through WebSocket
  const requestScan = useCallback(
    (volumeId: string, options?: { async?: boolean }) => {
      return sendMessage({
        type: 'scan_complete', // This would be 'scan_request' in real implementation
        volume_id: volumeId,
        data: options,
        timestamp: new Date().toISOString(),
      });
    },
    [sendMessage],
  );

  // Initialize connection on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    // Connection state
    ...state,

    // Connection control
    connect,
    disconnect,
    reconnect,

    // Messaging
    sendMessage,
    requestScan,

    // Utility
    isReady: state.status === 'connected',
    canReconnect:
      autoReconnect && state.reconnectAttempts < maxReconnectAttempts,
  };
};

export default useWebSocketConnection;
