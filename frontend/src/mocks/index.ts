/**
 * MSW Mock Index
 * Entry point for all MSW-related functionality
 */

export { handlers } from './handlers';
// Only export server in test environment to avoid browser import issues
// export { server, setupMSWServer } from './server';
export { configureMSW, resetMSW, startMSW, stopMSW, worker } from './setup';

// Convenience exports for different environments
export const mocks = {
  // Browser environment
  browser: {
    start: () => import('./setup').then((m) => m.startMSW()),
    stop: () => import('./setup').then((m) => m.stopMSW()),
    reset: () => import('./setup').then((m) => m.resetMSW()),
  },
  // Node/testing environment - only available in test environments
  node: {
    setup: () => {
      // Only import server in Node.js/test environments
      if (typeof window === 'undefined') {
        return import('./server').then((m) => m.setupMSWServer());
      }
      return Promise.resolve();
    },
    server: () => {
      // Only import server in Node.js/test environments  
      if (typeof window === 'undefined') {
        return import('./server').then((m) => m.server);
      }
      return Promise.resolve(null);
    },
  },
};
