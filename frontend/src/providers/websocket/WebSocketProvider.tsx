import { useAtom } from 'jotai';
import * as React from 'react';
import { useCallback, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import {
  addEventListenerAtom,
  addMessageToHistoryAtom,
  addSubscriptionAtom,
  clearWebSocketDataAtom,
  connectionStateAtom,
  lastMessageAtom,
  removeEventListenerAtom,
  removeSubscriptionAtom,
  triggerEventListenersAtom,
  updateConnectionStateAtom,
} from './atoms';
import type {
  GenericEventCallback,
  SubscriptionRequest,
  WebSocketContextValue,
  WebSocketMessage,
  WebSocketProviderProps,
} from './types';
import { WebSocketContext } from './useWebSocketContext';

const DEFAULT_CONFIG = {
  shouldReconnect: true,
  reconnectInterval: 3000,
  reconnectAttempts: 10,
  heartbeatInterval: 30000,
  messageHandlers: [],
};

export function WebSocketProvider({
  children,
  config,
}: WebSocketProviderProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Jotai state - only use write functions, don't read to avoid loops
  const [, setLastMessage] = useAtom(lastMessageAtom);
  const [, updateConnectionState] = useAtom(updateConnectionStateAtom);
  const [, addMessageToHistory] = useAtom(addMessageToHistoryAtom);
  const [, addSubscription] = useAtom(addSubscriptionAtom);
  const [, removeSubscription] = useAtom(removeSubscriptionAtom);
  const [, addEventListenerAction] = useAtom(addEventListenerAtom);
  const [, removeEventListenerAction] = useAtom(removeEventListenerAtom);
  const [, triggerEventListeners] = useAtom(triggerEventListenersAtom);
  const [, clearWebSocketData] = useAtom(clearWebSocketDataAtom);

  // Local state to track connection for this component
  const [localConnectionState, setLocalConnectionState] = React.useState({
    isConnected: false,
    connectedAt: undefined as Date | undefined,
    reconnectAttempts: 0,
  });

  // Memoize WebSocket URL to prevent reconnections
  const wsUrl = React.useMemo(() => config.url || '', [config.url]);

  // Memoize WebSocket options to prevent re-creating connection
  const wsOptions = React.useMemo(
    () => ({
      shouldReconnect:
        typeof mergedConfig.shouldReconnect === 'function'
          ? mergedConfig.shouldReconnect
          : () => !!mergedConfig.shouldReconnect,
      reconnectInterval: mergedConfig.reconnectInterval,
      reconnectAttempts: mergedConfig.reconnectAttempts,
      onOpen: (event: WebSocketEventMap['open']) => {
        // Connection opened - silent unless debugging
      },
      onClose: (event: WebSocketEventMap['close']) => {
        // Connection closed - silent unless debugging
      },
      onError: (event: WebSocketEventMap['error']) => {
        console.error('[WebSocket] Connection error');
      },
    }),
    [mergedConfig.shouldReconnect, mergedConfig.reconnectInterval, mergedConfig.reconnectAttempts],
  );

  const { lastMessage, readyState, sendMessage, getWebSocket } = useWebSocket(
    wsUrl,
    wsOptions,
  );

  // Update connection state when status changes
  useEffect(() => {
    const isConnected = readyState === ReadyState.OPEN;

    setLocalConnectionState((prev) => {
      const newState = {
        isConnected,
        connectedAt:
          isConnected && !prev.isConnected ? new Date() : prev.connectedAt,
        reconnectAttempts:
          readyState === ReadyState.CONNECTING && !prev.isConnected
            ? prev.reconnectAttempts + 1
            : readyState === ReadyState.OPEN
              ? 0
              : prev.reconnectAttempts,
      };

      // Only update Jotai atom if state actually changed
      if (
        prev.isConnected !== newState.isConnected ||
        prev.reconnectAttempts !== newState.reconnectAttempts
      ) {
        updateConnectionState({
          status: readyState,
          isConnected: newState.isConnected,
          connectedAt: newState.connectedAt,
          reconnectAttempts: newState.reconnectAttempts,
          lastError:
            readyState === ReadyState.CLOSED ? 'Connection closed' : undefined,
        });
      }

      // Clear data on disconnect
      if (readyState === ReadyState.CLOSED && prev.isConnected) {
        clearWebSocketData();
      }

      // Connection state updated - silent unless debugging
      return newState;
    });
  }, [readyState, updateConnectionState, clearWebSocketData]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    setLastMessage(lastMessage);

    try {
      const parsedMessage: WebSocketMessage = JSON.parse(lastMessage.data);

      // Add to message history
      addMessageToHistory(parsedMessage);

      // Trigger event listeners for this message type
      triggerEventListeners({
        eventType: parsedMessage.type,
        data: parsedMessage.data,
      });

      // Call configured message handlers
      mergedConfig.messageHandlers?.forEach((handler) => {
        if (handler.type === parsedMessage.type) {
          try {
            handler.handler(parsedMessage.data, parsedMessage);
          } catch (error) {
            console.error(
              `[WebSocket] Error in message handler for ${handler.type}:`,
              error,
            );
          }
        }
      });
    } catch (error) {
      console.error(
        '[WebSocket] Failed to parse message:',
        error,
        'Raw:',
        lastMessage.data,
      );
    }
  }, [
    lastMessage,
    setLastMessage,
    addMessageToHistory,
    triggerEventListeners,
    mergedConfig.messageHandlers,
  ]);

  // Generic message sending
  const sendGenericMessage = useCallback(
    (message: WebSocketMessage | any) => {
      if (readyState === ReadyState.OPEN) {
        const messageToSend =
          typeof message === 'string' ? message : JSON.stringify(message);
        sendMessage(messageToSend);
      } else {
        // WebSocket is not connected, message not sent
      }
    },
    [readyState, sendMessage],
  );

  // Subscription management
  const subscribe = useCallback(
    (event: string, filters?: Record<string, any>) => {
      // Prevent subscribing with empty event name
      if (!event || event.trim() === '') {
        console.error('[WebSocket] Cannot subscribe with empty event name');
        return false;
      }

      if (readyState === ReadyState.OPEN) {
        const subscriptionRequest: SubscriptionRequest = {
          action: 'subscribe',
          event,
          filters: filters || {},
        };

        sendMessage(JSON.stringify(subscriptionRequest));
        addSubscription({ event, filters });
        return true;
      } else {
        // Cannot subscribe - connection not open
        return false;
      }
    },
    [readyState, sendMessage, addSubscription],
  );

  const unsubscribe = useCallback(
    (event: string, filters?: Record<string, any>) => {
      // Prevent unsubscribing with empty event name
      if (!event || event.trim() === '') {
        console.error('[WebSocket] Cannot unsubscribe with empty event name');
        return false;
      }

      if (readyState === ReadyState.OPEN) {
        const subscriptionRequest: SubscriptionRequest = {
          action: 'unsubscribe',
          event,
          filters: filters || {},
        };

        sendMessage(JSON.stringify(subscriptionRequest));
        removeSubscription(event);
        return true;
      } else {
        // Cannot unsubscribe - connection not open
        return false;
      }
    },
    [readyState, sendMessage, removeSubscription],
  );

  // Generic event listener management
  const addEventListener = useCallback(
    <T = any,>(eventType: string, callback: GenericEventCallback<T>) => {
      addEventListenerAction({ eventType, callback });

      // Return cleanup function
      return () => {
        removeEventListenerAction({ eventType, callback });
      };
    },
    [addEventListenerAction, removeEventListenerAction],
  );

  const removeEventListener = useCallback(
    (eventType: string, callback: GenericEventCallback) => {
      removeEventListenerAction({ eventType, callback });
    },
    [removeEventListenerAction],
  );

  // Utility methods
  const reconnect = useCallback(() => {
    const ws = getWebSocket();
    if (ws) {
      ws.close();
    }
    // The useWebSocket hook will automatically attempt to reconnect
  }, [getWebSocket]);

  const disconnect = useCallback(() => {
    const ws = getWebSocket();
    if (ws) {
      ws.close();
    }
    clearWebSocketData();
  }, [getWebSocket, clearWebSocketData]);

  // Context value - MEMOIZE to prevent re-renders of all consumers!
  // Destructure localConnectionState to avoid object reference issues
  const { isConnected, connectedAt, reconnectAttempts } = localConnectionState;

  const contextValue: WebSocketContextValue = React.useMemo(
    () => ({
      // Connection state
      connectionState: {
        status: readyState,
        isConnected,
        connectedAt,
        reconnectAttempts,
        latency: null,
        lastError:
          readyState === ReadyState.CLOSED ? 'Connection closed' : undefined,
      },
      isConnected,

      // Message handling - lastMessage omitted to prevent re-renders on every message
      lastMessage: null,
      sendMessage: sendGenericMessage,

      // Subscription management
      subscribe,
      unsubscribe,

      // Generic event listeners
      addEventListener,
      removeEventListener,

      // Utility methods
      reconnect,
      disconnect,
    }),
    [
      readyState,
      isConnected,
      connectedAt,
      reconnectAttempts,
      sendGenericMessage,
      subscribe,
      unsubscribe,
      addEventListener,
      removeEventListener,
      reconnect,
      disconnect,
    ],
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}
