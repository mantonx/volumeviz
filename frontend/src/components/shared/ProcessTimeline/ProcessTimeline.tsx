import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { ProgressBar } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import type {
  ProcessTimelinePhase,
  ProcessTimelineProps,
  ProcessTimelineRef,
} from './ProcessTimeline.types';

/**
 * ProcessTimeline Component
 *
 * A comprehensive timeline component for displaying multi-phase processes
 * like scan operations. Combines ProgressBar and StatusBadge components
 * to provide detailed progress tracking with phase-by-phase visibility.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ProcessTimeline
 *   phases={scanPhases}
 *   currentPhase="indexing"
 *   status="running"
 *   showProgress
 * />
 * ```
 *
 * @example
 * Vertical layout with descriptions:
 * ```tsx
 * <ProcessTimeline
 *   phases={phases}
 *   orientation="vertical"
 *   showDescriptions
 *   showTimestamps
 *   onPhaseClick={handlePhaseClick}
 * />
 * ```
 *
 * @example
 * Compact horizontal timeline:
 * ```tsx
 * <ProcessTimeline
 *   phases={phases}
 *   orientation="horizontal"
 *   size="sm"
 *   showProgress={false}
 * />
 * ```
 */
export const ProcessTimeline = forwardRef<
  ProcessTimelineRef,
  ProcessTimelineProps
