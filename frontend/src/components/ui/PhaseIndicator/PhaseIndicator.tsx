import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import { Check, X, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

import { ProgressBar } from '../ProgressBar';

import type {
  PhaseIndicatorProps,
  PhaseIndicatorRef,
  Phase,
  PhaseStatus,
  PhaseSize,
  PhaseOrientation,
  PhaseDisplayConfig,
} from './PhaseIndicator.types';
import { defaultColorScheme } from './PhaseIndicator.types';

/**
 * Get status icon for a phase
 */
const getStatusIcon = (status: PhaseStatus, size: PhaseSize = 'md') => {
  const iconSize =
    size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';

  switch (status) {
    case 'completed':
      return <Check className={iconSize} />;
    case 'failed':
      return <X className={iconSize} />;
    case 'active':
      return <Clock className={`${iconSize} animate-pulse`} />;
    case 'skipped':
      return <ChevronRight className={iconSize} />;
    default:
      return null;
  }
};

/**
 * Get status colors for a phase
 */
const getStatusColors = (status: PhaseStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-gray-200 text-gray-600 border-gray-300';
    case 'active':
      return 'bg-blue-500 text-white border-blue-500';
    case 'completed':
      return 'bg-green-500 text-white border-green-500';
    case 'failed':
      return 'bg-red-500 text-white border-red-500';
    case 'skipped':
      return 'bg-yellow-500 text-white border-yellow-500';
    default:
      return 'bg-gray-200 text-gray-600 border-gray-300';
  }
};

/**
 * Get connector colors based on phase statuses
 */
const getConnectorColors = (
  fromStatus: PhaseStatus,
  toStatus: PhaseStatus,
): string => {
  if (fromStatus === 'completed') {
    return 'bg-green-500';
  }
  if (fromStatus === 'active' && toStatus === 'pending') {
    return 'bg-gradient-to-r from-blue-500 to-gray-300';
  }
  if (fromStatus === 'failed') {
    return 'bg-red-500';
  }
  return 'bg-gray-300';
};

/**
 * PhaseIndicator - Multi-step process visualization component
 *
 * A flexible component for displaying multi-phase processes with progress,
 * status indicators, and interactive capabilities. Perfect for scan monitoring.
 */
export const PhaseIndicator = forwardRef<
  PhaseIndicatorRef,
  PhaseIndicatorProps
