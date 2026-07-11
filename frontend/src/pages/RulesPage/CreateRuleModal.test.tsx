/**
 * CreateRuleModal Tests
 */

import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { CreateRuleModal } from './CreateRuleModal';

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

const sampleSchema = {
  fields: [
    {
      name: 'source_type',
      display_name: 'Mount Type',
      description: 'Type of mount',
      type: 'string',
      values: ['volume', 'bind', 'tmpfs'],
      operators: ['equals', 'not_equals', 'in', 'not_in'],
    },
    {
      name: 'compose_project',
      display_name: 'Compose Project',
      description: 'Docker Compose project name',
      type: 'string',
      operators: ['equals', 'not_equals', 'prefix', 'suffix', 'contains'],
    },
  ],
  operators: [
    { name: 'equals', display_name: 'Equals', description: 'Exact match', value_type: 'single' },
    { name: 'not_equals', display_name: 'Not Equals', description: '', value_type: 'single' },
    { name: 'in', display_name: 'In List', description: '', value_type: 'multiple' },
    { name: 'not_in', display_name: 'Not In List', description: '', value_type: 'multiple' },
    { name: 'prefix', display_name: 'Starts With', description: '', value_type: 'single' },
    { name: 'suffix', display_name: 'Ends With', description: '', value_type: 'single' },
    { name: 'contains', display_name: 'Contains', description: '', value_type: 'single' },
  ],
};

describe('CreateRuleModal', () => {
  it('loads the real field/operator schema instead of hardcoding options', async () => {
    server = setupServer(
      http.get('/api/v1/rules/schema', () => HttpResponse.json(sampleSchema)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(
      <CreateRuleModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Mount Type')).toBeInTheDocument();
    });
    expect(screen.getByText('Compose Project')).toBeInTheDocument();
  });

  it('validates the rule server-side before creating it', async () => {
    let validateCalled = false;
    let createCalled = false;

    server = setupServer(
      http.get('/api/v1/rules/schema', () => HttpResponse.json(sampleSchema)),
      http.post('/api/v1/rules/validate', async ({ request }) => {
        validateCalled = true;
        const body = (await request.json()) as { name: string };
        expect(body.name).toBe('Include Prod Volumes');
        return HttpResponse.json({ is_valid: true, errors: [], warnings: [] });
      }),
      http.post('/api/v1/rules', async () => {
        createCalled = true;
        return HttpResponse.json({ id: 42, name: 'Include Prod Volumes' }, { status: 201 });
      }),
    );
    server.listen({ onUnhandledRequest: 'error' });

    const onCreated = vi.fn();
    render(
      <CreateRuleModal open={true} onClose={vi.fn()} onCreated={onCreated} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('value')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Include Docker Volumes'), {
      target: { value: 'Include Prod Volumes' },
    });

    const valueInputs = screen.getAllByPlaceholderText('value');
    fireEvent.change(valueInputs[0], { target: { value: 'volume' } });

    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(createCalled).toBe(true);
    });
    expect(validateCalled).toBe(true);
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows real validation errors from the server instead of creating an invalid rule', async () => {
    server = setupServer(
      http.get('/api/v1/rules/schema', () => HttpResponse.json(sampleSchema)),
      http.post('/api/v1/rules/validate', () =>
        HttpResponse.json({
          is_valid: false,
          errors: [{ field: 'name', message: 'Rule name is required', code: 'required' }],
          warnings: [],
        }),
      ),
      http.post('/api/v1/rules', () => {
        throw new Error('should not be called when validation fails');
      }),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(
      <CreateRuleModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('value')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Include Docker Volumes'), {
      target: { value: 'x' },
    });
    const valueInputs = screen.getAllByPlaceholderText('value');
    fireEvent.change(valueInputs[0], { target: { value: 'volume' } });

    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(screen.getByText('Rule name is required')).toBeInTheDocument();
    });
  });

  it('switches to a comma-separated placeholder for multi-value operators', async () => {
    server = setupServer(
      http.get('/api/v1/rules/schema', () => HttpResponse.json(sampleSchema)),
    );
    server.listen({ onUnhandledRequest: 'error' });

    render(
      <CreateRuleModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    // Wait for the condition row's operator <select> to be populated
    // (seeded by an effect after the schema loads), not just for the field
    // <select> to have options - otherwise the change event below fires on
    // an operator <select> with no <option>s yet.
    await waitFor(() => {
      expect(screen.getByText('Equals')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    // [0] = Action select, [1] = field select, [2] = operator select
    fireEvent.change(selects[2], { target: { value: 'in' } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('value1, value2')).toBeInTheDocument();
    });
  });
});
