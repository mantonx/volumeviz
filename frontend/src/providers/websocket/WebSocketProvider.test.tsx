import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { WebSocketProvider } from './WebSocketProvider';
import { useWebSocketContext } from './useWebSocketContext';

// Regression coverage for the "Maximum update depth exceeded" bug flagged
// twice as unresolved in FIXES.md (item 9b's follow-up, and again during
// the Modal rewrite) — see SCAN_UX_ARCHITECTURE.md #3a and the comment atop
// handleMessage in WebSocketProvider.tsx for the full root-cause writeup.
//
// react-use-websocket wraps every lastMessage update in ReactDOM.flushSync
// unconditionally, with no config to disable it, so consuming messages via
// lastMessage + a useEffect forces this app's own dispatch logic to run
// synchronously nested inside that flush. The fix moves dispatch into the
// library's onMessage option, which is called as a plain function before
// flushSync is ever invoked. This test captures the onMessage callback
// WebSocketProvider registers and invokes it directly (simulating a raw
// incoming WebSocket message, without needing a real socket or a real
// flushSync-triggering render), asserting that event listeners still fire
// correctly through that path.
let capturedOnMessage: ((message: MessageEvent) => void) | undefined;

vi.mock('react-use-websocket', () => ({
  default: (_url: string, options: any) => {
    capturedOnMessage = options.onMessage;
    return {
      lastMessage: null,
      readyState: 1, // OPEN
      sendMessage: vi.fn(),
      getWebSocket: () => null,
    };
  },
  ReadyState: {
    UNINSTANTIATED: -1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

function TestConsumer({
  onListen,
}: {
  onListen: (ctx: ReturnType<typeof useWebSocketContext>) => void;
}) {
  const ctx = useWebSocketContext();
  onListen(ctx);
  return null;
}

describe('WebSocketProvider message dispatch', () => {
  beforeEach(() => {
    capturedOnMessage = undefined;
  });

  it('registers onMessage on the underlying react-use-websocket hook', () => {
    render(
      <JotaiProvider>
        <WebSocketProvider config={{ url: 'ws://test' }}>
          <div />
        </WebSocketProvider>
      </JotaiProvider>,
    );

    expect(capturedOnMessage).toBeInstanceOf(Function);
  });

  it('dispatches a real incoming message to registered event listeners via onMessage, not lastMessage', () => {
    const received: any[] = [];
    let addEventListener: ReturnType<
      typeof useWebSocketContext
    >['addEventListener'];

    render(
      <JotaiProvider>
        <WebSocketProvider config={{ url: 'ws://test' }}>
          <TestConsumer
            onListen={(ctx) => {
              addEventListener = ctx.addEventListener;
            }}
          />
        </WebSocketProvider>
      </JotaiProvider>,
    );

    act(() => {
      addEventListener!('scan.progress', (data: any) => {
        received.push(data);
      });
    });

    expect(capturedOnMessage).toBeInstanceOf(Function);

    act(() => {
      capturedOnMessage!({
        data: JSON.stringify({
          type: 'scan.progress',
          data: { volume_id: 'vol-1', status: 'completed' },
        }),
      } as MessageEvent);
    });

    expect(received).toEqual([{ volume_id: 'vol-1', status: 'completed' }]);
  });

  it('handles a burst of messages without throwing (no forced synchronous flush per message)', () => {
    let addEventListener: ReturnType<
      typeof useWebSocketContext
    >['addEventListener'];
    const received: any[] = [];

    render(
      <JotaiProvider>
        <WebSocketProvider config={{ url: 'ws://test' }}>
          <TestConsumer
            onListen={(ctx) => {
              addEventListener = ctx.addEventListener;
            }}
          />
        </WebSocketProvider>
      </JotaiProvider>,
    );

    act(() => {
      addEventListener!('scan.progress', (data: any) => {
        received.push(data);
      });
    });

    // Simulate a burst — e.g. a bulk scan of many volumes each firing a
    // completion message in quick succession, all within one synchronous
    // block (no timers, no separate render cycles between them).
    act(() => {
      for (let i = 0; i < 50; i++) {
        capturedOnMessage!({
          data: JSON.stringify({
            type: 'scan.progress',
            data: { volume_id: `vol-${i}`, status: 'completed' },
          }),
        } as MessageEvent);
      }
    });

    expect(received).toHaveLength(50);
  });

  it('recovers from a malformed message without breaking subsequent dispatch', () => {
    let addEventListener: ReturnType<
      typeof useWebSocketContext
    >['addEventListener'];
    const received: any[] = [];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <JotaiProvider>
        <WebSocketProvider config={{ url: 'ws://test' }}>
          <TestConsumer
            onListen={(ctx) => {
              addEventListener = ctx.addEventListener;
            }}
          />
        </WebSocketProvider>
      </JotaiProvider>,
    );

    act(() => {
      addEventListener!('scan.progress', (data: any) => {
        received.push(data);
      });
    });

    act(() => {
      capturedOnMessage!({ data: 'not valid json{{{' } as MessageEvent);
      capturedOnMessage!({
        data: JSON.stringify({
          type: 'scan.progress',
          data: { volume_id: 'vol-ok', status: 'completed' },
        }),
      } as MessageEvent);
    });

    expect(received).toEqual([{ volume_id: 'vol-ok', status: 'completed' }]);
    consoleErrorSpy.mockRestore();
  });
});
