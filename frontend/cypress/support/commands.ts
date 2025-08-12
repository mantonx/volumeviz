/**
 * Custom Cypress Commands for VolumeViz E2E Tests
 * 
 * This file contains reusable commands for common testing patterns
 * across the VolumeViz application.
 */

// Import types for better IDE support
/// <reference types="cypress" />

/**
 * Set up common API interceptors used across multiple tests
 */
Cypress.Commands.add('setupCommonInterceptors', () => {
  // Health check endpoint
  cy.intercept('GET', '/api/v1/health', {
    statusCode: 200,
    body: { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  }).as('healthCheck');

  // Volume list endpoint
  cy.intercept('GET', '/api/v1/volumes*', {
    statusCode: 200,
    body: {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        has_more: false
      }
    }
  }).as('volumesList');

  // System info endpoint
  cy.intercept('GET', '/api/v1/system*', {
    statusCode: 200,
    body: {
      data: {
        docker_version: '20.10.0',
        volumes_count: 0,
        containers_count: 0
      }
    }
  }).as('systemInfo');
});

/**
 * Wait for the application to be fully loaded
 */
Cypress.Commands.add('waitForAppLoad', () => {
  // Wait for React to mount
  cy.get('[data-testid="app-root"]', { timeout: 10000 }).should('be.visible');
  
  // Wait for initial API calls to complete
  cy.wait('@healthCheck');
  
  // Wait for WebSocket to connect (if enabled)
  cy.window().then((win) => {
    if (win.__TEST_WS__ || Cypress.env('ENABLE_WEBSOCKET')) {
      cy.waitForWebSocketConnection();
    }
  });
});

/**
 * Mock API health status for testing different states
 */
Cypress.Commands.add('mockApiHealth', (status: 'online' | 'offline' | 'error') => {
  const responses = {
    online: { statusCode: 200, body: { status: 'ok' } },
    offline: { statusCode: 503, body: { error: 'Service unavailable' } },
    error: { statusCode: 500, body: { error: 'Internal server error' } }
  };

  cy.intercept('GET', '/api/v1/health', responses[status]).as(`healthCheck${status}`);
});

/**
 * Mock volume data for consistent testing
 */
Cypress.Commands.add('mockVolumeData', (volumes: any[] = []) => {
  const defaultVolumes = [
    {
      name: 'test-volume-1',
      driver: 'local',
      created_at: '2023-01-01T00:00:00Z',
      size_bytes: 1024000,
      attachments_count: 1,
      is_system: false,
      is_orphaned: false,
      labels: {}
    },
    {
      name: 'test-volume-2', 
      driver: 'local',
      created_at: '2023-01-02T00:00:00Z',
      size_bytes: 2048000,
      attachments_count: 0,
      is_system: false,
      is_orphaned: true,
      labels: {}
    }
  ];

  const mockData = volumes.length > 0 ? volumes : defaultVolumes;

  cy.intercept('GET', '/api/v1/volumes*', {
    statusCode: 200,
    body: {
      data: mockData,
      pagination: {
        page: 1,
        limit: 20,
        total: mockData.length,
        has_more: false
      }
    }
  }).as('volumesListMocked');
});

/**
 * Visit page with proper error handling and loading states
 */
Cypress.Commands.add('visitPage', (url: string) => {
  cy.visit(url, {
    onBeforeLoad: (win) => {
      // Set up test environment
      win.__TEST_MODE__ = true;
      
      // Initialize WebSocket shim if needed
      if (Cypress.env('ENABLE_WEBSOCKET')) {
        cy.setupWebSocketShim();
      }
    },
    onLoad: (win) => {
      // Wait for React to be available
      expect(win.React).to.exist;
    }
  });
  
  // Wait for app to load
  cy.waitForAppLoad();
});

/**
 * Test data-testid selector helper
 */
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

/**
 * Wait for debounced input to complete
 */
Cypress.Commands.add('waitForDebounce', (ms: number = 300) => {
  cy.wait(ms);
});

/**
 * Test search functionality with debouncing
 */
Cypress.Commands.add('testSearch', (searchTerm: string, expectedResults?: number) => {
  cy.getByTestId('search-input').clear().type(searchTerm);
  cy.waitForDebounce(500); // Wait for debounce
  
  if (expectedResults !== undefined) {
    cy.getByTestId('search-results').should('have.length', expectedResults);
  }
});

/**
 * Check status pill state
 */
