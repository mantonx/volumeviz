/**
 * Type definitions for WebSocket connection management hook
 */

export interface WebSocketMessage {
  type:
    | 'volume_update'
    | 'scan_complete'
    | 'scan_error'
    | 'scan_progress'
    | 'ping'
    | 'pong';
  data?: any;
  volume_id?: string;
  timestamp?: string;
}

export interface WebSocketOptions {
  /** WebSocket server URL */
  url?: string;
  /** Automatic reconnection enabled */
  autoReconnect?: boolean;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval for connection health checks */
  heartbeatInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Custom message handlers */
  onMessage?: (message: WebSocketMessage) => void;
  /** Connection event handlers */
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export interface WebSocketState {
  /** Current connection status */
  status:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'error';
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Last connection error */
  error: string | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Last message timestamp */
  lastMessage: Date | null;
  /** Last ping/pong latency in ms */
  latency: number | null;
}

export interface WebSocketReturn extends WebSocketState {
  // Connection control
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Messaging
  sendMessage: (message: WebSocketMessage) => boolean;
  requestScan: (volumeId: string, options?: { async?: boolean }) => boolean;

  // Utility
  isReady: boolean;
  canReconnect: boolean;
}
