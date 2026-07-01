/**
 * Enhanced error handling utilities specifically for VolumeViz scan operations
 * Provides contextual, user-friendly error messages with actionable guidance
 */

import {
  getErrorDetails,
  isApiError,
  getHttpStatusCode,
} from './errorHandling';

// Scan-specific error types
export interface ScanError {
  error_type:
    | 'EnrichmentError'
    | 'FileAccessError'
    | 'FilesystemError'
    | 'NetworkError'
    | 'ResourceError'
    | 'ValidationError'
    | 'TimeoutError';
  error_category:
    | 'metadata_extraction'
    | 'file_system'
    | 'disk_io'
    | 'network'
    | 'permissions'
    | 'validation'
    | 'timeout'
    | 'memory';
  severity: 'critical' | 'error' | 'warning' | 'info';
  component: string;
  operation: string;
  item_path: string;
  item_name: string;
  error_message: string;
  technical_details?: string;
  occurred_at: string;
  retry_count: number;
  enricher_name?: string;
  file_size?: number;
  file_type?: string;
}

// User-friendly context descriptions for scan operations
const SCAN_OPERATION_CONTEXT: Record<string, string> = {
  volume_scan: 'calculating volume size and statistics',
  filesystem_indexing: 'scanning and cataloging files',
  media_enrichment: 'extracting media metadata',
  extract_video_metadata: 'analyzing video file properties',
  extract_audio_metadata: 'analyzing audio file properties',
  extract_image_metadata: 'analyzing image file properties',
  read_file_metadata: 'reading file information',
  read_directory: 'scanning directory contents',
  create_thumbnail: 'generating preview thumbnail',
  calculate_checksum: 'calculating file integrity hash',
};

// User-friendly error messages with context
const SCAN_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  EnrichmentError: {
    metadata_extraction: 'Unable to extract metadata from media file',
  },
  FileAccessError: {
    permissions: 'Permission denied accessing file or directory',
    file_system: 'Unable to access file due to system restrictions',
  },
  FilesystemError: {
    disk_io: 'Storage device error - disk may be failing or corrupted',
    file_system: 'File system error - directory structure may be damaged',
  },
  NetworkError: {
    network: 'Network connection error during scan operation',
  },
  ResourceError: {
    memory: 'Insufficient system memory to process large files',
    disk_space: 'Insufficient disk space for scan operations',
  },
  TimeoutError: {
    timeout: 'Operation took too long and was cancelled',
  },
  ValidationError: {
    validation: 'Invalid file format or corrupted data detected',
  },
};

// User-friendly suggestions for resolving issues
const SCAN_ERROR_SUGGESTIONS: Record<string, Record<string, string>> = {
  FileAccessError: {
    permissions:
      'Check file permissions or run scan as administrator. Ensure the volume is mounted and accessible.',
    file_system:
      'Verify the file exists and the storage device is properly connected.',
  },
  FilesystemError: {
    disk_io:
      'Check disk health with fsck (Linux/Mac) or chkdsk (Windows). Consider backing up data immediately.',
    file_system:
      'Try remounting the volume or check for disk errors. This may indicate hardware failure.',
  },
  EnrichmentError: {
    metadata_extraction:
      'File may be corrupted or in an unsupported format. Consider updating media libraries or skipping this file.',
  },
  NetworkError: {
    network:
      'Check network connectivity if scanning remote volumes. Ensure stable connection to network storage.',
  },
  ResourceError: {
    memory:
      'Close other applications to free memory, or split large scans into smaller batches.',
    disk_space:
      'Free up disk space or change scan output directory to a drive with more space.',
  },
  TimeoutError: {
    timeout:
      'Large files may need more time. Consider increasing timeout settings or scanning during off-peak hours.',
  },
  ValidationError: {
    validation:
      'File appears corrupted or damaged. Try re-downloading or restoring from backup if available.',
  },
};

// Phase-specific context messages
const SCAN_PHASE_CONTEXT: Record<string, string> = {
  volume_scan: 'During volume size calculation',
  filesystem_indexing: 'While scanning file structure',
  media_enrichment: 'During media metadata extraction',
};

/**
 * Format scan error with enhanced user-friendly context
 */
