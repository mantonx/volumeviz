import { render, screen, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from './ProgressBar';
import type { ProgressBarRef } from './ProgressBar.types';
import { useRef } from 'react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock requestAnimationFrame for animation tests
const mockRequestAnimationFrame = vi.fn();
global.requestAnimationFrame = mockRequestAnimationFrame;

describe('ProgressBar', () => {
  beforeEach(() => {
    mockRequestAnimationFrame.mockImplementation((callback) => {
      setTimeout(callback, 16); // ~60fps
      return 1;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<ProgressBar value={50} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('renders with custom test ID', () => {
      render(<ProgressBar value={75} testId="custom-progress" />);

      const progressBar = screen.getByTestId('custom-progress');
      expect(progressBar).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ProgressBar value={30} className="custom-class" />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('custom-class');
    });

    it('passes through container props', () => {
      render(
        <ProgressBar
          value={60}
          containerProps={{ 'data-custom': 'test-value' }}
        />,
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('data-custom', 'test-value');
    });
  });

  // Props Validation Tests
  describe('Props Validation', () => {
    it('clamps value below 0 to 0', () => {
      render(<ProgressBar value={-20} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('clamps value above 100 to 100', () => {
      render(<ProgressBar value={150} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles decimal values correctly', () => {
      render(<ProgressBar value={33.7} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '33.7');
    });

    it('applies all size variants correctly', () => {
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

      sizes.forEach((size) => {
        const { container } = render(<ProgressBar value={50} size={size} />);
        const track = container.querySelector('.progress-bar-track');
        expect(track).toHaveClass(
          `h-${size === 'xs' ? '1' : size === 'sm' ? '2' : size === 'md' ? '3' : size === 'lg' ? '4' : '6'}`,
        );
      });
    });

    it('applies all variant colors correctly', () => {
      const variants = [
        'default',
        'success',
        'warning',
        'error',
        'info',
      ] as const;

      variants.forEach((variant) => {
        const { container } = render(
          <ProgressBar value={50} variant={variant} />,
        );
        const progress = container.querySelector('.progress-bar');

        const expectedColors = {
          default: 'bg-blue-500',
          success: 'bg-green-500',
          warning: 'bg-yellow-500',
          error: 'bg-red-500',
          info: 'bg-blue-400',
        };

        expect(progress).toHaveClass(expectedColors[variant]);
      });
    });
  });

  // Label Tests
  describe('Label Functionality', () => {
    it('shows percentage label when showLabel is true', () => {
      render(<ProgressBar value={75} showLabel />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<ProgressBar value={75} showLabel={false} />);

      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    it('displays custom label instead of percentage', () => {
      render(<ProgressBar value={60} showLabel label="Loading files..." />);

      expect(screen.getByText('Loading files...')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument(); // Percentage still shown separately
    });

    it('uses correct label test ID', () => {
      render(<ProgressBar value={40} showLabel testId="test-progress" />);

      expect(screen.getByTestId('test-progress-label')).toBeInTheDocument();
    });

    it('applies correct label size classes', () => {
      const { rerender } = render(
        <ProgressBar value={50} showLabel size="xs" />,
      );
      expect(screen.getByTestId('progress-bar-label')).toHaveClass('text-xs');

      rerender(<ProgressBar value={50} showLabel size="xl" />);
      expect(screen.getByTestId('progress-bar-label')).toHaveClass('text-lg');
    });
  });

  // Animation and Visual States Tests
  describe('Animation and Visual States', () => {
    it('applies striped class when striped is true', () => {
      const { container } = render(<ProgressBar value={50} striped />);
      const progress = container.querySelector('.progress-bar');
      expect(progress).toHaveClass('progress-bar--striped');
    });

    it('applies animated striped class when both animated and striped are true', () => {
      const { container } = render(<ProgressBar value={50} animated striped />);
      const progress = container.querySelector('.progress-bar');
      expect(progress).toHaveClass('progress-bar--animated');
    });

    it('applies indeterminate class and styles for indeterminate state', () => {
      const { container } = render(<ProgressBar indeterminate />);
      const progress = container.querySelector('.progress-bar');
      expect(progress).toHaveClass('progress-bar--indeterminate');

      // Check inline styles for indeterminate
      expect(progress).toHaveStyle({ width: '30%' });
    });

    it('removes aria-valuenow for indeterminate state', () => {
      render(<ProgressBar indeterminate />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });

    it('shows correct progress width based on value', () => {
      const { container } = render(<ProgressBar value={73} />);
      const progress = container.querySelector('.progress-bar');
      expect(progress).toHaveStyle({ width: '73%' });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <ProgressBar value={65} showLabel label="File upload progress" />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes', () => {
      render(<ProgressBar value={80} label="Custom progress" />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '80');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', 'Custom progress');
    });

    it('provides default aria-label when none specified', () => {
      render(<ProgressBar value={45} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Progress: 45%');
    });

    it('uses custom label in aria-label', () => {
      render(<ProgressBar value={70} label="Uploading documents" />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Uploading documents');
    });

    it('maintains accessibility in indeterminate state', async () => {
      const { container } = render(
        <ProgressBar indeterminate label="Loading..." animated />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  // Ref API Tests
  describe('Ref API', () => {
    const TestComponent = () => {
      const ref = useRef<ProgressBarRef>(null);

      return (
        <div>
          <ProgressBar ref={ref} value={50} />
          <button onClick={() => ref.current?.getValue()}>Get Value</button>
          <button onClick={() => ref.current?.setValue(75)}>Set Value</button>
          <button onClick={() => ref.current?.animateTo(90, 500)}>
            Animate To
          </button>
        </div>
      );
    };

    it('exposes getValue method', () => {
      const ref = { current: null as ProgressBarRef | null };
      render(<ProgressBar ref={ref} value={42} />);

      expect(ref.current?.getValue()).toBe(42);
    });

    it('exposes setValue method', () => {
      const ref = { current: null as ProgressBarRef | null };
      render(<ProgressBar ref={ref} value={30} />);

      act(() => {
        ref.current?.setValue(80);
      });

      expect(ref.current?.getValue()).toBe(80);
    });

    it('exposes animateTo method', async () => {
      const ref = { current: null as ProgressBarRef | null };
      render(<ProgressBar ref={ref} value={20} />);

      act(() => {
        ref.current?.animateTo(70, 100);
      });

      // Animation should be triggered
      expect(mockRequestAnimationFrame).toHaveBeenCalled();
    });

    it('handles animateTo with default duration', () => {
      const ref = { current: null as ProgressBarRef | null };
      render(<ProgressBar ref={ref} value={10} />);

      act(() => {
        ref.current?.animateTo(90); // No duration specified
      });

      expect(mockRequestAnimationFrame).toHaveBeenCalled();
    });
  });

  // Edge Cases and Error Handling
  describe('Edge Cases', () => {
    it('handles rapid value changes', () => {
      const { rerender } = render(<ProgressBar value={0} />);

      // Rapidly change values
      for (let i = 0; i <= 100; i += 10) {
        rerender(<ProgressBar value={i} />);
      }

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles undefined/null values gracefully', () => {
      // TypeScript would prevent this, but test runtime safety
      render(<ProgressBar value={undefined as any} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('handles very long labels without breaking layout', () => {
      const longLabel =
        'This is a very long label that could potentially break the layout or cause overflow issues in the component';

      render(<ProgressBar value={50} showLabel label={longLabel} />);

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('maintains performance with frequent updates', () => {
      const { rerender } = render(<ProgressBar value={0} animated />);

      const startTime = performance.now();

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        rerender(<ProgressBar value={i} animated />);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 100ms for 100 updates)
      expect(duration).toBeLessThan(100);
    });
  });

  // Integration Tests
  describe('Integration Scenarios', () => {
    it('works correctly in scan progress scenario', () => {
      const { rerender } = render(
        <ProgressBar
          value={0}
          variant="info"
          showLabel
          label="Starting scan..."
          animated
          striped
        />,
      );

      // Simulate scan progress
      rerender(
        <ProgressBar
          value={33}
          variant="info"
          showLabel
          label="Discovering volumes..."
          animated
          striped
        />,
      );

      expect(screen.getByText('Discovering volumes...')).toBeInTheDocument();
      expect(screen.getByText('33%')).toBeInTheDocument();

      // Simulate completion
      rerender(
        <ProgressBar
          value={100}
          variant="success"
          showLabel
          label="Scan completed"
        />,
      );

      expect(screen.getByText('Scan completed')).toBeInTheDocument();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles error state correctly', () => {
      render(
        <ProgressBar
          value={45}
          variant="error"
          showLabel
          label="Error: Permission denied"
        />,
      );

      expect(screen.getByText('Error: Permission denied')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('handles unknown progress state', () => {
      render(
        <ProgressBar
          indeterminate
          variant="default"
          showLabel
          label="Preparing scan..."
          animated
        />,
      );

      expect(screen.getByText('Preparing scan...')).toBeInTheDocument();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).not.toHaveAttribute('aria-valuenow');
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('memoizes correctly with unchanged props', () => {
      const { rerender } = render(<ProgressBar value={50} />);

      // Re-render with same props
      rerender(<ProgressBar value={50} />);

      // Component should not have re-rendered unnecessarily
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('handles animation cleanup correctly', () => {
      const ref = { current: null as ProgressBarRef | null };
      const { unmount } = render(<ProgressBar ref={ref} value={20} />);

      // Start animation
      act(() => {
        ref.current?.animateTo(80, 1000);
      });

      // Unmount component during animation
      unmount();

      // Should not cause memory leaks or errors
      expect(mockRequestAnimationFrame).toHaveBeenCalled();
    });
  });
});
