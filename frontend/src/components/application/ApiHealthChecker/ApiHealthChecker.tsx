import { useEffect } from 'react';
import { useGetHealthDatabase } from '@/api/orval-generated/api';
import { logger } from '@/utils/logger';

/**
 * Component that checks API health on mount and periodically
 */
export function ApiHealthChecker() {
  const {
    data: healthData,
    error,
  } = useGetHealthDatabase({
    query: {
      refetchInterval: 10000, // Check every 10 seconds
      retry: (failureCount) => {
        // Retry up to 3 times with exponential backoff
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  });

  useEffect(() => {
    logger.debug('[ApiHealthChecker] Starting health checks');

    if (healthData) {
      logger.info(
        '[ApiHealthChecker] Health check completed:',
        healthData.status,
      );
    }

    if (error) {
      logger.error('[ApiHealthChecker] Health check failed:', error);
    }
  }, [healthData, error]);

  return null;
}
