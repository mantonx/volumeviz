/**
 * Global WebSocket Provider
 *
 * Provides a single, globally managed WebSocket connection with:
 * - Environment-based configuration (VITE_WS_URL, VITE_ENABLE_WEBSOCKET)
 * - Exponential backoff reconnection (1-5s jittered)
 * - Connection state management
 * - Dev panel support for testing
 */

import { useSetAtom } from 'jotai';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useDebounce } from '../hooks/useDebounce';
import type { WebSocketState, WebSocketStatus } from '../store/atoms/websocket';
import {
    websocketEnabledAtom,
    websocketStateAtom,
} from '../store/atoms/websocket';

// Environment configuration
const WS_ENABLED = import.meta.env.VITE_ENABLE_WEBSOCKET === 'true';
const WS_URL = import.meta.env.VITE_WS_URL;
const DEV_MODE = import.meta.env.DEV;

if (!WS_URL) {
  throw new Error('VITE_WS_URL environment variable is required but not set');
}

// Debug logging
console.log('WebSocket configuration:', {
  WS_ENABLED,
  WS_URL,
  DEV_MODE,
});

interface WebSocketMessage {
  type: string;
  data?: any;
  volume_id?: string;
  timestamp?: string;
}

interface WebSocketContextValue {
  // Connection state
  status: WebSocketStatus;
  isConnected: boolean;
  error: string | null;
  lastEventAt: Date | null;
  latency: number | null;
  reconnectAttempts: number;

  // Connection control
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Messaging
  send: (message: WebSocketMessage) => boolean;
  sendTest: () => boolean; // Dev only

