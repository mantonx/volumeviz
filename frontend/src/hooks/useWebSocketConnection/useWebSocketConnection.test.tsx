/**
 * Tests for useWebSocketConnection hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { useWebSocketConnection } from './useWebSocketConnection';
import type { WebSocketOptions } from './useWebSocketConnection.types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string) {
    // Mock send
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code: code || 1000, reason }));
    }, 0);
  }
}

// Mock Jotai atoms
jest.mock('../../store/atoms/volumes', () => ({
  volumesAtom: { init: [] },
  scanResultsAtom: { init: {} },
  scanErrorAtom: { init: {} },
  volumesLastUpdatedAtom: { init: null },
}));

const originalWebSocket = global.WebSocket;

const renderUseWebSocketConnection = (options?: WebSocketOptions) => {
  return renderHook(() => useWebSocketConnection(options || {}), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    ),
  });
};

describe('useWebSocketConnection', () => {
  beforeEach(() => {
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderUseWebSocketConnection();

    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.reconnectAttempts).toBe(0);
    expect(result.current.latency).toBe(null);
  });

  it('should connect to WebSocket', async () => {
    const onConnect = jest.fn();
    const { result } = renderUseWebSocketConnection({
      onConnect,
    });

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalled();
  });

  it('should disconnect from WebSocket', async () => {
    const onDisconnect = jest.fn();
    const { result } = renderUseWebSocketConnection({
      onDisconnect,
    });

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('should send messages through WebSocket', async () => {
    const { result } = renderUseWebSocketConnection();

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');

    act(() => {
      const success = result.current.sendMessage({
        type: 'ping',
        timestamp: new Date().toISOString(),
      });
      expect(success).toBe(true);
    });

    expect(sendSpy).toHaveBeenCalled();
  });

  it('should handle incoming messages', async () => {
    const onMessage = jest.fn();
    const { result } = renderUseWebSocketConnection({
      onMessage,
    });

    let mockWs: MockWebSocket;

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Get the WebSocket instance to simulate messages
    mockWs = (global.WebSocket as any).mock?.instances?.[0];

    if (mockWs?.onmessage) {
      act(() => {
        mockWs.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'volume_update',
              data: { volumes: [] },
            }),
          }),
        );
      });
    }

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'volume_update',
        data: { volumes: [] },
      }),
    );
  });

  it('should handle connection errors', async () => {
    const onError = jest.fn();
    const { result } = renderUseWebSocketConnection({
      onError,
    });

    let mockWs: MockWebSocket;

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    mockWs = (global.WebSocket as any).mock?.instances?.[0];

    if (mockWs?.onerror) {
      act(() => {
        mockWs.onerror(new Event('error'));
      });
    }

    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalled();
  });

  it('should attempt reconnection on connection loss', async () => {
    const { result } = renderUseWebSocketConnection({
      autoReconnect: true,
      reconnectDelay: 100,
      maxReconnectAttempts: 2,
    });

    let mockWs: MockWebSocket;

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    mockWs = (global.WebSocket as any).mock?.instances?.[0];

    // Simulate connection loss
    await act(async () => {
      mockWs.close(1006, 'Connection lost'); // Abnormal closure
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.status).toBe('reconnecting');
    expect(result.current.reconnectAttempts).toBe(1);
  });

  it('should handle heartbeat ping/pong', async () => {
    const { result } = renderUseWebSocketConnection({
      heartbeatInterval: 1000,
    });

    let mockWs: MockWebSocket;

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    mockWs = (global.WebSocket as any).mock?.instances?.[0];

    // Simulate pong response
    if (mockWs?.onmessage) {
      act(() => {
        mockWs.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            }),
          }),
        );
      });
    }

    expect(result.current.latency).toBeGreaterThanOrEqual(0);
  });

  it('should request scans through WebSocket', async () => {
    const { result } = renderUseWebSocketConnection();

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');

    act(() => {
      const success = result.current.requestScan('volume-1', { async: true });
      expect(success).toBe(true);
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.stringContaining('"volume_id":"volume-1"'),
    );
  });

  it('should provide utility properties', async () => {
    const { result } = renderUseWebSocketConnection({
      autoReconnect: true,
      maxReconnectAttempts: 3,
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.canReconnect).toBe(true);

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.isReady).toBe(true);
  });

  it('should handle connection timeout', async () => {
    // Mock WebSocket that doesn't connect
    class SlowMockWebSocket extends MockWebSocket {
      constructor(url: string) {
        super(url);
        this.readyState = MockWebSocket.CONNECTING;
        // Never call onopen to simulate timeout
      }
    }

    global.WebSocket = SlowMockWebSocket as any;

    const { result } = renderUseWebSocketConnection({
      connectionTimeout: 100,
    });

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Connection timeout');
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderUseWebSocketConnection();

    await act(async () => {
      result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const closeSpy = jest.spyOn(MockWebSocket.prototype, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
