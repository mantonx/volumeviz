import React, { useState } from 'react';
import {
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { Button } from '../Button';
import { Card } from '../Card';
import { cn } from '@/utils';
import {
  getErrorDetails,
  getHttpStatusCode,
  formatErrorForDisplay,
} from '@/utils/errorHandling';
import type { ErrorStateProps } from './ErrorState.types';

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  title,
  description,
  showRetryButton = true,
  showErrorDetails = false,
  className,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorDisplay = formatErrorForDisplay(error);
  const errorDetails = getErrorDetails(error);
  const statusCode = getHttpStatusCode(error);

  const displayTitle = title || errorDisplay.title;
  const displayMessage = description || errorDisplay.message;
  const shouldShowRetry =
    showRetryButton && errorDisplay.showRetry !== false && onRetry;

  const handleCopyError = async () => {
    const errorInfo = {
      message: errorDetails.message,
      code: errorDetails.code,
      statusCode,
      requestId: errorDetails.requestId,
      details: errorDetails.details,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const getIconColor = () => {
    switch (errorDisplay.variant) {
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-red-500';
    }
  };

  return (
    <Card className={cn('p-8 text-center max-w-md mx-auto', className)}>
      <div className={cn('mb-4', getIconColor())}>
        <AlertCircle className="h-12 w-12 mx-auto" />
      </div>

      <h3 className="text-lg font-semibold text-primary mb-2">
        {displayTitle}
      </h3>

      <p className="text-secondary mb-6">{displayMessage}</p>

      {/* Status Code Badge */}
      {statusCode && (
        <div className="mb-4">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusCode >= 500
                ? 'bg-red-100 text-red-800'
                : statusCode >= 400
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-surface-secondary text-secondary',
            )}
          >
            HTTP {statusCode}
          </span>
        </div>
      )}

      {/* Request ID */}
      {errorDetails.requestId && (
        <div className="mb-4 text-xs text-tertiary">
          Request ID: <code>{errorDetails.requestId}</code>
        </div>
      )}

      <div className="flex flex-col space-y-3">
        {/* Retry Button */}
        {shouldShowRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {/* Error Details Toggle */}
        {(showErrorDetails || errorDetails.code || errorDetails.details) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4 mr-2" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-2" />
            )}
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        )}
      </div>

      {/* Expandable Error Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-line text-left">
          <div className="bg-surface-secondary rounded-lg p-4 space-y-2">
            {errorDetails.code && (
              <div>
                <span className="text-xs font-medium text-tertiary">
                  Code:
                </span>
                <code className="ml-2 text-xs text-primary">
                  {errorDetails.code}
                </code>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-tertiary">
                Message:
              </span>
              <code className="ml-2 text-xs text-primary break-all">
                {errorDetails.message}
              </code>
            </div>

            {errorDetails.requestId && (
              <div>
                <span className="text-xs font-medium text-tertiary">
                  Request ID:
                </span>
                <code className="ml-2 text-xs text-primary">
                  {errorDetails.requestId}
                </code>
              </div>
            )}

            {statusCode && (
              <div>
                <span className="text-xs font-medium text-tertiary">
                  Status Code:
                </span>
                <code className="ml-2 text-xs text-primary">
                  {statusCode}
                </code>
              </div>
            )}

            {errorDetails.details && (
              <div>
                <span className="text-xs font-medium text-tertiary">
                  Details:
                </span>
                <pre className="mt-1 text-xs text-primary bg-surface p-2 rounded overflow-auto">
                  {JSON.stringify(errorDetails.details, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyError}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Copy Error Info'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
