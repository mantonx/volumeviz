import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { BrowserRouter } from 'react-router-dom';
import { ReadyState } from 'react-use-websocket';
import { WebSocketProvider } from '@/providers/websocket/WebSocketProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { VolumesPage } from './VolumesPage';
import * as volumeWebSocketModule from '@/hooks/useVolumeWebSocket';

// Avoid a real WebSocket connection attempt (and its reconnect timers) in
// jsdom — WebSocketProvider only needs a stable, inert connection object.
vi.mock('react-use-websocket', () => ({
  default: () => ({
    lastMessage: null,
    readyState: ReadyState.CLOSED,
    sendMessage: vi.fn(),
    getWebSocket: () => null,
  }),
  ReadyState: {
    UNINSTANTIATED: -1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

/**
 * Test wrapper with all required providers
 */
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <BrowserRouter>
            <WebSocketProvider config={{ shouldReconnect: false }}>
              <ToastProvider>{children}</ToastProvider>
            </WebSocketProvider>
          </BrowserRouter>
        </JotaiProvider>
      </QueryClientProvider>
    );
  };
};

describe('VolumesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the page title', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Volumes')).toBeInTheDocument();
      expect(
        screen.getByText('Manage and analyze your Docker volumes'),
      ).toBeInTheDocument();
    });

    it('renders the Export button', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('renders the VolumesList component', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      // VolumesList should be rendered (check for its characteristic elements)
      expect(
        screen.getByRole('heading', { name: 'Volumes' }),
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      const mainHeading = screen.getByRole('heading', {
        level: 1,
        name: /volumes/i,
      });
      expect(mainHeading).toBeInTheDocument();
    });

    it('buttons have accessible names', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      expect(
        screen.getByRole('button', { name: /export/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates with VolumesList component', () => {
      render(<VolumesPage />, { wrapper: createWrapper() });

      // Check that VolumesList is rendered by looking for its elements
      // This is a basic integration check
      expect(
        screen.getByRole('heading', { name: /volumes/i }),
      ).toBeInTheDocument();
    });
  });

  // Regression coverage for SCAN_UX_ARCHITECTURE.md #3b: onSizeUpdate/
  // onMetadataUpdate used to invalidate the volumes query immediately on
  // every message, and a real bulk scan fires one of each PER VOLUME —
  // enough near-simultaneous requests to trip the backend's rate limiter.
  // Mocks useVolumeWebSocket directly (rather than driving a real
  // react-use-websocket message) so these tests exercise VolumesPage's own
  // debounce logic without needing to simulate the transport layer.
  describe('WebSocket-driven refetch debouncing', () => {
    let sizeUpdateCallback: ((event: any) => void) | undefined;
    let metadataUpdateCallback: ((event: any) => void) | undefined;
    let progressCallback: ((event: any) => void) | undefined;
    let invalidateQueriesSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      sizeUpdateCallback = undefined;
      metadataUpdateCallback = undefined;
      progressCallback = undefined;

      vi.spyOn(volumeWebSocketModule, 'useVolumeWebSocket').mockReturnValue({
        isConnected: true,
        onSizeUpdate: (cb: (event: any) => void) => {
          sizeUpdateCallback = cb;
          return () => {};
        },
        onMetadataUpdate: (cb: (event: any) => void) => {
          metadataUpdateCallback = cb;
          return () => {};
        },
        onScanProgress: (cb: (event: any) => void) => {
          progressCallback = cb;
          return () => {};
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const renderWithSpy = () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      invalidateQueriesSpy = vi.fn();
      queryClient.invalidateQueries = invalidateQueriesSpy;

      render(
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <BrowserRouter>
              <WebSocketProvider config={{ shouldReconnect: false }}>
                <ToastProvider>
                  <VolumesPage />
                </ToastProvider>
              </WebSocketProvider>
            </BrowserRouter>
          </JotaiProvider>
        </QueryClientProvider>,
      );
    };

    it('coalesces a burst of size/metadata updates into a single debounced refetch', () => {
      renderWithSpy();

      // Simulate a bulk scan of 3 volumes each firing size + metadata
      // events in quick succession (well within the 500ms debounce window).
      act(() => {
        sizeUpdateCallback?.({ volume_id: 'vol-1' });
        metadataUpdateCallback?.({ volume_id: 'vol-1' });
        sizeUpdateCallback?.({ volume_id: 'vol-2' });
        metadataUpdateCallback?.({ volume_id: 'vol-2' });
        sizeUpdateCallback?.({ volume_id: 'vol-3' });
        metadataUpdateCallback?.({ volume_id: 'vol-3' });
      });

      // Nothing should have fired yet — still within the debounce window.
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Six events in, but only one actual refetch.
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['/api/v1/volumes'],
      });
    });

    it('resets the debounce window on each new event rather than firing on a fixed interval', () => {
      renderWithSpy();

      act(() => {
        sizeUpdateCallback?.({ volume_id: 'vol-1' });
      });
      act(() => {
        vi.advanceTimersByTime(400); // under the 500ms window
      });
      act(() => {
        sizeUpdateCallback?.({ volume_id: 'vol-2' }); // resets the timer
      });
      act(() => {
        vi.advanceTimersByTime(400); // still under 500ms since the reset
      });

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100); // completes the 500ms from the reset
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    });

    it('also debounces a scan-completed progress event', () => {
      renderWithSpy();

      act(() => {
        progressCallback?.({ volume_id: 'vol-1', status: 'completed' });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    });

    it('does not refetch on a non-completed progress event', () => {
      renderWithSpy();

      act(() => {
        progressCallback?.({ volume_id: 'vol-1', status: 'running' });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });
});
