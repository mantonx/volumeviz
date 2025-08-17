import { useEffect } from 'react';
import { useApiHealth } from '@/api/services';

/**
 * Component that checks API health on mount and periodically
 */
export function ApiHealthChecker() {
  const { checkHealth } = useApiHealth();

  useEffect(() => {
    console.log('[ApiHealthChecker] Starting health checks');
    
    // Initial health check
    checkHealth().then(() => {
      console.log('[ApiHealthChecker] Initial health check completed');
    }).catch((err) => {
      console.error('[ApiHealthChecker] Initial health check failed:', err);
    });

    // Check health every 10 seconds for faster feedback
    const interval = setInterval(() => {
      console.log('[ApiHealthChecker] Running periodic health check');
      checkHealth().catch((err) => {
        console.error('[ApiHealthChecker] Periodic health check failed:', err);
      });
    }, 10000);

    return () => {
      console.log('[ApiHealthChecker] Cleaning up health checks');
      clearInterval(interval);
    };
  }, [checkHealth]);

  return null;
}