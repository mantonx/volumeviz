/**
 * Admin PermissionsPage Tests
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { PermissionsPage } from './PermissionsPage';

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

const samplePermissions = {
  resources: ['volumes', 'scans', 'files', 'users', 'organizations'],
  actions: ['read', 'write', 'delete'],
  roles: [
    {
      role: 'admin',
      grants: { 'volumes:read': true, 'volumes:write': true, 'volumes:delete': true },
      org_grants: {},
    },
    {
      role: 'operator',
      grants: { 'volumes:read': true },
      org_grants: { 'volumes:read': true },
    },
    {
      role: 'user',
      grants: { 'volumes:read': true },
      org_grants: {},
    },
    {
      role: 'viewer',
      grants: { 'volumes:read': true },
      org_grants: {},
    },
  ],
};

describe('Admin PermissionsPage', () => {
  it('shows the real permission matrix for the 4 enforced roles instead of mock data', async () => {
    server = setupServer(
      http.get('/api/v1/permissions', () => HttpResponse.json(samplePermissions)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<PermissionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    // The old mock's fake System category should be gone entirely
    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Role')).not.toBeInTheDocument();
  });

  it('locks global default grants and lets an org-scoped override be toggled', async () => {
    server = setupServer(
      http.get('/api/v1/permissions', () => HttpResponse.json(samplePermissions)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<PermissionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const adminCard = screen.getByText('Administrator').closest('.p-6') as HTMLElement;
    const adminReadButton = within(adminCard).getAllByText('read')[0].closest('button')!;
    expect(adminReadButton).toBeDisabled();

    const operatorCard = screen.getByText('Operator').closest('.p-6') as HTMLElement;
    const operatorReadButton = within(operatorCard).getAllByText('read')[0].closest('button')!;
    expect(operatorReadButton).not.toBeDisabled();
  });

  it('sends a real PUT request to revoke an org-scoped grant, not a local-state-only toggle', async () => {
    let putBody: any = null;
    server = setupServer(
      http.get('/api/v1/permissions', () => HttpResponse.json(samplePermissions)),
      http.put('/api/v1/permissions', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ granted: false });
      }),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<PermissionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Operator')).toBeInTheDocument();
    });

    const operatorCard = screen.getByText('Operator').closest('.p-6') as HTMLElement;
    const operatorReadButton = within(operatorCard).getAllByText('read')[0].closest('button')!;
    fireEvent.click(operatorReadButton);

    await waitFor(() => {
      expect(putBody).toEqual({
        role: 'operator',
        resource: 'volumes',
        action: 'read',
        granted: false,
      });
    });
  });

  it('shows an honest error when revoking a global default is rejected by the server', async () => {
    server = setupServer(
      http.get('/api/v1/permissions', () => HttpResponse.json(samplePermissions)),
      http.put('/api/v1/permissions', () =>
        HttpResponse.json({ error: 'Cannot revoke a global default permission' }, { status: 409 }),
      ),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<PermissionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Operator')).toBeInTheDocument();
    });

    const operatorCard = screen.getByText('Operator').closest('.p-6') as HTMLElement;
    const operatorReadButton = within(operatorCard).getAllByText('read')[0].closest('button')!;
    fireEvent.click(operatorReadButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to update|HTTP 409/i)).toBeInTheDocument();
    });
  });

  it('shows an honest error state when the request fails', async () => {
    server = setupServer(
      http.get('/api/v1/permissions', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(<PermissionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Couldn't load permissions")).toBeInTheDocument();
    });
  });
});
