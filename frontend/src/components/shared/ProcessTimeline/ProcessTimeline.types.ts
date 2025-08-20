import type { HTMLAttributes, ReactNode } from 'react';
import type { ProgressBarProps } from '../../ui/ProgressBar';
import type { StatusBadgeProps } from '../../ui/StatusBadge';

export interface ProcessTimelinePhase {
  /** Unique identifier for the phase */
  id: string;
  /** Display label for the phase */
  label: string;
  /** Current status of the phase */
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  /** Progress percentage (0-100) for active phases */
  progress?: number;
  /** Optional description or additional info */
  description?: string;
  /** Optional icon for the phase */
  icon?: ReactNode;
  /** Estimated or actual duration */
  duration?: {
    estimated?: number; // seconds
    actual?: number; // seconds
  };
  /** Start and end timestamps */
  timestamps?: {
    startedAt?: Date;
    completedAt?: Date;
  };
  /** Error information for failed phases */
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
  /** Phase-specific metadata */
  metadata?: Record<string, any>;
}

export interface ProcessTimelineProps {
  /** Array of phases to display */
  phases: ProcessTimelinePhase[];
  /** Current active phase ID */
  currentPhase?: string;
  /** Overall process status */
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show progress bars for active phases */
  showProgress?: boolean;
  /** Whether to show phase descriptions */
  showDescriptions?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show estimated durations */
  showDurations?: boolean;
  /** Whether to animate transitions */
  animated?: boolean;
  /** Custom phase click handler */
  onPhaseClick?: (phase: ProcessTimelinePhase) => void;
  /** Custom phase retry handler for failed phases */
  onRetryPhase?: (phase: ProcessTimelinePhase) => void;
  /** Custom CSS class name */
  className?: string;
  /** Additional props passed to the container */
  containerProps?: HTMLAttributes<HTMLDivElement>;
  /** Test ID for testing */
  testId?: string;
}

export interface ProcessTimelineRef {
  /** Get the timeline container element */
  getElement: () => HTMLDivElement | null;
  /** Focus a specific phase */
  focusPhase: (phaseId: string) => void;
  /** Get phase element by ID */
  getPhaseElement: (phaseId: string) => HTMLElement | null;
  /** Scroll to a specific phase */
  scrollToPhase: (phaseId: string) => void;
}

export type ProcessTimelineOrientation = ProcessTimelineProps['orientation'];
export type ProcessTimelineSize = ProcessTimelineProps['size'];
export type ProcessPhaseStatus = ProcessTimelinePhase['status'];

// Theme configuration
export interface ProcessTimelineTheme {
  orientations: Record<
    NonNullable<ProcessTimelineOrientation>,
    {
      container: string;
      connector: string;
      phase: string;
    }
  >;
  sizes: Record<
    NonNullable<ProcessTimelineSize>,
    {
      spacing: string;
      iconSize: string;
      fontSize: string;
      connectorWidth: string;
    }
  >;
  phaseStates: Record<
    ProcessPhaseStatus,
    {
      badge: StatusBadgeProps['variant'];
      progress: ProgressBarProps['variant'];
      connector: string;
    }
  >;
}

// Utility types for scan phases
export interface ScanPhaseConfig
  extends Omit<ProcessTimelinePhase, 'id' | 'status'> {
  /** Phase identifier */
  phase:
    | 'discovery'
    | 'indexing'
    | 'enrichment'
    | 'preview_generation'
    | 'completion';
  /** Default label */
  defaultLabel: string;
  /** Weight for overall progress calculation */
  weight: number;
}

export const SCAN_PHASE_CONFIGS: Record<string, ScanPhaseConfig> = {
  discovery: {
    phase: 'discovery',
    defaultLabel: 'Volume Discovery',
    label: 'Discovering volumes and containers',
    description: 'Scanning Docker environment for available volumes',
    weight: 0.1,
  },
  indexing: {
    phase: 'indexing',
    defaultLabel: 'Filesystem Indexing',
    label: 'Indexing filesystem structure',
    description: 'Building directory tree and cataloging files',
    weight: 0.4,
  },
  enrichment: {
    phase: 'enrichment',
    defaultLabel: 'Metadata Enrichment',
    label: 'Processing file metadata',
    description: 'Extracting EXIF, media properties, and file details',
    weight: 0.3,
  },
  preview_generation: {
    phase: 'preview_generation',
    defaultLabel: 'Preview Generation',
    label: 'Generating thumbnails and previews',
    description: 'Creating image thumbnails and video previews',
    weight: 0.15,
  },
  completion: {
    phase: 'completion',
    defaultLabel: 'Finalizing',
    label: 'Finalizing scan results',
    description: 'Updating indexes and cleaning up temporary files',
    weight: 0.05,
  },
};

// Helper function to create timeline from scan progress
export interface ScanProgressData {
  phase: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  filesProcessed?: number;
  totalFiles?: number;
  currentPath?: string;
}

export const createScanTimeline = (
  scanProgress: ScanProgressData[],
): ProcessTimelinePhase[] => {
  return Object.entries(SCAN_PHASE_CONFIGS).map(([key, config]) => {
    const progressData = scanProgress.find((p) => p.phase === key);

    return {
      id: key,
      label: config.label,
      description: config.description,
      status: progressData?.status || 'pending',
      progress: progressData?.progress,
      timestamps: {
        startedAt: progressData?.startedAt,
        completedAt: progressData?.completedAt,
      },
      error: progressData?.error
        ? {
            message: progressData.error,
          }
        : undefined,
      metadata: {
        weight: config.weight,
        filesProcessed: progressData?.filesProcessed,
        totalFiles: progressData?.totalFiles,
        currentPath: progressData?.currentPath,
      },
    };
  });
};
