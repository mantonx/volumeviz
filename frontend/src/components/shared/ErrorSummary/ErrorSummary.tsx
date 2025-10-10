import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  XCircle,
  Shield,
  Wifi,
  FolderX,
  Clock,
  HardDrive,
  FileQuestion,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
  Lightbulb,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import {
  formatScanErrorForDisplay,
  type ScanError,
} from '../../../utils/scanErrorHandling';
import type {
  ErrorSummaryProps,
  ErrorSummaryRef,
  ErrorSummaryItem,
  ErrorGroup,
} from './ErrorSummary.types';
import { groupErrorsByCategory } from './ErrorSummary.types';

/**
 * ErrorSummary Component
 *
 * A comprehensive error management component for displaying, categorizing, and
 * managing errors from scan operations. Provides grouping, filtering, retry
 * mechanisms, and acknowledgment workflows for effective error handling.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ErrorSummary
 *   errors={scanErrors}
 *   showRetryActions
 *   onRetry={handleRetry}
 * />
 * ```
 *
 * @example
 * Grouped with actions:
 * ```tsx
 * <ErrorSummary
 *   errors={errors}
 *   layout="grouped"
 *   groupByCategory
 *   showRetryActions
 *   showAcknowledgeActions
 *   onRetry={handleRetry}
 *   onAcknowledge={handleAcknowledge}
 * />
 * ```
 *
 * @example
 * Compact display:
 * ```tsx
 * <ErrorSummary
 *   errors={errors}
 *   layout="compact"
 *   maxItems={5}
 *   showCounts
 * />
 * ```
 */
