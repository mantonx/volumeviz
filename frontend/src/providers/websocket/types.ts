import * as React from 'react';

// =============================================================================
// GENERIC WEBSOCKET PROVIDER TYPES
// =============================================================================

// Generic WebSocket Message
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp?: string;
  room?: string;
  metadata?: Record<string, any>;
}

// Subscription Management
export interface SubscriptionRequest {
  action: 'subscribe' | 'unsubscribe';
  event: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

// Connection State
export interface ConnectionState {
  status: number; // ReadyState
  isConnected: boolean;
  connectedAt?: Date;
  reconnectAttempts: number;
  latency: number | null;
  lastError?: string;
}

// Generic Event Listener Types
export type GenericEventCallback<T = any> = (data: T) => void;
export type EventCleanupFunction = () => void;
export type GenericEventListener<T = any> = (
  callback: GenericEventCallback<T>,
) => EventCleanupFunction;

// Message Handler Configuration
export interface MessageHandler<T = any> {
  type: string;
  handler: (data: T, message: WebSocketMessage<T>) => void;
}

// WebSocket Provider Configuration
export interface WebSocketConfig {
  url?: string;
  shouldReconnect?: boolean | (() => boolean);
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
  messageHandlers?: MessageHandler[];
}

// WebSocket Context Value
export interface WebSocketContextValue {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;

  // Message handling
  lastMessage: MessageEvent<any> | null;
  sendMessage: (message: WebSocketMessage | any) => void;

  // Subscription management
  subscribe: (event: string, filters?: Record<string, any>) => void;
  unsubscribe: (event: string, filters?: Record<string, any>) => void;

  // Generic event listeners
  addEventListener: <T = any>(
    eventType: string,
    callback: GenericEventCallback<T>,
  ) => EventCleanupFunction;
  removeEventListener: (
    eventType: string,
    callback: GenericEventCallback,
  ) => void;

  // Utility methods
  reconnect: () => void;
  disconnect: () => void;
}

// Provider Props
export interface WebSocketProviderProps {
  children: React.ReactNode;
  config: WebSocketConfig;
}
