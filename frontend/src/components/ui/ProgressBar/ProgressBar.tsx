import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { clsx } from 'clsx';
import type { ProgressBarProps, ProgressBarRef } from './ProgressBar.types';

/**
 * ProgressBar Component
 *
 * A flexible progress bar component with multiple variants, sizes, and animation options.
 * Supports both determinate and indeterminate states for various use cases including
 * scan progress monitoring, file operations, and general loading states.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ProgressBar value={75} variant="success" size="md" showLabel />
 * ```
 *
 * @example
 * Scan progress with custom label:
 * ```tsx
 * <ProgressBar
 *   value={45}
 *   variant="info"
 *   label="Indexing files..."
 *   animated
 *   striped
 * />
 * ```
 *
 * @example
 * Indeterminate loading state:
 * ```tsx
 * <ProgressBar indeterminate animated variant="default" />
 * ```
 */
export const ProgressBar = forwardRef<ProgressBarRef, ProgressBarProps>(
  (
    {
      value,
      variant = 'default',
      size = 'md',
      showLabel = false,
      label,
      animated = false,
      striped = false,
      indeterminate = false,
      className,
      containerProps,
      testId = 'progress-bar',
    },
    ref,
  ) => {
    const [currentValue, setCurrentValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);

    // Update internal value when prop changes
    useEffect(() => {
      setCurrentValue(value);
    }, [value]);

    // Clamp value between 0 and 100
    const clampedValue = Math.min(Math.max(currentValue, 0), 100);

    const animateTo = useCallback(
      (targetValue: number, duration = 300) => {
        const startValue = currentValue;
        const startTime = Date.now();
        setIsAnimating(true);

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease-out cubic easing
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          const newValue =
            startValue + (targetValue - startValue) * easeOutCubic;

          setCurrentValue(newValue);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setIsAnimating(false);
          }
        };

        requestAnimationFrame(animate);
      },
      [currentValue],
    );

    useImperativeHandle(ref, () => ({
      getValue: () => currentValue,
      setValue: setCurrentValue,
      animateTo,
    }));

    // CSS classes for different variants
    const variantClasses = {
      default: 'bg-blue-500',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-blue-400',
    };

    // CSS classes for different sizes
    const sizeClasses = {
      xs: 'h-1',
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
      xl: 'h-6',
    };

    // Label size classes
    const labelSizeClasses = {
      xs: 'text-xs',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
    };

    const containerClasses = clsx(
      'progress-bar-container relative w-full',
      {
        'progress-bar-container--animated': animated,
        'progress-bar-container--indeterminate': indeterminate,
      },
      className,
    );

    const trackClasses = clsx(
      'progress-bar-track w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
      sizeClasses[size],
    );

    const progressClasses = clsx(
      'progress-bar h-full transition-all duration-300 ease-out rounded-full',
      variantClasses[variant],
      {
        'progress-bar--striped bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:1rem_1rem]':
          striped,
        'progress-bar--animated animate-[progress-stripe_1s_linear_infinite]':
          animated && striped,
        'progress-bar--indeterminate animate-[progress-indeterminate_1.5s_ease-in-out_infinite]':
          indeterminate,
        'opacity-75': isAnimating,
      },
    );

    const displayLabel = label || `${Math.round(clampedValue)}%`;

    return (
      <div
        className={containerClasses}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Progress: ${displayLabel}`}
        data-testid={testId}
        {...containerProps}
      >
        <div className={trackClasses}>
          <div
            className={progressClasses}
            style={{
              width: indeterminate ? '30%' : `${clampedValue}%`,
              transform: indeterminate ? 'translateX(-100%)' : undefined,
            }}
          />
        </div>

        {showLabel && (
          <div className="flex justify-between items-center mt-1">
            <span
              className={clsx(
                'progress-bar-label font-medium text-gray-700 dark:text-gray-300',
                labelSizeClasses[size],
              )}
              data-testid={`${testId}-label`}
            >
              {displayLabel}
            </span>
            {!indeterminate && (
              <span
                className={clsx(
                  'text-gray-500 dark:text-gray-400',
                  labelSizeClasses[size],
                )}
              >
                {Math.round(clampedValue)}%
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';