export const ErrorSummary = forwardRef<ErrorSummaryRef, ErrorSummaryProps>(
  (
    {
      errors,
      maxItems,
      layout = 'list',
      size = 'md',
      showDetails = true,
      showTimestamps = true,
      showCounts = false,
      showRetryActions = false,
      showAcknowledgeActions = false,
      groupByCategory = false,
      collapseResolved = true,
      onErrorClick,
      onRetry,
      onAcknowledge,
      onDismiss,
      onClearAll,
      filter,
      sortBy,
      emptyMessage = 'No errors to display',
      isLoading = false,
      className,
      containerProps,
      testId = 'error-summary',
      ...props
    },
    ref,
  ) => {
    const summaryRef = useRef<HTMLDivElement>(null);
    const errorRefs = useRef<Map<string, HTMLElement>>(new Map());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
      new Set(),
    );
    const [collapsedErrors, setCollapsedErrors] = useState<Set<string>>(
      new Set(),
    );

    const focusError = useCallback((errorId: string) => {
      const element = errorRefs.current.get(errorId);
      element?.focus();
    }, []);

    const getErrorElement = useCallback((errorId: string) => {
      return errorRefs.current.get(errorId) || null;
    }, []);

    const getErrors = useCallback(() => {
      return errors;
    }, [errors]);

    const clearAll = useCallback(() => {
      onClearAll?.();
    }, [onClearAll]);

    useImperativeHandle(ref, () => ({
      getElement: () => summaryRef.current,
      focusError,
      getErrorElement,
      getErrors,
      getFilteredErrors: () => processedErrors,
      clearAll,
    }));

    // Process errors with filtering and sorting
    const processedErrors = useMemo(() => {
      let processed = [...errors];

      // Apply filter
      if (filter) {
        processed = processed.filter(filter);
      }

      // Filter out resolved errors if collapseResolved is enabled
      if (collapseResolved) {
        processed = processed.filter((error) => !error.resolved);
      }

      // Apply sorting
      if (sortBy) {
        processed.sort(sortBy);
      } else {
        // Default sorting: severity (critical first), then timestamp (newest first)
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        processed.sort((a, b) => {
          const severityDiff =
            severityOrder[b.severity] - severityOrder[a.severity];
          if (severityDiff !== 0) return severityDiff;
          return b.timestamp.getTime() - a.timestamp.getTime();
        });
      }

      // Apply maxItems limit
      if (maxItems && processed.length > maxItems) {
        processed = processed.slice(0, maxItems);
      }

      return processed;
    }, [errors, filter, sortBy, maxItems, collapseResolved]);

    // Group errors if needed
    const errorGroups = useMemo(() => {
      if (!groupByCategory) return null;
      return groupErrorsByCategory(processedErrors);
    }, [processedErrors, groupByCategory]);

    // Get icon for error category
    const getCategoryIcon = useCallback(
      (category: ErrorSummaryItem['category']) => {
        switch (category) {
          case 'permission':
            return <Shield className="w-full h-full" />;
          case 'network':
            return <Wifi className="w-full h-full" />;
          case 'filesystem':
            return <FolderX className="w-full h-full" />;
          case 'timeout':
            return <Clock className="w-full h-full" />;
          case 'resource':
            return <HardDrive className="w-full h-full" />;
          case 'validation':
            return <FileQuestion className="w-full h-full" />;
          default:
            return <AlertTriangle className="w-full h-full" />;
        }
      },
      [],
    );

    // Get status variant for severity
    const getSeverityVariant = useCallback(
      (severity: ErrorSummaryItem['severity']) => {
        switch (severity) {
          case 'critical':
            return 'error';
          case 'high':
            return 'error';
          case 'medium':
            return 'warning';
          case 'low':
            return 'info';
          default:
            return 'default';
        }
      },
      [],
    );

    // Format timestamp
    const formatTimestamp = useCallback((timestamp: Date) => {
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    }, []);

    // Size classes
    const sizeClasses = {
      sm: {
        padding: 'p-2',
        gap: 'gap-2',
        iconSize: 'w-4 h-4',
        fontSize: 'text-sm',
        buttonSize: 'px-2 py-1 text-xs',
      },
      md: {
        padding: 'p-3',
        gap: 'gap-3',
        iconSize: 'w-5 h-5',
        fontSize: 'text-base',
        buttonSize: 'px-3 py-1 text-sm',
      },
      lg: {
        padding: 'p-4',
        gap: 'gap-4',
        iconSize: 'w-6 h-6',
        fontSize: 'text-lg',
        buttonSize: 'px-4 py-2 text-base',
      },
    };

    const currentSize = sizeClasses[size];

    // Toggle group expansion
    const toggleGroup = useCallback((groupCategory: string) => {
      setExpandedGroups((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(groupCategory)) {
          newExpanded.delete(groupCategory);
        } else {
          newExpanded.add(groupCategory);
        }
        return newExpanded;
      });
    }, []);

    // Toggle error collapse
    const toggleErrorCollapse = useCallback((errorId: string) => {
      setCollapsedErrors((prev) => {
        const newCollapsed = new Set(prev);
        if (newCollapsed.has(errorId)) {
          newCollapsed.delete(errorId);
        } else {
          newCollapsed.add(errorId);
        }
        return newCollapsed;
      });
    }, []);

    // Error item component
    const ErrorItem = ({
      error,
      isGrouped = false,
    }: {
      error: ErrorSummaryItem;
      isGrouped?: boolean;
    }) => {
      const isCollapsed = collapsedErrors.has(error.id);
      const isClickable = !!onErrorClick;

      // Check if this is a scan error and format accordingly
      const isScanError =
        error.rawError &&
        typeof error.rawError === 'object' &&
        'error_type' in error.rawError;
      const scanErrorDisplay = isScanError
        ? formatScanErrorForDisplay(error.rawError as ScanError)
        : null;

      const itemClasses = clsx(
        'error-summary-item border rounded-lg transition-all duration-200',
        currentSize.padding,
        {
          'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10':
            error.severity === 'critical',
          'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/10':
            error.severity === 'high',
          'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/10':
            error.severity === 'medium',
          'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10':
            error.severity === 'low',
          'border-gray-200 bg-gray-50 border-line dark:bg-gray-800':
            error.resolved,
          'cursor-pointer hover:shadow-md': isClickable,
          'opacity-60': error.acknowledged || error.resolved,
          'ml-4': isGrouped,
        },
      );

      const handleClick = useCallback(() => {
        if (onErrorClick) {
          onErrorClick(error);
        }
      }, [error]);

      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
          if ((event.key === 'Enter' || event.key === ' ') && onErrorClick) {
            event.preventDefault();
            handleClick();
          }
        },
        [handleClick],
      );

      const handleRetry = useCallback(
        (event: React.MouseEvent) => {
          event.stopPropagation();
          onRetry?.(error);
        },
        [error],
      );

      const handleAcknowledge = useCallback(
        (event: React.MouseEvent) => {
          event.stopPropagation();
          onAcknowledge?.(error);
        },
        [error],
      );

      const handleDismiss = useCallback(
        (event: React.MouseEvent) => {
          event.stopPropagation();
          onDismiss?.(error);
        },
        [error],
      );

      return (
        <div
          className={itemClasses}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          data-testid={`${testId}-error-${error.id}`}
          data-severity={error.severity}
          data-category={error.category}
          data-resolved={error.resolved}
          ref={(el) => {
            if (el) errorRefs.current.set(error.id, el);
          }}
        >
          {/* Header */}
          <div
            className={clsx(
              'flex items-start justify-between',
              currentSize.gap,
            )}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {/* Status Badge */}
              <div className="flex-shrink-0">
                <StatusBadge
                  variant={getSeverityVariant(error.severity)}
                  size={size === 'lg' ? 'md' : 'sm'}
                  icon={error.icon || getCategoryIcon(error.category)}
                  showDot={!error.acknowledged && !error.resolved}
                  animated={
                    error.severity === 'critical' && !error.acknowledged
                  }
                >
                  {error.severity}
                </StatusBadge>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={clsx(
                      'font-medium text-primary truncate',
                      currentSize.fontSize,
                    )}
                  >
                    {scanErrorDisplay?.title || error.message}
                  </h4>
                  {error.code && (
                    <code className="text-xs bg-surface-secondary text-secondary px-1 py-0.5 rounded">
                      {error.code}
                    </code>
                  )}
                  {showCounts && error.count && error.count > 1 && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full">
                      {error.count}x
                    </span>
                  )}
                </div>

                {/* Enhanced error message for scan errors */}
                {scanErrorDisplay &&
                  scanErrorDisplay.message !== scanErrorDisplay.title && (
                    <div className="mt-1 text-sm text-secondary">
                      {scanErrorDisplay.message}
                    </div>
                  )}

                {/* Scan error suggestion */}
                {scanErrorDisplay?.suggestion && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <div className="flex items-start gap-1">
                      <Lightbulb className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-700 dark:text-blue-200">
                        {scanErrorDisplay.suggestion}
                      </div>
                    </div>
                  </div>
                )}

                {/* Context Information */}
                {(error.context || scanErrorDisplay?.context) && (
                  <div className="mt-1 text-sm text-secondary">
                    {scanErrorDisplay?.context && (
                      <div
                        className="truncate mb-1"
                        title={scanErrorDisplay.context}
                      >
                        {scanErrorDisplay.context}
                      </div>
                    )}
                    {error.context?.phase && (
                      <span>Phase: {error.context.phase}</span>
                    )}
                    {error.context?.volume && (
                      <span>
                        {error.context.phase ? ' • ' : ''}Volume:{' '}
                        {error.context.volume}
                      </span>
                    )}
                    {error.context?.path && (
                      <div className="truncate mt-1" title={error.context.path}>
                        Path: {error.context.path}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                {showTimestamps && (
                  <div className="mt-1 text-xs text-gray-500 text-tertiary">
                    {formatTimestamp(error.timestamp)}
                  </div>
                )}

                {/* Details (expandable) */}
                {showDetails && (error.details || error.suggestion) && (
                  <div className="mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleErrorCollapse(error.id);
                      }}
                      className="flex items-center gap-1 text-xs text-secondary hover:text-gray-800 hover:text-primary"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {isCollapsed ? 'Show details' : 'Hide details'}
                    </button>

                    {!isCollapsed && (
                      <div className="mt-2 space-y-2">
                        {error.suggestion && (
                          <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            💡 {error.suggestion}
                          </div>
                        )}
                        {error.details && (
                          <div className="text-xs text-secondary bg-surface-secondary p-2 rounded font-mono whitespace-pre-wrap">
                            {error.details}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {showRetryActions && error.retryable && !error.resolved && (
                <button
                  onClick={handleRetry}
                  className={clsx(
                    'flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors',
                    currentSize.buttonSize,
                  )}
                  title="Retry operation"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              )}

              {showAcknowledgeActions &&
                !error.acknowledged &&
                !error.resolved && (
                  <button
                    onClick={handleAcknowledge}
                    className={clsx(
                      'flex items-center gap-1 bg-gray-600 text-white hover:bg-gray-700 rounded transition-colors',
                      currentSize.buttonSize,
                    )}
                    title="Acknowledge error"
                  >
                    <Check className="w-3 h-3" />
                    Ack
                  </button>
                )}

              {onDismiss && (
                <button
                  onClick={handleDismiss}
                  className={clsx(
                    'flex items-center gap-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors',
                    currentSize.buttonSize,
                  )}
                  title="Dismiss error"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    // Group header component
    const GroupHeader = ({ group }: { group: ErrorGroup }) => {
      const isExpanded = expandedGroups.has(group.category);

      return (
        <button
          onClick={() => toggleGroup(group.category)}
          className={clsx(
            'w-full flex items-center justify-between p-3 bg-surface-secondary border border-line rounded-lg hover:bg-surface-hover transition-colors',
            currentSize.fontSize,
          )}
          data-testid={`${testId}-group-${group.category}`}
        >
          <div className="flex items-center gap-3">
            <div className={currentSize.iconSize}>
              {getCategoryIcon(group.category)}
            </div>
            <div className="text-left">
              <div className="font-medium text-primary">
                {group.label}
              </div>
              <div className="text-sm text-secondary">
                {group.count} error{group.count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge
              variant={getSeverityVariant(group.highestSeverity)}
              size="sm"
            >
              {group.highestSeverity}
            </StatusBadge>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </button>
      );
    };

    // Layout classes
    const getLayoutClasses = () => {
      switch (layout) {
        case 'compact':
          return 'space-y-2';
        case 'grouped':
          return 'space-y-3';
        default:
          return 'space-y-3';
      }
    };

    // Loading state
    if (isLoading) {
      return (
        <div
          className="flex items-center justify-center h-32 bg-surface-secondary rounded-lg"
          data-testid={testId}
        >
          <div className="flex items-center gap-3 text-secondary">
            <XCircle className="w-5 h-5 animate-pulse" />
            Loading errors...
          </div>
        </div>
      );
    }

    // Empty state
    if (processedErrors.length === 0) {
      return (
        <div
          className="flex items-center justify-center h-32 bg-surface-secondary rounded-lg border border-line"
          data-testid={testId}
        >
          <div className="text-center text-secondary">
            <Check className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <div>{emptyMessage}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={summaryRef}
        className="error-summary-container"
        data-testid={testId}
        data-layout={layout}
        data-size={size}
        data-error-count={processedErrors.length}
        {...containerProps}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={clsx(
              'font-medium text-primary',
              currentSize.fontSize,
            )}
          >
            {processedErrors.length} error
            {processedErrors.length !== 1 ? 's' : ''}
            {maxItems &&
              errors.length > maxItems &&
              ` (showing ${maxItems} of ${errors.length})`}
          </div>

          {onClearAll && processedErrors.length > 0 && (
            <button
              onClick={clearAll}
              className={clsx(
                'flex items-center gap-1 text-secondary hover:text-red-600 dark:hover:text-red-400 transition-colors',
                currentSize.buttonSize,
              )}
              data-testid={`${testId}-clear-all`}
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {/* Errors */}
        <div
          className={clsx(
            'error-summary-content',
            getLayoutClasses(),
            className,
          )}
        >
          {groupByCategory && errorGroups
            ? // Grouped layout
              errorGroups.map((group) => (
                <div key={group.category} className="error-group">
                  <GroupHeader group={group} />
                  {expandedGroups.has(group.category) && (
                    <div className="mt-2 space-y-2">
                      {group.errors.map((error) => (
                        <ErrorItem key={error.id} error={error} isGrouped />
                      ))}
                    </div>
                  )}
                </div>
              ))
            : // List layout
              processedErrors.map((error) => (
                <ErrorItem key={error.id} error={error} />
              ))}
        </div>
      </div>
    );
  },
);

ErrorSummary.displayName = 'ErrorSummary';
