import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

import type {
  ModalProps,
  ModalRef,
  ModalContextValue,
  ModalSize,
  ModalVariant,
  DrawerPosition,
  ModalAnimation,
} from './Modal.types';
import {
  defaultModalSizes,
  defaultDrawerSizes,
  defaultAnimations,
} from './Modal.types';

/**
 * Modal Context
 */
const ModalContext = createContext<ModalContextValue | null>(null);

/**
 * Hook to use modal context
 */
export const useModal = (): ModalContextValue => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a Modal component');
  }
  return context;
};

/**
 * Focus trap utility
 */
const useFocusTrap = (
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element
    const firstFocusable = containerRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ) as HTMLElement;

    if (firstFocusable) {
      firstFocusable.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, enabled, containerRef]);
};

/**
 * Body scroll lock utility
 */
const useBodyScrollLock = (isOpen: boolean, enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled || !isOpen) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, enabled]);
};

/**
 * Get modal size classes
 */
const getModalSizeClasses = (
  size: ModalSize,
  variant: ModalVariant,
): string => {
  const sizeMap = variant === 'drawer' ? defaultDrawerSizes : defaultModalSizes;
  return sizeMap[size];
};

/**
 * Get drawer position classes
 */
const getDrawerPositionClasses = (position: DrawerPosition): string => {
  switch (position) {
    case 'left':
      return 'left-0 top-0 h-full';
    case 'right':
      return 'right-0 top-0 h-full';
    case 'top':
      return 'top-0 left-0 w-full';
    case 'bottom':
      return 'bottom-0 left-0 w-full';
    default:
      return 'right-0 top-0 h-full';
  }
};

/**
 * Get animation classes
 */
const getAnimationClasses = (
  animation: ModalAnimation,
  isOpen: boolean,
  isEntering: boolean,
  isExiting: boolean,
): string => {
  const config = defaultAnimations[animation];

  if (isExiting) {
    return clsx(config.exit, config.exitActive);
  }

  if (isEntering && isOpen) {
    return clsx(config.enter, config.enterActive);
  }

  if (isOpen) {
    return config.enterActive.replace(/transition-\S+/g, '').trim();
  }

  return config.enter;
};

/**
 * Enhanced Modal/Drawer component
 *
 * A versatile modal and drawer component with comprehensive features:
 * - Modal and drawer variants
 * - Multiple sizes and positions
 * - Focus trapping and accessibility
 * - Custom animations
 * - Header/footer configuration
 * - Body scroll locking
 */