  // Event handlers
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    isConnected: false,
    error: null,
    reconnectAttempts: 0,
    lastMessage: null,
    latency: null,
  });

  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Debounced state updates to prevent flicker
  const debouncedStatus = useDebounce(state.status, 200);
  const debouncedIsConnected = useDebounce(state.isConnected, 200);

  // Refs for persistent values
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const pingTimeRef = useRef<number | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(
    new Map(),
  );

  // Jotai atoms
  const setWebSocketState = useSetAtom(websocketStateAtom);
  const setWebSocketEnabled = useSetAtom(websocketEnabledAtom);

  // Update global state when local state changes (debounced)
  useEffect(() => {
    setWebSocketState({
      ...state,
      status: debouncedStatus,
      isConnected: debouncedIsConnected,
    });
  }, [state, debouncedStatus, debouncedIsConnected, setWebSocketState]);

  // Set enabled state from environment
  useEffect(() => {
    setWebSocketEnabled(WS_ENABLED);
  }, [setWebSocketEnabled]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Event handler management
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event)!.add(handler);
  }, []);

  const off = useCallback((event: string, handler: (data: any) => void) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(event);
      }
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in WebSocket event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }, []);

  // Send message through WebSocket
  const send = useCallback((message: WebSocketMessage): boolean => {
    console.log('WebSocket send called with message:', message);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message:', message);
      console.log('WebSocket state:', wsRef.current?.readyState);
      return false;
    }

    try {
      const messageToSend = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      };
      console.log('Sending WebSocket message:', messageToSend);
      wsRef.current.send(JSON.stringify(messageToSend));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }, []);

  // Send test message (dev only)
  const sendTest = useCallback((): boolean => {
    if (!DEV_MODE) {
      console.warn('sendTest() is only available in development mode');
      return false;
    }

    return send({
      type: 'ping',
      data: { test: true, timestamp: Date.now() },
    });
  }, [send]);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Update last event time
        setLastEventAt(new Date());

        // Handle built-in message types
        switch (message.type) {
          case 'pong':
            // Calculate latency if we sent a ping
            if (pingTimeRef.current) {
              const latency = Date.now() - pingTimeRef.current;
              setState((prev) => ({ ...prev, latency }));
              pingTimeRef.current = null;
            }
            break;

          case 'ping':
            // Respond to server ping
            send({ type: 'pong' });
            break;

          default:
            // Emit to custom handlers
            emit(message.type, message);

            // Also emit a general 'message' event
            emit('message', message);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        console.error('Raw message data:', event.data);
        // Log first 200 characters to help debug malformed JSON
        const preview =
          typeof event.data === 'string'
            ? event.data.substring(0, 200) +
              (event.data.length > 200 ? '...' : '')
            : event.data;
        console.error('Message preview:', preview);
        emit('error', { type: 'parse_error', error, rawData: event.data });
      }
    },
    [send, emit],
  );

  // Start heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimeRef.current = Date.now();
        send({ type: 'ping' });
      }
    }, 30000); // 30 second heartbeat
  }, [send]);

  // Calculate jittered backoff delay
  const getReconnectDelay = useCallback((attempt: number): number => {
    // Exponential backoff: 1s * 2^attempt, capped at 5s, with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
    const jitter = Math.random() * 0.3; // ±30% jitter
    return Math.floor(baseDelay * (1 + jitter));
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!WS_ENABLED) {
      console.log('WebSocket is disabled by environment configuration');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.warn('WebSocket already connecting');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    setState((prev) => ({
      ...prev,
      status: prev.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
      error: null,
    }));

    try {
      console.log('Attempting WebSocket connection to:', WS_URL);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;

        console.log('WebSocket connected to:', WS_URL);
        setState((prev) => ({
          ...prev,
          status: 'connected',
          isConnected: true,
          error: null,
          reconnectAttempts: 0,
        }));

        startHeartbeat();
        emit('connect', { url: WS_URL });
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        if (!mountedRef.current) return;

        console.error('WebSocket error:', event);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Connection error',
        }));

        emit('error', { type: 'connection_error', event });
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        console.log('WebSocket closed:', event.code, event.reason);
        clearTimers();
        wsRef.current = null;

        setState((prev) => ({
          ...prev,
          status: 'disconnected',
          isConnected: false,
          latency: null,
        }));

        emit('disconnect', { code: event.code, reason: event.reason });

        // Auto-reconnect on unexpected close (not clean disconnect)
        if (event.code !== 1000 && state.reconnectAttempts < 10) {
          const delay = getReconnectDelay(state.reconnectAttempts);
          console.log(
            `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1})`,
          );

          setState((prev) => ({
            ...prev,
            status: 'reconnecting',
            reconnectAttempts: prev.reconnectAttempts + 1,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        } else if (state.reconnectAttempts >= 10) {
          console.error('Max reconnection attempts reached');
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Max reconnection attempts exceeded',
          }));
          emit('max_reconnect_exceeded', { attempts: state.reconnectAttempts });
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: `Connection failed: ${error}`,
      }));
    }
  }, [
    WS_ENABLED,
    state.reconnectAttempts,
    handleMessage,
    startHeartbeat,
    emit,
    getReconnectDelay,
    clearTimers,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('WebSocket disconnecting...');
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      status: 'disconnected',
      isConnected: false,
      error: null,
      reconnectAttempts: 0,
      latency: null,
    }));

    setLastEventAt(null);
  }, [clearTimers]);

  // Force reconnection
  const reconnect = useCallback(() => {
    console.log('WebSocket force reconnecting...');
    disconnect();
    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);
  }, [disconnect, connect]);

  // Initialize connection on mount (if enabled)
  useEffect(() => {
    mountedRef.current = true;

    if (WS_ENABLED && !wsRef.current) {
      console.log('Initializing WebSocket connection...');
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [WS_ENABLED]); // Only depend on WS_ENABLED to avoid reconnection loops

  // Prevent duplicate connections on hot reload in development
  useEffect(() => {
    if (DEV_MODE) {
      const handleBeforeUnload = () => {
        if (wsRef.current) {
          wsRef.current.close(1000, 'Page reload');
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () =>
        window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, []);

  const contextValue: WebSocketContextValue = {
    // Connection state
    status: debouncedStatus,
    isConnected: debouncedIsConnected,
    error: state.error,
    lastEventAt,
    latency: state.latency,
    reconnectAttempts: state.reconnectAttempts,

    // Connection control
    connect,
    disconnect,
    reconnect,

    // Messaging
    send,
    sendTest,

    // Event handlers
    on,
    off,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketProvider;
