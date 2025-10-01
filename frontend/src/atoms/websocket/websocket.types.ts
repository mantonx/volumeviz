export type WebSocketStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'error';

export interface WebSocketState {
  status: WebSocketStatus;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastMessage: Date | null;
  latency: number | null;
}

export interface ConnectionStatus {
  api: 'online' | 'offline' | 'connecting' | 'error';
  websocket: WebSocketStatus;
  websocketEnabled: boolean;
}
