import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProcessTimeline } from './ProcessTimeline';
import type {
  ProcessTimelineRef,
  ProcessTimelinePhase,
} from './ProcessTimeline.types';
import { createScanTimeline } from './ProcessTimeline.types';
import { useRef } from 'react';
import { Search, FolderOpen, CheckCircle } from 'lucide-react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Sample test data
const createTestPhases = (): ProcessTimelinePhase[] => [
  {
    id: 'phase1',
    label: 'Phase 1',
    description: 'First phase description',
    status: 'completed',
    progress: 100,
    icon: <Search data-testid="phase1-icon" />,
    timestamps: {
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
    },
    duration: { estimated: 300, actual: 280 },
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    description: 'Second phase description',
    status: 'active',
    progress: 65,
    icon: <FolderOpen data-testid="phase2-icon" />,
    timestamps: {
      startedAt: new Date('2024-01-01T10:05:00Z'),
    },
    duration: { estimated: 600 },
    metadata: {
      filesProcessed: 1500,
      totalFiles: 2300,
      currentPath: '/data/files',
    },
  },
  {
    id: 'phase3',
    label: 'Phase 3',
    description: 'Third phase description',
    status: 'pending',
    icon: <CheckCircle data-testid="phase3-icon" />,
    duration: { estimated: 180 },
  },
];

const createFailedPhases = (): ProcessTimelinePhase[] => [
  {
    id: 'phase1',
    label: 'Phase 1',
    status: 'completed',
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    status: 'failed',
    progress: 30,
    error: {
      message: 'Permission denied',
      code: 'EACCES',
      details: 'Cannot access restricted directory',
    },
  },
  {
    id: 'phase3',
    label: 'Phase 3',
    status: 'pending',
  },
];

