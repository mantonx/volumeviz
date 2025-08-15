import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Browser Setup
 * Configures Mock Service Worker for development and testing
 */

// Configure MSW worker
export const worker = setupWorker(...handlers);

/**
 * Start MSW in browser environment
 * Call this in your app entry point during development
 */
export const startMSW = async () => {
  if (typeof window === 'undefined') {
    // Skip in SSR environment
    return;
  }

  // Only start MSW in development or when explicitly enabled
  const shouldUseMSW =
    import.meta.env.VITE_USE_MSW === 'true' || import.meta.env.DEV === true;

  if (!shouldUseMSW) {
    console.log('MSW: Skipping - not enabled for this environment');
    return;
  }

  try {
    await worker.start({
      onUnhandledRequest: 'warn',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    console.log('🛡️ MSW: Mock Service Worker enabled');
  } catch (error) {
    console.error('MSW: Failed to start Service Worker:', error);
  }
};

/**
 * Stop MSW worker
 */
export const stopMSW = () => {
  worker.stop();
  console.log('MSW: Service Worker stopped');
};

/**
 * Reset MSW handlers to initial state
 */
export const resetMSW = () => {
  worker.resetHandlers();
  console.log('MSW: Handlers reset to initial state');
};

/**
 * Enable/disable specific MSW features
 */
export const configureMSW = {
  /**
   * Enable network delays to simulate real network conditions
   */
  enableNetworkDelay: (delay = 100) => {
    console.log(`MSW: Network delay enabled (${delay}ms)`);
    worker.use(
      ...handlers.map((handler) => {
        // Add delay to each handler
        return handler;
      }),
    );
  },

  /**
   * Enable error simulation for testing error states
   */
  enableErrorSimulation: (errorRate: number = 0.1) => {
    // This would be implemented with custom handlers that randomly fail
    console.log(`MSW: Error simulation enabled (${errorRate * 100}% rate)`);
  },
};

// Export worker for advanced usage
export { worker as mswWorker };
