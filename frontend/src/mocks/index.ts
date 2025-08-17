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
  // Node/testing environment
  node: {
    setup: () => import('./server').then((m) => m.setupMSWServer()),
    server: () => import('./server').then((m) => m.server),
  },
};