describe('ProcessTimeline', () => {
  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} />);

      const timeline = screen.getByTestId('process-timeline');
      expect(timeline).toBeInTheDocument();
      expect(timeline).toHaveAttribute('data-orientation', 'vertical');
      expect(timeline).toHaveAttribute('data-size', 'md');
    });

    it('renders all phases', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} />);

      phases.forEach((phase) => {
        expect(
          screen.getByTestId(`process-timeline-phase-${phase.id}`),
        ).toBeInTheDocument();
        expect(screen.getByText(phase.label)).toBeInTheDocument();
      });
    });

    it('renders with custom test ID', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} testId="custom-timeline" />);

      const timeline = screen.getByTestId('custom-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} className="custom-class" />);

      const timeline = screen.getByTestId('process-timeline');
      expect(timeline).toHaveClass('custom-class');
    });
  });

  // Props Validation Tests
  describe('Props Validation', () => {
    it('applies orientation correctly', () => {
      const phases = createTestPhases();
      const { rerender } = render(
        <ProcessTimeline phases={phases} orientation="vertical" />,
      );

      let timeline = screen.getByTestId('process-timeline');
      expect(timeline).toHaveAttribute('data-orientation', 'vertical');
      expect(timeline).toHaveClass('flex', 'flex-col');

      rerender(<ProcessTimeline phases={phases} orientation="horizontal" />);
      timeline = screen.getByTestId('process-timeline');
      expect(timeline).toHaveAttribute('data-orientation', 'horizontal');
      expect(timeline).toHaveClass('flex', 'items-center');
    });

    it('applies size variants correctly', () => {
      const phases = createTestPhases();
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { container } = render(
          <ProcessTimeline phases={phases} size={size} />,
        );
        const timeline = container.querySelector(
          '[data-testid="process-timeline"]',
        );
        expect(timeline).toHaveAttribute('data-size', size);
      });
    });

    it('shows progress bars when showProgress is true', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showProgress />);

      // Should show progress for active phase
      const activePhase = phases.find((p) => p.status === 'active');
      if (activePhase) {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      }
    });

    it('hides progress bars when showProgress is false', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showProgress={false} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows descriptions when showDescriptions is true', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showDescriptions />);

      phases.forEach((phase) => {
        if (phase.description) {
          expect(screen.getByText(phase.description)).toBeInTheDocument();
        }
      });
    });

    it('hides descriptions when showDescriptions is false', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showDescriptions={false} />);

      phases.forEach((phase) => {
        if (phase.description) {
          expect(screen.queryByText(phase.description)).not.toBeInTheDocument();
        }
      });
    });

    it('shows timestamps when showTimestamps is true', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showTimestamps />);

      // Should show timestamps for phases that have them
      expect(screen.getByText(/Started:/)).toBeInTheDocument();
      expect(screen.getByText(/Completed:/)).toBeInTheDocument();
    });

    it('shows durations when showDurations is true', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} showDurations />);

      // Should show duration information
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText(/Est:/)).toBeInTheDocument();
    });
  });

  // Phase Status Tests
  describe('Phase Status Rendering', () => {
    it('renders completed phases correctly', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} />);

      const completedPhase = screen.getByTestId(
        'process-timeline-phase-phase1',
      );
      expect(completedPhase).toHaveAttribute('data-phase-status', 'completed');
    });

    it('renders active phases correctly', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} currentPhase="phase2" />);

      const activePhase = screen.getByTestId('process-timeline-phase-phase2');
      expect(activePhase).toHaveAttribute('data-phase-status', 'active');
      expect(activePhase).toHaveAttribute('data-phase-active', 'true');
    });

    it('renders pending phases correctly', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} />);

      const pendingPhase = screen.getByTestId('process-timeline-phase-phase3');
      expect(pendingPhase).toHaveAttribute('data-phase-status', 'pending');
    });

    it('renders failed phases with error information', () => {
      const phases = createFailedPhases();
      render(<ProcessTimeline phases={phases} />);

      const failedPhase = screen.getByTestId('process-timeline-phase-phase2');
      expect(failedPhase).toHaveAttribute('data-phase-status', 'failed');
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });

    it('shows metadata for phases that have it', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} />);

      // Should show file processing information
      expect(
        screen.getByText(/1,500 files processed of 2,300/),
      ).toBeInTheDocument();
    });
  });

  // Interaction Tests
  describe('Interaction', () => {
    it('handles phase click events', () => {
      const handlePhaseClick = vi.fn();
      const phases = createTestPhases();

      render(
        <ProcessTimeline phases={phases} onPhaseClick={handlePhaseClick} />,
      );

      // StatusBadge should be clickable
      const phaseButton = screen.getAllByRole('button')[0];
      fireEvent.click(phaseButton);

      expect(handlePhaseClick).toHaveBeenCalledWith(phases[0]);
    });

    it('handles retry for failed phases', () => {
      const handleRetryPhase = vi.fn();
      const phases = createFailedPhases();

      render(
        <ProcessTimeline phases={phases} onRetryPhase={handleRetryPhase} />,
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(handleRetryPhase).toHaveBeenCalledWith(phases[1]);
    });

    it('handles keyboard navigation for clickable phases', async () => {
      const handlePhaseClick = vi.fn();
      const phases = createTestPhases();
      const user = userEvent.setup();

      render(
        <ProcessTimeline phases={phases} onPhaseClick={handlePhaseClick} />,
      );

      // Focus and activate first phase
      await user.tab();
      await user.keyboard('{Enter}');

      expect(handlePhaseClick).toHaveBeenCalled();
    });
  });

  // Ref API Tests
  describe('Ref API', () => {
    const TestComponent = () => {
      const ref = useRef<ProcessTimelineRef>(null);
      const phases = createTestPhases();

      return (
        <div>
          <ProcessTimeline ref={ref} phases={phases} />
          <button onClick={() => ref.current?.focusPhase('phase2')}>
            Focus Phase 2
          </button>
          <button onClick={() => ref.current?.scrollToPhase('phase3')}>
            Scroll to Phase 3
          </button>
          <button onClick={() => ref.current?.getElement()}>Get Element</button>
          <button onClick={() => ref.current?.getPhaseElement('phase1')}>
            Get Phase Element
          </button>
        </div>
      );
    };

    it('exposes getElement method', () => {
      const ref = { current: null as ProcessTimelineRef | null };
      const phases = createTestPhases();

      render(<ProcessTimeline ref={ref} phases={phases} />);

      const element = ref.current?.getElement();
      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('exposes getPhaseElement method', () => {
      const ref = { current: null as ProcessTimelineRef | null };
      const phases = createTestPhases();

      render(<ProcessTimeline ref={ref} phases={phases} />);

      const phaseElement = ref.current?.getPhaseElement('phase1');
      expect(phaseElement).toBeInstanceOf(HTMLElement);
    });

    it('exposes focusPhase method', () => {
      const ref = { current: null as ProcessTimelineRef | null };
      const phases = createTestPhases();

      render(<ProcessTimeline ref={ref} phases={phases} />);

      // Should not throw when calling focusPhase
      expect(() => ref.current?.focusPhase('phase1')).not.toThrow();
    });

    it('exposes scrollToPhase method', () => {
      const ref = { current: null as ProcessTimelineRef | null };
      const phases = createTestPhases();

      // Mock scrollIntoView
      const scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(<ProcessTimeline ref={ref} phases={phases} />);

      ref.current?.scrollToPhase('phase1');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const phases = createTestPhases();
      const { container } = render(
        <ProcessTimeline
          phases={phases}
          showProgress
          showDescriptions
          showTimestamps
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA attributes for timeline', () => {
      const phases = createTestPhases();
      render(<ProcessTimeline phases={phases} status="running" />);

      const timeline = screen.getByTestId('process-timeline');
      expect(timeline).toHaveAttribute('data-status', 'running');
    });

    it('maintains accessibility for clickable phases', async () => {
      const phases = createTestPhases();
      const { container } = render(
        <ProcessTimeline phases={phases} onPhaseClick={() => {}} />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides accessible error information', async () => {
      const phases = createFailedPhases();
      const { container } = render(<ProcessTimeline phases={phases} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Error message should be accessible
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  // Utility Function Tests
  describe('Utility Functions', () => {
    it('createScanTimeline utility works correctly', () => {
      const scanProgressData = [
        {
          phase: 'discovery',
          progress: 100,
          status: 'completed' as const,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        {
          phase: 'indexing',
          progress: 50,
          status: 'active' as const,
          startedAt: new Date(),
          filesProcessed: 1000,
          totalFiles: 2000,
        },
      ];

      const timeline = createScanTimeline(scanProgressData);

      expect(timeline).toHaveLength(5); // All scan phases
      expect(timeline[0].status).toBe('completed');
      expect(timeline[1].status).toBe('active');
      expect(timeline[1].progress).toBe(50);
      expect(timeline[1].metadata?.filesProcessed).toBe(1000);
    });

    it('handles empty scan progress data', () => {
      const timeline = createScanTimeline([]);

      expect(timeline).toHaveLength(5); // All phases with pending status
      timeline.forEach((phase) => {
        expect(phase.status).toBe('pending');
      });
    });
  });

  // Edge Cases Tests
  describe('Edge Cases', () => {
    it('handles empty phases array', () => {
      render(<ProcessTimeline phases={[]} />);

      const timeline = screen.getByTestId('process-timeline');
      expect(timeline).toBeInTheDocument();
      expect(timeline.children).toHaveLength(0);
    });

    it('handles phases without descriptions', () => {
      const phases = [
        { id: 'test', label: 'Test Phase', status: 'pending' as const },
      ];

      render(<ProcessTimeline phases={phases} showDescriptions />);

      expect(screen.getByText('Test Phase')).toBeInTheDocument();
    });

    it('handles phases without icons', () => {
      const phases = [
        { id: 'test', label: 'Test Phase', status: 'pending' as const },
      ];

      render(<ProcessTimeline phases={phases} />);

      const phase = screen.getByTestId('process-timeline-phase-test');
      expect(phase).toBeInTheDocument();
    });

    it('handles invalid currentPhase ID', () => {
      const phases = createTestPhases();

      render(<ProcessTimeline phases={phases} currentPhase="nonexistent" />);

      const timeline = screen.getByTestId('process-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('handles missing metadata gracefully', () => {
      const phases = [
        {
          id: 'test',
          label: 'Test Phase',
          status: 'active' as const,
          progress: 50,
        },
      ];

      render(<ProcessTimeline phases={phases} showProgress />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('handles large number of phases efficiently', () => {
      const manyPhases = Array.from({ length: 50 }, (_, i) => ({
        id: `phase-${i}`,
        label: `Phase ${i}`,
        status: 'pending' as const,
      }));

      const startTime = performance.now();
      render(<ProcessTimeline phases={manyPhases} />);
      const endTime = performance.now();

      // Should render quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // All phases should be rendered
      manyPhases.forEach((phase, index) => {
        if (index < 10) {
          // Check first 10 to avoid overwhelming the test
          expect(screen.getByText(phase.label)).toBeInTheDocument();
        }
      });
    });

    it('updates efficiently on status changes', () => {
      const phases = createTestPhases();
      const { rerender } = render(
        <ProcessTimeline phases={phases} status="idle" />,
      );

      const startTime = performance.now();
      rerender(<ProcessTimeline phases={phases} status="running" />);
      const endTime = performance.now();

      // Should update quickly
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
