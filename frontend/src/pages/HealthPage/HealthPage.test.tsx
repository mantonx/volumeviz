/**
 * HealthPage Tests
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { HealthPage } from './HealthPage';

const healthyResponse = {
  status: 'healthy',
  timestamp: 1752246000,
  version: { version: '1.4.0' },
  checks: {
    docker: { status: 'healthy', version: '24.0.7', api_version: '1.43' },
    database: { status: 'healthy', type: 'store-managed' },
    events: {
      status: 'healthy',
      connected: true,
      queue_size: 0,
      processed_total: 120,
      errors_total: 0,
      dropped_total: 0,
      reconnects_total: 0,
      last_event_age_seconds: 12,
    },
    scheduler: {
      status: 'healthy',
      running: true,
      queue_depth: 0,
      active_scans: 1,
      worker_count: 4,
      total_completed: 42,
      total_failed: 0,
    },
  },
};

const degradedResponse = {
  ...healthyResponse,
  status: 'degraded',
  checks: {
    ...healthyResponse.checks,
    events: { ...healthyResponse.checks.events, status: 'unhealthy', connected: false },
  },
};

let server: ReturnType<typeof setupServer>;

afterEach(() => {
  server?.resetHandlers();
  server?.close();
});
afterAll(() => server?.close());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('HealthPage', () => {
  it('renders real health data for every dependency, not a coming-soon stub', async () => {
    server = setupServer(
      http.get('/api/v1/health', () => HttpResponse.json(healthyResponse)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<HealthPage />, { wrapper: createWrapper() });

    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Docker')).toBeInTheDocument();
    });
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Docker Events')).toBeInTheDocument();
    expect(screen.getByText('Scan Scheduler')).toBeInTheDocument();
    expect(screen.getByText(/Engine 24\.0\.7/)).toBeInTheDocument();
  });

  it('shows the real degraded status and which dependency caused it', async () => {
    server = setupServer(
      http.get('/api/v1/health', () => HttpResponse.json(degradedResponse, { status: 206 })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<HealthPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Connected: No')).toBeInTheDocument();
    });
    expect(screen.getAllByText('degraded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('unhealthy').length).toBeGreaterThan(0);
  });

  it('shows a real error state, not a silent failure, when the health check itself fails', async () => {
    server = setupServer(
      http.get('/api/v1/health', () => HttpResponse.json({}, { status: 500 })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<HealthPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Couldn't Load Health Status")).toBeInTheDocument();
    });
  });
});
