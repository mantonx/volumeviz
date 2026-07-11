import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { BrowserRouter } from 'react-router-dom';
import { ReadyState } from 'react-use-websocket';
import { WebSocketProvider } from '@/providers/websocket/WebSocketProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { VolumesPage } from './VolumesPage';

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
});
