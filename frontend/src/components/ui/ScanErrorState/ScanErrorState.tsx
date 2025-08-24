import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Play,
  Square,
  SkipForward,
  Lightbulb,
  Clock,
  HardDrive,
  Shield,
  Wifi,
  FolderX,
  FileQuestion,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../Button';
import { Card } from '../Card';
import { StatusBadge } from '../StatusBadge';
import {
  formatScanErrorForDisplay,
  formatApiErrorForScan,
  type ScanError,
} from '../../../utils/scanErrorHandling';

export interface ScanErrorStateProps {
  /** The scan error to display */
  error: ScanError | any;
  /** Scan context information */
  context?: {
    phase?: string;
    operation?: string;
    volumeName?: string;
    fileName?: string;
    batchInfo?: {
      currentBatch: number;
      totalBatches: number;
      filesInBatch: number;
      batchProgress: number;
    };
  };
  /** Available actions */
  actions?: {
    onRetry?: () => void;
    onSkip?: () => void;
    onPause?: () => void;
    onAbort?: () => void;
    onViewDetails?: () => void;
  };
  /** Whether to show technical details by default */
  showTechnicalDetails?: boolean;
  /** Whether to show suggested actions */
  showActions?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * Enhanced error display component specifically for scan operations
 * Provides contextual, user-friendly error messages with actionable guidance
 */
export const ScanErrorState: React.FC<ScanErrorStateProps> = ({
  error,
  context,
  actions,
  showTechnicalDetails = false,
  showActions = true,
  size = 'md',
  className,
}) => {
  const [showDetails, setShowDetails] = useState(showTechnicalDetails);
  const [copied, setCopied] = useState(false);

  // Format error based on type
  const isScanError =
    error && typeof error === 'object' && 'error_type' in error;
  const errorDisplay = isScanError
    ? formatScanErrorForDisplay(error as ScanError)
    : formatApiErrorForScan(error, context);

  // Get appropriate icon for error category
  const getErrorIcon = () => {
    if (isScanError) {
      const scanError = error as ScanError;
      switch (scanError.error_category) {
        case 'permissions':
          return Shield;
        case 'network':
          return Wifi;
        case 'file_system':
        case 'disk_io':
          return FolderX;
        case 'timeout':
          return Clock;
        case 'memory':
          return HardDrive;
        case 'validation':
          return FileQuestion;
        default:
          return AlertCircle;
      }
    }

    // Default based on severity/variant
    switch (errorDisplay.variant || errorDisplay.severity) {
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      case 'critical':
      case 'error':
      default:
        return XCircle;
    }
  };

  // Get color scheme based on severity
  const getColorScheme = () => {
    const severity = errorDisplay.severity || errorDisplay.variant;
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/10',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-500',
          title: 'text-red-900 dark:text-red-100',
          text: 'text-red-700 dark:text-red-200',
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/10',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-500',
          title: 'text-red-900 dark:text-red-100',
          text: 'text-red-700 dark:text-red-200',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/10',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-500',
          title: 'text-yellow-900 dark:text-yellow-100',
          text: 'text-yellow-700 dark:text-yellow-200',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/10',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-500',
          title: 'text-blue-900 dark:text-blue-100',
          text: 'text-blue-700 dark:text-blue-200',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          icon: 'text-gray-500',
          title: 'text-gray-900 dark:text-white',
          text: 'text-gray-700 dark:text-gray-300',
        };
    }
  };

  const colors = getColorScheme();
  const ErrorIcon = getErrorIcon();

  // Size classes
  const sizeClasses = {
    sm: {
      padding: 'p-4',
      iconSize: 'w-8 h-8',
      titleSize: 'text-base',
      textSize: 'text-sm',
      buttonSize: 'text-xs px-2 py-1',
    },
    md: {
      padding: 'p-6',
      iconSize: 'w-10 h-10',
      titleSize: 'text-lg',
      textSize: 'text-base',
      buttonSize: 'text-sm px-3 py-1.5',
    },
    lg: {
      padding: 'p-8',
      iconSize: 'w-12 h-12',
      titleSize: 'text-xl',
      textSize: 'text-lg',
      buttonSize: 'text-base px-4 py-2',
    },
  };

  const currentSize = sizeClasses[size];

  // Copy error details
  const handleCopyError = async () => {
    const errorInfo = isScanError
      ? {
          type: error.error_type,
          category: error.error_category,
          message: error.error_message,
          file: error.item_path,
          technical: error.technical_details,
          context: context,
          occurred: error.occurred_at,
          retries: error.retry_count,
        }
      : {
          message: errorDisplay.message,
          context: context,
          technical: error,
        };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  return (
    <Card
      className={clsx(
        colors.bg,
        colors.border,
        'border',
        currentSize.padding,
        className,
      )}
    >
      {/* Error Header */}
      <div className="flex items-start gap-4">
        <div
          className={clsx(colors.icon, currentSize.iconSize, 'flex-shrink-0')}
        >
          <ErrorIcon className="w-full h-full" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3
              className={clsx(
                colors.title,
                currentSize.titleSize,
                'font-semibold',
              )}
            >
              {errorDisplay.title}
            </h3>

            {isScanError && (
              <StatusBadge
                variant={
                  errorDisplay.severity === 'critical'
                    ? 'error'
                    : (errorDisplay.severity as any)
                }
                size={size === 'sm' ? 'sm' : 'md'}
              >
                {errorDisplay.severity}
              </StatusBadge>
            )}
          </div>

          <p className={clsx(colors.text, currentSize.textSize, 'mb-4')}>
            {errorDisplay.message}
          </p>

          {/* Context Information */}
          {errorDisplay.context && (
            <div
              className={clsx(
                colors.text,
                'text-sm mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg',
              )}
            >
              <span className="font-medium">Context:</span>{' '}
              {errorDisplay.context}
              {context?.batchInfo && (
                <div className="text-xs mt-1">
                  Batch {context.batchInfo.currentBatch} of{' '}
                  {context.batchInfo.totalBatches}(
                  {context.batchInfo.filesInBatch} files,{' '}
                  {context.batchInfo.batchProgress}% complete)
                </div>
              )}
            </div>
          )}

          {/* Suggestion */}
          {errorDisplay.suggestion && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Suggested Solution:
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-200">
                    {errorDisplay.suggestion}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions &&
            actions &&
            (errorDisplay.retryable || errorDisplay.actionable) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {actions.onRetry && errorDisplay.retryable && (
                  <Button
                    variant="default"
                    size={size}
                    onClick={actions.onRetry}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                )}

                {actions.onSkip && (
                  <Button
                    variant="outline"
                    size={size}
                    onClick={actions.onSkip}
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip File
                  </Button>
                )}

                {actions.onPause && (
                  <Button
                    variant="outline"
                    size={size}
                    onClick={actions.onPause}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Pause Scan
                  </Button>
                )}

                {actions.onAbort && (
                  <Button
                    variant="outline"
                    size={size}
                    onClick={actions.onAbort}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Scan
                  </Button>
                )}
              </div>
            )}

          {/* Technical Details Toggle */}
          {(errorDisplay.technical ||
            (isScanError && error.technical_details)) && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className={clsx(
                  colors.text,
                  'hover:bg-white/20 dark:hover:bg-gray-800/20',
                )}
              >
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 mr-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-2" />
                )}
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>

              {showDetails && (
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 text-white">
                  <div className="space-y-3">
                    {isScanError && (
                      <>
                        <div>
                          <span className="text-gray-400 text-xs">
                            Error Type:
                          </span>
                          <code className="ml-2 text-xs">
                            {error.error_type}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">
                            Category:
                          </span>
                          <code className="ml-2 text-xs">
                            {error.error_category}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">
                            Component:
                          </span>
                          <code className="ml-2 text-xs">
                            {error.component}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">
                            Operation:
                          </span>
                          <code className="ml-2 text-xs">
                            {error.operation}
                          </code>
                        </div>
                        {error.item_path && (
                          <div>
                            <span className="text-gray-400 text-xs">
                              File Path:
                            </span>
                            <code className="ml-2 text-xs break-all">
                              {error.item_path}
                            </code>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 text-xs">
                            Retry Count:
                          </span>
                          <code className="ml-2 text-xs">
                            {error.retry_count}
                          </code>
                        </div>
                      </>
                    )}

                    <div>
                      <span className="text-gray-400 text-xs">Raw Error:</span>
                      <pre className="mt-1 text-xs text-gray-300 bg-gray-800 p-2 rounded overflow-auto">
                        {isScanError && error.technical_details
                          ? error.technical_details
                          : JSON.stringify(error, null, 2)}
                      </pre>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyError}
                        className="w-full bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {copied ? 'Copied!' : 'Copy Error Info'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ScanErrorState;
