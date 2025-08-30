// WebSocket Provider - Generic WebSocket management layer
export { WebSocketProvider } from './WebSocketProvider';
export { useWebSocketContext } from './useWebSocketContext';

// Hooks
export {
  useConnectionState,
  useConnectionStatus,
  useMessageHistory,
  useSubscriptions,
  useWebSocketEventListener,
  useWebSocketEventListeners,
  useWebSocketActions,
  useWebSocketSubscription,
  useWebSocketDebug,
} from './hooks';

// Types
export type {
  WebSocketMessage,
  SubscriptionRequest,
  ConnectionState,
  GenericEventCallback,
  EventCleanupFunction,
  GenericEventListener,
  MessageHandler,
  WebSocketConfig,
  WebSocketContextValue,
  WebSocketProviderProps,
} from './types';

// Atoms (for advanced usage)
export {
  connectionStateAtom,
  lastMessageAtom,
  messageHistoryAtom,
  activeSubscriptionsAtom,
  eventListenersAtom,
  isConnectedAtom,
  connectionStatusAtom,
  reconnectAttemptsAtom,
  recentMessagesAtom,
  activeSubscriptionCountAtom,
} from './atoms';