export function formatScanErrorForDisplay(error: ScanError): {
  title: string;
  message: string;
  suggestion?: string;
  context: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  technical?: string;
  actionable: boolean;
  retryable: boolean;
} {
  const baseMessage =
    SCAN_ERROR_MESSAGES[error.error_type]?.[error.error_category] ||
    error.error_message;
  const suggestion =
    SCAN_ERROR_SUGGESTIONS[error.error_type]?.[error.error_category];
  const operationContext =
    SCAN_OPERATION_CONTEXT[error.operation] || error.operation;

  // Build context-aware title
  let title = baseMessage;
  if (error.error_type === 'FileAccessError') {
    title = 'File Access Problem';
  } else if (error.error_type === 'EnrichmentError') {
    title = 'Media Processing Issue';
  } else if (error.error_type === 'FilesystemError') {
    title = 'Storage Device Error';
  } else if (error.error_type === 'NetworkError') {
    title = 'Network Connection Issue';
  } else if (error.error_type === 'ResourceError') {
    title = 'System Resource Problem';
  } else if (error.error_type === 'TimeoutError') {
    title = 'Operation Timeout';
  }

  // Build user-friendly context
  let context = `While ${operationContext}`;
  if (error.item_name) {
    context += `: ${error.item_name}`;
  }
  if (error.item_path && error.item_path !== error.item_name) {
    context += ` (${error.item_path})`;
  }

  // Add file size context if available
  if (error.file_size && error.file_size > 0) {
    const sizeMB = error.file_size / (1024 * 1024);
    if (sizeMB > 1000) {
      context += ` - ${(sizeMB / 1024).toFixed(1)}GB file`;
    } else if (sizeMB > 1) {
      context += ` - ${sizeMB.toFixed(1)}MB file`;
    }
  }

  // Determine if error is actionable/retryable
  const retryable =
    error.error_type !== 'ValidationError' &&
    error.error_type !== 'FilesystemError';
  const actionable = !!suggestion;

  return {
    title,
    message: baseMessage,
    suggestion,
    context,
    severity: error.severity,
    technical: error.technical_details,
    actionable,
    retryable,
  };
}

/**
 * Format general API errors with scan-specific context
 */
export function formatApiErrorForScan(
  error: any,
  context?: {
    phase?: string;
    operation?: string;
    volumeName?: string;
    fileName?: string;
  },
): {
  title: string;
  message: string;
  suggestion?: string;
  context?: string;
  variant: 'error' | 'warning' | 'info';
  retryable: boolean;
} {
  const details = getErrorDetails(error);
  const statusCode = getHttpStatusCode(error);

  let title = 'Scan Error';
  let message = details.message;
  let suggestion: string | undefined;
  let contextMessage: string | undefined;
  let variant: 'error' | 'warning' | 'info' = 'error';
  let retryable = true;

  // Add scan context if provided
  if (context) {
    const parts: string[] = [];
    if (context.phase) {
      parts.push(
        SCAN_PHASE_CONTEXT[context.phase] || `During ${context.phase}`,
      );
    }
    if (context.operation) {
      parts.push(
        SCAN_OPERATION_CONTEXT[context.operation] || context.operation,
      );
    }
    if (context.volumeName) {
      parts.push(`on volume "${context.volumeName}"`);
    }
    if (context.fileName) {
      parts.push(`for file "${context.fileName}"`);
    }
    contextMessage = parts.join(' ');
  }

  // Enhance based on status code
  if (statusCode) {
    switch (statusCode) {
      case 400:
        title = 'Invalid Scan Request';
        message =
          'The scan request contains invalid parameters. Please check your scan settings and try again.';
        suggestion = 'Verify volume path exists and scan options are correct.';
        retryable = false;
        break;
      case 401:
        title = 'Authentication Required';
        message = 'You need to be authenticated to perform scan operations.';
        suggestion = 'Please log in and try again.';
        retryable = false;
        break;
      case 403:
        title = 'Insufficient Permissions';
        message =
          "You don't have permission to scan this volume or access these files.";
        suggestion =
          'Contact your administrator or check volume access permissions.';
        retryable = false;
        break;
      case 404:
        title = 'Volume Not Found';
        message =
          'The specified volume could not be found or may have been unmounted.';
        suggestion =
          'Verify the volume is still connected and accessible, then refresh the volume list.';
        variant = 'info';
        break;
      case 409:
        title = 'Scan Already Running';
        message = 'A scan is already in progress for this volume.';
        suggestion =
          'Wait for the current scan to complete or cancel it before starting a new one.';
        variant = 'warning';
        retryable = false;
        break;
      case 413:
        title = 'Volume Too Large';
        message =
          'The volume is too large to scan with current system resources.';
        suggestion =
          'Consider scanning specific directories or upgrading system resources.';
        retryable = false;
        break;
      case 422:
        title = 'Invalid Volume Data';
        message =
          'The volume contains invalid or corrupted data that prevents scanning.';
        suggestion =
          'Check disk integrity or try scanning specific subdirectories.';
        retryable = false;
        break;
      case 429:
        title = 'Too Many Scan Requests';
        message = 'You have reached the limit for concurrent scans.';
        suggestion =
          'Wait for existing scans to complete before starting new ones.';
        variant = 'warning';
        break;
      case 500:
        title = 'Scan Service Error';
        message = 'The scan service encountered an internal error.';
        suggestion =
          'Try again in a few moments. If the problem persists, contact support.';
        break;
      case 503:
        title = 'Scan Service Unavailable';
        message = 'The scan service is temporarily unavailable or overloaded.';
        suggestion = 'Try again later when system load is lower.';
        break;
      case 507:
        title = 'Insufficient Storage Space';
        message = 'Not enough disk space available for scan operations.';
        suggestion = 'Free up disk space or change scan output location.';
        retryable = false;
        break;
    }
  }

  // Check for specific API error codes
  if (isApiError(error)) {
    switch (error.error.code) {
      case 'VOLUME_NOT_ACCESSIBLE':
        title = 'Volume Access Error';
        message = 'The volume is not accessible for scanning.';
        suggestion =
          'Check if the volume is mounted and you have read permissions.';
        break;
      case 'SCAN_ALREADY_RUNNING':
        title = 'Scan In Progress';
        message = 'A scan is already running for this volume.';
        suggestion = 'Wait for the current scan to finish or cancel it first.';
        variant = 'warning';
        break;
      case 'INSUFFICIENT_RESOURCES':
        title = 'System Resources Low';
        message = 'Insufficient system resources to perform the scan.';
        suggestion =
          'Close other applications or try scanning smaller directories.';
        break;
      case 'VOLUME_TOO_LARGE':
        title = 'Volume Size Limit Exceeded';
        message = 'The volume is too large for the current scan configuration.';
        suggestion =
          'Consider scanning specific directories or adjusting scan settings.';
        retryable = false;
        break;
    }
  }

  return {
    title,
    message,
    suggestion,
    context: contextMessage,
    variant,
    retryable,
  };
}

