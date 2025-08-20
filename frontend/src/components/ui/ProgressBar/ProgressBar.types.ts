import type { HTMLAttributes } from 'react';

export interface ProgressBarProps {
  /** Progress value between 0 and 100 */
  value: number;
  /** Visual variant of the progress bar */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Size of the progress bar */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the percentage label */
  showLabel?: boolean;
  /** Custom label text (overrides percentage) */
  label?: string;
  /** Whether to animate the progress */
  animated?: boolean;
  /** Whether to show striped pattern */
  striped?: boolean;
  /** Whether to show indeterminate state */
  indeterminate?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Additional props passed to the container */
  containerProps?: HTMLAttributes<HTMLDivElement>;
  /** Test ID for testing */
  testId?: string;
}

export interface ProgressBarRef {
  /** Get current progress value */
  getValue: () => number;
  /** Set progress value */
  setValue: (value: number) => void;
  /** Animate to target value */
  animateTo: (targetValue: number, duration?: number) => void;
}

export type ProgressBarVariant = ProgressBarProps['variant'];
export type ProgressBarSize = ProgressBarProps['size'];

// Animation configurations
export interface ProgressBarAnimation {
  duration: number;
  easing: 'linear' | 'ease-out' | 'ease-in-out';
}

// Theme configuration
export interface ProgressBarTheme {
  colors: Record<NonNullable<ProgressBarVariant>, string>;
  sizes: Record<
    NonNullable<ProgressBarSize>,
    {
      height: string;
      fontSize: string;
      borderRadius: string;
    }
  >;
}
