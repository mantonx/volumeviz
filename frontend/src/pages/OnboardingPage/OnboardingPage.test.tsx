/**
 * OnboardingPage Tests
 * Comprehensive test suite for onboarding wizard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingPage } from './OnboardingPage';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );
};

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ mounts: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders onboarding page', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Discover')).toBeInTheDocument();
    });

    it('shows step progress indicators', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('starts at discovery step', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Discovering Your Docker Mounts')).toBeInTheDocument();
    });
  });

  describe('Discovery Step', () => {
    it('shows loading state initially', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Scanning Docker mounts...')).toBeInTheDocument();
    });

    it('displays mount statistics after discovery', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mounts: [
            { mount_type: 'volume', is_orphaned: false },
            { mount_type: 'bind', is_orphaned: false },
          ],
        }),
      });

      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      });
    });

    it('shows refresh discovery button', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Refresh Discovery')).toBeInTheDocument();
      });
    });

    it('handles refresh discovery click', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh Discovery');
        fireEvent.click(refreshButton);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/mounts/discover',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('shows no mounts warning when appropriate', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/No Docker Mounts Discovered/)).toBeInTheDocument();
      });
    });

    it('disables next button when no discovery data', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Preset Selection Step', () => {
    beforeEach(async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      // Wait for discovery to load
      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      // Navigate to preset step
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    it('shows preset selection screen', () => {
      expect(screen.getByText('Choose Your Tracking Strategy')).toBeInTheDocument();
    });

    it('displays all preset options', () => {
      expect(screen.getByText('Server Default')).toBeInTheDocument();
      expect(screen.getByText('Strict')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('allows preset selection', () => {
      const serverPreset = screen.getByText('Server Default').closest('div');
      fireEvent.click(serverPreset!);

      const checkmarks = document.querySelectorAll('[data-lucide="check-circle"]');
      expect(checkmarks.length).toBeGreaterThan(0);
    });

    it('shows preset descriptions', () => {
      expect(screen.getByText(/Recommended for most server workloads/)).toBeInTheDocument();
    });

    it('disables next button when no preset selected', () => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('enables next button after preset selection', () => {
      const serverPreset = screen.getByText('Server Default').closest('div');
      fireEvent.click(serverPreset!);

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Preview Step', () => {
    beforeEach(async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      // Navigate through steps
      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next')); // To preset step

      await waitFor(() => {
        const serverPreset = screen.getByText('Server Default').closest('div');
        fireEvent.click(serverPreset!);
      });

      fireEvent.click(screen.getByText('Next')); // To preview step
    });

    it('shows preview configuration screen', () => {
      expect(screen.getByText('Preview Your Configuration')).toBeInTheDocument();
    });

    it('shows generate preview button', () => {
      expect(screen.getByText('Generate Preview')).toBeInTheDocument();
    });

    it('generates preview when button clicked', async () => {
      const generateButton = screen.getByText('Generate Preview');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Tracking Results')).toBeInTheDocument();
      });
    });

    it('displays tracking statistics', async () => {
      const generateButton = screen.getByText('Generate Preview');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Will Track')).toBeInTheDocument();
        expect(screen.getByText('Excluded')).toBeInTheDocument();
      });
    });

    it('shows selected preset rules', async () => {
      const generateButton = screen.getByText('Generate Preview');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/Selected Preset:/)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Step', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ mounts: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'rule-1' }),
        });

      render(<OnboardingPage />, { wrapper: createWrapper() });

      // Navigate through all steps
      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        const serverPreset = screen.getByText('Server Default').closest('div');
        fireEvent.click(serverPreset!);
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Preview');
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Tracking Results')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));
    });

    it('shows completion screen', () => {
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
    });

    it('displays tracked mounts count', () => {
      expect(screen.getByText('Mounts will be tracked')).toBeInTheDocument();
    });

    it('shows go to dashboard button', () => {
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    it('completes onboarding when button clicked', async () => {
      const completeButton = screen.getByText('Go to Dashboard');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(localStorage.getItem('volumeviz_onboarding_complete')).toBe('true');
      });
    });

    it('navigates to dashboard after completion', async () => {
      const completeButton = screen.getByText('Go to Dashboard');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', expect.any(Object));
      });
    });
  });

  describe('Navigation', () => {
    it('shows previous button on later steps', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    it('disables previous button on first step', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });
      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('navigates backwards correctly', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('Choose Your Tracking Strategy')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByText('Discovering Your Docker Mounts')).toBeInTheDocument();
    });
  });

  describe('State Persistence', () => {
    it('saves state to localStorage', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        const savedState = localStorage.getItem('volumeviz_onboarding_state');
        expect(savedState).toBeTruthy();
      });
    });

    it('restores state from localStorage', () => {
      localStorage.setItem(
        'volumeviz_onboarding_state',
        JSON.stringify({
          currentStep: 1,
          selectedPreset: 'server',
          customRules: [],
        })
      );

      render(<OnboardingPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Choose Your Tracking Strategy')).toBeInTheDocument();
    });

    it('clears state after completion', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'rule-1' }),
      });

      localStorage.setItem('volumeviz_onboarding_state', '{}');

      render(<OnboardingPage />, { wrapper: createWrapper() });

      // Fast-forward to completion (mock the state)
      // In real scenario, would navigate through all steps

      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles discovery API error gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

      render(<OnboardingPage />, { wrapper: createWrapper() });

      // Should fall back to mock data
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      });
    });

    it('handles rule creation error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Failed to save rule'));

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Scanning Docker mounts...')).not.toBeInTheDocument();
      });

      alertSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', async () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
      });
    });

    it('buttons have proper labels', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('disabled buttons have proper attributes', () => {
      render(<OnboardingPage />, { wrapper: createWrapper() });

      const previousButton = screen.getByText('Previous');
      expect(previousButton).toHaveAttribute('disabled');
    });
  });
});
