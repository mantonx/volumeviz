export interface ErrorStateProps {
  error: any;
  onRetry?: () => void;
  title?: string;
  description?: string;
  showRetryButton?: boolean;
  showErrorDetails?: boolean;
  className?: string;
}
