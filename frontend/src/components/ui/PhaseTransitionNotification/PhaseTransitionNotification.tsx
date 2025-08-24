import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  CheckCircle,
  ArrowRight,
  Clock,
  Activity,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  formatPhaseTransition,
  type PhaseTransition,
} from '../../../utils/phaseTransitionNotifications';
import { formatDuration } from '../../../utils/format';

export interface PhaseTransitionNotificationProps {
  /** The phase transition to display */
  transition: PhaseTransition;
  /** Whether to show detailed stats */
  showDetails?: boolean;
  /** Whether to auto-dismiss after a timeout */
  autoDismiss?: boolean;
  /** Auto-dismiss timeout in ms */
  dismissTimeout?: number;
  /** Variant for styling */
  variant?: 'toast' | 'inline' | 'modal';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether notification can be dismissed */
  dismissible?: boolean;
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Callback when notification is clicked */
  onClick?: (transition: PhaseTransition) => void;
  /** Custom className */
  className?: string;
}

/**
 * PhaseTransitionNotification displays beautiful, informative notifications
 * when scan phases transition, providing context and progress information.
 */
export const PhaseTransitionNotification: React.FC<
  PhaseTransitionNotificationProps
> = ({
  transition,
  showDetails = false,
  autoDismiss = false,
  dismissTimeout = 5000,
  variant = 'toast',
  size = 'md',
  dismissible = true,
  onDismiss,
  onClick,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [isVisible, setIsVisible] = useState(true);
  const [timeAgo, setTimeAgo] = useState('');

  const display = formatPhaseTransition(transition);

  // Update time ago periodically
  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const diff = now.getTime() - transition.transitionTime.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        setTimeAgo(`${hours}h ago`);
      } else if (minutes > 0) {
        setTimeAgo(`${minutes}m ago`);
      } else {
        setTimeAgo(`${seconds}s ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [transition.transitionTime]);

  // Auto-dismiss functionality
  useEffect(() => {
    if (autoDismiss && dismissible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 300); // Allow fade out animation
      }, dismissTimeout);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, dismissTimeout, dismissible, onDismiss]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  const handleClick = () => {
    onClick?.(transition);
  };

  const handleToggleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Color schemes based on phase
  const getColorScheme = () => {
    switch (display.color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          title: 'text-blue-900 dark:text-blue-100',
          text: 'text-blue-700 dark:text-blue-200',
          accent: 'bg-blue-500',
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          icon: 'text-purple-600 dark:text-purple-400',
          title: 'text-purple-900 dark:text-purple-100',
          text: 'text-purple-700 dark:text-purple-200',
          accent: 'bg-purple-500',
        };
      case 'green':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: 'text-green-600 dark:text-green-400',
          title: 'text-green-900 dark:text-green-100',
          text: 'text-green-700 dark:text-green-200',
          accent: 'bg-green-500',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          icon: 'text-gray-600 dark:text-gray-400',
          title: 'text-gray-900 dark:text-white',
          text: 'text-gray-700 dark:text-gray-300',
          accent: 'bg-gray-500',
        };
    }
  };

  // Size classes
  const sizeClasses = {
    sm: {
      padding: 'p-3',
      iconSize: 'w-5 h-5',
      titleSize: 'text-sm',
      textSize: 'text-xs',
      maxWidth: 'max-w-sm',
    },
    md: {
      padding: 'p-4',
      iconSize: 'w-6 h-6',
      titleSize: 'text-base',
      textSize: 'text-sm',
      maxWidth: 'max-w-md',
    },
    lg: {
      padding: 'p-6',
      iconSize: 'w-8 h-8',
      titleSize: 'text-lg',
      textSize: 'text-base',
      maxWidth: 'max-w-lg',
    },
  };

  // Variant-specific styles
  const variantClasses = {
    toast: 'shadow-lg rounded-lg border',
    inline: 'rounded-md border',
    modal: 'rounded-xl border-2 shadow-xl',
  };

  const colors = getColorScheme();
  const sizes = sizeClasses[size];

  if (!isVisible) return null;

  return (
    <div
      className={clsx(
        colors.bg,
        colors.border,
        variantClasses[variant],
        sizes.padding,
        sizes.maxWidth,
        'transition-all duration-300 ease-in-out',
        {
          'opacity-100 scale-100': isVisible,
          'opacity-0 scale-95': !isVisible,
          'cursor-pointer hover:shadow-md': !!onClick,
        },
        className,
      )}
      onClick={onClick ? handleClick : undefined}
    >
      {/* Accent bar */}
      <div
        className={clsx(
          colors.accent,
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
        )}
      />

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={clsx(colors.icon, sizes.iconSize, 'flex-shrink-0 mt-0.5')}
        >
          {transition.fromPhase ? (
            <ArrowRight className="w-full h-full" />
          ) : (
            <Activity className="w-full h-full" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-lg">{display.icon}</div>
                <h4
                  className={clsx(
                    colors.title,
                    sizes.titleSize,
                    'font-semibold truncate',
                  )}
                >
                  {display.title}
                </h4>
              </div>

              {transition.volumeName && (
                <div className={clsx(colors.text, 'text-xs mt-0.5 truncate')}>
                  Volume: {transition.volumeName}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={clsx(colors.text, 'text-xs')}>{timeAgo}</div>

              {(display.stats || display.duration) && (
                <button
                  onClick={handleToggleDetails}
                  className={clsx(
                    colors.icon,
                    'hover:bg-white/20 dark:hover:bg-gray-800/20 p-1 rounded',
                  )}
                  title={isExpanded ? 'Hide details' : 'Show details'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className={clsx(
                    colors.icon,
                    'hover:bg-white/20 dark:hover:bg-gray-800/20 p-1 rounded',
                  )}
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Message */}
          <p className={clsx(colors.text, sizes.textSize, 'mt-1')}>
            {display.message}
          </p>

          {/* Description */}
          {display.description && (
            <p className={clsx(colors.text, 'text-xs mt-1 opacity-75')}>
              {display.description}
            </p>
          )}

          {/* Progress indication */}
          {transition.progress && (
            <div className="mt-2 text-xs">
              <div className={clsx(colors.text, 'flex items-center gap-2')}>
                <span>{transition.progress.fromProgress}%</span>
                <ArrowRight className="w-3 h-3" />
                <span>{transition.progress.toProgress}%</span>
              </div>
            </div>
          )}

          {/* Expandable details */}
          {isExpanded && (display.stats || display.duration) && (
            <div className="mt-3 space-y-2">
              {display.duration && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className={clsx(colors.icon, 'w-3 h-3')} />
                  <span className={colors.text}>
                    Expected duration: {display.duration}
                  </span>
                </div>
              )}

              {display.stats && display.stats.length > 0 && (
                <div className="space-y-1">
                  <div className={clsx(colors.text, 'text-xs font-medium')}>
                    Previous phase summary:
                  </div>
                  {display.stats.map((stat, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs"
                    >
                      <CheckCircle className={clsx(colors.icon, 'w-3 h-3')} />
                      <span className={colors.text}>{stat}</span>
                    </div>
                  ))}
                </div>
              )}

              {transition.duration && (
                <div className="text-xs">
                  <span className={colors.text}>
                    Previous phase completed in{' '}
                    {formatDuration(transition.duration)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhaseTransitionNotification;