Cypress.Commands.add('checkStatusPill', (expectedState: {
  api: 'OK' | 'Error';
  websocket?: 'Connected' | 'Connecting' | 'Reconnecting' | 'Disconnected' | 'Error';
  hasWebSocket?: boolean;
}) => {
  const statusPill = cy.getByTestId('status-pill');
  
  // Check API status
  statusPill.should('contain', `API: ${expectedState.api}`);
  
  // Check WebSocket status if specified
  if (expectedState.hasWebSocket && expectedState.websocket) {
    statusPill.should('contain', `RT: ${expectedState.websocket}`);
  } else if (!expectedState.hasWebSocket) {
    statusPill.should('not.contain', 'RT:');
  }
});

/**
 * Mock scan operation with progress updates
 */
Cypress.Commands.add('mockScanOperation', (volumeId: string, options?: {
  duration?: number;
  finalSize?: number;
  shouldFail?: boolean;
}) => {
  const config = {
    duration: 3000,
    finalSize: 1024000,
    shouldFail: false,
    ...options
  };

  // Mock scan start endpoint
  cy.intercept('POST', `/api/v1/volumes/${volumeId}/scan`, {
    statusCode: 200,
    body: {
      data: {
        scan_id: `scan-${Date.now()}`,
        volume_id: volumeId,
        status: 'started',
        method: 'du'
      }
    }
  }).as('scanStart');

  // If WebSocket is enabled, emit scan progress events
  cy.window().then((win) => {
    if (win.__TEST_WS__) {
      // Emit scan progress events
      const steps = 5;
      const stepDuration = config.duration / steps;
      
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          if (!config.shouldFail) {
            win.__TEST_WS__.emit('scan_progress', {
              type: 'scan_progress',
              volume_id: volumeId,
              data: {
                progress: (i / steps) * 100,
                current_size: (config.finalSize * i) / steps,
                files_processed: i * 10,
                method: 'du',
                started_at: new Date().toISOString()
              }
            });
          }
        }, stepDuration * i);
      }

      // Emit final event
      setTimeout(() => {
        if (config.shouldFail) {
          win.__TEST_WS__.emit('scan_error', {
            type: 'scan_error',
            volume_id: volumeId,
            data: {
              error: 'Permission denied'
            }
          });
        } else {
          win.__TEST_WS__.emit('scan_complete', {
            type: 'scan_complete',
            volume_id: volumeId,
            data: {
              total_size: config.finalSize,
              file_count: 50,
              directory_count: 5,
              method: 'du',
              duration: config.duration,
              scanned_at: new Date().toISOString()
            }
          });
        }
      }, config.duration);
    }
  });
});

/**
 * Take a screenshot with a descriptive name
 */
Cypress.Commands.add('takeNamedScreenshot', (name: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  cy.screenshot(`${name}-${timestamp}`, {
    capture: 'viewport',
    overwrite: true
  });
});

/**
 * Wait for animation or transition to complete
 */
Cypress.Commands.add('waitForAnimation', (selector?: string, duration: number = 300) => {
  if (selector) {
    cy.get(selector).should('be.visible');
  }
  cy.wait(duration);
});

/**
 * Assert API response format
 */
Cypress.Commands.add('validateApiResponse', (alias: string) => {
  cy.wait(alias).then((interception) => {
    expect(interception.response?.body).to.be.validApiResponse;
  });
});

/**
 * Simulate tab key press for keyboard navigation testing
 */
Cypress.Commands.add('tab', () => {
  cy.focused().trigger('keydown', { keyCode: 9, which: 9, key: 'Tab' });
});

// Type definitions for TypeScript support
declare global {
  namespace Cypress {
    interface Chainable {
      setupCommonInterceptors(): Chainable<void>;
      waitForAppLoad(): Chainable<void>;
      mockApiHealth(status: 'online' | 'offline' | 'error'): Chainable<void>;
      mockVolumeData(volumes?: any[]): Chainable<void>;
      visitPage(url: string): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      waitForDebounce(ms?: number): Chainable<void>;
      testSearch(searchTerm: string, expectedResults?: number): Chainable<void>;
      checkStatusPill(expectedState: {
        api: 'OK' | 'Error';
        websocket?: 'Connected' | 'Connecting' | 'Reconnecting' | 'Disconnected' | 'Error';
        hasWebSocket?: boolean;
      }): Chainable<void>;
      mockScanOperation(volumeId: string, options?: {
        duration?: number;
        finalSize?: number;
        shouldFail?: boolean;
      }): Chainable<void>;
      takeNamedScreenshot(name: string): Chainable<void>;
      waitForAnimation(selector?: string, duration?: number): Chainable<void>;
      validateApiResponse(alias: string): Chainable<void>;
      tab(): Chainable<void>;
    }
  }
}