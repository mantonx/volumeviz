import type { ReactNode } from 'react';

/**
 * Phase status types
 */
export type PhaseStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Phase display orientation
 */
export type PhaseOrientation = 'horizontal' | 'vertical';

/**
 * Phase size variants
 */
export type PhaseSize = 'sm' | 'md' | 'lg';

/**
 * Individual phase information
 */
export interface Phase {
  /** Unique identifier for the phase */
  id: string;
  /** Display label for the phase */
  label: string;
  /** Optional description */
  description?: string;
  /** Current status of the phase */
  status: PhaseStatus;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Optional icon */
  icon?: ReactNode;
  /** Optional metadata */
  metadata?: Record<string, any>;
  /** Whether this phase can be clicked */
  clickable?: boolean;
  /** Whether this phase is disabled */
  disabled?: boolean;
}

/**
 * Main component props
 */
export interface PhaseIndicatorProps {
  /** Array of phases to display */
  phases: Phase[];

  /** Current active phase ID */
  activePhase?: string;

  /** Display orientation */
  orientation?: PhaseOrientation;

  /** Size variant */
  size?: PhaseSize;

  /** Whether to show phase descriptions */
  showDescriptions?: boolean;

  /** Whether to show progress bars for active phases */
  showProgress?: boolean;

  /** Whether to show connecting lines between phases */
  showConnectors?: boolean;

  /** Whether to animate transitions */
  animated?: boolean;

  /** Whether phases are clickable */
  clickable?: boolean;

  /** Custom color scheme */
  colorScheme?: {
    pending?: string;
    active?: string;
    completed?: string;
    failed?: string;
    skipped?: string;
  };

  /** Event handlers */
  onPhaseClick?: (phase: Phase) => void;
  onPhaseHover?: (phase: Phase) => void;

  /** Custom CSS classes */
  className?: string;

  /** Test ID for testing */
  testId?: string;
}

/**
 * Component ref interface
 */
export interface PhaseIndicatorRef {
  /** Focus a specific phase */
  focusPhase(phaseId: string): void;
  /** Get current active phase */
  getActivePhase(): Phase | null;
  /** Get phase by ID */
  getPhase(phaseId: string): Phase | null;
  /** Scroll to phase (for long lists) */
  scrollToPhase(phaseId: string): void;
}

/**
 * Phase display configuration
 */
export interface PhaseDisplayConfig {
  size: PhaseSize;
  orientation: PhaseOrientation;
  showDescriptions: boolean;
  showProgress: boolean;
  showConnectors: boolean;
  animated: boolean;
}

/**
 * Default color scheme
 */
export const defaultColorScheme = {
  pending: 'bg-gray-200 text-gray-600',
  active: 'bg-blue-500 text-white',
  completed: 'bg-green-500 text-white',
  failed: 'bg-red-500 text-white',
  skipped: 'bg-yellow-500 text-white',
} as const;

/**
 * Phase indicator variants for different use cases
 */
export type PhaseIndicatorVariant =
  | 'default'
  | 'compact'
  | 'detailed'
  | 'minimal';

/**
 * Extended props with variant support
 */
export interface PhaseIndicatorVariantProps
  extends Omit<
    PhaseIndicatorProps,
    'size' | 'showDescriptions' | 'showProgress'
  > {
  /** Predefined variant configuration */
  variant?: PhaseIndicatorVariant;
}
