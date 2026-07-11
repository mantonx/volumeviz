/**
 * Integration test for the volume list flow: load volumes from the real API
 * shape (via MSW) and confirm they render, backed by src/mocks/handlers.ts
 * fixtures rather than page-local component mocks.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ReadyState } from 'react-use-websocket';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { handlers } from '@/mocks/handlers';
import { AppProvider } from '@/providers/AppProvider';
import { WebSocketProvider } from '@/providers/websocket/WebSocketProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { VolumesPage } from '@/pages/VolumesPage/VolumesPage';

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

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider>
        <BrowserRouter>
          <WebSocketProvider config={{ shouldReconnect: false }}>
            <ToastProvider>{children}</ToastProvider>
          </WebSocketProvider>
        </BrowserRouter>
      </AppProvider>
    );
  };
};

describe('VolumesPage integration', () => {
  it('loads and displays volumes from the API', async () => {
    render(<VolumesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('production-db-data')).toBeInTheDocument();
    });

    expect(screen.getByText('redis-cache-vol')).toBeInTheDocument();
  });

  it('filters volumes by search query', async () => {
    const user = userEvent.setup();
    render(<VolumesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('production-db-data')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'production');

    await waitFor(() => {
      expect(screen.getByText('production-db-data')).toBeInTheDocument();
      expect(screen.queryByText('redis-cache-vol')).not.toBeInTheDocument();
    });
  });
});
