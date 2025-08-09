/**
 * Error handling utilities for VolumeViz API
 * Handles uniform error envelopes from v1 API
 */

// Uniform error response format from v1 API
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    request_id?: string;
  };
}

// Common error codes from the API
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  [ApiErrorCode.VALIDATION_ERROR]: 'Invalid request parameters',
  [ApiErrorCode.NOT_FOUND]: 'Resource not found',
  [ApiErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ApiErrorCode.FORBIDDEN]: 'Access denied',
  [ApiErrorCode.RATE_LIMITED]: 'Too many requests. Please wait and try again.',
  [ApiErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

/**
 * Check if an error response matches the uniform API error format
 */
export function isApiError(error: any): error is ApiError {
  return (
    error &&
    typeof error === 'object' &&
    error.error &&
    typeof error.error.code === 'string' &&
    typeof error.error.message === 'string'
  );
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: any): string {
  // First check if it's a structured API error
  if (isApiError(error)) {
    const { code, message } = error.error;

    // Return custom message if available, otherwise use code-based message
    const friendlyMessage = ERROR_MESSAGES[code];
    return friendlyMessage || message || 'An error occurred';
  }

  // Check for HTTP status codes
  const statusCode = getHttpStatusCode(error);
  if (statusCode) {
    return getStatusCodeMessage(statusCode);
  }

  // Handle non-API errors
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Extract detailed error information for debugging
 */
export function getErrorDetails(error: any): {
  message: string;
  code?: string;
  details?: any;
  requestId?: string;
} {
  if (isApiError(error)) {
    return {
      message: error.error.message,
      code: error.error.code,
      details: error.error.details,
      requestId: error.error.request_id,
    };
  }

  return {
    message: getErrorMessage(error),
  };
}

/**
 * Check if error is a specific type
 */
export function isErrorOfType(error: any, code: ApiErrorCode): boolean {
  return isApiError(error) && error.error.code === code;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: any): boolean {
  return isErrorOfType(error, ApiErrorCode.VALIDATION_ERROR);
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: any): boolean {
  return isErrorOfType(error, ApiErrorCode.NOT_FOUND);
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  return isErrorOfType(error, ApiErrorCode.RATE_LIMITED);
}

/**
 * Format error for display in UI components
 */
export function formatErrorForDisplay(error: any): {
  title: string;
  message: string;
  variant: 'error' | 'warning' | 'info';
  showRetry?: boolean;
} {
  const details = getErrorDetails(error);

  if (isRateLimitError(error)) {
    return {
      title: 'Rate Limited',
      message: 'Too many requests. Please wait a moment and try again.',
      variant: 'warning',
      showRetry: true,
    };
  }

  if (isValidationError(error)) {
    return {
      title: 'Invalid Request',
      message: details.message,
      variant: 'error',
    };
  }

  if (isNotFoundError(error)) {
    return {
      title: 'Not Found',
      message: details.message,
      variant: 'info',
    };
  }

  return {
    title: 'Error',
    message: details.message,
    variant: 'error',
    showRetry: true,
  };
}

/**
 * Get HTTP status code from error response
 */
export function getHttpStatusCode(error: any): number | null {
  // Check if error has response.status (axios-like)
  if (error?.response?.status) {
    return error.response.status;
  }
  
  // Check if error has status property directly
  if (typeof error?.status === 'number') {
    return error.status;
  }
  
  // Check if error has response.status (fetch-like)
  if (error?.response && typeof error.response.status === 'number') {
    return error.response.status;
  }
  
  return null;
}

/**
 * Get user-friendly message based on HTTP status code
 */
export function getStatusCodeMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad request. Please check your input and try again.';
    case 401:
      return 'Authentication required. Please log in and try again.';
    case 403:
      return 'Access denied. You don\'t have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'Conflict. The resource already exists or is being modified.';
    case 422:
      return 'Invalid input. Please check your data and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Internal server error. Please try again later.';
    case 502:
      return 'Service temporarily unavailable. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    case 504:
      return 'Request timeout. Please try again.';
    default:
      if (statusCode >= 400 && statusCode < 500) {
        return 'Client error. Please check your request and try again.';
      } else if (statusCode >= 500) {
        return 'Server error. Please try again later.';
      }
      return 'An error occurred. Please try again.';
  }
}

/**
 * Enhanced error handling for API responses
 * Can be used with generated API client
 */
export function handleApiError(error: any): never {
  const details = getErrorDetails(error);

  // Log error details for debugging
  console.error('API Error:', {
    code: details.code,
    message: details.message,
    details: details.details,
    requestId: details.requestId,
  });

  // Throw user-friendly error
  const friendlyMessage = getErrorMessage(error);
  const enhancedError = new Error(friendlyMessage);

  // Attach original error details
  (enhancedError as any).originalError = error;
  (enhancedError as any).code = details.code;
  (enhancedError as any).requestId = details.requestId;

  throw enhancedError;
}
