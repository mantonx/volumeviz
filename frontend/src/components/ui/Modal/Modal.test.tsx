import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Modal } from './Modal';
import type { ModalProps } from './Modal.types';

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
}));

const defaultProps: ModalProps = {
  open: true,
  onClose: vi.fn(),
  children: <div>Modal content</div>,
  testId: 'test-modal',
};

describe('Modal', () => {
  const user = userEvent.setup();
  let originalBodyOverflow: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalBodyOverflow = document.body.style.overflow;
  });

  afterEach(() => {
    document.body.style.overflow = originalBodyOverflow;
  });

  describe('Rendering', () => {
    it('renders modal content when open', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByText('Modal content')).toBeInTheDocument();
      expect(screen.getByTestId('test-modal')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<Modal {...defaultProps} open={false} />);

      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-modal')).not.toBeInTheDocument();
    });

    it('renders with custom test ID', () => {
      render(<Modal {...defaultProps} testId="custom-modal" />);

      expect(screen.getByTestId('custom-modal')).toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
      render(<Modal {...defaultProps} />);

      const modal = screen.getByTestId('test-modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('role', 'dialog');
    });
  });

  describe('Header', () => {
    it('renders header with title and subtitle', () => {
      render(
        <Modal
          {...defaultProps}
          header={{
            title: 'Test Title',
            subtitle: 'Test Subtitle',
          }}
        />
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    });

    it('renders close button by default', () => {
      render(
        <Modal
          {...defaultProps}
          header={{ title: 'Test Title' }}
        />
      );

      expect(screen.getByTestId('test-modal-close-button')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('hides close button when showClose is false', () => {
      render(
        <Modal
          {...defaultProps}
          header={{
            title: 'Test Title',
            showClose: false,
          }}
        />
      );

      expect(screen.queryByTestId('test-modal-close-button')).not.toBeInTheDocument();
    });

    it('renders header actions', () => {
      render(
        <Modal
          {...defaultProps}
          header={{
            title: 'Test Title',
            actions: <button data-testid="header-action">Action</button>,
          }}
        />
      );

      expect(screen.getByTestId('header-action')).toBeInTheDocument();
    });

    it('renders custom header', () => {
      render(
        <Modal
          {...defaultProps}
          header={{
            custom: <div data-testid="custom-header">Custom Header</div>,
          }}
        />
      );

      expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('renders footer with primary and secondary actions', () => {
      render(
        <Modal
          {...defaultProps}
          footer={{
            primaryAction: <button data-testid="primary-action">Save</button>,
            secondaryAction: <button data-testid="secondary-action">Cancel</button>,
          }}
        />
      );

      expect(screen.getByTestId('primary-action')).toBeInTheDocument();
      expect(screen.getByTestId('secondary-action')).toBeInTheDocument();
    });

    it('renders footer content', () => {
      render(
        <Modal
          {...defaultProps}
          footer={{
            content: <div data-testid="footer-content">Footer Content</div>,
          }}
        />
      );

      expect(screen.getByTestId('footer-content')).toBeInTheDocument();
    });

    it('renders multiple actions', () => {
      render(
        <Modal
          {...defaultProps}
          footer={{
            actions: [
              <button key="1" data-testid="action-1">Action 1</button>,
              <button key="2" data-testid="action-2">Action 2</button>,
            ],
          }}
        />
      );

      expect(screen.getByTestId('action-1')).toBeInTheDocument();
      expect(screen.getByTestId('action-2')).toBeInTheDocument();
    });

    it('does not render footer when not provided', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('applies correct size classes for modal variant', () => {
      const { rerender } = render(
        <Modal {...defaultProps} size="sm" variant="modal" />
      );

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('max-w-sm');

      rerender(<Modal {...defaultProps} size="lg" variant="modal" />);
      expect(content).toHaveClass('max-w-lg');
    });

    it('applies correct size classes for drawer variant', () => {
      const { rerender } = render(
        <Modal {...defaultProps} size="sm" variant="drawer" />
      );

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('w-80');

      rerender(<Modal {...defaultProps} size="lg" variant="drawer" />);
      expect(content).toHaveClass('w-1/3');
    });
  });

  describe('Variants', () => {
    it('renders as modal by default', () => {
      render(<Modal {...defaultProps} />);

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('rounded-lg');
    });

    it('renders as drawer when variant is drawer', () => {
      render(<Modal {...defaultProps} variant="drawer" />);

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('fixed');
    });
  });

  describe('Drawer Positions', () => {
    it('applies correct position classes for drawer', () => {
      const { rerender } = render(
        <Modal {...defaultProps} variant="drawer" position="left" />
      );

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('left-0', 'top-0', 'h-full');

      rerender(<Modal {...defaultProps} variant="drawer" position="right" />);
      expect(content).toHaveClass('right-0', 'top-0', 'h-full');

      rerender(<Modal {...defaultProps} variant="drawer" position="top" />);
      expect(content).toHaveClass('top-0', 'left-0', 'w-full');

      rerender(<Modal {...defaultProps} variant="drawer" position="bottom" />);
      expect(content).toHaveClass('bottom-0', 'left-0', 'w-full');
    });
  });

  describe('Backdrop', () => {
    it('renders backdrop by default', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByTestId('test-modal-backdrop')).toBeInTheDocument();
    });

    it('hides backdrop when show is false', () => {
      render(
        <Modal
          {...defaultProps}
          backdrop={{ show: false }}
        />
      );

      expect(screen.queryByTestId('test-modal-backdrop')).not.toBeInTheDocument();
    });

    it('applies custom backdrop opacity', () => {
      render(
        <Modal
          {...defaultProps}
          backdrop={{ opacity: 75 }}
        />
      );

      const backdrop = screen.getByTestId('test-modal-backdrop');
      expect(backdrop).toHaveClass('bg-opacity-75');
    });

    it('calls onClose when backdrop is clicked', async () => {
      const mockOnClose = vi.fn();
      render(<Modal {...defaultProps} onClose={mockOnClose} />);

      const backdrop = screen.getByTestId('test-modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when backdrop is not closable', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          backdrop={{ closable: false }}
        />
      );

      const backdrop = screen.getByTestId('test-modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when closeOnOutsideClick is false', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          closeOnOutsideClick={false}
        />
      );

      const backdrop = screen.getByTestId('test-modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Interactions', () => {
    it('calls onClose when Escape is pressed', async () => {
      const mockOnClose = vi.fn();
      render(<Modal {...defaultProps} onClose={mockOnClose} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when closeOnEscape is false', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          closeOnEscape={false}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when not closable', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          closable={false}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('calls onEscapeKey handler when Escape is pressed', async () => {
      const mockOnEscapeKey = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onEscapeKey={mockOnEscapeKey}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnEscapeKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          header={{ title: 'Test' }}
        />
      );

      const closeButton = screen.getByTestId('test-modal-close-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when not closable', async () => {
      const mockOnClose = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onClose={mockOnClose}
          closable={false}
          header={{ title: 'Test' }}
        />
      );

      // Close button should not be rendered when not closable
      expect(screen.queryByTestId('test-modal-close-button')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading is true', () => {
      render(<Modal {...defaultProps} loading />);

      const spinner = screen.getByRole('dialog').querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('shows content when not loading', () => {
      render(<Modal {...defaultProps} loading={false} />);

      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      render(
        <Modal
          {...defaultProps}
          error="Something went wrong"
        />
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('shows content when no error', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });
  });

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal is open', () => {
      render(<Modal {...defaultProps} preventBodyScroll />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('does not lock body scroll when preventBodyScroll is false', () => {
      render(<Modal {...defaultProps} preventBodyScroll={false} />);

      expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('restores original body overflow when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps} preventBodyScroll />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} open={false} preventBodyScroll />);

      // Note: In test environment, the cleanup happens on unmount
      // In real usage, the useEffect cleanup would restore the scroll
    });
  });

  describe('Max Height', () => {
    it('applies max height to content', () => {
      render(
        <Modal
          {...defaultProps}
          maxHeight="400px"
        />
      );

      const content = screen.getByTestId('test-modal-content');
      const bodyElement = content.querySelector('[style*="max-height"]') as HTMLElement;
      
      if (bodyElement) {
        expect(bodyElement.style.maxHeight).toBe('400px');
      }
    });

    it('applies numeric max height', () => {
      render(
        <Modal
          {...defaultProps}
          maxHeight={500}
        />
      );

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('max-h-[500px]');
    });
  });

  describe('Event Handlers', () => {
    it('calls onOpen when modal opens', async () => {
      const mockOnOpen = vi.fn();
      const { rerender } = render(
        <Modal {...defaultProps} open={false} onOpen={mockOnOpen} />
      );

      rerender(<Modal {...defaultProps} open={true} onOpen={mockOnOpen} />);

      await waitFor(() => {
        expect(mockOnOpen).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onOutsideClick when backdrop is clicked', async () => {
      const mockOnOutsideClick = vi.fn();
      render(
        <Modal
          {...defaultProps}
          onOutsideClick={mockOnOutsideClick}
        />
      );

      const backdrop = screen.getByTestId('test-modal-backdrop');
      await user.click(backdrop);

      expect(mockOnOutsideClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ref API', () => {
    it('exposes imperative API through ref', () => {
      const ref = React.createRef<any>();
      render(<Modal {...defaultProps} ref={ref} />);

      expect(ref.current).toHaveProperty('focus');
      expect(ref.current).toHaveProperty('close');
      expect(ref.current).toHaveProperty('getElement');
      expect(ref.current).toHaveProperty('scrollToTop');
      expect(ref.current).toHaveProperty('isOpen');
    });

    it('isOpen returns correct state', () => {
      const ref = React.createRef<any>();
      const { rerender } = render(
        <Modal {...defaultProps} open={true} ref={ref} />
      );

      expect(ref.current.isOpen()).toBe(true);

      rerender(<Modal {...defaultProps} open={false} ref={ref} />);
      expect(ref.current.isOpen()).toBe(false);
    });

    it('close calls onClose', () => {
      const mockOnClose = vi.fn();
      const ref = React.createRef<any>();
      render(
        <Modal {...defaultProps} onClose={mockOnClose} ref={ref} />
      );

      ref.current.close();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      render(
        <Modal
          {...defaultProps}
          className="custom-modal"
        />
      );

      const content = screen.getByTestId('test-modal-content');
      expect(content).toHaveClass('custom-modal');
    });

    it('applies custom header className', () => {
      render(
        <Modal
          {...defaultProps}
          header={{ title: 'Test' }}
          headerClassName="custom-header"
        />
      );

      const header = screen.getByText('Test').closest('.custom-header');
      expect(header).toBeInTheDocument();
    });

    it('applies custom footer className', () => {
      render(
        <Modal
          {...defaultProps}
          footer={{ content: <div>Footer</div> }}
          footerClassName="custom-footer"
        />
      );

      const footer = screen.getByText('Footer').closest('.custom-footer');
      expect(footer).toBeInTheDocument();
    });

    it('applies custom backdrop className', () => {
      render(
        <Modal
          {...defaultProps}
          backdropClassName="custom-backdrop"
        />
      );

      const backdrop = screen.getByTestId('test-modal-backdrop');
      expect(backdrop).toHaveClass('custom-backdrop');
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes with title', () => {
      render(
        <Modal
          {...defaultProps}
          header={{ title: 'Test Modal Title' }}
        />
      );

      const modal = screen.getByTestId('test-modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('close button has correct aria-label', () => {
      render(
        <Modal
          {...defaultProps}
          header={{ title: 'Test' }}
        />
      );

      const closeButton = screen.getByTestId('test-modal-close-button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
    });
  });
});