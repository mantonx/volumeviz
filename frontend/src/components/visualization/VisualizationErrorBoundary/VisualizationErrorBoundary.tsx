import React from 'react';
import { BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ErrorFallbackProps } from '@/components/ui/ErrorBoundary';

interface VisualizationErrorFallbackProps extends ErrorFallbackProps {
  title?: string;
  description?: string;
  showChart?: boolean;
}

const VisualizationErrorFallback: React.FC<VisualizationErrorFallbackProps> = ({
  error,
  resetError,
  eventId,
  title = 'Visualization Error',
  description = 'Unable to render chart data',
  showChart = true,
}) => {
  return (
    <Card className="w-full h-64 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 border-dashed">
      <div className="text-center">
        {showChart ? (
          <div className="relative mb-4">
            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
            <AlertTriangle className="w-6 h-6 text-red-500 absolute -top-1 -right-1" />
          </div>
        ) : (
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        )}

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
          {description}
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={resetError}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="text-xs cursor-pointer text-gray-500 hover:text-gray-700">
              Debug Info ({eventId?.slice(-8)})
            </summary>
            <pre className="mt-2 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-700 dark:text-red-300 overflow-x-auto max-w-md">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </Card>
  );
};

interface VisualizationErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showChart?: boolean;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

export const VisualizationErrorBoundary: React.FC<
  VisualizationErrorBoundaryProps
> = ({ children, title, description, showChart, onError, resetKeys }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log visualization-specific error details
    console.error('Visualization Error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Call custom error handler if provided
    onError?.(error, errorInfo);
  };

  return (
    <ErrorBoundary
      onError={handleError}
      resetOnPropsChange={true}
      resetKeys={resetKeys}
      fallback={
        <VisualizationErrorFallback
          error={new Error('Visualization rendering failed')}
          resetError={() => window.location.reload()}
          eventId={null}
          title={title}
          description={description}
          showChart={showChart}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
};

// HOC for wrapping visualization components
export function withVisualizationErrorBoundary<T extends {}>(
  Component: React.ComponentType<T>,
  options?: {
    title?: string;
    description?: string;
    showChart?: boolean;
  },
) {
  const WrappedComponent = (props: T) => (
    <VisualizationErrorBoundary {...options}>
      <Component {...props} />
    </VisualizationErrorBoundary>
  );

  WrappedComponent.displayName = `withVisualizationErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
