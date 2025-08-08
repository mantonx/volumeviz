/**
 * WebSocket client for real-time volume updates
 */

// Simple event emitter for browser compatibility
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.events[event]) return;
    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach((listener) => listener(...args));
  }
}
import type {
  WebSocketMessageType,
  VolumeUpdateMessageType,
  ScanProgressMessageType,
  ScanCompleteMessageType,
  ScanErrorMessageType,
} from './generated/volumeviz-api';

export type WebSocketMessage = WebSocketMessageType;
export type VolumeUpdateMessage = VolumeUpdateMessageType;
export type ScanProgressMessage = ScanProgressMessageType;
export type ScanCompleteMessage = ScanCompleteMessageType;
export type ScanErrorMessage = ScanErrorMessageType;

export interface WebSocketClientOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export class VolumeWebSocketClient extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  constructor(options: WebSocketClientOptions) {
    super();
    this.options = {
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...options,
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.isClosing = false;
    this.emit('connecting');

    try {
      this.ws = new WebSocket(this.options.url);
      this.setupEventHandlers();
      this.startConnectionTimeout();
    } catch (error) {
      this.emit('error', error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    this.isClosing = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.emit('disconnected');
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.clearConnectionTimeout();
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        this.emit('error', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.cleanup();

      if (!this.isClosing) {
        this.emit('disconnected');
        this.handleReconnect();
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'ping':
        this.send({ type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'pong':
        // Heartbeat response received
        break;

      case 'volume_update':
        const volumeMessage = message as VolumeUpdateMessage;
        this.emit('volume_update', volumeMessage.data);
        break;

      case 'scan_complete':
        const completeMessage = message as ScanCompleteMessage;
        this.emit('scan_complete', {
          volume_id: completeMessage.volume_id,
          result: completeMessage.data.result,
        });
        break;

      case 'scan_progress':
        const progressMessage = message as ScanProgressMessage;
        this.emit('scan_progress', {
          volume_id: progressMessage.volume_id,
          progress: progressMessage.data,
        });
        break;

      case 'scan_error':
        const errorMessage = message as ScanErrorMessage;
        this.emit('scan_error', {
          volume_id: errorMessage.volume_id,
          error: errorMessage.data,
        });
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: new Date().toISOString() });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        console.error('WebSocket connection timeout');
        this.ws?.close();
        this.handleReconnect();
      }
    }, this.options.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private handleReconnect(): void {
    if (!this.options.autoReconnect || this.isClosing) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_exceeded');
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.options.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    this.clearConnectionTimeout();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Singleton instance
let wsClient: VolumeWebSocketClient | null = null;

export function getWebSocketClient(url?: string): VolumeWebSocketClient {
  if (!wsClient && url) {
    wsClient = new VolumeWebSocketClient({ url });
  }

  if (!wsClient) {
    throw new Error(
      'WebSocket client not initialized. Provide URL on first call.',
    );
  }

  return wsClient;
}

export function closeWebSocketClient(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
