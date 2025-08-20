import type { HTMLAttributes, ReactNode } from 'react';

export interface StatusBadgeProps {
  /** Status variant determining the visual appearance */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'pending';
  /** Size of the badge */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Badge content - can be text or React elements */
  children: ReactNode;
  /** Optional icon to display before the text */
  icon?: ReactNode;
  /** Whether to show animated pulse effect */
  animated?: boolean;
  /** Whether to show a dot indicator */
  showDot?: boolean;
  /** Dot position relative to the content */
  dotPosition?: 'left' | 'right';
  /** Whether the badge should be rounded */
  rounded?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Additional props passed to the container */
  containerProps?: HTMLAttributes<HTMLSpanElement>;
  /** Test ID for testing */
  testId?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the badge is clickable */
  clickable?: boolean;
}

export interface StatusBadgeRef {
  /** Get the current badge element */
  getElement: () => HTMLSpanElement | null;
  /** Focus the badge element */
  focus: () => void;
  /** Blur the badge element */
  blur: () => void;
}

export type StatusBadgeVariant = StatusBadgeProps['variant'];
export type StatusBadgeSize = StatusBadgeProps['size'];

// Animation configurations
export interface StatusBadgeAnimation {
  duration: number;
  type: 'pulse' | 'bounce' | 'fade' | 'spin';
  timing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// Theme configuration
export interface StatusBadgeTheme {
  colors: Record<
    NonNullable<StatusBadgeVariant>,
    {
      background: string;
      text: string;
      border: string;
      dot: string;
    }
  >;
  sizes: Record<
    NonNullable<StatusBadgeSize>,
    {
      padding: string;
      fontSize: string;
      height: string;
      iconSize: string;
      dotSize: string;
    }
  >;
  animations: Record<string, StatusBadgeAnimation>;
}

// Predefined status configurations for common scan states
export interface ScanStatusConfig {
  variant: StatusBadgeVariant;
  icon?: ReactNode;
  animated?: boolean;
  showDot?: boolean;
  label: string;
}

export const SCAN_STATUS_CONFIGS: Record<string, ScanStatusConfig> = {
  pending: {
    variant: 'pending',
    animated: true,
    showDot: true,
    label: 'Pending',
  },
  running: {
    variant: 'info',
    animated: true,
    showDot: true,
    label: 'Running',
  },
  completed: {
    variant: 'success',
    showDot: true,
    label: 'Completed',
  },
  failed: {
    variant: 'error',
    showDot: true,
    label: 'Failed',
  },
  paused: {
    variant: 'warning',
    showDot: true,
    label: 'Paused',
  },
  cancelled: {
    variant: 'default',
    showDot: true,
    label: 'Cancelled',
  },
};
