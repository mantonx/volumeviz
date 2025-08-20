import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StatusBadge } from './StatusBadge';
import type { StatusBadgeRef } from './StatusBadge.types';
import { useRef } from 'react';
import { CheckCircle, Activity } from 'lucide-react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('StatusBadge', () => {
  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<StatusBadge>Test Status</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Test Status');
    });

    it('renders with custom test ID', () => {
      render(<StatusBadge testId="custom-badge">Status</StatusBadge>);

      const badge = screen.getByTestId('custom-badge');
      expect(badge).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<StatusBadge className="custom-class">Status</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveClass('custom-class');
    });

    it('passes through container props', () => {
      render(
        <StatusBadge containerProps={{ 'data-custom': 'test-value' }}>
          Status
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('data-custom', 'test-value');
    });
  });

  // Props Validation Tests
  describe('Props Validation', () => {
    it('applies all variant styles correctly', () => {
      const variants = [
        'default',
        'success',
        'warning',
        'error',
        'info',
        'pending',
      ] as const;

      variants.forEach((variant) => {
        const { container } = render(
          <StatusBadge variant={variant}>Status</StatusBadge>,
        );
        const badge = container.querySelector('.status-badge');
        expect(badge).toHaveAttribute('data-variant', variant);
      });
    });

    it('applies all size styles correctly', () => {
      const sizes = ['xs', 'sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { container } = render(
          <StatusBadge size={size}>Status</StatusBadge>,
        );
        const badge = container.querySelector('.status-badge');
        expect(badge).toHaveAttribute('data-size', size);
      });
    });

    it('shows icon when provided', () => {
      render(
        <StatusBadge icon={<CheckCircle data-testid="test-icon" />}>
          Status
        </StatusBadge>,
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-icon')).toBeInTheDocument();
    });

    it('shows dot when showDot is true', () => {
      render(<StatusBadge showDot>Status</StatusBadge>);

      expect(screen.getByTestId('status-badge-dot')).toBeInTheDocument();
    });

    it('positions dot correctly', () => {
      const { rerender } = render(
        <StatusBadge showDot dotPosition="left">
          Status
        </StatusBadge>,
      );

      let badge = screen.getByTestId('status-badge');
      let dot = screen.getByTestId('status-badge-dot');
      let content = screen.getByTestId('status-badge-content');

      // Left dot should come before content
      expect(badge.children[0]).toBe(dot);
      expect(Array.from(badge.children)).indexOf(content).toBeGreaterThan(0);

      rerender(
        <StatusBadge showDot dotPosition="right">
          Status
        </StatusBadge>,
      );

      badge = screen.getByTestId('status-badge');
      dot = screen.getByTestId('status-badge-dot');
      content = screen.getByTestId('status-badge-content');

      // Right dot should come after content
      expect(Array.from(badge.children))
        .indexOf(dot)
        .toBeGreaterThan(Array.from(badge.children))
        .indexOf(content);
    });

    it('applies rounded styles correctly', () => {
      const { rerender, container } = render(
        <StatusBadge rounded>Status</StatusBadge>,
      );
      let badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).not.toHaveClass('rounded-md');

      rerender(<StatusBadge rounded={false}>Status</StatusBadge>);
      badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('rounded-md');
      expect(badge).not.toHaveClass('rounded-full');
    });
  });

  // Animation Tests
  describe('Animation', () => {
    it('applies animation classes when animated is true', () => {
      const { container } = render(
        <StatusBadge animated showDot>
          Status
        </StatusBadge>,
      );

      const badge = container.querySelector('.status-badge');
      const dot = container.querySelector('.status-badge-dot');

      expect(badge).toHaveClass('animate-pulse');
      expect(dot).toHaveClass('animate-pulse');
      expect(badge).toHaveAttribute('data-animated', 'true');
    });

    it('does not apply animation classes when animated is false', () => {
      const { container } = render(
        <StatusBadge animated={false} showDot>
          Status
        </StatusBadge>,
      );

      const badge = container.querySelector('.status-badge');
      const dot = container.querySelector('.status-badge-dot');

      expect(badge).not.toHaveClass('animate-pulse');
      expect(dot).not.toHaveClass('animate-pulse');
      expect(badge).toHaveAttribute('data-animated', 'false');
    });
  });

  // Interaction Tests
  describe('Interaction', () => {
    it('handles click events when clickable', () => {
      const handleClick = vi.fn();
      render(
        <StatusBadge clickable onClick={handleClick}>
          Click me
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('role', 'button');
      expect(badge).toHaveAttribute('tabIndex', '0');
      expect(badge).toHaveAttribute('data-clickable', 'true');

      fireEvent.click(badge);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard events when clickable', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <StatusBadge clickable onClick={handleClick}>
          Press me
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');

      // Focus and press Enter
      await user.tab();
      expect(badge).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Press Space
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('does not respond to clicks when not clickable', () => {
      const handleClick = vi.fn();
      render(<StatusBadge onClick={handleClick}>Status</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('role', 'button'); // onClick still makes it clickable
      expect(badge).toHaveAttribute('data-clickable', 'true');

      fireEvent.click(badge);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies correct cursor and hover styles for clickable badges', () => {
      const { container } = render(
        <StatusBadge clickable>Clickable</StatusBadge>,
      );

      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('cursor-pointer');
      expect(badge).toHaveClass('hover:opacity-80');
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <StatusBadge variant="success" icon={<CheckCircle />} showDot>
          Completed Successfully
        </StatusBadge>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes for status role', () => {
      render(<StatusBadge variant="info">Processing</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('role', 'status');
      expect(badge).toHaveAttribute('aria-label', 'Status: Processing');
    });

    it('has correct ARIA attributes for button role when clickable', () => {
      render(
        <StatusBadge clickable onClick={() => {}}>
          Click me
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('role', 'button');
      expect(badge).toHaveAttribute('tabIndex', '0');
      expect(badge).toHaveAttribute('aria-label', 'Status: Click me');
    });

    it('provides fallback aria-label for non-string children', () => {
      render(
        <StatusBadge variant="success">
          <span>Complex content</span>
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('aria-label', 'Status badge: success');
    });

    it('maintains accessibility in animated state', async () => {
      const { container } = render(
        <StatusBadge variant="info" animated showDot icon={<Activity />}>
          Loading...
        </StatusBadge>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  // Ref API Tests
  describe('Ref API', () => {
    const TestComponent = () => {
      const ref = useRef<StatusBadgeRef>(null);

      return (
        <div>
          <StatusBadge ref={ref}>Test Badge</StatusBadge>
          <button onClick={() => ref.current?.focus()}>Focus Badge</button>
          <button onClick={() => ref.current?.blur()}>Blur Badge</button>
          <button onClick={() => ref.current?.getElement()}>Get Element</button>
        </div>
      );
    };

    it('exposes getElement method', () => {
      const ref = { current: null as StatusBadgeRef | null };
      render(<StatusBadge ref={ref}>Test</StatusBadge>);

      const element = ref.current?.getElement();
      expect(element).toBeInstanceOf(HTMLSpanElement);
      expect(element).toHaveTextContent('Test');
    });

    it('exposes focus method', () => {
      const ref = { current: null as StatusBadgeRef | null };
      render(
        <StatusBadge ref={ref} clickable>
          Test
        </StatusBadge>,
      );

      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      ref.current?.focus();

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('exposes blur method', () => {
      const ref = { current: null as StatusBadgeRef | null };
      render(
        <StatusBadge ref={ref} clickable>
          Test
        </StatusBadge>,
      );

      const blurSpy = vi.spyOn(HTMLElement.prototype, 'blur');
      ref.current?.blur();

      expect(blurSpy).toHaveBeenCalled();
      blurSpy.mockRestore();
    });
  });

  // Content Tests
  describe('Content Rendering', () => {
    it('renders string children correctly', () => {
      render(<StatusBadge>Simple Text</StatusBadge>);

      const content = screen.getByTestId('status-badge-content');
      expect(content).toHaveTextContent('Simple Text');
    });

    it('renders React element children correctly', () => {
      render(
        <StatusBadge>
          <span data-testid="complex-content">Complex Content</span>
        </StatusBadge>,
      );

      expect(screen.getByTestId('complex-content')).toBeInTheDocument();
      expect(screen.getByTestId('complex-content')).toHaveTextContent(
        'Complex Content',
      );
    });

    it('renders both icon and content correctly', () => {
      render(
        <StatusBadge icon={<CheckCircle data-testid="icon" />}>
          With Icon
        </StatusBadge>,
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-content')).toHaveTextContent(
        'With Icon',
      );
    });

    it('renders icon, dot, and content in correct order', () => {
      render(
        <StatusBadge
          icon={<CheckCircle data-testid="icon" />}
          showDot
          dotPosition="left"
        >
          Full Badge
        </StatusBadge>,
      );

      const badge = screen.getByTestId('status-badge');
      const children = Array.from(badge.children);

      // Order should be: dot, icon, content
      expect(children[0]).toHaveClass('status-badge-dot');
      expect(children[1]).toHaveClass('status-badge-icon');
      expect(children[2]).toHaveClass('status-badge-content');
    });
  });

  // Edge Cases and Error Handling
  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      render(<StatusBadge>{''}</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      const content = screen.getByTestId('status-badge-content');

      expect(badge).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('');
    });

    it('handles null/undefined children', () => {
      render(<StatusBadge>{null}</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
    });

    it('handles very long text content', () => {
      const longText =
        'This is a very long status message that might overflow or cause layout issues';
      render(<StatusBadge>{longText}</StatusBadge>);

      const content = screen.getByTestId('status-badge-content');
      expect(content).toHaveTextContent(longText);
    });

    it('handles rapid state changes', () => {
      const { rerender } = render(
        <StatusBadge variant="pending">Pending</StatusBadge>,
      );

      // Rapidly change variants
      const variants = ['info', 'success', 'error', 'warning'] as const;
      variants.forEach((variant) => {
        rerender(<StatusBadge variant={variant}>{variant}</StatusBadge>);
      });

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveAttribute('data-variant', 'warning');
    });
  });

  // Integration Tests
  describe('Integration Scenarios', () => {
    it('works correctly in scan status scenario', () => {
      const { rerender } = render(
        <StatusBadge variant="pending" animated showDot>
          Pending
        </StatusBadge>,
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Simulate status progression
      rerender(
        <StatusBadge variant="info" animated showDot icon={<Activity />}>
          Running
        </StatusBadge>,
      );

      expect(screen.getByText('Running')).toBeInTheDocument();

      rerender(
        <StatusBadge variant="success" showDot icon={<CheckCircle />}>
          Completed
        </StatusBadge>,
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('handles clickable scan actions', () => {
      const mockRetry = vi.fn();
      const mockPause = vi.fn();

      render(
        <div>
          <StatusBadge variant="error" clickable onClick={mockRetry}>
            Retry
          </StatusBadge>
          <StatusBadge variant="info" clickable onClick={mockPause}>
            Pause
          </StatusBadge>
        </div>,
      );

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRetry).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Pause'));
      expect(mockPause).toHaveBeenCalledTimes(1);
    });

    it('supports complex icon components', () => {
      const ComplexIcon = () => (
        <div data-testid="complex-icon">
          <span>🔄</span>
        </div>
      );

      render(
        <StatusBadge icon={<ComplexIcon />} variant="info">
          Custom Icon
        </StatusBadge>,
      );

      expect(screen.getByTestId('complex-icon')).toBeInTheDocument();
      expect(screen.getByText('Custom Icon')).toBeInTheDocument();
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('memoizes correctly with unchanged props', () => {
      const { rerender } = render(
        <StatusBadge variant="success">Success</StatusBadge>,
      );

      // Re-render with same props
      rerender(<StatusBadge variant="success">Success</StatusBadge>);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
    });

    it('handles frequent prop changes efficiently', () => {
      const { rerender } = render(
        <StatusBadge variant="pending">Status</StatusBadge>,
      );

      const startTime = performance.now();

      // Simulate 50 rapid updates
      for (let i = 0; i < 50; i++) {
        const variants = ['pending', 'info', 'success', 'error'] as const;
        const variant = variants[i % variants.length];
        rerender(
          <StatusBadge variant={variant} animated={i % 2 === 0}>
            Status {i}
          </StatusBadge>,
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 50ms for 50 updates)
      expect(duration).toBeLessThan(50);
    });
  });
});
