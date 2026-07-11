/**
 * RulesPage Tests
 *
 * Covers the migration off raw fetch() (which sent no Authorization header
 * and 401'd once auth was enabled) onto the real, auth-aware Orval hooks,
 * plus the real Create Rule flow.
 */

import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import RulesPage from './RulesPage';

let server: ReturnType<typeof setupServer>;

afterEach(() => {
  server?.resetHandlers();
  server?.close();
  localStorage.clear();
});
afterAll(() => server?.close());

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const sampleConfig = {
  rules: [
    {
      id: 1,
      name: 'Include Docker Volumes',
      description: 'Include all named volumes',
      action: 'include',
      priority: 100,
      is_enabled: true,
      conditions: [{ field_name: 'source_type', operator: 'equals', value: 'volume' }],
      match_count: 12,
    },
  ],
  total: 1,
  enabled: 1,
};

const samplePreview = {
  summary: { total_mounts: 72, mounts_included: 12, mounts_excluded: 5, mounts_unmatched: 55 },
  execution_time_ms: 8,
};

describe('RulesPage', () => {
  it('sends a real Authorization header on every tracking request, not an anonymous fetch()', async () => {
    localStorage.setItem('auth_token', 'test-token-abc');
    const seenAuthHeaders: (string | null)[] = [];

    server = setupServer(
      http.get('/api/v1/tracking/rules', ({ request }) => {
        seenAuthHeaders.push(request.headers.get('Authorization'));
        return HttpResponse.json(sampleConfig);
      }),
      http.post('/api/v1/tracking/preview', ({ request }) => {
        seenAuthHeaders.push(request.headers.get('Authorization'));
        return HttpResponse.json(samplePreview);
      }),
      http.get('/api/v1/rules/schema', () => HttpResponse.json({ fields: [], operators: [] })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<RulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Include Docker Volumes')).toBeInTheDocument();
    });

    expect(seenAuthHeaders.length).toBeGreaterThan(0);
    expect(seenAuthHeaders.every((h) => h === 'Bearer test-token-abc')).toBe(true);
  });

  it('shows real rule data and real preview numbers instead of nothing', async () => {
    server = setupServer(
      http.get('/api/v1/tracking/rules', () => HttpResponse.json(sampleConfig)),
      http.post('/api/v1/tracking/preview', () => HttpResponse.json(samplePreview)),
      http.get('/api/v1/rules/schema', () => HttpResponse.json({ fields: [], operators: [] })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<RulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Include Docker Volumes')).toBeInTheDocument();
    });
    expect(screen.getByText('12')).toBeInTheDocument(); // mounts_included
  });

  it('opens the real Create Rule modal instead of a placeholder', async () => {
    server = setupServer(
      http.get('/api/v1/tracking/rules', () => HttpResponse.json(sampleConfig)),
      http.post('/api/v1/tracking/preview', () => HttpResponse.json(samplePreview)),
      http.get('/api/v1/rules/schema', () =>
        HttpResponse.json({
          fields: [{ name: 'source_type', display_name: 'Mount Type', operators: ['equals'] }],
          operators: [{ name: 'equals', display_name: 'Equals', value_type: 'single' }],
        }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<RulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Include Docker Volumes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(screen.getByText('Create New Rule')).toBeInTheDocument();
    });
    expect(screen.queryByText('Rule creation form would go here...')).not.toBeInTheDocument();
  });
});
