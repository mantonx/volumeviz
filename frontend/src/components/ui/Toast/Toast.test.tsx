import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Toast, ToastProvider, useToast } from './';
import type { ToastProps } from './Toast.types';

// Mock createPortal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (element: React.ReactElement) => element,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">✕</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">✓</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">!</div>,
  AlertTriangle: () => <div data-testid="alert-triangle-icon">⚠</div>,
  Info: () => <div data-testid="info-icon">i</div>,
  Loader2: () => <div data-testid="loader-icon">⟳</div>,
}));

const defaultProps: ToastProps = {
  variant: 'info',
  message: 'Test message',
  testId: 'test-toast',
};

describe('Toast', () => {
  const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders with message', () => {
      render(<Toast {...defaultProps} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByTestId('test-toast')).toBeInTheDocument();
    });

    it('renders with title and message', () => {
      render(<Toast {...defaultProps} title="Test Title" />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders with custom test ID', () => {
      render(<Toast {...defaultProps} testId="custom-toast" />);

      expect(screen.getByTestId('custom-toast')).toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
      render(<Toast {...defaultProps} title="Test Title" />);

      const toast = screen.getByTestId('test-toast');
      expect(toast).toHaveAttribute('role', 'alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(toast).toHaveAttribute('aria-labelledby');
      expect(toast).toHaveAttribute('aria-describedby');
    });

    it('has assertive aria-live for error variant', () => {
      render(<Toast {...defaultProps} variant="error" />);

      const toast = screen.getByTestId('test-toast');
      expect(toast).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Variants', () => {
    it('renders info variant with correct icon', () => {
      render(<Toast {...defaultProps} variant="info" />);

      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-variant',
        'info',
      );
    });

    it('renders success variant with correct icon', () => {
      render(<Toast {...defaultProps} variant="success" />);

      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-variant',
        'success',
      );
    });

    it('renders warning variant with correct icon', () => {
      render(<Toast {...defaultProps} variant="warning" />);

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-variant',
        'warning',
      );
    });

    it('renders error variant with correct icon', () => {
      render(<Toast {...defaultProps} variant="error" />);

      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-variant',
        'error',
      );
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Toast {...defaultProps} size="sm" />);

      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-size',
        'sm',
      );
    });

    it('renders medium size', () => {
      render(<Toast {...defaultProps} size="md" />);

      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-size',
        'md',
      );
    });

    it('renders large size', () => {
      render(<Toast {...defaultProps} size="lg" />);

      expect(screen.getByTestId('test-toast')).toHaveAttribute(
        'data-size',
        'lg',
      );
    });
  });

  describe('Icons', () => {
    it('renders default icon for variant', () => {
      render(<Toast {...defaultProps} variant="success" />);

      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('renders custom icon', () => {
      render(
        <Toast
          {...defaultProps}
          icon={<div data-testid="custom-icon">Custom</div>}
        />,
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('info-icon')).not.toBeInTheDocument();
    });

    it('renders no icon when icon is null', () => {
      render(<Toast {...defaultProps} icon={null} />);

      expect(screen.queryByTestId('info-icon')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders action button', () => {
      const mockAction = vi.fn();
      render(
        <Toast
          {...defaultProps}
          action={{ label: 'Action', onClick: mockAction }}
        />,
      );

      const actionButton = screen.getByTestId('test-toast-action');
      expect(actionButton).toBeInTheDocument();
      expect(actionButton).toHaveTextContent('Action');
    });

    it('calls action onClick when clicked', async () => {
      const mockAction = vi.fn();
      const mockOnAction = vi.fn();

      render(
        <Toast
          {...defaultProps}
          action={{ label: 'Action', onClick: mockAction }}
          onAction={mockOnAction}
        />,
      );

      const actionButton = screen.getByTestId('test-toast-action');
      await user.click(actionButton);

      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });

    it('auto-dismisses after action when not persistent', async () => {
      const mockAction = vi.fn();
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          action={{ label: 'Action', onClick: mockAction }}
          onDismiss={mockOnDismiss}
          persistent={false}
        />,
      );

      const actionButton = screen.getByTestId('test-toast-action');
      await user.click(actionButton);
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('does not auto-dismiss after action when persistent', async () => {
      const mockAction = vi.fn();
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          action={{ label: 'Action', onClick: mockAction }}
          onDismiss={mockOnDismiss}
          persistent={true}
        />,
      );

      const actionButton = screen.getByTestId('test-toast-action');
      await user.click(actionButton);
      vi.advanceTimersByTime(300);

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Dismissal', () => {
    it('renders close button when dismissible', () => {
      render(<Toast {...defaultProps} dismissible={true} />);

      expect(screen.getByTestId('test-toast-close')).toBeInTheDocument();
    });

    it('does not render close button when not dismissible', () => {
      render(<Toast {...defaultProps} dismissible={false} />);

      expect(screen.queryByTestId('test-toast-close')).not.toBeInTheDocument();
    });

    it('calls onDismiss when close button is clicked', async () => {
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          dismissible={true}
          onDismiss={mockOnDismiss}
        />,
      );

      const closeButton = screen.getByTestId('test-toast-close');
      await user.click(closeButton);
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onDismiss when not dismissible', async () => {
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          dismissible={false}
          onDismiss={mockOnDismiss}
        />,
      );

      // No close button should be present
      expect(screen.queryByTestId('test-toast-close')).not.toBeInTheDocument();
    });
  });

  describe('Auto-dismiss', () => {
    it('auto-dismisses after duration', async () => {
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          duration={1000}
          persistent={false}
          onDismiss={mockOnDismiss}
        />,
      );

      expect(mockOnDismiss).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('does not auto-dismiss when persistent', async () => {
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          duration={1000}
          persistent={true}
          onDismiss={mockOnDismiss}
        />,
      );

      vi.advanceTimersByTime(1000);

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });

    it('does not auto-dismiss when duration is 0', async () => {
      const mockOnDismiss = vi.fn();

      render(
        <Toast
          {...defaultProps}
          duration={0}
          persistent={false}
          onDismiss={mockOnDismiss}
        />,
      );

      vi.advanceTimersByTime(5000);

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Persistent state', () => {
    it('shows loading indicator for persistent non-dismissible toast', () => {
      render(<Toast {...defaultProps} persistent={true} dismissible={false} />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('does not show loading indicator for dismissible toast', () => {
      render(<Toast {...defaultProps} persistent={true} dismissible={true} />);

      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });
  });

  describe('Visibility', () => {
    it('renders when isVisible is true', () => {
      render(<Toast {...defaultProps} isVisible={true} />);

      expect(screen.getByTestId('test-toast')).toBeInTheDocument();
    });

    it('does not render when isVisible is false', () => {
      render(<Toast {...defaultProps} isVisible={false} />);

      expect(screen.queryByTestId('test-toast')).not.toBeInTheDocument();
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(<Toast {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty('dismiss');
      expect(ref.current).toHaveProperty('show');
      expect(ref.current).toHaveProperty('getElement');
      expect(ref.current).toHaveProperty('isPersistent');
    });

    it('isPersistent returns correct value', () => {
      const ref = React.createRef<any>();
      const { rerender } = render(
        <Toast {...defaultProps} persistent={true} ref={ref} />,
      );

      expect(ref.current.isPersistent()).toBe(true);

      rerender(<Toast {...defaultProps} persistent={false} ref={ref} />);
      expect(ref.current.isPersistent()).toBe(false);
    });

    it('dismiss calls onDismiss', () => {
      const mockOnDismiss = vi.fn();
      const ref = React.createRef<any>();

      render(<Toast {...defaultProps} onDismiss={mockOnDismiss} ref={ref} />);

      ref.current.dismiss();
      vi.advanceTimersByTime(300);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });
});

// Toast Provider tests
describe('ToastProvider', () => {
  const TestComponent = () => {
    const toast = useToast();

    return (
      <div>
        <button onClick={() => toast.info('Info message')}>Show Info</button>
        <button onClick={() => toast.success('Success message')}>
          Show Success
        </button>
        <button onClick={() => toast.warning('Warning message')}>
          Show Warning
        </button>
        <button onClick={() => toast.error('Error message')}>Show Error</button>
        <button onClick={() => toast.clearAllToasts()}>Clear All</button>
      </div>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('provides toast context', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    expect(screen.getByText('Show Info')).toBeInTheDocument();
  });

  it('shows info toast', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Show Info'));

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows different toast variants', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Show Success'));
    await user.click(screen.getByText('Show Warning'));
    await user.click(screen.getByText('Show Error'));

    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('clears all toasts', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Show Info'));
    await user.click(screen.getByText('Show Success'));

    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();

    await user.click(screen.getByText('Clear All'));

    expect(screen.queryByText('Info message')).not.toBeInTheDocument();
    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('respects maxToasts limit', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    const TestMaxToasts = () => {
      const toast = useToast();

      const showMany = () => {
        for (let i = 1; i <= 5; i++) {
          toast.info(`Message ${i}`);
        }
      };

      return <button onClick={showMany}>Show Many</button>;
    };

    render(
      <ToastProvider maxToasts={3}>
        <TestMaxToasts />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Show Many'));

    // Should only show the last 3 toasts
    expect(screen.getByText('Message 3')).toBeInTheDocument();
    expect(screen.getByText('Message 4')).toBeInTheDocument();
    expect(screen.getByText('Message 5')).toBeInTheDocument();
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Message 2')).not.toBeInTheDocument();
  });

  it('handles promise toasts', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });

    const TestPromise = () => {
      const toast = useToast();

      const testPromise = () => {
        const promise = new Promise((resolve) => {
          setTimeout(() => resolve({ data: 'success' }), 1000);
        });

        toast.promise(promise, {
          loading: 'Loading...',
          success: 'Success!',
          error: 'Error!',
        });
      };

      return <button onClick={testPromise}>Test Promise</button>;
    };

    render(
      <ToastProvider>
        <TestPromise />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Test Promise'));

    // Should show loading toast
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Advance timers to complete promise
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });

  it('throws error when used outside provider', () => {
    const TestError = () => {
      useToast();
      return null;
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestError />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });
});
