/**
 * Admin DashboardPage Tests
 */

import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReadyState } from 'react-use-websocket';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { WebSocketProvider } from '@/providers/websocket/WebSocketProvider';
import { DashboardPage } from './DashboardPage';

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

const healthResponse = {
  status: 'healthy',
  timestamp: 1752246000,
  version: { version: 'dev' },
  checks: {
    docker: { status: 'healthy' },
    database: { status: 'healthy' },
    scheduler: {
      status: 'healthy',
      running: true,
      active_scans: 3,
      total_completed: 128,
      queue_depth: 0,
      worker_count: 4,
    },
  },
};

const activityResponse = {
  events: [
    { id: 1, action: 'volume.delete', resource_type: 'volume', resource_id: 'abc', status: 'success', timestamp: '2026-07-10T00:00:00Z' },
  ],
};

let server: ReturnType<typeof setupServer>;

afterEach(() => {
  server?.resetHandlers();
  server?.close();
});
afterAll(() => server?.close());

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider config={{ shouldReconnect: false }}>{children}</WebSocketProvider>
    </QueryClientProvider>
  );
};

describe('Admin DashboardPage', () => {
  it('shows real scan counts from the scheduler health check, not hardcoded zeros', async () => {
    server = setupServer(
      http.get('/api/v1/users', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/organizations', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/volumes', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/health', () => HttpResponse.json(healthResponse)),
      http.get('/api/v1/activity/recent', () => HttpResponse.json(activityResponse)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('128')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows real per-dependency system health instead of hardcoded all-healthy', async () => {
    const degraded = {
      ...healthResponse,
      status: 'degraded',
      checks: { ...healthResponse.checks, database: { status: 'unhealthy', error: 'connection refused' } },
    };
    server = setupServer(
      http.get('/api/v1/users', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/organizations', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/volumes', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/health', () => HttpResponse.json(degraded, { status: 206 })),
      http.get('/api/v1/activity/recent', () => HttpResponse.json({ events: [] })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('unhealthy')).toBeInTheDocument();
    });
  });

  it('shows real audit-log events instead of a coming-soon placeholder', async () => {
    server = setupServer(
      http.get('/api/v1/users', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/organizations', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/volumes', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/health', () => HttpResponse.json(healthResponse)),
      http.get('/api/v1/activity/recent', () => HttpResponse.json(activityResponse)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.queryByText('Activity log coming soon')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('volume.delete')).toBeInTheDocument();
    });
  });

  it('shows an honest empty state when there is no activity yet', async () => {
    server = setupServer(
      http.get('/api/v1/users', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/organizations', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/volumes', () => HttpResponse.json({ data: [], total: 0 })),
      http.get('/api/v1/health', () => HttpResponse.json(healthResponse)),
      http.get('/api/v1/activity/recent', () => HttpResponse.json({ events: [] })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });
  });
});
