import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

import type {
  ToastProps,
  ToastRef,
  ToastVariant,
  ToastPosition,
} from './Toast.types';
import {
  defaultToastDurations,
  defaultToastSizes,
  defaultToastAnimations,
  toastVariantStyles,
} from './Toast.types';

/**
 * Get animation classes based on position
 */
const getAnimationForPosition = (position: ToastPosition): string => {
  if (position.includes('right')) return 'slide-right';
  if (position.includes('left')) return 'slide-left';
  if (position.includes('top')) return 'slide-down';
  if (position.includes('bottom')) return 'slide-up';
  return 'fade';
};

/**
 * Get default icon for variant
 */
const getDefaultIcon = (variant: ToastVariant) => {
  const iconMap = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
  };
  return iconMap[variant];
};

/**
 * Enhanced Toast component
 *
 * A comprehensive toast notification component with:
 * - Multiple variants (info, success, warning, error)
 * - Customizable positioning and animations
 * - Action buttons and dismissal options
 * - Size variants and responsive design
 * - Accessibility support
 * - Auto-dismiss with custom durations
 */
export const Toast = forwardRef<ToastRef, ToastProps>(
  (
    {
      id = `toast-${Math.random().toString(36).substr(2, 9)}`,
      variant = 'info',
      title,
      message,
      duration,
      persistent = false,
      dismissible = true,
      icon,
      action,
      position = 'top-right',
      size = 'md',
      animate = true,
      isVisible = true,
      onDismiss,
      onAction,
      onAnimationEnd,
      className,
      testId = 'toast',
    },
    ref,
  ) => {
    const toastRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(isVisible);
    const [isEntering, setIsEntering] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>(undefined);

    // Mount handling
    useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    // Visibility handling
    useEffect(() => {
      if (isVisible && !visible) {
        setVisible(true);
        setIsEntering(true);

        if (animate) {
          const timer = setTimeout(() => {
            setIsEntering(false);
          }, defaultToastAnimations.fade.duration);
          return () => clearTimeout(timer);
        }
      } else if (!isVisible && visible) {
        handleDismiss();
      }
    }, [isVisible, visible, animate]);

    // Auto-dismiss handling
    useEffect(() => {
      if (!persistent && visible && !isExiting) {
        const dismissDuration = duration || defaultToastDurations[variant];

        if (dismissDuration > 0) {
          timeoutRef.current = setTimeout(() => {
            handleDismiss();
          }, dismissDuration);
        }
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [persistent, visible, isExiting, duration, variant]);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        dismiss: handleDismiss,
        show: () => setVisible(true),
        getElement: () => toastRef.current,
        isPersistent: () => persistent,
      }),
      [persistent],
    );

    // Event handlers
    const handleDismiss = useCallback(() => {
      if (!dismissible) return;

      setIsExiting(true);

      if (animate) {
        setTimeout(() => {
          setVisible(false);
          onDismiss?.();
          onAnimationEnd?.();
        }, defaultToastAnimations.fade.duration);
      } else {
        setVisible(false);
        onDismiss?.();
        onAnimationEnd?.();
      }
    }, [dismissible, animate, onDismiss, onAnimationEnd]);

    const handleActionClick = useCallback(() => {
      action?.onClick();
      onAction?.();

      // Auto-dismiss after action unless persistent
      if (!persistent) {
        handleDismiss();
      }
    }, [action, onAction, persistent, handleDismiss]);

    // Computed values
    const sizeConfig = useMemo(() => defaultToastSizes[size], [size]);
    const variantConfig = useMemo(() => toastVariantStyles[variant], [variant]);

    const animationClass = useMemo(() => {
      if (!animate) return '';

      const animationType = getAnimationForPosition(position);
      const config = defaultToastAnimations[animationType];

      if (isExiting) {
        return clsx(config.exit, config.exitActive);
      }

      if (isEntering) {
        return clsx(config.enter, config.enterActive);
      }

      return config.enterActive.replace(/transition-\S+/g, '').trim();
    }, [animate, position, isExiting, isEntering]);

    // Icon rendering
    const renderIcon = () => {
      if (icon === null) return null;

      if (icon) {
        return (
          <div className={clsx(sizeConfig.icon, variantConfig.icon)}>
            {icon}
          </div>
        );
      }

      const DefaultIcon = getDefaultIcon(variant);
      return (
        <DefaultIcon
          className={clsx(sizeConfig.icon, variantConfig.icon)}
          aria-hidden="true"
        />
      );
    };

    // Don't render if not mounted or not visible
    if (!mounted || !visible) {
      return null;
    }

    // Toast classes
    const toastClasses = clsx(
      'relative flex items-start rounded-lg shadow-lg border backdrop-blur-sm',
      'transform transition-all duration-300 ease-out',
      sizeConfig.toast,
      variantConfig.container,
      animationClass,
      className,
    );

    // Content
    const toastContent = (
      <div
        ref={toastRef}
        className={toastClasses}
        role="alert"
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        aria-labelledby={title ? `${id}-title` : undefined}
        aria-describedby={`${id}-message`}
        data-testid={testId}
        data-variant={variant}
        data-size={size}
      >
        {/* Icon */}
        {renderIcon()}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <div
              id={`${id}-title`}
              className={clsx(sizeConfig.title, variantConfig.title, 'mb-1')}
            >
              {title}
            </div>
          )}
          <div
            id={`${id}-message`}
            className={clsx(sizeConfig.message, variantConfig.message)}
          >
            {message}
          </div>
        </div>

        {/* Action button */}
        {action && (
          <button
            onClick={handleActionClick}
            className={clsx(
              'ml-3 rounded border transition-colors',
              sizeConfig.action,
              variantConfig.action,
            )}
            data-testid={`${testId}-action`}
          >
            {action.label}
          </button>
        )}

        {/* Close button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={clsx(
              'ml-2 p-1 rounded transition-colors',
              'hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-1',
              variantConfig.closeButton,
            )}
            aria-label="Dismiss notification"
            data-testid={`${testId}-close`}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Loading indicator for persistent toasts */}
        {persistent && !dismissible && (
          <div className="ml-2 flex items-center">
            <Loader2 className="w-4 h-4 animate-spin opacity-50" />
          </div>
        )}
      </div>
    );

    return toastContent;
  },
);

Toast.displayName = 'Toast';