export const Modal = forwardRef<ModalRef, ModalProps>(
  (
    {
      open,
      variant = 'modal',
      size = 'md',
      position = 'right',
      animation = 'fade',
      animationDuration,
      header,
      footer,
      children,
      focusTrap = { enabled: true },
      backdrop = { show: true, opacity: 50, closable: true },
      closable = true,
      closeOnEscape = true,
      closeOnOutsideClick = true,
      preventBodyScroll = true,
      zIndex = 50,
      container,
      scrollable = true,
      maxHeight,
      loading = false,
      error,
      onClose,
      onOpen,
      onEscapeKey,
      onOutsideClick,
      onAnimationEnd,
      className,
      headerClassName,
      bodyClassName,
      footerClassName,
      backdropClassName,
      testId = 'modal',
    },
    ref,
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isEntering, setIsEntering] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [mounted, setMounted] = useState(false);
    const modalId = useRef(
      `modal-${Math.random().toString(36).substr(2, 9)}`,
    ).current;

    // Hooks
    useFocusTrap(open && mounted, modalRef, focusTrap.enabled);
    useBodyScrollLock(open && mounted, preventBodyScroll);

    // Mount handling
    useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    // Animation handling
    useEffect(() => {
      if (!mounted) return;

      if (open) {
        setIsEntering(true);
        onOpen?.();

        const timer = setTimeout(() => {
          setIsEntering(false);
          onAnimationEnd?.();
        }, animationDuration || defaultAnimations[animation].duration);

        return () => clearTimeout(timer);
      } else {
        setIsExiting(true);

        const timer = setTimeout(() => {
          setIsExiting(false);
          onAnimationEnd?.();
        }, animationDuration || defaultAnimations[animation].duration);

        return () => clearTimeout(timer);
      }
    }, [open, mounted, animation, animationDuration, onOpen, onAnimationEnd]);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          modalRef.current?.focus();
        },
        close: () => {
          onClose?.();
        },
        getElement: () => modalRef.current,
        scrollToTop: () => {
          if (contentRef.current) {
            contentRef.current.scrollTop = 0;
          }
        },
        isOpen: () => open,
      }),
      [open, onClose],
    );

    // Event handlers
    const handleEscapeKey = useCallback(
      (event: KeyboardEvent) => {
        if (event.key === 'Escape' && closeOnEscape && closable) {
          event.preventDefault();
          onEscapeKey?.();
          onClose?.();
        }
      },
      [closeOnEscape, closable, onClose, onEscapeKey],
    );

    const handleBackdropClick = useCallback(
      (event: React.MouseEvent) => {
        if (
          event.target === event.currentTarget &&
          closeOnOutsideClick &&
          backdrop.closable !== false &&
          closable
        ) {
          onOutsideClick?.();
          onClose?.();
        }
      },
      [
        closeOnOutsideClick,
        backdrop.closable,
        closable,
        onClose,
        onOutsideClick,
      ],
    );

    const handleCloseClick = useCallback(() => {
      if (closable) {
        onClose?.();
      }
    }, [closable, onClose]);

    // Keyboard event listener
    useEffect(() => {
      if (open && mounted) {
        document.addEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
      }
    }, [open, mounted, handleEscapeKey]);

    // Context value
    const contextValue: ModalContextValue = {
      isOpen: open,
      close: handleCloseClick,
      modalId,
      size,
      variant,
    };

    // Don't render if not mounted or not visible
    if (!mounted || (!open && !isExiting)) {
      return null;
    }

    // Container classes
    const containerClasses = clsx(
      'fixed inset-0 z-50 flex items-center justify-center p-4',
      variant === 'drawer' && 'p-0',
      `z-${zIndex}`,
    );

    // Backdrop classes
    const backdropClasses = clsx(
      'fixed inset-0',
      backdrop.show && `bg-black bg-opacity-${backdrop.opacity || 50}`,
      backdrop.blur && 'backdrop-blur-sm',
      backdropClassName,
    );

    // Modal/Drawer classes
    const modalClasses = clsx(
      'relative bg-white shadow-xl',
      variant === 'modal' && [
        'rounded-lg',
        'max-h-full',
        getModalSizeClasses(size, variant),
        'mx-auto',
      ],
      variant === 'drawer' && [
        'fixed',
        getDrawerPositionClasses(position),
        getModalSizeClasses(size, variant),
        position === 'left' || position === 'right'
          ? 'max-h-full'
          : 'max-w-full',
      ],
      getAnimationClasses(animation, open, isEntering, isExiting),
      scrollable && 'overflow-hidden',
      className,
    );

    // Content classes
    const contentClasses = clsx(
      'flex flex-col',
      scrollable ? 'overflow-hidden' : 'overflow-visible',
      maxHeight &&
        `max-h-[${typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight}]`,
    );

    // Header component
    const renderHeader = () => {
      if (!header || header.custom) {
        return header?.custom;
      }

      return (
        <div
          className={clsx(
            'flex items-center justify-between p-6 border-b border-gray-200',
            header.sticky && 'sticky top-0 bg-white z-10',
            headerClassName,
          )}
        >
          <div className="flex-1">
            {header.title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {header.title}
              </h2>
            )}
            {header.subtitle && (
              <p className="text-sm text-gray-600 mt-1">{header.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {header.actions}
            {header.showClose !== false &&
              closable &&
              (header.closeButton || (
                <button
                  onClick={handleCloseClick}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                  aria-label="Close modal"
                  data-testid={`${testId}-close-button`}
                >
                  <X className="w-5 h-5" />
                </button>
              ))}
          </div>
        </div>
      );
    };

    // Footer component
    const renderFooter = () => {
      if (!footer) return null;

      const alignmentClasses = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
        between: 'justify-between',
      };

      return (
        <div
          className={clsx(
            'flex items-center gap-3 p-6 border-t border-gray-200',
            alignmentClasses[footer.align || 'right'],
            footer.sticky && 'sticky bottom-0 bg-white',
            footerClassName,
          )}
        >
          {footer.content}
          {footer.secondaryAction}
          {footer.actions?.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
          {footer.primaryAction}
        </div>
      );
    };

    // Body component
    const renderBody = () => (
      <div
        ref={contentRef}
        className={clsx(
          'flex-1 p-6',
          scrollable && 'overflow-y-auto',
          bodyClassName,
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!loading && !error && children}
      </div>
    );

    // Portal content
    const modalContent = (
      <ModalContext.Provider value={contextValue}>
        <div
          className={containerClasses}
          data-testid={testId}
          aria-modal="true"
          role="dialog"
          aria-labelledby={header?.title ? `${modalId}-title` : undefined}
        >
          {/* Backdrop */}
          {backdrop.show && (
            <div
              className={backdropClasses}
              onClick={handleBackdropClick}
              data-testid={`${testId}-backdrop`}
            />
          )}

          {/* Modal/Drawer */}
          <div
            ref={modalRef}
            className={modalClasses}
            tabIndex={-1}
            data-testid={`${testId}-content`}
          >
            <div className={contentClasses}>
              {renderHeader()}
              {renderBody()}
              {renderFooter()}
            </div>
          </div>
        </div>
      </ModalContext.Provider>
    );

    // Render with portal
    const targetContainer = container
      ? typeof container === 'string'
        ? document.querySelector(container)
        : container
      : document.body;

    if (!targetContainer) {
      return null;
    }

    return createPortal(modalContent, targetContainer);
  },
);

Modal.displayName = 'Modal';
