import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import type { ConnectionState, WebSocketMessage } from './types';

// =============================================================================
// GENERIC WEBSOCKET ATOMS
// =============================================================================

// Connection State
export const connectionStateAtom = atom<ConnectionState>({
  status: 0, // ReadyState.CONNECTING
  isConnected: false,
  connectedAt: undefined,
  reconnectAttempts: 0,
  latency: null,
  lastError: undefined,
});

// Last received message (writable)
export const lastMessageAtom = atomWithReset<MessageEvent<any> | null>(null);

// Message history (optional, for debugging)
export const messageHistoryAtom = atomWithReset<WebSocketMessage[]>([]);

// Active subscriptions tracking
export const activeSubscriptionsAtom = atomWithReset<
  Record<string, { filters?: Record<string, any>; subscribedAt: Date }>
>({});

// Generic event listeners registry
export const eventListenersAtom = atomWithReset<Map<string, Set<Function>>>(
  new Map(),
);

// =============================================================================
// DERIVED ATOMS
// =============================================================================

// Connection status helpers
export const isConnectedAtom = atom((get) => {
  const state = get(connectionStateAtom);
  return state.isConnected;
});

export const connectionStatusAtom = atom((get) => {
  const state = get(connectionStateAtom);
  return state.status;
});

export const reconnectAttemptsAtom = atom((get) => {
  const state = get(connectionStateAtom);
  return state.reconnectAttempts;
});

// Recent messages (last 50 for debugging)
export const recentMessagesAtom = atom((get) => {
  const messages = get(messageHistoryAtom);
  return messages.slice(-50);
});

// Active subscription count
export const activeSubscriptionCountAtom = atom((get) => {
  const subscriptions = get(activeSubscriptionsAtom);
  return Object.keys(subscriptions).length;
});

// =============================================================================
// ACTION ATOMS
// =============================================================================

// Update connection state
export const updateConnectionStateAtom = atom(
  null,
  (get, set, updates: Partial<ConnectionState>) => {
    const current = get(connectionStateAtom);
    set(connectionStateAtom, { ...current, ...updates });
  },
);

// Add message to history
export const addMessageToHistoryAtom = atom(
  null,
  (get, set, message: WebSocketMessage) => {
    const current = get(messageHistoryAtom);
    const updated = [...current, message].slice(-100); // Keep last 100 messages
    set(messageHistoryAtom, updated);
  },
);

// Add subscription
export const addSubscriptionAtom = atom(
  null,
  (
    get,
    set,
    { event, filters }: { event: string; filters?: Record<string, any> },
  ) => {
    const current = get(activeSubscriptionsAtom);
    set(activeSubscriptionsAtom, {
      ...current,
      [event]: {
        filters,
        subscribedAt: new Date(),
      },
    });
  },
);

// Remove subscription
export const removeSubscriptionAtom = atom(null, (get, set, event: string) => {
  const current = get(activeSubscriptionsAtom);
  const { [event]: _removed, ...rest } = current;
  set(activeSubscriptionsAtom, rest);
});

// Add event listener
export const addEventListenerAtom = atom(
  null,
  (
    get,
    set,
    { eventType, callback }: { eventType: string; callback: Function },
  ) => {
    const current = get(eventListenersAtom);
    const newMap = new Map(current);

    if (!newMap.has(eventType)) {
      newMap.set(eventType, new Set());
    }

    newMap.get(eventType)!.add(callback);
    set(eventListenersAtom, newMap);
  },
);

// Remove event listener
export const removeEventListenerAtom = atom(
  null,
  (
    get,
    set,
    { eventType, callback }: { eventType: string; callback: Function },
  ) => {
    const current = get(eventListenersAtom);
    const newMap = new Map(current);

    const listeners = newMap.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        newMap.delete(eventType);
      }
    }

    set(eventListenersAtom, newMap);
  },
);

// Clear all data (for disconnection/reset)
export const clearWebSocketDataAtom = atom(null, (_get, set) => {
  set(messageHistoryAtom, []);
  set(activeSubscriptionsAtom, {});
  set(eventListenersAtom, new Map());
  set(lastMessageAtom, null);
});

// Trigger event listeners
export const triggerEventListenersAtom = atom(
  null,
  (get, _set, { eventType, data }: { eventType: string; data: any }) => {
    const listeners = get(eventListenersAtom);
    const eventListeners = listeners.get(eventType);

    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `Error in WebSocket event listener for ${eventType}:`,
            error,
          );
        }
      });
    }
  },
);
