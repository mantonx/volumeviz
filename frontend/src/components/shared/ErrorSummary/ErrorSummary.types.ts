import type { HTMLAttributes, ReactNode } from 'react';
import type { StatusBadgeProps } from '../../ui/StatusBadge';

export interface ErrorSummaryItem {
  /** Unique identifier for the error */
  id: string;
  /** Error message */
  message: string;
  /** Error code or type */
  code?: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Error category for grouping */
  category:
    | 'permission'
    | 'network'
    | 'filesystem'
    | 'validation'
    | 'timeout'
    | 'resource'
    | 'unknown';
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Context where error occurred */
  context?: {
    /** Phase or operation when error occurred */
    phase?: string;
    /** File path or resource involved */
    path?: string;
    /** Volume or container name */
    volume?: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
  };
  /** Error details or stack trace */
  details?: string;
  /** Number of times this error occurred */
  count?: number;
  /** Whether error can be retried */
  retryable?: boolean;
  /** Suggested action or fix */
  suggestion?: string;
  /** Custom icon for the error */
  icon?: ReactNode;
  /** Whether error has been acknowledged */
  acknowledged?: boolean;
  /** Resolution status */
  resolved?: boolean;
  /** Raw error object for enhanced formatting (scan errors) */
  rawError?: any;
}

export interface ErrorSummaryProps {
  /** Array of errors to display */
  errors: ErrorSummaryItem[];
  /** Maximum number of errors to show */
  maxItems?: number;
  /** Layout style */
  layout?: 'list' | 'compact' | 'grouped';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show error details */
  showDetails?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show error counts */
  showCounts?: boolean;
  /** Whether to show retry buttons */
  showRetryActions?: boolean;
  /** Whether to show acknowledgment actions */
  showAcknowledgeActions?: boolean;
  /** Whether to group errors by category */
  groupByCategory?: boolean;
  /** Whether to auto-collapse resolved errors */
  collapseResolved?: boolean;
  /** Custom error click handler */
  onErrorClick?: (error: ErrorSummaryItem) => void;
  /** Custom retry handler */
  onRetry?: (error: ErrorSummaryItem) => void;
  /** Custom acknowledge handler */
  onAcknowledge?: (error: ErrorSummaryItem) => void;
  /** Custom dismiss handler */
  onDismiss?: (error: ErrorSummaryItem) => void;
  /** Custom clear all handler */
  onClearAll?: () => void;
  /** Custom filter function */
  filter?: (error: ErrorSummaryItem) => boolean;
  /** Custom sort function */
  sortBy?: (a: ErrorSummaryItem, b: ErrorSummaryItem) => number;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Additional props passed to the container */
  containerProps?: HTMLAttributes<HTMLDivElement>;
  /** Test ID for testing */
  testId?: string;
}

export interface ErrorSummaryRef {
  /** Get the container element */
  getElement: () => HTMLDivElement | null;
  /** Focus a specific error */
  focusError: (errorId: string) => void;
  /** Get error element by ID */
  getErrorElement: (errorId: string) => HTMLElement | null;
  /** Get current errors data */
  getErrors: () => ErrorSummaryItem[];
  /** Get filtered errors */
  getFilteredErrors: () => ErrorSummaryItem[];
  /** Clear all errors */
  clearAll: () => void;
}

export type ErrorSummaryLayout = ErrorSummaryProps['layout'];
export type ErrorSummarySize = ErrorSummaryProps['size'];
export type ErrorSeverity = ErrorSummaryItem['severity'];
export type ErrorCategory = ErrorSummaryItem['category'];

// Theme configuration
export interface ErrorSummaryTheme {
  layouts: Record<
    NonNullable<ErrorSummaryLayout>,
    {
      container: string;
      item: string;
      spacing: string;
    }
  >;
  sizes: Record<
    NonNullable<ErrorSummarySize>,
    {
      padding: string;
      fontSize: string;
      iconSize: string;
      spacing: string;
    }
  >;
  severities: Record<
    ErrorSeverity,
    {
      badge: StatusBadgeProps['variant'];
      background: string;
      border: string;
      text: string;
    }
  >;
  categories: Record<
    ErrorCategory,
    {
      label: string;
      icon: ReactNode;
      color: string;
    }
  >;
}

// Error grouping utilities
export interface ErrorGroup {
  category: ErrorCategory;
  errors: ErrorSummaryItem[];
  count: number;
  highestSeverity: ErrorSeverity;
  label: string;
  icon?: ReactNode;
}

