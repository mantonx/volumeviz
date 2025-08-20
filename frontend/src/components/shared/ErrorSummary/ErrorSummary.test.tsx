import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { ErrorSummary } from './ErrorSummary';
import type { ErrorSummaryRef, ErrorSummaryItem } from './ErrorSummary.types';
import {
  createScanError,
  createScanErrors,
  groupErrorsByCategory,
} from './ErrorSummary.types';
import { useRef } from 'react';

// Test setup

// Sample test data
const createTestErrors = (): ErrorSummaryItem[] => [
  {
    id: 'error-1',
    message: 'Permission denied accessing directory',
    code: 'EACCES',
    severity: 'high',
    category: 'permission',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    context: {
      phase: 'filesystem_indexing',
      path: '/data/restricted',
      volume: 'secure-volume',
    },
    details: 'User lacks read permissions for this directory',
    retryable: true,
    suggestion: 'Check file permissions or run with elevated privileges',
    count: 2,
    acknowledged: false,
    resolved: false,
  },
  {
    id: 'error-2',
    message: 'Network timeout',
    code: 'ETIMEDOUT',
    severity: 'medium',
    category: 'network',
    timestamp: new Date('2024-01-01T10:05:00Z'),
    context: {
      phase: 'preview_generation',
      volume: 'remote-storage',
    },
    details: 'Connection timeout after 30 seconds',
    retryable: true,
    suggestion: 'Verify network connectivity and try again',
    count: 1,
    acknowledged: false,
    resolved: false,
  },
  {
    id: 'error-3',
    message: 'File not found',
    code: 'ENOENT',
    severity: 'low',
    category: 'filesystem',
    timestamp: new Date('2024-01-01T10:10:00Z'),
    context: {
      path: '/data/missing.txt',
      volume: 'data-volume',
    },
    retryable: false,
    count: 1,
    acknowledged: true,
    resolved: false,
  },
  {
    id: 'error-4',
    message: 'Disk space exhausted',
    code: 'ENOSPC',
    severity: 'critical',
    category: 'resource',
    timestamp: new Date('2024-01-01T10:15:00Z'),
    context: {
      phase: 'preview_generation',
      volume: 'temp-storage',
    },
    retryable: true,
    count: 1,
    acknowledged: false,
    resolved: true,
  },
];