>(
  (
    {
      phases,
      currentPhase,
      status = 'idle',
      orientation = 'vertical',
      size = 'md',
      showProgress = true,
      showDescriptions = true,
      showTimestamps = false,
      showDurations = false,
      animated = true,
      onPhaseClick,
      onRetryPhase,
      className,
      containerProps,
      testId = 'process-timeline',
      ...props
    },
    ref,
  ) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const phaseRefs = useRef<Map<string, HTMLElement>>(new Map());

    const focusPhase = useCallback((phaseId: string) => {
      const element = phaseRefs.current.get(phaseId);
      element?.focus();
    }, []);

    const getPhaseElement = useCallback((phaseId: string) => {
      return phaseRefs.current.get(phaseId) || null;
    }, []);

    const scrollToPhase = useCallback((phaseId: string) => {
      const element = phaseRefs.current.get(phaseId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    useImperativeHandle(ref, () => ({
      getElement: () => timelineRef.current,
      focusPhase,
      getPhaseElement,
      scrollToPhase,
    }));

    // Phase status icons
    const getPhaseIcon = useCallback(
      (phase: ProcessTimelinePhase) => {
        const iconSize =
          size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

        if (phase.icon) {
          return React.cloneElement(phase.icon as React.ReactElement, {
            className: iconSize,
          });
        }

        switch (phase.status) {
          case 'completed':
            return <CheckCircle className={iconSize} />;
          case 'failed':
            return <XCircle className={iconSize} />;
          case 'active':
            return <Play className={iconSize} />;
          case 'pending':
            return <Clock className={iconSize} />;
          case 'skipped':
            return <AlertTriangle className={iconSize} />;
          default:
            return <Clock className={iconSize} />;
        }
      },
      [size],
    );

    // Calculate overall progress
    const overallProgress = useMemo(() => {
      if (!phases.length) return 0;

      const totalWeight = phases.reduce((acc, phase) => {
        return acc + (phase.metadata?.weight || 1);
      }, 0);

      const completedWeight = phases.reduce((acc, phase) => {
        const weight = phase.metadata?.weight || 1;
        if (phase.status === 'completed') return acc + weight;
        if (phase.status === 'active' && phase.progress) {
          return acc + (weight * phase.progress) / 100;
        }
        return acc;
      }, 0);

      return Math.round((completedWeight / totalWeight) * 100);
    }, [phases]);

    // Size classes
    const sizeClasses = {
      sm: {
        spacing: orientation === 'horizontal' ? 'gap-3' : 'gap-4',
        iconSize: 'w-6 h-6',
        fontSize: 'text-sm',
        connectorWidth: orientation === 'horizontal' ? 'w-8' : 'h-6',
      },
      md: {
        spacing: orientation === 'horizontal' ? 'gap-4' : 'gap-5',
        iconSize: 'w-8 h-8',
        fontSize: 'text-base',
        connectorWidth: orientation === 'horizontal' ? 'w-12' : 'h-8',
      },
      lg: {
        spacing: orientation === 'horizontal' ? 'gap-6' : 'gap-6',
        iconSize: 'w-10 h-10',
        fontSize: 'text-lg',
        connectorWidth: orientation === 'horizontal' ? 'w-16' : 'h-10',
      },
    };

    const currentSize = sizeClasses[size];

    // Container classes
    const containerClasses = clsx(
      'process-timeline',
      {
        // Orientation
        'flex items-center': orientation === 'horizontal',
        'flex flex-col': orientation === 'vertical',
      },
      currentSize.spacing,
      className,
    );

    // Phase connector component
    const PhaseConnector = ({
      isLast,
      phase,
    }: {
      isLast: boolean;
      phase: ProcessTimelinePhase;
    }) => {
      if (isLast) return null;

      const connectorClasses = clsx(
        'process-timeline-connector flex-shrink-0',
        {
          'h-0.5': orientation === 'horizontal',
          'w-0.5': orientation === 'vertical',
        },
        currentSize.connectorWidth,
        // Color based on phase status
        {
          'bg-green-300 dark:bg-green-600': phase.status === 'completed',
          'bg-blue-300 dark:bg-blue-600': phase.status === 'active',
          'bg-gray-300 dark:bg-gray-600': ['pending', 'skipped'].includes(
            phase.status,
          ),
          'bg-red-300 dark:bg-red-600': phase.status === 'failed',
        },
      );

      return <div className={connectorClasses} />;
    };

    // Individual phase component
    const PhaseItem = ({
      phase,
      index,
    }: {
      phase: ProcessTimelinePhase;
      index: number;
    }) => {
      const isActive = currentPhase === phase.id;
      const isClickable = !!(
        onPhaseClick ||
        (phase.status === 'failed' && onRetryPhase)
      );

      const phaseClasses = clsx('process-timeline-phase', {
        'flex-shrink-0': orientation === 'horizontal',
        'w-full': orientation === 'vertical',
      });

      const contentClasses = clsx('process-timeline-phase-content', {
        'text-center': orientation === 'horizontal',
        'flex items-start gap-4': orientation === 'vertical', // Increased gap from 3 to 4
      });

      const handlePhaseClick = useCallback(() => {
        if (onPhaseClick) {
          onPhaseClick(phase);
        } else if (phase.status === 'failed' && onRetryPhase) {
          onRetryPhase(phase);
        }
      }, [phase]);

      const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0
          ? `${minutes}m ${remainingSeconds}s`
          : `${minutes}m`;
      };

      const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      return (
        <div
          key={phase.id}
          className={phaseClasses}
          ref={(el) => {
            if (el) phaseRefs.current.set(phase.id, el);
          }}
          data-testid={`${testId}-phase-${phase.id}`}
          data-phase-status={phase.status}
          data-phase-active={isActive}
        >
          <div className={contentClasses}>
            {/* Phase Icon/Badge */}
            <div className="flex-shrink-0">
              <div
                className={clsx(
                  'rounded-full flex items-center justify-center',
                  currentSize.iconSize,
                  {
                    'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400':
                      phase.status === 'completed',
                    'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400':
                      phase.status === 'failed',
                    'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400':
                      phase.status === 'active',
                    'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400':
                      phase.status === 'skipped',
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400':
                      phase.status === 'pending',
                    'cursor-pointer hover:scale-105 transition-transform':
                      isClickable,
                  },
                )}
                onClick={isClickable ? handlePhaseClick : undefined}
              >
                {getPhaseIcon(phase)}
              </div>
            </div>

            {/* Phase Details */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Phase Label */}
              <div
                className={clsx(
                  'font-medium text-gray-900 dark:text-white leading-tight',
                  currentSize.fontSize,
                  {
                    'text-center': orientation === 'horizontal',
                  },
                )}
              >
                {phase.label}
              </div>

              {/* Description */}
              {showDescriptions && phase.description && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {phase.description}
                </div>
              )}

              {/* Progress Bar for Active Phases */}
              {showProgress &&
                phase.status === 'active' &&
                typeof phase.progress === 'number' && (
                  <div className="mt-2">
                    <ProgressBar
                      value={phase.progress}
                      variant="info"
                      size={size === 'lg' ? 'md' : 'sm'}
                      showLabel
                      animated={animated}
                      striped
                    />
                  </div>
                )}

              {/* Error Information */}
              {phase.status === 'failed' && phase.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md space-y-2">
                  <div className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                    {phase.error.message}
                  </div>
                  {onRetryPhase && (
                    <button
                      onClick={() => onRetryPhase(phase)}
                      className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              )}

              {/* Timestamps and Duration */}
              {(showTimestamps || showDurations) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {showTimestamps && phase.timestamps?.startedAt && (
                    <span className="whitespace-nowrap">
                      Started: {formatTimestamp(phase.timestamps.startedAt)}
                    </span>
                  )}
                  {showTimestamps && phase.timestamps?.completedAt && (
                    <span className="whitespace-nowrap">
                      Completed: {formatTimestamp(phase.timestamps.completedAt)}
                    </span>
                  )}
                  {showDurations && phase.duration?.actual && (
                    <span className="whitespace-nowrap">
                      Duration: {formatDuration(phase.duration.actual)}
                    </span>
                  )}
                  {showDurations &&
                    phase.duration?.estimated &&
                    !phase.duration.actual && (
                      <span className="whitespace-nowrap">
                        Est: {formatDuration(phase.duration.estimated)}
                      </span>
                    )}
                </div>
              )}

              {/* Metadata Display */}
              {phase.metadata?.filesProcessed && (
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                  {phase.metadata.filesProcessed.toLocaleString()} files
                  processed
                  {phase.metadata.totalFiles && (
                    <> of {phase.metadata.totalFiles.toLocaleString()}</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div
        ref={timelineRef}
        className={containerClasses}
        data-testid={testId}
        data-orientation={orientation}
        data-size={size}
        data-status={status}
        data-overall-progress={overallProgress}
        {...containerProps}
        {...props}
      >
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className={clsx('flex', {
              'items-center': orientation === 'horizontal',
              'flex-col w-full': orientation === 'vertical',
            })}
          >
            <PhaseItem phase={phase} index={index} />
            <PhaseConnector
              isLast={index === phases.length - 1}
              phase={phase}
            />
          </div>
        ))}
      </div>
    );
  },
);

ProcessTimeline.displayName = 'ProcessTimeline';
