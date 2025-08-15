import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server Setup for Node.js environments (Testing)
 */

// Create MSW server for testing
export const server = setupServer(...handlers);

// Test setup helpers
export const setupMSWServer = () => {
  // Note: Import beforeAll, afterEach, afterAll from your test framework
  // Example for Vitest/Jest:
  // import { beforeAll, afterEach, afterAll } from 'vitest';

  const setupFunctions = {
    beforeAll: (fn: () => void) => fn(), // Replace with actual beforeAll
    afterEach: (fn: () => void) => fn(), // Replace with actual afterEach
    afterAll: (fn: () => void) => fn(), // Replace with actual afterAll
  };

  // Establish API mocking before all tests
  setupFunctions.beforeAll(() =>
    server.listen({ onUnhandledRequest: 'error' }),
  );

  // Reset any request handlers that are declared as a part of tests
  setupFunctions.afterEach(() => server.resetHandlers());

  // Clean up after all tests are finished
  setupFunctions.afterAll(() => server.close());
};

// Export server for advanced usage
export { server as mswServer };

export default server;
