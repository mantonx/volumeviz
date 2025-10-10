import { clsx } from 'clsx';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
} from 'react';
import type { StatusBadgeProps, StatusBadgeRef } from './StatusBadge.types';

/**
 * StatusBadge Component
 *
 * A flexible status badge component for displaying scan states, progress indicators,
 * and general status information. Supports multiple variants, animations, and
 * accessibility features for comprehensive status communication.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <StatusBadge variant="success">Completed</StatusBadge>
 * ```
 *
 * @example
 * Animated scan status:
 * ```tsx
 * <StatusBadge
 *   variant="info"
 *   animated
 *   showDot
 *   icon={<ActivityIcon />}
 * >
 *   Scanning...
 * </StatusBadge>
 * ```
 *
 * @example
 * Clickable status with actions:
 * ```tsx
 * <StatusBadge
 *   variant="warning"
 *   clickable
 *   onClick={handleRetry}
 *   showDot
 * >
 *   Retry Scan
 * </StatusBadge>
 * ```
 */
export const StatusBadge = forwardRef<StatusBadgeRef, StatusBadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      children,
      icon,
      animated = false,
      showDot = false,
      dotPosition = 'left',
      rounded = true,
      className,
      containerProps,
      testId = 'status-badge',
      onClick,
      clickable = false,
      ...props
    },
    ref,
  ) => {
    const badgeRef = useRef<HTMLSpanElement>(null);

    const focus = useCallback(() => {
      badgeRef.current?.focus();
    }, []);

    const blur = useCallback(() => {
      badgeRef.current?.blur();
    }, []);

    useImperativeHandle(ref, () => ({
      getElement: () => badgeRef.current,
      focus,
      blur,
    }));

    // CSS classes for different variants
    const variantClasses = {
      default: {
        base: 'bg-surface-secondary text-secondary border-line',
        dark: '',
        dot: 'bg-gray-400',
      },
      success: {
        base: 'bg-green-100 text-green-800 border-green-200',
        dark: '',
        dot: 'bg-green-500',
      },
      warning: {
        base: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        dark: '',
        dot: 'bg-yellow-500',
      },
      error: {
        base: 'bg-red-100 text-red-800 border-red-200',
        dark: '',
        dot: 'bg-red-500',
      },
      info: {
        base: 'bg-blue-100 text-blue-800 border-blue-200',
        dark: '',
        dot: 'bg-blue-500',
      },
      pending: {
        base: 'bg-purple-100 text-purple-800 border-purple-200',
        dark: '',
        dot: 'bg-purple-500',
      },
    };

    // CSS classes for different sizes
    const sizeClasses = {
      xs: {
        padding: 'px-1.5 py-0.5',
        text: 'text-xs',
        height: 'h-5',
        iconSize: 'w-3 h-3',
        dotSize: 'w-1.5 h-1.5',
        gap: 'gap-1',
      },
      sm: {
        padding: 'px-2 py-1',
        text: 'text-xs',
        height: 'h-6',
        iconSize: 'w-3 h-3',
        dotSize: 'w-2 h-2',
        gap: 'gap-1.5',
      },
      md: {
        padding: 'px-2.5 py-1',
        text: 'text-sm',
        height: 'h-7',
        iconSize: 'w-4 h-4',
        dotSize: 'w-2 h-2',
        gap: 'gap-2',
      },
      lg: {
        padding: 'px-3 py-1.5',
        text: 'text-sm',
        height: 'h-8',
        iconSize: 'w-4 h-4',
        dotSize: 'w-2.5 h-2.5',
        gap: 'gap-2',
      },
    };

    const currentVariant = variantClasses[variant];
    const currentSize = sizeClasses[size];

    const badgeClasses = clsx(
      // Base styles
      'status-badge inline-flex items-center font-medium border transition-all duration-200',
      // Size-specific styles
      currentSize.padding,
      currentSize.text,
      currentSize.height,
      currentSize.gap,
      // Variant-specific styles
      currentVariant.base,
      currentVariant.dark,
      // Shape
      {
        'rounded-full': rounded,
        'rounded-md': !rounded,
      },
      // Interactive states
      {
        'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500':
          clickable || onClick,
        'select-none': clickable || onClick,
      },
      // Animation
      {
        'animate-pulse': animated,
      },
      className,
    );

    const dotClasses = clsx(
      'status-badge-dot rounded-full flex-shrink-0',
      currentSize.dotSize,
      currentVariant.dot,
      {
        'animate-pulse': animated,
      },
    );

    const iconClasses = clsx(
      'status-badge-icon flex-shrink-0',
      currentSize.iconSize,
    );

    const handleClick = useCallback(() => {
      if (onClick && (clickable || onClick)) {
        onClick();
      }
    }, [onClick, clickable]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLSpanElement>) => {
        if (
          (event.key === 'Enter' || event.key === ' ') &&
          (clickable || onClick)
        ) {
          event.preventDefault();
          handleClick();
        }
      },
      [handleClick, clickable, onClick],
    );

    return (
      <span
        ref={badgeRef}
        className={badgeClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={clickable || onClick ? 'button' : 'status'}
        tabIndex={clickable || onClick ? 0 : undefined}
        aria-label={
          typeof children === 'string'
            ? `Status: ${children}`
            : `Status badge: ${variant}`
        }
        data-testid={testId}
        data-variant={variant}
        data-size={size}
        data-animated={animated}
        data-clickable={clickable || !!onClick}
        {...containerProps}
        {...props}
      >
        {/* Left dot */}
        {showDot && dotPosition === 'left' && (
          <span className={dotClasses} data-testid={`${testId}-dot`} />
        )}

        {/* Icon */}
        {icon && (
          <span className={iconClasses} data-testid={`${testId}-icon`}>
            {icon}
          </span>
        )}

        {/* Content */}
        <span
          className="status-badge-content"
          data-testid={`${testId}-content`}
        >
          {children}
        </span>

        {/* Right dot */}
        {showDot && dotPosition === 'right' && (
          <span className={dotClasses} data-testid={`${testId}-dot`} />
        )}
      </span>
    );
  },
);

StatusBadge.displayName = 'StatusBadge';
