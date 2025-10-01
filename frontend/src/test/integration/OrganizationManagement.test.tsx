/**
 * Integration tests for Organization Management workflows
 * Tests user management, authentication, and organization settings
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import OrganizationSettings from '@/pages/Organization/OrganizationSettings';

// Mock authentication utilities
jest.mock('@/utils/auth', () => ({
  getCurrentUser: jest.fn(() => ({
    id: 'user-456',
    email: 'admin@example.com',
    role: 'admin',
  })),
  logout: jest.fn(),
  hasPermission: jest.fn((permission: string) => {
    // Admin has all permissions
    return true;
  }),
}));

// Mock notification system
jest.mock('@/utils/notifications', () => ({
  showNotification: jest.fn(),
  showError: jest.fn(),
}));

// Test server setup
const server = setupServer(
  // Get current organization
  http.get('/api/v1/organizations/me', () => {
    return HttpResponse.json({
      id: 'org-123',
      name: 'Acme Corporation',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      settings: {
        retention_days: 30,
        max_storage_gb: 1000,
        scan_schedule: 'daily',
        notification_emails: ['admin@example.com'],
      },
      users: [
        {
          id: 'user-456',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-20T08:00:00Z',
          status: 'active',
        },
        {
          id: 'user-789',
          email: 'viewer@example.com',
          name: 'Viewer User',
          role: 'viewer',
          created_at: '2024-01-05T00:00:00Z',
          last_login: '2024-01-19T16:30:00Z',
          status: 'active',
        },
        {
          id: 'user-101',
          email: 'inactive@example.com',
          name: 'Inactive User',
          role: 'viewer',
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-01T00:00:00Z',
          status: 'inactive',
        },
      ],
    });
  }),

  // Update organization settings
  http.put('/api/v1/organizations/me', async ({ request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      id: 'org-123',
      name: body.name || 'Acme Corporation',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
      settings: {
        ...body.settings,
      },
      users: [], // Users array would be returned in real implementation
    });
  }),

  // Create user invitation
  http.post('/api/v1/organizations/me/invitations', async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      role: string;
      name?: string;
    };

    return HttpResponse.json({
      id: `inv-${Date.now()}`,
      email: body.email,
      role: body.role,
      name: body.name,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });
  }),

  // Get user invitations
  http.get('/api/v1/organizations/me/invitations', () => {
    return HttpResponse.json({
      invitations: [
        {
          id: 'inv-123',
          email: 'pending@example.com',
          role: 'editor',
          name: 'Pending User',
          status: 'pending',
          expires_at: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          created_at: '2024-01-18T00:00:00Z',
        },
      ],
    });
  }),

  // Update user role
  http.put(
    '/api/v1/organizations/me/users/:userId',
    async ({ params, request }) => {
      const userId = params.userId as string;
      const body = (await request.json()) as { role: string; status?: string };

      return HttpResponse.json({
        id: userId,
        email: 'updated@example.com',
        name: 'Updated User',
        role: body.role,
        status: body.status || 'active',
        created_at: '2024-01-01T00:00:00Z',
        last_login: new Date().toISOString(),
      });
    },
  ),

  // Remove user
  http.delete('/api/v1/organizations/me/users/:userId', ({ params }) => {
    const userId = params.userId as string;
    return HttpResponse.json({ success: true });
  }),

  // Revoke invitation
  http.delete(
    '/api/v1/organizations/me/invitations/:invitationId',
    ({ params }) => {
      const invitationId = params.invitationId as string;
      return HttpResponse.json({ success: true });
    },
  ),

  // Get organization usage statistics
  http.get('/api/v1/organizations/me/usage', () => {
    return HttpResponse.json({
      total_storage_bytes: 536870912000, // 500 GB
      total_volumes: 25,
      active_users: 2,
      scans_this_month: 150,
      retention_savings_bytes: 107374182400, // 100 GB
    });
  }),

  // Error simulation endpoints
  http.put('/api/v1/organizations/me/error-test', () => {
    return HttpResponse.json(
      { error: 'Validation failed: Name is required' },
      { status: 400 },
    );
  }),

  http.post('/api/v1/organizations/me/invitations/error-test', () => {
    return HttpResponse.json({ error: 'User already exists' }, { status: 409 });
  }),
);

// Test wrapper component
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </JotaiProvider>
    </MemoryRouter>
  );
}

describe('Organization Management Integration', () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('Organization Settings Loading', () => {
    it('should load and display organization information', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for organization data to load
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Acme Corporation'),
        ).toBeInTheDocument();
      });

      // Verify settings are displayed
      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // retention_days
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument(); // max_storage_gb
      expect(screen.getByDisplayValue('daily')).toBeInTheDocument(); // scan_schedule

      // Verify notification emails
      expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument();
    });

    it('should display user list with correct information', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
        expect(screen.getByText('viewer@example.com')).toBeInTheDocument();
        expect(screen.getByText('inactive@example.com')).toBeInTheDocument();
      });

      // Verify user details
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
      expect(screen.getByText('Inactive User')).toBeInTheDocument();

      // Verify roles
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getAllByText('viewer')).toHaveLength(2);

      // Verify status indicators
      expect(screen.getAllByText('active')).toHaveLength(2);
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    it('should display usage statistics', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for usage data to load
      await waitFor(() => {
        expect(screen.getByText('500.0 GB')).toBeInTheDocument(); // total storage
        expect(screen.getByText('25')).toBeInTheDocument(); // total volumes
        expect(screen.getByText('2')).toBeInTheDocument(); // active users
        expect(screen.getByText('150')).toBeInTheDocument(); // scans this month
        expect(screen.getByText('100.0 GB')).toBeInTheDocument(); // retention savings
      });
    });
  });

  describe('Organization Settings Updates', () => {
    it('should successfully update organization settings', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for form to load
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Acme Corporation'),
        ).toBeInTheDocument();
      });

      // Update organization name
      const nameInput = screen.getByDisplayValue('Acme Corporation');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Corporation');

      // Update retention days
      const retentionInput = screen.getByDisplayValue('30');
      await user.clear(retentionInput);
      await user.type(retentionInput, '60');

      // Update max storage
      const storageInput = screen.getByDisplayValue('1000');
      await user.clear(storageInput);
      await user.type(storageInput, '2000');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show loading state
      expect(saveButton).toBeDisabled();

      // Wait for save to complete
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      // Verify updated values persist
      expect(
        screen.getByDisplayValue('Updated Corporation'),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('60')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    });

    it('should handle validation errors when updating settings', async () => {
      // Mock validation error
      server.use(
        http.put('/api/v1/organizations/me', () => {
          return HttpResponse.json(
            { error: 'Validation failed: Name is required' },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for form to load
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Acme Corporation'),
        ).toBeInTheDocument();
      });

      // Clear name field (invalid)
      const nameInput = screen.getByDisplayValue('Acme Corporation');
      await user.clear(nameInput);

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Management', () => {
    it('should successfully invite a new user', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Find invite user button
      const inviteButton = screen.getByRole('button', { name: /invite user/i });
      await user.click(inviteButton);

      // Should show invite modal/form
      expect(
        screen.getByRole('dialog', { name: /invite user/i }),
      ).toBeInTheDocument();

      // Fill in invitation details
      const emailInput = screen.getByLabelText(/email/i);
      const nameInput = screen.getByLabelText(/name/i);
      const roleSelect = screen.getByLabelText(/role/i);

      await user.type(emailInput, 'newuser@example.com');
      await user.type(nameInput, 'New User');
      await user.selectOptions(roleSelect, 'editor');

      // Send invitation
      const sendButton = screen.getByRole('button', {
        name: /send invitation/i,
      });
      await user.click(sendButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/invitation sent/i)).toBeInTheDocument();
      });

      // Modal should close
      expect(
        screen.queryByRole('dialog', { name: /invite user/i }),
      ).not.toBeInTheDocument();
    });

    it('should handle duplicate user invitation error', async () => {
      // Mock duplicate user error
      server.use(
        http.post('/api/v1/organizations/me/invitations', () => {
          return HttpResponse.json(
            { error: 'User already exists' },
            { status: 409 },
          );
        }),
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Open invite modal
      const inviteButton = screen.getByRole('button', { name: /invite user/i });
      await user.click(inviteButton);

      // Fill in existing user email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'admin@example.com');

      // Try to send invitation
      const sendButton = screen.getByRole('button', {
        name: /send invitation/i,
      });
      await user.click(sendButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/user already exists/i)).toBeInTheDocument();
      });
    });

    it('should successfully update user role', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('viewer@example.com')).toBeInTheDocument();
      });

      // Find edit button for viewer user
      const editButtons = screen.getAllByRole('button', { name: /edit user/i });
      await user.click(editButtons[1]); // Second user (viewer)

      // Should show edit modal
      expect(
        screen.getByRole('dialog', { name: /edit user/i }),
      ).toBeInTheDocument();

      // Change role from viewer to editor
      const roleSelect = screen.getByLabelText(/role/i);
      await user.selectOptions(roleSelect, 'editor');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/user updated/i)).toBeInTheDocument();
      });

      // Modal should close and role should be updated
      expect(
        screen.queryByRole('dialog', { name: /edit user/i }),
      ).not.toBeInTheDocument();
    });

    it('should successfully remove a user', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('inactive@example.com')).toBeInTheDocument();
      });

      // Find remove button for inactive user
      const removeButtons = screen.getAllByRole('button', {
        name: /remove user/i,
      });
      await user.click(removeButtons[2]); // Third user (inactive)

      // Should show confirmation dialog
      expect(
        screen.getByRole('dialog', { name: /confirm removal/i }),
      ).toBeInTheDocument();

      // Confirm removal
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/user removed/i)).toBeInTheDocument();
      });

      // User should be removed from the list
      expect(
        screen.queryByText('inactive@example.com'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Invitation Management', () => {
    it('should display pending invitations', async () => {
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for invitations to load
      await waitFor(() => {
        expect(screen.getByText('pending@example.com')).toBeInTheDocument();
      });

      // Verify invitation details
      expect(screen.getByText('Pending User')).toBeInTheDocument();
      expect(screen.getByText('editor')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('should successfully revoke an invitation', async () => {
      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Wait for invitations to load
      await waitFor(() => {
        expect(screen.getByText('pending@example.com')).toBeInTheDocument();
      });

      // Find revoke button
      const revokeButton = screen.getByRole('button', {
        name: /revoke invitation/i,
      });
      await user.click(revokeButton);

      // Should show confirmation dialog
      expect(
        screen.getByRole('dialog', { name: /confirm revocation/i }),
      ).toBeInTheDocument();

      // Confirm revocation
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/invitation revoked/i)).toBeInTheDocument();
      });

      // Invitation should be removed from the list
      expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      server.use(
        http.get('/api/v1/organizations/me', () => {
          return HttpResponse.error();
        }),
      );

      const TestWrapper = createTestWrapper();
      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Should handle the error gracefully without crashing
      await waitFor(() => {
        expect(screen.getByText(/error loading/i)).toBeInTheDocument();
      });
    });

    it('should provide retry functionality on errors', async () => {
      let callCount = 0;

      // Mock failing request that succeeds on retry
      server.use(
        http.get('/api/v1/organizations/me', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            id: 'org-123',
            name: 'Acme Corporation',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
            settings: {},
            users: [],
          });
        }),
      );

      const user = userEvent.setup();
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <OrganizationSettings />
        </TestWrapper>,
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/error loading/i)).toBeInTheDocument();
      });

      // Find and click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should successfully load on retry
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Acme Corporation'),
        ).toBeInTheDocument();
      });
    });
  });
});