>(
  (
    {
      phases,
      activePhase,
      orientation = 'horizontal',
      size = 'md',
      showDescriptions = true,
      showProgress = true,
      showConnectors = true,
      animated = true,
      clickable = false,
      colorScheme = defaultColorScheme,
      onPhaseClick,
      onPhaseHover,
      className,
      testId = 'phase-indicator',
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const phaseRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Configuration object
    const config: PhaseDisplayConfig = {
      size,
      orientation,
      showDescriptions,
      showProgress,
      showConnectors,
      animated,
    };

    // Find active phase
    const currentActivePhase = phases.find((phase) =>
      activePhase ? phase.id === activePhase : phase.status === 'active',
    );

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        focusPhase: (phaseId: string) => {
          const element = phaseRefs.current.get(phaseId);
          element?.focus();
        },
        getActivePhase: () => currentActivePhase || null,
        getPhase: (phaseId: string) =>
          phases.find((p) => p.id === phaseId) || null,
        scrollToPhase: (phaseId: string) => {
          const element = phaseRefs.current.get(phaseId);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      }),
      [phases, currentActivePhase],
    );

    // Event handlers
    const handlePhaseClick = useCallback(
      (phase: Phase) => {
        if (!clickable || phase.disabled || !phase.clickable) return;
        onPhaseClick?.(phase);
      },
      [clickable, onPhaseClick],
    );

    const handlePhaseHover = useCallback(
      (phase: Phase) => {
        if (phase.disabled) return;
        onPhaseHover?.(phase);
      },
      [onPhaseHover],
    );

    // Register phase ref
    const setPhaseRef = useCallback(
      (phaseId: string, element: HTMLDivElement | null) => {
        if (element) {
          phaseRefs.current.set(phaseId, element);
        } else {
          phaseRefs.current.delete(phaseId);
        }
      },
      [],
    );

    // Render individual phase
    const renderPhase = (phase: Phase, index: number) => {
      const isActive = phase.id === activePhase || phase.status === 'active';
      const isClickable =
        clickable && phase.clickable !== false && !phase.disabled;

      const phaseClasses = clsx(
        'relative flex items-center gap-2 transition-all duration-200',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        config.animated && 'transition-all duration-300',
        isClickable && 'cursor-pointer hover:scale-105',
        phase.disabled && 'opacity-50 cursor-not-allowed',
      );

      const indicatorClasses = clsx(
        'flex items-center justify-center rounded-full border-2 flex-shrink-0',
        getStatusColors(phase.status),
        size === 'sm' && 'w-6 h-6 text-xs',
        size === 'md' && 'w-8 h-8 text-sm',
        size === 'lg' && 'w-12 h-12 text-base',
        config.animated && phase.status === 'active' && 'animate-pulse',
      );

      const contentClasses = clsx(
        'flex flex-col',
        orientation === 'horizontal' ? 'text-left' : 'text-center',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-base',
      );

      return (
        <div
          key={phase.id}
          ref={(el) => setPhaseRef(phase.id, el)}
          className={phaseClasses}
          onClick={() => handlePhaseClick(phase)}
          onMouseEnter={() => handlePhaseHover(phase)}
          tabIndex={isClickable ? 0 : -1}
          role={isClickable ? 'button' : undefined}
          aria-label={`Phase: ${phase.label}${phase.description ? ` - ${phase.description}` : ''}`}
          aria-current={isActive ? 'step' : undefined}
          data-testid={`${testId}-phase-${phase.id}`}
        >
          {/* Phase indicator circle */}
          <div className={indicatorClasses}>
            {phase.icon || getStatusIcon(phase.status, size)}
          </div>

          {/* Phase content */}
          <div className={contentClasses}>
            <div
              className={clsx(
                'font-medium',
                isActive && 'text-blue-600',
                phase.status === 'completed' && 'text-green-600',
                phase.status === 'failed' && 'text-red-600',
              )}
            >
              {phase.label}
            </div>

            {showDescriptions && phase.description && (
              <div className="text-gray-500 mt-1">{phase.description}</div>
            )}

            {/* Progress bar for active phase */}
            {showProgress &&
              phase.status === 'active' &&
              typeof phase.progress === 'number' && (
                <div className="mt-2 w-full">
                  <ProgressBar
                    progress={phase.progress}
                    size={size === 'lg' ? 'md' : 'sm'}
                    showPercentage={size !== 'sm'}
                    animated={config.animated}
                  />
                </div>
              )}
          </div>
        </div>
      );
    };

    // Render connector between phases
    const renderConnector = (
      fromPhase: Phase,
      toPhase: Phase,
      index: number,
    ) => {
      if (!showConnectors) return null;

      const connectorClasses = clsx(
        'flex-shrink-0',
        orientation === 'horizontal'
          ? 'h-0.5 w-8 mx-2'
          : 'w-0.5 h-8 my-2 mx-auto',
        getConnectorColors(fromPhase.status, toPhase.status),
        config.animated && 'transition-all duration-300',
      );

      return (
        <div
          key={`connector-${index}`}
          className={connectorClasses}
          data-testid={`${testId}-connector-${index}`}
        />
      );
    };

    return (
      <div
        ref={containerRef}
        className={clsx(
          'flex items-center',
          orientation === 'horizontal' ? 'flex-row' : 'flex-col',
          className,
        )}
        data-testid={testId}
        role="progressbar"
        aria-label="Process phases"
        aria-valuenow={phases.findIndex((p) => p.status === 'active') + 1}
        aria-valuemin={1}
        aria-valuemax={phases.length}
      >
        {phases.map((phase, index) => (
          <React.Fragment key={phase.id}>
            {renderPhase(phase, index)}
            {index < phases.length - 1 &&
              renderConnector(phase, phases[index + 1], index)}
          </React.Fragment>
        ))}
      </div>
    );
  },
);

PhaseIndicator.displayName = 'PhaseIndicator';
