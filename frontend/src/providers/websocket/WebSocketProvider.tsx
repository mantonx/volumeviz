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

  // WebSocket connection with debug logging
  console.log('[WebSocketProvider] Initializing with URL:', config.url);
  console.log('[WebSocketProvider] Config:', {
    url: config.url,
    shouldReconnect: mergedConfig.shouldReconnect,
    reconnectInterval: mergedConfig.reconnectInterval,
    reconnectAttempts: mergedConfig.reconnectAttempts,
  });
  
  const { lastMessage, readyState, sendMessage, getWebSocket } = useWebSocket(
    config.url || '',
    {
      shouldReconnect:
        typeof mergedConfig.shouldReconnect === 'function'
          ? mergedConfig.shouldReconnect
          : () => !!mergedConfig.shouldReconnect,
      reconnectInterval: mergedConfig.reconnectInterval,
      reconnectAttempts: mergedConfig.reconnectAttempts,
      onOpen: (event) => {
        console.log('[WebSocket] Connection opened:', event);
      },
      onClose: (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
      },
      onError: (event) => {
        console.error('[WebSocket] Connection error:', event);
      },
    },
  );

  // Update connection state when status changes
  useEffect(() => {
    const isConnected = readyState === ReadyState.OPEN;
    
    setLocalConnectionState((prev) => {
      const newState = {
        isConnected,
        connectedAt: isConnected && !prev.isConnected ? new Date() : prev.connectedAt,
        reconnectAttempts:
          readyState === ReadyState.CONNECTING && !prev.isConnected
            ? prev.reconnectAttempts + 1
            : readyState === ReadyState.OPEN
            ? 0
            : prev.reconnectAttempts,
      };
      
      // Only update Jotai atom if state actually changed
      if (prev.isConnected !== newState.isConnected || 
          prev.reconnectAttempts !== newState.reconnectAttempts) {
        updateConnectionState({
          status: readyState,
          isConnected: newState.isConnected,
          connectedAt: newState.connectedAt,
          reconnectAttempts: newState.reconnectAttempts,
          lastError: readyState === ReadyState.CLOSED ? 'Connection closed' : undefined,
        });
      }
      
      // Clear data on disconnect
      if (readyState === ReadyState.CLOSED && prev.isConnected) {
        clearWebSocketData();
      }
      
      console.log('[WebSocket] Connection state:', {
        readyState,
        isConnected: newState.isConnected,
        reconnectAttempts: newState.reconnectAttempts
      });
      
      return newState;
    });
  }, [readyState, updateConnectionState, clearWebSocketData]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    setLastMessage(lastMessage);

    try {
      const parsedMessage: WebSocketMessage = JSON.parse(lastMessage.data);
      
      console.log('[WebSocket] Received message:', parsedMessage);

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
            console.log(`[WebSocket] Calling handler for ${handler.type}:`, parsedMessage.data);
            handler.handler(parsedMessage.data, parsedMessage);
          } catch (error) {
            console.error(
              `Error in message handler for ${handler.type}:`,
              error,
            );
          }
        }
      });
      
      // Handle system messages
      if (parsedMessage.type.startsWith('system.')) {
        console.log('[WebSocket] System message:', parsedMessage);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error, 'Raw:', lastMessage.data);
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
      if (readyState === ReadyState.OPEN) {
        const subscriptionRequest: SubscriptionRequest = {
          action: 'subscribe',
          event,
          filters: filters || {},
        };

        console.log('[WebSocket] Sending subscription:', subscriptionRequest);
        sendMessage(JSON.stringify(subscriptionRequest));
        addSubscription({ event, filters });
        return true;
      } else {
        console.warn('[WebSocket] Cannot subscribe - connection not open:', readyState);
        return false;
      }
    },
    [readyState, sendMessage, addSubscription],
  );

  const unsubscribe = useCallback(
    (event: string, filters?: Record<string, any>) => {
      if (readyState === ReadyState.OPEN) {
        const subscriptionRequest: SubscriptionRequest = {
          action: 'unsubscribe',
          event,
          filters: filters || {},
        };

        console.log('[WebSocket] Sending unsubscription:', subscriptionRequest);
        sendMessage(JSON.stringify(subscriptionRequest));
        removeSubscription(event);
        return true;
      } else {
        console.warn('[WebSocket] Cannot unsubscribe - connection not open:', readyState);
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

  // Context value - use local state for connection info
  const contextValue: WebSocketContextValue = {
    // Connection state
    connectionState: {
      status: readyState,
      isConnected: localConnectionState.isConnected,
      connectedAt: localConnectionState.connectedAt,
      reconnectAttempts: localConnectionState.reconnectAttempts,
      latency: null,
      lastError: readyState === ReadyState.CLOSED ? 'Connection closed' : undefined,
    },
    isConnected: localConnectionState.isConnected,

    // Message handling
    lastMessage,
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
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}
