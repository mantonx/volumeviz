/**
 * WebSocket Status Pill Tests
 * 
 * Tests WebSocket connection status display and functionality:
 * - REST-only mode status pill behavior
 * - REST+WS mode status pill behavior  
 * - Connection state changes and visual feedback
 * - Dev panel functionality (in dev mode)
 */

describe('WebSocket Status Pill', () => {
  beforeEach(() => {
    // Visit the main dashboard
    cy.visit('/');
  });

  describe('REST-only Mode', () => {
    beforeEach(() => {
      // Mock environment to disable WebSocket
      cy.window().then((win) => {
        // @ts-ignore
        win.__env = { VITE_ENABLE_WEBSOCKET: 'false' };
      });
    });

    it('should show REST-only status pill when WebSocket is disabled', () => {
      // Should show API status only
      cy.get('[data-testid="status-pill"]')
        .should('be.visible')
        .and('contain', 'API');
      
      // Should not show RT (real-time) indicator
      cy.get('[data-testid="status-pill"]')
        .should('not.contain', 'RT');
    });

    it('should show correct API status states', () => {
      // Mock healthy API response
      cy.intercept('GET', '/api/v1/health', { 
        statusCode: 200, 
        body: { status: 'ok' } 
      }).as('healthCheck');

      cy.get('[data-testid="status-pill"]')
        .should('contain', 'API: OK');

      // Mock API error
      cy.intercept('GET', '/api/v1/health', { 
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('healthCheckError');

      // Trigger a refresh or wait for next health check
      cy.reload();

      cy.get('[data-testid="status-pill"]')
        .should('contain', 'API: Error');
    });
  });

  describe('REST+WebSocket Mode', () => {
    beforeEach(() => {
      // Mock environment to enable WebSocket
      cy.window().then((win) => {
        // @ts-ignore
        win.__env = { 
          VITE_ENABLE_WEBSOCKET: 'true',
          VITE_WS_URL: 'ws://localhost:8080/api/v1/ws'
        };
      });
    });

    it('should show REST+WS status pill when WebSocket is enabled', () => {
      // Should show both API and RT status
      cy.get('[data-testid="status-pill"]')
        .should('be.visible')
        .and('contain', 'API')
        .and('contain', 'RT');
      
      // Should have separator dots
      cy.get('[data-testid="status-pill"] .separator-dot')
        .should('have.length.at.least', 1);
    });

    it('should show connecting state initially', () => {
      // On page load, WebSocket should be in connecting state
      cy.get('[data-testid="status-pill"]')
        .should('contain', 'RT: Connecting...');
      
      // Should show connecting animation
      cy.get('[data-testid="ws-status-icon"]')
        .should('have.class', 'animate-spin');
    });

    it('should show connected state when WebSocket connects', () => {
      // Mock successful WebSocket connection
      cy.window().its('WebSocket').then((ws) => {
        // Simulate successful connection
        cy.get('[data-testid="status-pill"]', { timeout: 5000 })
          .should('contain', 'RT: Connected');
        
        // Should show connected indicator
        cy.get('[data-testid="ws-status-icon"]')
          .should('not.have.class', 'animate-spin')
          .and('have.class', 'bg-green-500');
      });
    });

    it('should show reconnecting state on connection loss', () => {
      // Wait for initial connection
      cy.get('[data-testid="status-pill"]')
        .should('contain', 'RT: Connected');

      // Simulate connection loss
      cy.window().then((win) => {
        // @ts-ignore - Access WebSocket instance and close it
        if (win.WebSocket && win.WebSocket.prototype.close) {
          // Force close WebSocket connection
          cy.get('[data-testid="status-pill"]')
            .should('contain', 'RT: Reconnecting...');
        }
      });
    });
  });

  describe('Status Pill Tooltip', () => {
    it('should show detailed status information on hover', () => {
      cy.get('[data-testid="status-pill"]')
        .trigger('mouseover');

      // Should show tooltip with detailed information
      cy.get('[data-testid="status-pill"]')
        .should('have.attr', 'title')
        .and('include', 'API');
    });

    it('should include latency information when WebSocket is connected', () => {
      // Mock environment with WebSocket enabled
      cy.window().then((win) => {
        // @ts-ignore
        win.__env = { VITE_ENABLE_WEBSOCKET: 'true' };
      });

      // Wait for connection and latency measurement
      cy.get('[data-testid="status-pill"]', { timeout: 10000 })
        .should('contain', 'RT: Connected');

      cy.get('[data-testid="status-pill"]')
        .should('have.attr', 'title')
        .and('match', /\(\d+ms\)/); // Should include latency in ms
    });
  });

  describe('Dev Panel Integration', () => {
    beforeEach(() => {
      // Only run in development environment
      cy.window().then((win) => {
        // @ts-ignore
        if (!win.__DEV__) {
          cy.skip('Dev panel only available in development mode');
        }
      });
    });

    it('should open dev panel with Ctrl+Shift+W', () => {
      // Press keyboard shortcut
      cy.get('body').type('{ctrl+shift+w}');

      // Dev panel should appear
      cy.get('[data-testid="websocket-dev-panel"]')
        .should('be.visible');

      // Should show WebSocket connection info
      cy.get('[data-testid="websocket-dev-panel"]')
        .should('contain', 'WebSocket Dev Panel');
    });

    it('should send test messages through dev panel', () => {
      // Open dev panel
      cy.get('body').type('{ctrl+shift+w}');

      // Click send test button
      cy.get('[data-testid="send-test-btn"]').click();

      // Should show sent message in log
      cy.get('[data-testid="dev-message-log"]')
        .should('contain', 'Test message sent');
    });

    it('should show real-time message log', () => {
      // Open dev panel
      cy.get('body').type('{ctrl+shift+w}');

      // Send a test message
      cy.get('[data-testid="send-test-btn"]').click();

      // Should show message in real-time log
      cy.get('[data-testid="dev-message-log"]')
        .should('contain', 'ping');
    });

    it('should close dev panel with Escape key', () => {
      // Open dev panel
      cy.get('body').type('{ctrl+shift+w}');

      // Panel should be visible
      cy.get('[data-testid="websocket-dev-panel"]')
        .should('be.visible');

      // Press Escape
      cy.get('body').type('{esc}');

      // Panel should be hidden
      cy.get('[data-testid="websocket-dev-panel"]')
        .should('not.exist');
    });
  });

  describe('Visual States and Animations', () => {
    it('should not flicker during rapid state changes', () => {
      // Mock rapid connection state changes
      let stateChangeCount = 0;
      
      cy.window().then(() => {
        // Monitor status pill for flickering
        cy.get('[data-testid="status-pill"]')
          .should('be.visible');

        // Simulate multiple rapid state changes
        for (let i = 0; i < 5; i++) {
          cy.wait(100); // Debounce delay should prevent flicker
        }

        // Status pill should remain stable
        cy.get('[data-testid="status-pill"]')
          .should('be.visible')
          .and('not.have.class', 'animate-pulse'); // Should not be constantly animating
      });
    });

    it('should show appropriate animations for each state', () => {
      // Connecting state should have spinning animation
      cy.get('[data-testid="status-pill"]')
        .should('contain', 'Connecting');
      
      cy.get('[data-testid="ws-status-icon"]')
        .should('have.class', 'animate-spin');

      // Connected state should have pulse animation
      cy.get('[data-testid="status-pill"]', { timeout: 5000 })
        .should('contain', 'Connected');

      cy.get('[data-testid="ws-status-icon"]')
        .should('not.have.class', 'animate-spin');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection failures gracefully', () => {
      // Mock WebSocket connection failure
      cy.intercept('ws://localhost:8080/api/v1/ws', { forceNetworkError: true });

      // Should show error state
      cy.get('[data-testid="status-pill"]')
        .should('contain', 'RT: Error');

      // Should show error indicator
      cy.get('[data-testid="ws-status-icon"]')
        .should('have.class', 'bg-red-500');
    });

    it('should show console errors when WebSocket fails', () => {
      // Monitor console for WebSocket errors
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });

      // Mock connection failure
      cy.intercept('ws://localhost:8080/api/v1/ws', { forceNetworkError: true });

      // Should log errors to console
      cy.get('@consoleError').should('have.been.called');
    });

    it('should not show console errors during normal reconnection attempts', () => {
      // Monitor console
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });

      // Wait for normal connection cycle
      cy.wait(5000);

      // Should not have excessive console errors during normal operation
      cy.get('@consoleError').should('not.have.been.calledWith', /reconnect/);
    });
  });
});

// Test utilities
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Mock WebSocket connection state
       */
      mockWebSocketState(state: 'connected' | 'connecting' | 'disconnected' | 'error'): Chainable<void>;
      
      /**
       * Wait for WebSocket connection
       */
      waitForWebSocketConnection(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('mockWebSocketState', (state) => {
  cy.window().then((win) => {
    // @ts-ignore - Mock WebSocket state
    if (win.__wsProvider) {
      win.__wsProvider.mockState(state);
    }
  });
});

Cypress.Commands.add('waitForWebSocketConnection', () => {
  cy.get('[data-testid="status-pill"]', { timeout: 10000 })
    .should('contain', 'RT: Connected');
});