export const groupErrorsByCategory = (
  errors: ErrorSummaryItem[],
): ErrorGroup[] => {
  const groups = new Map<ErrorCategory, ErrorSummaryItem[]>();

  errors.forEach((error) => {
    const existing = groups.get(error.category) || [];
    groups.set(error.category, [...existing, error]);
  });

  const severityOrder: Record<ErrorSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const categoryLabels: Record<ErrorCategory, string> = {
    permission: 'Permission Errors',
    network: 'Network Errors',
    filesystem: 'Filesystem Errors',
    validation: 'Validation Errors',
    timeout: 'Timeout Errors',
    resource: 'Resource Errors',
    unknown: 'Other Errors',
  };

  return Array.from(groups.entries())
    .map(([category, categoryErrors]) => {
      const highestSeverity = categoryErrors.reduce((highest, error) => {
        return severityOrder[error.severity] > severityOrder[highest]
          ? error.severity
          : highest;
      }, 'low' as ErrorSeverity);

      return {
        category,
        errors: categoryErrors,
        count: categoryErrors.length,
        highestSeverity,
        label: categoryLabels[category],
      };
    })
    .sort(
      (a, b) =>
        severityOrder[b.highestSeverity] - severityOrder[a.highestSeverity],
    );
};

// Scan-specific error handling
export interface ScanErrorData {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** File path where error occurred */
  path?: string;
  /** Volume name */
  volume?: string;
  /** Scan phase */
  phase?: string;
  /** Error timestamp */
  timestamp?: Date;
  /** Stack trace or details */
  details?: string;
  /** Whether operation can be retried */
  retryable?: boolean;
}

export const createScanError = (
  errorData: ScanErrorData,
  index: number = 0,
): ErrorSummaryItem => {
  // Determine category based on error code or message
  const determineCategory = (
    code?: string,
    message?: string,
  ): ErrorCategory => {
    if (!code && !message) return 'unknown';

    const errorText = `${code || ''} ${message || ''}`.toLowerCase();

    if (
      errorText.includes('permission') ||
      errorText.includes('eacces') ||
      errorText.includes('eperm')
    ) {
      return 'permission';
    }
    if (errorText.includes('timeout') || errorText.includes('etimedout')) {
      return 'timeout';
    }
    if (
      errorText.includes('network') ||
      errorText.includes('connection') ||
      errorText.includes('econnrefused')
    ) {
      return 'network';
    }
    if (
      errorText.includes('file') ||
      errorText.includes('directory') ||
      errorText.includes('enoent') ||
      errorText.includes('enotdir')
    ) {
      return 'filesystem';
    }
    if (
      errorText.includes('memory') ||
      errorText.includes('space') ||
      errorText.includes('enospc')
    ) {
      return 'resource';
    }
    if (errorText.includes('invalid') || errorText.includes('validation')) {
      return 'validation';
    }

    return 'unknown';
  };

  // Determine severity based on category and context
  const determineSeverity = (
    category: ErrorCategory,
    code?: string,
  ): ErrorSeverity => {
    if (code === 'EACCES' || code === 'EPERM') return 'high';
    if (category === 'permission') return 'high';
    if (category === 'network') return 'medium';
    if (category === 'filesystem') return 'medium';
    if (category === 'timeout') return 'medium';
    if (category === 'resource') return 'critical';
    if (category === 'validation') return 'low';
    return 'medium';
  };

  const category = determineCategory(errorData.code, errorData.message);
  const severity = determineSeverity(category, errorData.code);

  // Generate suggestions based on error type
  const generateSuggestion = (category: ErrorCategory): string | undefined => {
    switch (category) {
      case 'permission':
        return 'Check file permissions or run with elevated privileges';
      case 'network':
        return 'Verify network connectivity and try again';
      case 'filesystem':
        return 'Ensure the file or directory exists and is accessible';
      case 'timeout':
        return 'Increase timeout settings or check system load';
      case 'resource':
        return 'Free up disk space or increase available memory';
      case 'validation':
        return 'Check input parameters and format';
      default:
        return undefined;
    }
  };

  return {
    id: `scan-error-${index}-${Date.now()}`,
    message: errorData.message,
    code: errorData.code,
    severity,
    category,
    timestamp: errorData.timestamp || new Date(),
    context: {
      phase: errorData.phase,
      path: errorData.path,
      volume: errorData.volume,
    },
    details: errorData.details,
    retryable:
      errorData.retryable ??
      ['permission', 'network', 'timeout'].includes(category),
    suggestion: generateSuggestion(category),
    count: 1,
    acknowledged: false,
    resolved: false,
  };
};

export const createScanErrors = (
  errorDataList: ScanErrorData[],
): ErrorSummaryItem[] => {
  return errorDataList.map((errorData, index) =>
    createScanError(errorData, index),
  );
};
