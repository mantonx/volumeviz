/**
 * Admin SystemSettingsPage Tests
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { SystemSettingsPage } from './SystemSettingsPage';

let server: ReturnType<typeof setupServer>;

afterEach(() => {
  server?.resetHandlers();
  server?.close();
});
afterAll(() => server?.close());

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const sampleConfig = {
  server: { mode: 'release', database_type: 'postgres' },
  auth: { enabled: true },
  rate_limit: { enabled: true, requests_per_minute: 60, burst: 30 },
  cors: { allowed_origins: ['http://localhost:5173'] },
  scan: { enabled: true, interval_seconds: 21600, concurrency: 3, bind_mounts_enabled: false },
  retention: {
    enabled: true,
    scan_jobs_days: 30,
    scan_metrics_days: 90,
    scan_phases_days: 7,
    file_metadata_days: 180,
    inactive_files_days: 60,
  },
  alerts: { enabled: false, evaluation_interval_minutes: 1 },
};

describe('Admin SystemSettingsPage', () => {
  it('shows the real running configuration instead of hardcoded fake defaults', async () => {
    server = setupServer(
      http.get('/api/v1/system/config', () => HttpResponse.json(sampleConfig)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<SystemSettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('release')).toBeInTheDocument();
    });
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:5173')).toBeInTheDocument();
    expect(screen.getByText('360 min')).toBeInTheDocument(); // 21600s scan interval
    expect(screen.getByText('30 days')).toBeInTheDocument(); // scan jobs retention

    // No editable form controls - this is read-only, not a fake save button
    expect(screen.queryByText('Save Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument();
    expect(document.querySelector('input')).not.toBeInTheDocument();
  });

  it('shows an honest error state when the request fails', async () => {
    server = setupServer(
      http.get('/api/v1/system/config', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<SystemSettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Couldn't load configuration")).toBeInTheDocument();
    });
  });

  it('shows a disabled status pill for disabled features instead of always-on fake toggles', async () => {
    server = setupServer(
      http.get('/api/v1/system/config', () => HttpResponse.json(sampleConfig)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<SystemSettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
  });
});
