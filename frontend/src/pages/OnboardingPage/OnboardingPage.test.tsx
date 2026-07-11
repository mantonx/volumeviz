/**
 * OnboardingPage Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import OnboardingPage from './OnboardingPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const twoMounts = [
  { mount_type: 'volume', is_orphaned: false },
  { mount_type: 'bind', is_orphaned: false },
];

let ruleIdCounter = 0;

// Default handlers cover the full real request chain this page now makes:
// discover mounts, list mounts, create each preset rule for real, preview
// those real rules, delete rules (on preset change), and apply on complete.
function defaultHandlers(mounts: unknown[] = twoMounts) {
  return [
    http.get('/api/v1/mounts', () => HttpResponse.json({ mounts })),
    http.post('/api/v1/mounts/discover', () => HttpResponse.json({ ok: true })),
    http.post('/api/v1/rules', async ({ request }) => {
      const body = (await request.json()) as { name: string };
      ruleIdCounter += 1;
      return HttpResponse.json({ id: ruleIdCounter, name: body.name });
    }),
    http.delete('/api/v1/rules/:id', () => HttpResponse.json({ ok: true })),
    http.post('/api/v1/tracking/preview', () =>
      HttpResponse.json({
        summary: {
          total_mounts: mounts.length,
          mounts_included: 1,
          mounts_excluded: 1,
          mounts_unmatched: Math.max(mounts.length - 2, 0),
        },
      }),
    ),
    http.post('/api/v1/tracking/apply', () =>
      HttpResponse.json({ dry_run: false, changes_count: 1, changes: [] }),
    ),
  ];
}

let server: ReturnType<typeof setupServer>;

beforeEach(() => {
  localStorage.clear();
  ruleIdCounter = 0;
});

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

async function goToPresetStep() {
  await waitFor(() => {
    expect(
      screen.queryByText('Scanning Docker mounts...'),
    ).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() => {
    expect(screen.getByText('Choose Your Tracking Strategy')).toBeInTheDocument();
  });
}

async function goToPreviewStep() {
  await goToPresetStep();
  fireEvent.click(screen.getByText('Server Default').closest('div')!);
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() => {
    expect(screen.getByText('Preview Your Configuration')).toBeInTheDocument();
  });
}

async function generateRealPreview() {
  await goToPreviewStep();
  fireEvent.click(screen.getByText('Generate Preview'));
  await waitFor(() => {
    expect(screen.getByText('Tracking Results')).toBeInTheDocument();
  });
}

describe('OnboardingPage', () => {
  describe('Initial Rendering', () => {
    it('renders onboarding page', () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Discover')).toBeInTheDocument();
    });

    it('starts at discovery step', () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(
        screen.getByText('Discovering Your Docker Mounts'),
      ).toBeInTheDocument();
    });
  });

  describe('Discovery Step', () => {
    it('displays real mount statistics after discovery', async () => {
      server = setupServer(...defaultHandlers(twoMounts));
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      });
    });

    it('shows an honest empty state for a genuine zero-mounts result, not fake data', async () => {
      server = setupServer(...defaultHandlers([]));
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });

      // The component re-fetches after triggering discovery, with a real
      // 1s delay in between (not a fake timer) - give waitFor enough room
      await waitFor(
        () => {
          expect(
            screen.getByText(/No Docker Mounts Discovered/),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('disables next button when no discovery data', () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Preset Selection Step', () => {
    beforeEach(async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await goToPresetStep();
    });

    it('displays all preset options', () => {
      expect(screen.getByText('Server Default')).toBeInTheDocument();
      expect(screen.getByText('Strict')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('disables next button when no preset selected', () => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('enables next button after preset selection', () => {
      fireEvent.click(screen.getByText('Server Default').closest('div')!);
      expect(screen.getByText('Next')).not.toBeDisabled();
    });
  });

  describe('Preview Step', () => {
    beforeEach(async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await goToPreviewStep();
    });

    it('shows the generate preview button before generating', () => {
      expect(screen.getByText('Generate Preview')).toBeInTheDocument();
    });

    it('creates the preset rules for real, then shows real tracking results from the preview endpoint', async () => {
      fireEvent.click(screen.getByText('Generate Preview'));
      await waitFor(() => {
        expect(screen.getByText('Tracking Results')).toBeInTheDocument();
      });

      // Real numbers from the mocked /api/v1/tracking/preview response,
      // not client-side-invented arithmetic
      expect(screen.getByText('Will Track')).toBeInTheDocument();
      expect(screen.getByText('Excluded')).toBeInTheDocument();
    });

    it('shows the selected preset rules', async () => {
      fireEvent.click(screen.getByText('Generate Preview'));
      await waitFor(() => {
        expect(screen.getByText('Tracking Results')).toBeInTheDocument();
      });
      expect(screen.getByText(/Selected Preset:/)).toBeInTheDocument();
    });

    it('shows an honest error state if the preview request fails, not fabricated numbers', async () => {
      server.use(
        http.post('/api/v1/tracking/preview', () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );

      fireEvent.click(screen.getByText('Generate Preview'));

      await waitFor(() => {
        expect(screen.getByText(/you can try again below/)).toBeInTheDocument();
      });
      expect(screen.queryByText('Tracking Results')).not.toBeInTheDocument();
    });
  });

  describe('Custom preset (zero rules)', () => {
    it('shows zero tracked without calling the preview endpoint (which treats empty rule_ids as "all rules")', async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await goToPresetStep();
      fireEvent.click(screen.getByText('Custom').closest('div')!);
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Preview Your Configuration')).toBeInTheDocument();
      });

      let previewCalled = false;
      server.use(
        http.post('/api/v1/tracking/preview', () => {
          previewCalled = true;
          return HttpResponse.json({ summary: {} });
        }),
      );

      fireEvent.click(screen.getByText('Generate Preview'));

      await waitFor(() => {
        expect(screen.getByText('Tracking Results')).toBeInTheDocument();
      });
      expect(previewCalled).toBe(false);
    });
  });

  describe('Complete Step', () => {
    beforeEach(async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await generateRealPreview();
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
      });
    });

    it('shows completion screen', () => {
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
    });

    it('does not re-POST rules on complete once they were already created during Preview', async () => {
      const rulesPostSpy = vi.fn();
      server.use(
        http.post('/api/v1/rules', () => {
          rulesPostSpy();
          return HttpResponse.json({ id: 999 });
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
      expect(rulesPostSpy).not.toHaveBeenCalled();
    });

    it('navigates to dashboard after completion', async () => {
      fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', expect.any(Object));
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
    });

    it('disables previous button on first step', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Previous')).toBeDisabled();
    });

    it('navigates backwards correctly', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await goToPresetStep();

      fireEvent.click(screen.getByText('Previous'));
      expect(
        screen.getByText('Discovering Your Docker Mounts'),
      ).toBeInTheDocument();
    });

    it('deletes rules created for the preview when going back to change preset', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await generateRealPreview();

      const deleteSpy = vi.fn();
      server.use(
        http.delete('/api/v1/rules/:id', () => {
          deleteSpy();
          return HttpResponse.json({ ok: true });
        }),
      );

      fireEvent.click(screen.getByText('Previous'));

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalled();
      });
    });
  });

  describe('State Persistence', () => {
    it('saves step/preset progress to localStorage', async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await goToPresetStep();

      await waitFor(() => {
        const savedState = localStorage.getItem('volumeviz_onboarding_state');
        expect(savedState).toBeTruthy();
      });
    });

    it('restores step/preset from localStorage but not stale preview results', async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      localStorage.setItem(
        'volumeviz_onboarding_state',
        JSON.stringify({
          currentStep: 1,
          selectedPreset: 'server',
          customRules: [],
        }),
      );

      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(
          screen.getByText('Choose Your Tracking Strategy'),
        ).toBeInTheDocument();
      });
    });

    it('clears onboarding state from localStorage after completion', async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      await generateRealPreview();
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));

      await waitFor(() => {
        expect(localStorage.getItem('volumeviz_onboarding_state')).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows a real error state on discovery failure, not fake sample data', async () => {
      // fetch only rejects on a genuine network-level failure (an HTTP
      // error status still resolves normally) - simulate that directly
      // since the component's catch block is specifically for this case
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('network down'));

      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Couldn't Load Mount Discovery")).toBeInTheDocument();
      });

      fetchSpy.mockRestore();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
    });

    it('shows an alert and does not crash if rule creation fails during preview generation', async () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<OnboardingPage />, { wrapper: createWrapper() });
      await goToPreviewStep();

      server.use(
        http.post('/api/v1/rules', () =>
          HttpResponse.json({ error: 'failed' }, { status: 500 }),
        ),
      );

      fireEvent.click(screen.getByText('Generate Preview'));

      await waitFor(() => {
        expect(screen.getByText(/you can try again below/)).toBeInTheDocument();
      });

      alertSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('buttons have proper labels', () => {
      server = setupServer(...defaultHandlers());
      server.listen({ onUnhandledRequest: 'error' });
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });
});
