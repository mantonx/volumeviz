import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { PhaseIndicator } from './PhaseIndicator';
import type { Phase, PhaseIndicatorProps } from './PhaseIndicator.types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => <div data-testid="check-icon">✓</div>,
  X: () => <div data-testid="x-icon">✗</div>,
  Clock: () => <div data-testid="clock-icon">⏰</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">→</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">↓</div>,
}));

// Sample test phases
const createTestPhases = (): Phase[] => [
  {
    id: 'phase1',
    label: 'Phase 1',
    description: 'First phase description',
    status: 'completed',
    clickable: true,
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    description: 'Second phase description',
    status: 'active',
    progress: 50,
    clickable: true,
  },
  {
    id: 'phase3',
    label: 'Phase 3',
    description: 'Third phase description',
    status: 'pending',
    clickable: true,
  },
];

const defaultProps: PhaseIndicatorProps = {
  phases: createTestPhases(),
  testId: 'test-phase-indicator',
};

describe('PhaseIndicator', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all phases correctly', () => {
      render(<PhaseIndicator {...defaultProps} />);

      expect(screen.getByText('Phase 1')).toBeInTheDocument();
      expect(screen.getByText('Phase 2')).toBeInTheDocument();
      expect(screen.getByText('Phase 3')).toBeInTheDocument();
    });

    it('renders phase descriptions when enabled', () => {
      render(<PhaseIndicator {...defaultProps} showDescriptions />);

      expect(screen.getByText('First phase description')).toBeInTheDocument();
      expect(screen.getByText('Second phase description')).toBeInTheDocument();
      expect(screen.getByText('Third phase description')).toBeInTheDocument();
    });

    it('hides phase descriptions when disabled', () => {
      render(<PhaseIndicator {...defaultProps} showDescriptions={false} />);

      expect(
        screen.queryByText('First phase description'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Second phase description'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Third phase description'),
      ).not.toBeInTheDocument();
    });

    it('renders correct status icons', () => {
      render(<PhaseIndicator {...defaultProps} />);

      expect(screen.getByTestId('check-icon')).toBeInTheDocument(); // completed
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument(); // active
    });

    it('renders with custom test ID', () => {
      render(<PhaseIndicator {...defaultProps} />);

      expect(screen.getByTestId('test-phase-indicator')).toBeInTheDocument();
      expect(
        screen.getByTestId('test-phase-indicator-phase-phase1'),
      ).toBeInTheDocument();
    });
  });

  describe('Orientation', () => {
    it('renders horizontally by default', () => {
      render(<PhaseIndicator {...defaultProps} />);

      const container = screen.getByTestId('test-phase-indicator');
      expect(container).toHaveClass('flex-row');
    });

    it('renders vertically when specified', () => {
      render(<PhaseIndicator {...defaultProps} orientation="vertical" />);

      const container = screen.getByTestId('test-phase-indicator');
      expect(container).toHaveClass('flex-col');
    });
  });

  describe('Sizes', () => {
    it('applies small size classes', () => {
      render(<PhaseIndicator {...defaultProps} size="sm" />);

      const phase = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase.querySelector('.w-6')).toBeInTheDocument(); // Small indicator size
    });

    it('applies medium size classes by default', () => {
      render(<PhaseIndicator {...defaultProps} />);

      const phase = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase.querySelector('.w-8')).toBeInTheDocument(); // Medium indicator size
    });

    it('applies large size classes', () => {
      render(<PhaseIndicator {...defaultProps} size="lg" />);

      const phase = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase.querySelector('.w-12')).toBeInTheDocument(); // Large indicator size
    });
  });

  describe('Progress Display', () => {
    it('shows progress bar for active phase with progress', () => {
      render(<PhaseIndicator {...defaultProps} showProgress />);

      // Should find a progress bar in the active phase
      const activePhase = screen.getByTestId(
        'test-phase-indicator-phase-phase2',
      );
      expect(activePhase).toBeInTheDocument();
    });

    it('hides progress bars when disabled', () => {
      render(<PhaseIndicator {...defaultProps} showProgress={false} />);

      // Progress bars should not be rendered
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Connectors', () => {
    it('renders connectors between phases', () => {
      render(<PhaseIndicator {...defaultProps} showConnectors />);

      expect(
        screen.getByTestId('test-phase-indicator-connector-0'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('test-phase-indicator-connector-1'),
      ).toBeInTheDocument();
    });

    it('hides connectors when disabled', () => {
      render(<PhaseIndicator {...defaultProps} showConnectors={false} />);

      expect(
        screen.queryByTestId('test-phase-indicator-connector-0'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('test-phase-indicator-connector-1'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onPhaseClick when phase is clicked and clickable', async () => {
      const mockOnPhaseClick = vi.fn();
      render(
        <PhaseIndicator
          {...defaultProps}
          clickable
          onPhaseClick={mockOnPhaseClick}
        />,
      );

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      await user.click(phase1);

      expect(mockOnPhaseClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'phase1',
          label: 'Phase 1',
        }),
      );
    });

    it('does not call onPhaseClick when not clickable', async () => {
      const mockOnPhaseClick = vi.fn();
      render(
        <PhaseIndicator
          {...defaultProps}
          clickable={false}
          onPhaseClick={mockOnPhaseClick}
        />,
      );

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      await user.click(phase1);

      expect(mockOnPhaseClick).not.toHaveBeenCalled();
    });

    it('does not call onPhaseClick for disabled phases', async () => {
      const mockOnPhaseClick = vi.fn();
      const phasesWithDisabled = [
        ...createTestPhases(),
        {
          id: 'disabled-phase',
          label: 'Disabled Phase',
          status: 'pending' as const,
          disabled: true,
          clickable: true,
        },
      ];

      render(
        <PhaseIndicator
          phases={phasesWithDisabled}
          clickable
          onPhaseClick={mockOnPhaseClick}
          testId="test-phase-indicator"
        />,
      );

      const disabledPhase = screen.getByTestId(
        'test-phase-indicator-phase-disabled-phase',
      );
      await user.click(disabledPhase);

      expect(mockOnPhaseClick).not.toHaveBeenCalled();
    });

    it('calls onPhaseHover when phase is hovered', async () => {
      const mockOnPhaseHover = vi.fn();
      render(
        <PhaseIndicator {...defaultProps} onPhaseHover={mockOnPhaseHover} />,
      );

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      await user.hover(phase1);

      expect(mockOnPhaseHover).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'phase1',
          label: 'Phase 1',
        }),
      );
    });

    it('supports keyboard navigation', async () => {
      const mockOnPhaseClick = vi.fn();
      render(
        <PhaseIndicator
          {...defaultProps}
          clickable
          onPhaseClick={mockOnPhaseClick}
        />,
      );

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      phase1.focus();

      expect(phase1).toHaveFocus();
      expect(phase1).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Active Phase', () => {
    it('identifies active phase from status', () => {
      render(<PhaseIndicator {...defaultProps} />);

      const activePhase = screen.getByTestId(
        'test-phase-indicator-phase-phase2',
      );
      expect(activePhase).toHaveAttribute('aria-current', 'step');
    });

    it('identifies active phase from activePhase prop', () => {
      render(<PhaseIndicator {...defaultProps} activePhase="phase3" />);

      const activePhase = screen.getByTestId(
        'test-phase-indicator-phase-phase3',
      );
      expect(activePhase).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<PhaseIndicator {...defaultProps} />);

      const container = screen.getByTestId('test-phase-indicator');
      expect(container).toHaveAttribute('role', 'progressbar');
      expect(container).toHaveAttribute('aria-label', 'Process phases');
      expect(container).toHaveAttribute('aria-valuenow', '2'); // Phase 2 is active (index 1 + 1)
      expect(container).toHaveAttribute('aria-valuemin', '1');
      expect(container).toHaveAttribute('aria-valuemax', '3');
    });

    it('has proper phase labels', () => {
      render(<PhaseIndicator {...defaultProps} />);

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase1).toHaveAttribute(
        'aria-label',
        'Phase: Phase 1 - First phase description',
      );
    });

    it('sets correct tabindex for clickable phases', () => {
      render(<PhaseIndicator {...defaultProps} clickable />);

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase1).toHaveAttribute('tabindex', '0');
      expect(phase1).toHaveAttribute('role', 'button');
    });

    it('sets correct tabindex for non-clickable phases', () => {
      render(<PhaseIndicator {...defaultProps} clickable={false} />);

      const phase1 = screen.getByTestId('test-phase-indicator-phase-phase1');
      expect(phase1).toHaveAttribute('tabindex', '-1');
      expect(phase1).not.toHaveAttribute('role', 'button');
    });
  });

  describe('Custom Icons', () => {
    it('renders custom icons when provided', () => {
      const phasesWithCustomIcons: Phase[] = [
        {
          id: 'custom',
          label: 'Custom',
          status: 'pending',
          icon: <div data-testid="custom-icon">🔧</div>,
        },
      ];

      render(
        <PhaseIndicator
          phases={phasesWithCustomIcons}
          testId="test-phase-indicator"
        />,
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('renders failed phase correctly', () => {
      const failedPhases: Phase[] = [
        {
          id: 'failed',
          label: 'Failed Phase',
          status: 'failed',
        },
      ];

      render(
        <PhaseIndicator phases={failedPhases} testId="test-phase-indicator" />,
      );

      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('renders skipped phase correctly', () => {
      const skippedPhases: Phase[] = [
        {
          id: 'skipped',
          label: 'Skipped Phase',
          status: 'skipped',
        },
      ];

      render(
        <PhaseIndicator phases={skippedPhases} testId="test-phase-indicator" />,
      );

      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(<PhaseIndicator {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty('focusPhase');
      expect(ref.current).toHaveProperty('getActivePhase');
      expect(ref.current).toHaveProperty('getPhase');
      expect(ref.current).toHaveProperty('scrollToPhase');
    });

    it('getActivePhase returns current active phase', () => {
      const ref = React.createRef<any>();
      render(<PhaseIndicator {...defaultProps} ref={ref} />);

      const activePhase = ref.current.getActivePhase();
      expect(activePhase).toEqual(
        expect.objectContaining({
          id: 'phase2',
          status: 'active',
        }),
      );
    });

    it('getPhase returns specific phase by ID', () => {
      const ref = React.createRef<any>();
      render(<PhaseIndicator {...defaultProps} ref={ref} />);

      const phase = ref.current.getPhase('phase1');
      expect(phase).toEqual(
        expect.objectContaining({
          id: 'phase1',
          label: 'Phase 1',
        }),
      );
    });
  });
});