/**
 * Get user-friendly status message for scan states
 */
export function getScanStatusMessage(
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'paused',
  context?: { phase?: string; progress?: number; fileName?: string },
): {
  message: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
} {
  switch (status) {
    case 'pending':
      return {
        message: 'Scan Queued',
        description:
          'Your scan is waiting to begin. It will start once system resources are available.',
        variant: 'info',
      };
    case 'running':
      const progressText = context?.progress ? ` (${context.progress}%)` : '';
      const phaseText = context?.phase
        ? ` - ${SCAN_PHASE_CONTEXT[context.phase] || context.phase}`
        : '';
      const fileText = context?.fileName
        ? ` - Processing: ${context.fileName}`
        : '';
      return {
        message: `Scan Active${progressText}`,
        description: `Your volume scan is currently running${phaseText}${fileText}`,
        variant: 'info',
      };
    case 'completed':
      return {
        message: 'Scan Completed Successfully',
        description:
          'Your volume has been fully scanned and indexed. All files have been analyzed.',
        variant: 'success',
      };
    case 'failed':
      return {
        message: 'Scan Failed',
        description:
          'The scan encountered errors and could not complete. Check error details below.',
        variant: 'error',
      };
    case 'cancelled':
      return {
        message: 'Scan Cancelled',
        description:
          'The scan was cancelled by user request. Partial results may be available.',
        variant: 'warning',
      };
    case 'paused':
      return {
        message: 'Scan Paused',
        description:
          'The scan is temporarily paused. Resume to continue scanning from where it left off.',
        variant: 'warning',
      };
    default:
      return {
        message: 'Unknown Status',
        description:
          'The scan status is unclear. Please refresh or check system logs.',
        variant: 'warning',
      };
  }
}

/**
 * Format batch/progress error context for media enrichment
 */