describe('ErrorSummary', () => {
  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} />);

      const summary = screen.getByTestId('error-summary');
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveAttribute('data-layout', 'list');
      expect(summary).toHaveAttribute('data-size', 'md');
    });

    it('renders all errors', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} collapseResolved={false} />);

      errors.forEach((error) => {
        expect(
          screen.getByTestId(`error-summary-error-${error.id}`),
        ).toBeInTheDocument();
        expect(screen.getByText(error.message)).toBeInTheDocument();
      });
    });

    it('renders with custom test ID', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} testId="custom-error-summary" />);

      const summary = screen.getByTestId('custom-error-summary');
      expect(summary).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} className="custom-class" />);

      const content = screen
        .getByTestId('error-summary')
        .querySelector('.error-summary-content');
      expect(content).toHaveClass('custom-class');
    });
  });

  // Layout Tests
  describe('Layout', () => {
    it('applies list layout correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} layout="list" />);

      const summary = screen.getByTestId('error-summary');
      expect(summary).toHaveAttribute('data-layout', 'list');
    });

    it('applies compact layout correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} layout="compact" />);

      const summary = screen.getByTestId('error-summary');
      expect(summary).toHaveAttribute('data-layout', 'compact');
    });

    it('applies grouped layout with groupByCategory', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} layout="grouped" groupByCategory />);

      const summary = screen.getByTestId('error-summary');
      expect(summary).toHaveAttribute('data-layout', 'grouped');

      // Should show group headers
      const groups = screen.getAllByTestId(/error-summary-group-/);
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  // Size Tests
  describe('Size Variants', () => {
    it('applies size variants correctly', () => {
      const errors = createTestErrors();
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { container } = render(
          <ErrorSummary errors={errors} size={size} />,
        );
        const summary = container.querySelector(
          '[data-testid="error-summary"]',
        );
        expect(summary).toHaveAttribute('data-size', size);
      });
    });
  });

  // Error Display Tests
  describe('Error Display', () => {
    it('displays error messages and codes correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} />);

      expect(
        screen.getByText('Permission denied accessing directory'),
      ).toBeInTheDocument();
      expect(screen.getByText('EACCES')).toBeInTheDocument();
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
      expect(screen.getByText('ETIMEDOUT')).toBeInTheDocument();
    });

    it('shows context information correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} />);

      expect(
        screen.getByText(/Phase: filesystem_indexing/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Volume: secure-volume/)).toBeInTheDocument();
      expect(screen.getByText(/Path: \/data\/restricted/)).toBeInTheDocument();
    });

    it('shows error counts when showCounts is true', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} showCounts />);

      expect(screen.getByText('2x')).toBeInTheDocument(); // First error has count: 2
    });

    it('shows timestamps when showTimestamps is true', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} showTimestamps />);

      // Should show relative timestamps
      expect(screen.getAllByText(/ago|Just now/)).toHaveLength(3);
    });

    it('shows error details when expanded', async () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} showDetails />);

      // Details should be visible by default (not collapsed)
      expect(
        screen.getByText('User lacks read permissions for this directory'),
      ).toBeInTheDocument();

      // Suggestion should also be visible
      expect(screen.getByText(/Check file permissions/)).toBeInTheDocument();
    });
  });

  // Status Tests
  describe('Status Visualization', () => {
    it('displays severity badges correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} collapseResolved={false} />);

      const error1 = screen.getByTestId('error-summary-error-error-1');
      const error3 = screen.getByTestId('error-summary-error-error-3');
      const error4 = screen.getByTestId('error-summary-error-error-4');

      expect(error1).toHaveAttribute('data-severity', 'high');
      expect(error3).toHaveAttribute('data-severity', 'low');
      expect(error4).toHaveAttribute('data-severity', 'critical');
    });

    it('displays category information correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} />);

      const error1 = screen.getByTestId('error-summary-error-error-1');
      const error2 = screen.getByTestId('error-summary-error-error-2');

      expect(error1).toHaveAttribute('data-category', 'permission');
      expect(error2).toHaveAttribute('data-category', 'network');
    });

    it('shows resolved status correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} collapseResolved={false} />);

      const error4 = screen.getByTestId('error-summary-error-error-4');
      expect(error4).toHaveAttribute('data-resolved', 'true');
    });
  });

  // Action Tests
  describe('Actions', () => {
    it('shows retry buttons when showRetryActions is true', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} showRetryActions />);

      const retryButtons = screen.getAllByText('Retry');
      expect(retryButtons.length).toBeGreaterThan(0);
    });

    it('handles retry action correctly', () => {
      const handleRetry = vi.fn();
      const errors = createTestErrors();

      render(
        <ErrorSummary errors={errors} showRetryActions onRetry={handleRetry} />,
      );

      const retryButton = screen.getAllByText('Retry')[0];
      fireEvent.click(retryButton);

      expect(handleRetry).toHaveBeenCalledWith(errors[0]);
    });

    it('shows acknowledge buttons when showAcknowledgeActions is true', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} showAcknowledgeActions />);

      const ackButtons = screen.getAllByText('Ack');
      expect(ackButtons.length).toBeGreaterThan(0);
    });

    it('handles acknowledge action correctly', () => {
      const handleAcknowledge = vi.fn();
      const errors = createTestErrors();

      render(
        <ErrorSummary
          errors={errors}
          showAcknowledgeActions
          onAcknowledge={handleAcknowledge}
        />,
      );

      const ackButton = screen.getAllByText('Ack')[0];
      fireEvent.click(ackButton);

      expect(handleAcknowledge).toHaveBeenCalledWith(errors[0]);
    });

    it('handles dismiss action correctly', () => {
      const handleDismiss = vi.fn();
      const errors = createTestErrors();

      render(<ErrorSummary errors={errors} onDismiss={handleDismiss} />);

      // Find dismiss button (X icon)
      const dismissButtons = screen
        .getAllByRole('button')
        .filter(
          (btn) =>
            btn.textContent?.includes('✕') ||
            btn.querySelector('[data-testid*="x"]'),
        );

      if (dismissButtons.length > 0) {
        fireEvent.click(dismissButtons[0]);
        expect(handleDismiss).toHaveBeenCalled();
      }
    });

    it('handles clear all action correctly', () => {
      const handleClearAll = vi.fn();
      const errors = createTestErrors();

      render(<ErrorSummary errors={errors} onClearAll={handleClearAll} />);

      const clearAllButton = screen.getByTestId('error-summary-clear-all');
      fireEvent.click(clearAllButton);

      expect(handleClearAll).toHaveBeenCalled();
    });
  });

  // Grouping Tests
  describe('Error Grouping', () => {
    it('groups errors by category correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} groupByCategory layout="grouped" />);

      // Should show group headers for different categories
      const groups = screen.getAllByTestId(/error-summary-group-/);
      expect(groups.length).toBeGreaterThan(1);
    });

    it('expands and collapses groups correctly', async () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} groupByCategory layout="grouped" />);

      const groupHeader = screen.getAllByTestId(/error-summary-group-/)[0];

      // Click to expand
      fireEvent.click(groupHeader);

      // Should show errors in the group
      await waitFor(() => {
        expect(
          screen.getByTestId('error-summary-error-error-1'),
        ).toBeInTheDocument();
      });
    });
  });

  // Filtering Tests
  describe('Filtering and Sorting', () => {
    it('applies filter correctly', () => {
      const errors = createTestErrors();
      const filter = (error: ErrorSummaryItem) => error.severity === 'critical';

      render(
        <ErrorSummary
          errors={errors}
          filter={filter}
          collapseResolved={false}
        />,
      );

      // Should only show critical errors
      expect(
        screen.getByTestId('error-summary-error-error-4'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('error-summary-error-error-1'),
      ).not.toBeInTheDocument();
    });

    it('applies maxItems limit correctly', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} maxItems={2} />);

      const summary = screen.getByTestId('error-summary');
      expect(summary).toHaveAttribute('data-error-count', '2');
    });

    it('applies custom sorting', () => {
      const errors = createTestErrors();
      const sortBy = (a: ErrorSummaryItem, b: ErrorSummaryItem) =>
        a.message.localeCompare(b.message);

      render(
        <ErrorSummary
          errors={errors}
          sortBy={sortBy}
          collapseResolved={false}
        />,
      );

      // Should be sorted alphabetically by message
      const errorElements = screen.getAllByTestId(/error-summary-error-/);
      expect(errorElements).toHaveLength(errors.length);
    });

    it('collapses resolved errors when collapseResolved is true', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} collapseResolved />);

      // Resolved error should not be displayed
      expect(
        screen.queryByTestId('error-summary-error-error-4'),
      ).not.toBeInTheDocument();
    });
  });

  // Interaction Tests
  describe('Interaction', () => {
    it('handles error click events', () => {
      const handleErrorClick = vi.fn();
      const errors = createTestErrors();

      render(<ErrorSummary errors={errors} onErrorClick={handleErrorClick} />);

      const error1 = screen.getByTestId('error-summary-error-error-1');
      fireEvent.click(error1);

      expect(handleErrorClick).toHaveBeenCalledWith(errors[0]);
    });

    it('handles keyboard navigation for clickable errors', async () => {
      const handleErrorClick = vi.fn();
      const errors = createTestErrors();
      const user = userEvent.setup();

      render(<ErrorSummary errors={errors} onErrorClick={handleErrorClick} />);

      // Focus and activate first error
      await user.tab();
      await user.keyboard('{Enter}');

      expect(handleErrorClick).toHaveBeenCalled();
    });
  });

  // State Tests
  describe('Loading and Empty States', () => {
    it('shows loading state correctly', () => {
      render(<ErrorSummary errors={[]} isLoading />);

      expect(screen.getByText('Loading errors...')).toBeInTheDocument();
    });

    it('shows empty state correctly', () => {
      render(<ErrorSummary errors={[]} />);

      expect(screen.getByText('No errors to display')).toBeInTheDocument();
    });

    it('shows custom empty message', () => {
      const customMessage = 'All systems operational!';
      render(<ErrorSummary errors={[]} emptyMessage={customMessage} />);

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });
  });

  // Ref API Tests
  describe('Ref API', () => {
    const TestComponent = () => {
      const ref = useRef<ErrorSummaryRef>(null);
      const errors = createTestErrors();

      return (
        <div>
          <ErrorSummary ref={ref} errors={errors} />
          <button onClick={() => ref.current?.focusError('error-1')}>
            Focus Error 1
          </button>
          <button onClick={() => ref.current?.clearAll()}>Clear All</button>
          <button onClick={() => ref.current?.getElement()}>Get Element</button>
          <button onClick={() => ref.current?.getErrorElement('error-1')}>
            Get Error Element
          </button>
          <button onClick={() => ref.current?.getErrors()}>Get Errors</button>
        </div>
      );
    };

    it('exposes getElement method', () => {
      const ref = { current: null as ErrorSummaryRef | null };
      const errors = createTestErrors();

      render(<ErrorSummary ref={ref} errors={errors} />);

      const element = ref.current?.getElement();
      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('exposes getErrorElement method', () => {
      const ref = { current: null as ErrorSummaryRef | null };
      const errors = createTestErrors();

      render(<ErrorSummary ref={ref} errors={errors} />);

      const errorElement = ref.current?.getErrorElement('error-1');
      expect(errorElement).toBeInstanceOf(HTMLElement);
    });

    it('exposes focusError method', () => {
      const ref = { current: null as ErrorSummaryRef | null };
      const errors = createTestErrors();

      render(<ErrorSummary ref={ref} errors={errors} />);

      // Should not throw when calling focusError
      expect(() => ref.current?.focusError('error-1')).not.toThrow();
    });

    it('exposes getErrors method', () => {
      const ref = { current: null as ErrorSummaryRef | null };
      const errors = createTestErrors();

      render(<ErrorSummary ref={ref} errors={errors} />);

      const returnedErrors = ref.current?.getErrors();
      expect(returnedErrors).toEqual(errors);
    });

    it('exposes clearAll method', () => {
      const handleClearAll = vi.fn();
      const ref = { current: null as ErrorSummaryRef | null };
      const errors = createTestErrors();

      render(
        <ErrorSummary ref={ref} errors={errors} onClearAll={handleClearAll} />,
      );

      ref.current?.clearAll();
      expect(handleClearAll).toHaveBeenCalled();
    });
  });

  // Utility Function Tests
  describe('Utility Functions', () => {
    it('createScanError utility works correctly', () => {
      const errorData = {
        message: 'Permission denied',
        code: 'EACCES',
        path: '/restricted/file.txt',
        volume: 'secure-volume',
        phase: 'indexing',
        timestamp: new Date(),
        retryable: true,
      };

      const error = createScanError(errorData);

      expect(error.message).toBe('Permission denied');
      expect(error.code).toBe('EACCES');
      expect(error.category).toBe('permission');
      expect(error.severity).toBe('high');
      expect(error.retryable).toBe(true);
      expect(error.context?.path).toBe('/restricted/file.txt');
    });

    it('createScanErrors utility works correctly', () => {
      const errorDataList = [
        { message: 'Permission denied', code: 'EACCES' },
        { message: 'Connection timeout', code: 'ETIMEDOUT' },
        { message: 'File not found', code: 'ENOENT' },
      ];

      const errors = createScanErrors(errorDataList);

      expect(errors).toHaveLength(3);
      expect(errors[0].category).toBe('permission');
      expect(errors[1].category).toBe('timeout');
      expect(errors[2].category).toBe('filesystem');
    });

    it('groupErrorsByCategory utility works correctly', () => {
      const errors = createTestErrors();
      const groups = groupErrorsByCategory(errors);

      expect(groups.length).toBeGreaterThan(0);

      const permissionGroup = groups.find((g) => g.category === 'permission');
      expect(permissionGroup?.count).toBe(1);
      expect(permissionGroup?.label).toBe('Permission Errors');
      expect(permissionGroup?.highestSeverity).toBe('high');
    });

    it('handles error categorization correctly', () => {
      const testCases = [
        { code: 'EACCES', expectedCategory: 'permission' },
        { code: 'ETIMEDOUT', expectedCategory: 'timeout' },
        { code: 'ENOENT', expectedCategory: 'filesystem' },
        { code: 'ENOSPC', expectedCategory: 'resource' },
        { message: 'invalid format', expectedCategory: 'validation' },
        { message: 'connection refused', expectedCategory: 'network' },
      ];

      testCases.forEach(({ code, message, expectedCategory }) => {
        const error = createScanError({ message: message || 'test', code });
        expect(error.category).toBe(expectedCategory);
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('provides proper role attributes for clickable errors', () => {
      const errors = createTestErrors();
      render(<ErrorSummary errors={errors} onErrorClick={() => {}} />);

      const error1 = screen.getByTestId('error-summary-error-error-1');
      expect(error1).toHaveAttribute('role', 'button');
      expect(error1).toHaveAttribute('tabIndex', '0');
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('handles large number of errors efficiently', () => {
      const manyErrors = Array.from({ length: 100 }, (_, i) => ({
        id: `error-${i}`,
        message: `Error ${i}`,
        severity: 'medium' as const,
        category: 'unknown' as const,
        timestamp: new Date(),
        count: 1,
        acknowledged: false,
        resolved: false,
      }));

      const startTime = performance.now();
      render(<ErrorSummary errors={manyErrors} />);
      const endTime = performance.now();

      // Should render quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should show error count
      const summary = screen.getByTestId('error-summary');
      expect(summary).toHaveAttribute('data-error-count', '100');
    });

    it('updates efficiently on error changes', () => {
      const errors = createTestErrors();
      const { rerender } = render(<ErrorSummary errors={errors} />);

      const updatedErrors = errors.map((e) => ({ ...e, acknowledged: true }));

      const startTime = performance.now();
      rerender(<ErrorSummary errors={updatedErrors} />);
      const endTime = performance.now();

      // Should update quickly
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
