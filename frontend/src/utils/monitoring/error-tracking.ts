/**
 * Error tracking and monitoring utilities
 * Integrates with Sentry for production error tracking
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { config, isProduction, isDevelopment } from '@/config/environment';

/**
 * Initialize error tracking with Sentry
 */
export const initErrorTracking = () => {
  if (!config.monitoring.enableErrorTracking) {
    console.log('Error tracking disabled');
    return;
  }

  if (!config.monitoring.sentryDsn && isProduction) {
    console.warn('Sentry DSN not configured for production environment');
    return;
  }

  if (config.monitoring.sentryDsn) {
    Sentry.init({
      dsn: config.monitoring.sentryDsn,
      environment: config.environment,
      release: `volumeviz@${config.version}`,
      integrations: [
        new BrowserTracing({
          // Performance monitoring
          tracingOrigins: [config.apiBaseUrl, /^\//],
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes,
          ),
        }),
        new Sentry.Replay({
          // Session replay for debugging
          maskAllText: false,
          blockAllMedia: false,
          sampleRate: isDevelopment ? 1.0 : 0.1,
          errorSampleRate: 1.0,
        }),
      ],
      // Performance monitoring sample rate
      tracesSampleRate: isProduction ? 0.1 : 1.0,
      // Session replay sample rate
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Debug mode in development
      debug: isDevelopment,
      // Before sending error to Sentry
      beforeSend: (event, hint) => {
        // Filter out certain errors
        if (event.exception) {
          const error = hint.originalException;

          // Don't send network errors in development
          if (
            isDevelopment &&
            error instanceof TypeError &&
            error.message.includes('fetch')
          ) {
            return null;
          }

          // Don't send canceled requests
          if (error?.name === 'AbortError') {
            return null;
          }
        }

        // Add user context
        const user = getUserContext();
        if (user) {
          event.user = user;
        }

        // Add custom context
        event.contexts = {
          ...event.contexts,
          app: {
            version: config.version,
            buildId: config.buildId,
            environment: config.environment,
          },
        };

        return event;
      },
      // Ignore certain errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        // Random network errors
        'Network request failed',
        'NetworkError',
        'Failed to fetch',
        // Websocket errors (handled separately)
        'WebSocket connection failed',
        // User canceled actions
        'AbortError',
        'User cancelled',
        // React development warnings
        /React\.createElement/,
        /Non-Error promise rejection captured/,
      ],
    });

    console.log('✅ Error tracking initialized');
  }
};

/**
 * Custom error boundary for React components
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * Wrap component with error boundary
 */
export const withErrorBoundary = Sentry.withErrorBoundary;

/**
 * Capture custom errors
 */
export const captureError = (error: Error, context?: Record<string, any>) => {
  console.error('Error captured:', error);

  if (config.monitoring.enableErrorTracking && config.monitoring.sentryDsn) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }

  // Log to console in development
  if (isDevelopment) {
    console.error('Error context:', context);
  }
};

/**
 * Capture custom messages
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>,
) => {
  if (config.monitoring.enableErrorTracking && config.monitoring.sentryDsn) {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context,
      },
    });
  }

  // Log to console based on level
  const logMethod =
    level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
  console[logMethod](message, context);
};

/**
 * Set user context for error tracking
 */
export const setUserContext = (user: {
  id: string;
  email?: string;
  username?: string;
  organizationId?: number;
}) => {
  if (config.monitoring.enableErrorTracking && config.monitoring.sentryDsn) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      organization_id: user.organizationId?.toString(),
    });
  }
};

/**
 * Clear user context (on logout)
 */
export const clearUserContext = () => {
  if (config.monitoring.enableErrorTracking && config.monitoring.sentryDsn) {
    Sentry.setUser(null);
  }
};

/**
 * Get current user context
 */
const getUserContext = () => {
  // Get from your auth state
  const token = localStorage.getItem('auth_token');
  if (!token) return null;

  try {
    // Decode JWT to get user info (simplified)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email,
      organization_id: payload.org_id,
    };
  } catch {
    return null;
  }
};

/**
 * Track custom breadcrumbs
 */
export const addBreadcrumb = (breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) => {
  if (config.monitoring.enableErrorTracking && config.monitoring.sentryDsn) {
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || 'custom',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data,
      timestamp: Date.now() / 1000,
    });
  }
};

/**
 * Performance monitoring transaction
 */
export const startTransaction = (name: string, op: string = 'navigation') => {
  if (
    config.monitoring.enablePerformanceTracking &&
    config.monitoring.sentryDsn
  ) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  return null;
};

/**
 * React Query error handler
 */
export const queryErrorHandler = (error: unknown) => {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch')) {
      captureMessage('Network error in React Query', 'warning', {
        error: error.message,
      });
      return;
    }

    // API errors
    if ('status' in error) {
      const apiError = error as any;
      if (apiError.status >= 500) {
        captureError(error, {
          status: apiError.status,
          data: apiError.data,
        });
      }
    }
  }
};

/**
 * WebSocket error handler
 */
export const wsErrorHandler = (error: Event | Error, url: string) => {
  captureMessage('WebSocket error', 'error', {
    url,
    error: error instanceof Error ? error.message : 'Connection failed',
  });
};

/**
 * Global error handler for unhandled promise rejections
 */
export const setupGlobalErrorHandlers = () => {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureError(new Error(event.reason), {
      type: 'unhandledrejection',
      promise: event.promise,
    });
  });

  // Global errors
  window.addEventListener('error', (event) => {
    if (event.error) {
      captureError(event.error, {
        type: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }
  });
};

// Helper functions for specific error types
export const errorHandlers = {
  network: (error: Error, endpoint?: string) => {
    captureError(error, {
      type: 'network',
      endpoint,
    });
  },

  validation: (error: Error, data?: any) => {
    captureMessage('Validation error', 'warning', {
      error: error.message,
      data,
    });
  },

  permission: (error: Error, resource?: string) => {
    captureMessage('Permission denied', 'warning', {
      resource,
      error: error.message,
    });
  },

  timeout: (operation: string, duration: number) => {
    captureMessage('Operation timeout', 'warning', {
      operation,
      duration,
    });
  },
};