export function formatBatchErrorContext(
  error: ScanError,
  batchInfo?: {
    currentBatch: number;
    totalBatches: number;
    filesInBatch: number;
    batchProgress: number;
  },
): string {
  let context = formatScanErrorForDisplay(error).context;

  if (batchInfo) {
    context += ` (Batch ${batchInfo.currentBatch}/${batchInfo.totalBatches}, ${batchInfo.filesInBatch} files, ${batchInfo.batchProgress}% complete)`;
  }

  return context;
}

/**
 * Determine if scan error warrants stopping the entire scan
 */
export function isCriticalScanError(error: ScanError): boolean {
  return (
    error.severity === 'critical' ||
    (error.error_type === 'FilesystemError' &&
      error.error_category === 'disk_io') ||
    (error.error_type === 'ResourceError' &&
      error.error_category === 'memory') ||
    error.retry_count >= 3
  );
}

/**
 * Get recommended action for scan error
 */
export function getRecommendedScanAction(error: ScanError): {
  action: 'retry' | 'skip' | 'pause' | 'abort';
  reason: string;
  immediate: boolean;
} {
  if (isCriticalScanError(error)) {
    return {
      action: 'abort',
      reason:
        'Critical error detected that may affect system stability or data integrity',
      immediate: true,
    };
  }

  if (error.error_type === 'ResourceError') {
    return {
      action: 'pause',
      reason:
        'System resources are low - pausing to prevent system instability',
      immediate: true,
    };
  }

  if (error.retry_count >= 2) {
    return {
      action: 'skip',
      reason: 'Multiple retry attempts failed - skipping to avoid scan delays',
      immediate: false,
    };
  }

  if (error.error_type === 'ValidationError') {
    return {
      action: 'skip',
      reason: 'File appears corrupted - skipping to continue with other files',
      immediate: false,
    };
  }

  return {
    action: 'retry',
    reason: 'Temporary error that may resolve on retry',
    immediate: false,
  };
}

/**
 * Convert scan error to ErrorSummaryItem format for use in ErrorSummary component
 */
export function scanErrorToSummaryItem(
  scanError: ScanError,
  index: number = 0,
): {
  id: string;
  message: string;
  code?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'permission'
    | 'network'
    | 'filesystem'
    | 'validation'
    | 'timeout'
    | 'resource'
    | 'unknown';
  timestamp: Date;
  context?: {
    phase?: string;
    path?: string;
    volume?: string;
    metadata?: Record<string, any>;
  };
  details?: string;
  count?: number;
  retryable?: boolean;
  suggestion?: string;
  acknowledged?: boolean;
  resolved?: boolean;
  rawError: ScanError;
} {
  const errorDisplay = formatScanErrorForDisplay(scanError);

  // Map scan error severities to ErrorSummary severities
  const severityMap: Record<
    'critical' | 'error' | 'warning' | 'info',
    'low' | 'medium' | 'high' | 'critical'
  > = {
    critical: 'critical',
    error: 'high',
    warning: 'medium',
    info: 'low',
  };

  // Map scan error categories to ErrorSummary categories
  const categoryMap: Record<
    string,
    | 'permission'
    | 'network'
    | 'filesystem'
    | 'validation'
    | 'timeout'
    | 'resource'
    | 'unknown'
  > = {
    permissions: 'permission',
    file_system: 'filesystem',
    disk_io: 'filesystem',
    network: 'network',
    timeout: 'timeout',
    memory: 'resource',
    validation: 'validation',
    metadata_extraction: 'validation',
  };

  return {
    id: `scan-error-${index}-${scanError.occurred_at}`,
    message: errorDisplay.title,
    code: scanError.error_type,
    severity: severityMap[errorDisplay.severity],
    category: categoryMap[scanError.error_category] || 'unknown',
    timestamp: new Date(scanError.occurred_at),
    context: {
      phase: scanError.operation,
      path: scanError.item_path,
      metadata: {
        component: scanError.component,
        file_type: scanError.file_type,
        file_size: scanError.file_size,
        enricher: scanError.enricher_name,
        retry_count: scanError.retry_count,
      },
    },
    details: scanError.technical_details,
    count: 1,
    retryable: errorDisplay.retryable,
    suggestion: errorDisplay.suggestion,
    acknowledged: false,
    resolved: false,
    rawError: scanError,
  };
}

/**
 * Convert array of scan errors to ErrorSummaryItem array
 */
export function scanErrorsToSummaryItems(
  scanErrors: ScanError[],
): ReturnType<typeof scanErrorToSummaryItem>[] {
  return scanErrors.map((error, index) => scanErrorToSummaryItem(error, index));
}
