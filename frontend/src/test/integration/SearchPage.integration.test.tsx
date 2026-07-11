/**
 * Integration test for the file search flow: type a query into the real
 * SearchInterface and confirm results render, backed by the real
 * GET /api/v1/search/files MSW handler (src/mocks/handlers.ts) rather than
 * a page-local component mock.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';
import { AppProvider } from '@/providers/AppProvider';
import { SearchPage } from '@/pages/SearchPage/SearchPage';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AppProvider>
    );
  };
};

describe('SearchPage integration', () => {
  it('searches for files and displays real results from the API', async () => {
    const user = userEvent.setup();
    render(<SearchPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/search files and folders/i);
    await user.type(searchInput, 'signs{Enter}');

    await waitFor(() => {
      expect(screen.getByText('signs.txt')).toBeInTheDocument();
    });

    expect(screen.getByText('signs.pdf')).toBeInTheDocument();
  });

  it('filters results as the query narrows', async () => {
    const user = userEvent.setup();
    render(<SearchPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/search files and folders/i);
    await user.type(searchInput, 'signs.pdf{Enter}');

    await waitFor(() => {
      expect(screen.getByText('signs.pdf')).toBeInTheDocument();
    });

    expect(screen.queryByText('signs.txt')).not.toBeInTheDocument();
  });
});
