import { ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  eventId: string | null;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  eventId: string | null;
}
