import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import {
  connectionStateAtom,
  isConnectedAtom,
  connectionStatusAtom,
  reconnectAttemptsAtom,
  recentMessagesAtom,
  activeSubscriptionCountAtom,
  messageHistoryAtom,
  activeSubscriptionsAtom,
} from './atoms';
import { useWebSocketContext } from './useWebSocketContext';
import type { GenericEventCallback, EventCleanupFunction } from './types';

// =============================================================================
// CONNECTION STATE HOOKS
// =============================================================================

export const useConnectionState = () => {
  return useAtomValue(connectionStateAtom);
};

export const useConnectionStatus = () => {
  const isConnected = useAtomValue(isConnectedAtom);
  const status = useAtomValue(connectionStatusAtom);
  const attempts = useAtomValue(reconnectAttemptsAtom);
  const state = useAtomValue(connectionStateAtom);

  return {
    isConnected,
    status,
    reconnectAttempts: attempts,
    connectedAt: state.connectedAt,
    latency: state.latency,
    lastError: state.lastError,
  };
};

// =============================================================================
// MESSAGE HOOKS
// =============================================================================

export const useMessageHistory = () => {
  const messages = useAtomValue(messageHistoryAtom);
  const recentMessages = useAtomValue(recentMessagesAtom);

  return {
    allMessages: messages,
    recentMessages,
    messageCount: messages.length,
  };
};

// =============================================================================
// SUBSCRIPTION HOOKS
// =============================================================================

export const useSubscriptions = () => {
  const subscriptions = useAtomValue(activeSubscriptionsAtom);
  const subscriptionCount = useAtomValue(activeSubscriptionCountAtom);

  const subscriptionList = useMemo(() => {
    return Object.entries(subscriptions).map(([event, data]) => ({
      event,
      filters: data.filters,
      subscribedAt: data.subscribedAt,
    }));
  }, [subscriptions]);

  return {
    subscriptions,
    subscriptionList,
    subscriptionCount,
    hasSubscriptions: subscriptionCount > 0,
  };
};

// =============================================================================
// EVENT LISTENER HOOKS
// =============================================================================

export const useWebSocketEventListener = <T = any>(
  eventType: string,
  callback: GenericEventCallback<T>,
  dependencies: React.DependencyList = [],
): void => {
  const { addEventListener } = useWebSocketContext();

  React.useEffect(() => {
    const cleanup = addEventListener(eventType, callback);
    return cleanup;
  }, [eventType, addEventListener, callback, ...dependencies]);
};

// Hook for subscribing to multiple event types
export const useWebSocketEventListeners = <T = any>(
  eventTypes: string[],
  callback: GenericEventCallback<T>,
  dependencies: React.DependencyList = [],
): void => {
  const { addEventListener } = useWebSocketContext();

  React.useEffect(() => {
    const cleanupFunctions: EventCleanupFunction[] = [];

    eventTypes.forEach((eventType) => {
      const cleanup = addEventListener(eventType, callback);
      cleanupFunctions.push(cleanup);
    });

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [eventTypes, addEventListener, callback, ...dependencies]);
};

// =============================================================================
// UTILITY HOOKS
// =============================================================================

export const useWebSocketActions = () => {
  const { sendMessage, subscribe, unsubscribe, reconnect, disconnect } =
    useWebSocketContext();

  const subscribeToEvent = useCallback(
    (event: string, filters?: Record<string, any>) => {
      subscribe(event, filters);
    },
    [subscribe],
  );

  const unsubscribeFromEvent = useCallback(
    (event: string, filters?: Record<string, any>) => {
      unsubscribe(event, filters);
    },
    [unsubscribe],
  );

  const sendGenericMessage = useCallback(
    (message: any) => {
      sendMessage(message);
    },
    [sendMessage],
  );

  return {
    sendMessage: sendGenericMessage,
    subscribe: subscribeToEvent,
    unsubscribe: unsubscribeFromEvent,
    reconnect,
    disconnect,
  };
};

// Hook for managing subscription lifecycle
export const useWebSocketSubscription = (
  event: string,
  filters?: Record<string, any>,
) => {
  const { subscribe, unsubscribe } = useWebSocketContext();
  const { isConnected } = useConnectionStatus();

  React.useEffect(() => {
    if (isConnected) {
      subscribe(event, filters);
    }

    return () => {
      if (isConnected) {
        unsubscribe(event, filters);
      }
    };
  }, [event, filters, isConnected, subscribe, unsubscribe]);
};

// =============================================================================
// DEBUGGING HOOKS
// =============================================================================

export const useWebSocketDebug = () => {
  const connectionState = useConnectionState();
  const { messageCount, recentMessages } = useMessageHistory();
  const { subscriptionCount, subscriptionList } = useSubscriptions();

  return {
    connectionState,
    messageCount,
    recentMessages,
    subscriptionCount,
    subscriptionList,
    debugInfo: {
      status: connectionState.status,
      isConnected: connectionState.isConnected,
      reconnectAttempts: connectionState.reconnectAttempts,
      connectedAt: connectionState.connectedAt,
      latency: connectionState.latency,
      lastError: connectionState.lastError,
    },
  };
};
