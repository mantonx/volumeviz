/**
 * API Error Boundary Component
 *
 * Error boundary for API errors that provides:
 * - Graceful error handling for API failures
 * - User-friendly error messages
 * - Retry functionality
 * - Automatic error reporting
 */

import { AlertCircle, RefreshCw } from 'lucide-react';
import React from 'react';

interface APIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface APIErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

export class APIErrorBoundary extends React.Component<
  APIErrorBoundaryProps,
  APIErrorBoundaryState
> {
  constructor(props: APIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): APIErrorBoundaryState {
    // Error boundary for API errors implementation
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // API error boundary logging
    console.error('API Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            API Error Boundary Activated
          </h2>
          <p className="text-red-600 text-center mb-4">
            {this.state.error?.message || 'An API error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <details className="mt-4 text-sm text-gray-600">
            <summary className="cursor-pointer">Error Details</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default APIErrorBoundary;
