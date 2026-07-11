/**
 * Admin AuditLogsPage Tests
 */

import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { AuditLogsPage } from './AuditLogsPage';

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

const sampleLogs = [
  {
    id: 2,
    timestamp: '2026-07-10T14:30:00Z',
    user_id: 1,
    username: 'admin',
    action: 'volume.delete',
    resource_type: 'volume',
    resource_id: 'abc',
    ip_address: '192.168.1.100',
    status: 'success',
    details: { name: 'movies' },
  },
  {
    id: 1,
    timestamp: '2026-07-10T14:15:00Z',
    user_id: 7,
    username: 'demouser',
    action: 'login',
    resource_type: 'auth',
    status: 'failed',
  },
];

describe('Admin AuditLogsPage', () => {
  it('shows real audit log entries instead of the hardcoded mock rows', async () => {
    server = setupServer(
      http.get('/api/v1/audit-logs', () =>
        HttpResponse.json({ logs: sampleLogs, total: 2, limit: 25, offset: 0 }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('volume.delete')).toBeInTheDocument();
    });
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('demouser')).toBeInTheDocument();
    // The old mock data's fixed 4 rows should be gone entirely
    expect(screen.queryByText('create_user')).not.toBeInTheDocument();
  });

  it('sends the search term to the real API instead of filtering client-side mock data', async () => {
    let capturedSearch: string | null = null;
    server = setupServer(
      http.get('/api/v1/audit-logs', ({ request }) => {
        const url = new URL(request.url);
        capturedSearch = url.searchParams.get('search');
        return HttpResponse.json({ logs: sampleLogs, total: 2, limit: 25, offset: 0 });
      }),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('volume.delete')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Search logs...'), {
      target: { value: 'demouser' },
    });

    await waitFor(() => {
      expect(capturedSearch).toBe('demouser');
    });
  });

  it('shows an honest empty state when there are no matching logs', async () => {
    server = setupServer(
      http.get('/api/v1/audit-logs', () =>
        HttpResponse.json({ logs: [], total: 0, limit: 25, offset: 0 }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });
  });

  it('shows an honest error state when the request fails', async () => {
    server = setupServer(
      http.get('/api/v1/audit-logs', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Couldn't load audit logs")).toBeInTheDocument();
    });
  });

  it('paginates using real offset/limit params instead of client-side slicing', async () => {
    const requestedOffsets: number[] = [];
    server = setupServer(
      http.get('/api/v1/audit-logs', ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        requestedOffsets.push(offset);
        return HttpResponse.json({ logs: sampleLogs, total: 60, limit: 25, offset });
      }),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Showing 26–50 of 60')).toBeInTheDocument();
    });
    expect(requestedOffsets).toContain(25);
  });

  it('downloads a real CSV export instead of doing nothing', async () => {
    server = setupServer(
      http.get('/api/v1/audit-logs', () =>
        HttpResponse.json({ logs: sampleLogs, total: 2, limit: 25, offset: 0 }),
      ),
      http.get('/api/v1/audit-logs/export', () =>
        HttpResponse.text('id,timestamp,username,action,resource_type,resource_id,ip_address,status\n', {
          headers: { 'Content-Type': 'text/csv' },
        }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    render(<AuditLogsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('volume.delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export Logs'));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
  });
});
