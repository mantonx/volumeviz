import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

import type { ModalProps, ModalRef, ModalContextValue } from './Modal.types';
import { useModalPhase } from './useModalPhase';
import { useFocusTrap } from './useFocusTrap';
import { useBodyScrollLock } from './useBodyScrollLock';
import {
  getContainerClasses,
  getBackdropClasses,
  getModalClasses,
  getContentClasses,
  getDrawerTransformStyle,
} from './modalStyles';

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
      focusTrap: focusTrapProp,
      backdrop: backdropProp,
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
    const modalId = useRef(
      `modal-${Math.random().toString(36).substr(2, 9)}`,
    ).current;

    // Merge field-by-field rather than relying on a default parameter for
    // the whole object — a default param only applies when the prop is
    // omitted entirely, so `backdrop={{opacity: 75}}` would otherwise
    // silently drop `show: true` and the backdrop would stop rendering.
    const focusTrap = { enabled: true, ...focusTrapProp };
    const backdrop = {
      show: true,
      opacity: 50,
      closable: true,
      ...backdropProp,
    };

    const { phase, isRendered, isEntering, isExiting } = useModalPhase({
      open,
      animation,
      animationDuration,
      elementRef: modalRef,
      onOpen,
      onAnimationEnd,
    });

    useFocusTrap(open && isRendered, modalRef, focusTrap.enabled);
    useBodyScrollLock(open && isRendered, preventBodyScroll);

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
      if (open && isRendered) {
        document.addEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
      }
    }, [open, isRendered, handleEscapeKey]);

    // Context value
    const contextValue: ModalContextValue = {
      isOpen: open,
      close: handleCloseClick,
      modalId,
      size,
      variant,
    };

    // `isRendered` (phase !== 'closed') is the single source of truth for
    // whether this should be in the DOM — it only reaches 'closed' after
    // the real exit transition has finished (see useModalPhase), so
    // there's no separate "still animating out" case to account for here.
    if (!isRendered) {
      return null;
    }

    const containerClasses = getContainerClasses(variant, zIndex);
    const backdropClasses = getBackdropClasses(
      backdrop.show,
      backdrop.blur,
      backdropClassName,
    );
    const modalClasses = getModalClasses({
      variant,
      size,
      position,
      animation,
      open,
      isEntering,
      isExiting,
      scrollable,
      className,
    });
    const modalStyle: React.CSSProperties =
      variant === 'drawer' ? getDrawerTransformStyle(position, phase) : {};
    const contentClasses = getContentClasses(scrollable, maxHeight);

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
              style={{ opacity: (backdrop.opacity ?? 50) / 100 }}
              onClick={handleBackdropClick}
              data-testid={`${testId}-backdrop`}
            />
          )}

          {/* Modal/Drawer */}
          <div
            ref={modalRef}
            className={modalClasses}
            style={modalStyle}
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
