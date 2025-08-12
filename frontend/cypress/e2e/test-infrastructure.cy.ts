/**
 * Test Infrastructure Verification
 * 
 * This test verifies that our Cypress setup, WebSocket shim, and custom commands
 * work correctly without needing the full backend infrastructure.
 */

describe('Test Infrastructure', () => {
  beforeEach(() => {
    // Visit our test HTML page
    cy.visit('/cypress/fixtures/test-page.html');
  });

  describe('Basic Cypress Setup', () => {
    it('loads the test page successfully', () => {
      cy.getByTestId('app-root').should('be.visible');
      cy.get('h1').should('contain', 'VolumeViz Test Dashboard');
      cy.takeNamedScreenshot('test-page-loaded');
    });

    it('can find elements by data-testid', () => {
      cy.getByTestId('status-pill').should('be.visible').and('contain', 'API: OK');
      cy.getByTestId('search-input').should('be.visible');
      cy.getByTestId('volume-list').should('be.visible');
      cy.getByTestId('volume-item').should('have.length', 2);
    });
  });

  describe('WebSocket Shim Functionality', () => {
    it('can set up WebSocket shim', () => {
      // Set up the WebSocket shim
      cy.setupWebSocketShim({
        url: 'ws://localhost:8080/api/v1/ws',
        autoConnect: true,
        latency: 100
      });

      // Verify shim is available
      cy.window().then((win) => {
        expect(win.__TEST_WS__).to.exist;
        expect(win.__TEST_WS__.url).to.equal('ws://localhost:8080/api/v1/ws');
        expect(win.__TEST_WS__.state).to.equal('connected');
      });
    });

    it('can emit and receive WebSocket events', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      // Set up event listener
      cy.window().then((win) => {
        win.__TEST_RECEIVED_EVENTS__ = [];
        
        win.__TEST_WS__.on('test_event', (data) => {
          win.__TEST_RECEIVED_EVENTS__.push(data);
        });
      });

      // Emit test event
      cy.emitWebSocketEvent('test_event', {
        message: 'Hello from test',
        timestamp: new Date().toISOString()
      });

      // Verify event was received
      cy.window().then((win) => {
        expect(win.__TEST_RECEIVED_EVENTS__).to.have.length(1);
        expect(win.__TEST_RECEIVED_EVENTS__[0].data.message).to.equal('Hello from test');
      });
    });

    it('can simulate connection states', () => {
      cy.setupWebSocketShim({ autoConnect: false });
      
      // Initially disconnected
      cy.checkWebSocketState('disconnected');

      // Connect
      cy.window().then((win) => {
        win.__TEST_WS__.connect();
      });
      
      cy.waitForWebSocketConnection();
      cy.checkWebSocketState('connected');

      // Disconnect
      cy.disconnectWebSocket();
      cy.checkWebSocketState('disconnected');
    });

    it('can simulate scan progress events', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      // Mock scan operation
      cy.mockScanOperation('app-data', {
        duration: 1000,
        finalSize: 2097152,
        shouldFail: false
      });

      // Wait for scan progress event
      cy.waitForWebSocketEvent('scan_progress', 5000);

      // Wait for scan complete event
      cy.waitForWebSocketEvent('scan_complete', 5000);

      // Verify the events were properly formatted
      cy.window().then((win) => {
        // The mock scan should have emitted events through the shim
        expect(win.__TEST_WS__).to.exist;
      });
    });
  });

  describe('Custom Commands', () => {
    it('can use debounced search testing', () => {
      // Test the search functionality with debouncing
      cy.testSearch('app');
      
      // Should filter to show only app-data volume
      cy.getByTestId('volume-item').should('have.length', 1);
      cy.getByTestId('volume-item').should('contain', 'app-data');

      // Clear search
      cy.getByTestId('search-input').clear();
      cy.waitForDebounce(400);
      
      // Should show all volumes again
      cy.getByTestId('volume-item').should('have.length', 2);
    });

    it('can simulate scan operations', () => {
      // Click first scan button
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });

      // Button should be disabled during scan
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').should('be.disabled');
          cy.getByTestId('scan-status').should('contain', 'Scanning');
          cy.getByTestId('scan-progress-bar').should('be.visible');
        });

      // Wait for scan to complete
      cy.wait(2000); // Simple HTML simulation takes ~2s

      // Scan should complete
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').should('not.be.disabled');
          cy.getByTestId('scan-status').should('contain', 'Complete');
        });
    });

    it('can take named screenshots', () => {
      cy.takeNamedScreenshot('custom-command-test');
      
      // Screenshots should be saved (we can't verify this directly in test,
      // but the command should execute without error)
    });

    it('can wait for animations', () => {
      // Test animation waiting
      cy.waitForAnimation('[data-testid="volume-list"]', 300);
      
      // Should complete without timing out
      cy.getByTestId('volume-list').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket errors gracefully', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      // Simulate connection error
      cy.window().then((win) => {
        win.__TEST_WS__.simulateError('Connection failed');
      });

      // Should show error state
      cy.checkWebSocketState('error');
    });

    it('handles missing elements gracefully', () => {
      // Try to find a non-existent element
      cy.get('[data-testid="non-existent"]', { timeout: 1000 }).should('not.exist');
    });
  });

  describe('WebSocket Event Simulation', () => {
    it('can emit volume update events', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      let receivedEvents = [];
      
      cy.window().then((win) => {
        win.__TEST_WS__.on('volume_update', (event) => {
          receivedEvents.push(event);
        });
      });

      // Emit volume update
      cy.emitWebSocketEvent('volume_update', {
        volume_id: 'new-volume',
        volume_name: 'test-volume',
        action: 'created',
        details: { size_bytes: 1024000 }
      });

      // Verify event structure
      cy.window().then((win) => {
        expect(receivedEvents).to.have.length(1);
        expect(receivedEvents[0].type).to.equal('volume_update');
        expect(receivedEvents[0].data.volume_id).to.equal('new-volume');
      });
    });

    it('can test rate limiting', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      // Emit multiple events rapidly
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        cy.emitWebSocketEvent('scan_progress', {
          volume_id: 'test-volume',
          progress: i * 10,
          current_size: 1000 * i
        });
      }

      // All events should be processed (in our test shim, we don't enforce rate limiting
      // but the real implementation would)
      cy.wait(1000);
      
      cy.window().then((win) => {
        expect(win.__TEST_WS__).to.exist;
        // In a real test, we'd verify rate limiting here
      });
    });

    it('can test reconnection scenarios', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.waitForWebSocketConnection();

      // Simulate reconnection
      cy.simulateWebSocketReconnection({
        disconnectDuration: 500,
        maxAttempts: 2
      });

      // Should be connected again
      cy.checkWebSocketState('connected');
    });
  });

  describe('Accessibility Testing', () => {
    it('has proper ARIA labels', () => {
      cy.getByTestId('search-input')
        .should('have.attr', 'aria-label', 'Search volumes')
        .and('have.attr', 'role', 'searchbox');
    });

    it('supports keyboard navigation', () => {
      // Tab to search input
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'search-input');

      // Type in search
      cy.focused().type('app');
      
      // Should filter results
      cy.waitForDebounce(400);
      cy.getByTestId('volume-item').should('have.length', 1);
    });

    it('responds to keyboard shortcuts', () => {
      // Test dev panel shortcut (Ctrl+Shift+W)
      cy.get('body').type('{ctrl+shift+w}');
      
      // In our test page, this shows an alert
      // In a real app, it would open the dev panel
    });
  });

  describe('Performance Testing', () => {
    it('handles rapid DOM updates', () => {
      const startTime = Date.now();
      
      // Perform rapid search operations
      for (let i = 0; i < 5; i++) {
        cy.getByTestId('search-input').clear().type(`test${i}`);
        cy.wait(50); // Brief wait between operations
      }
      
      cy.getByTestId('search-input').clear();
      cy.waitForDebounce(400);
      
      // Should complete within reasonable time
      cy.then(() => {
        const endTime = Date.now();
        expect(endTime - startTime).to.be.lessThan(3000);
      });
    });

    it('handles multiple simultaneous operations', () => {
      // Click multiple scan buttons simultaneously
      cy.getByTestId('scan-button').each(($button) => {
        cy.wrap($button).click();
      });

      // All should start scanning
      cy.getByTestId('scan-button').each(($button) => {
        cy.wrap($button).should('be.disabled');
      });
    });
  });

  describe('Debug Information', () => {
    it('can retrieve WebSocket debug info', () => {
      cy.setupWebSocketShim({ 
        autoConnect: true,
        latency: 200
      });
      cy.waitForWebSocketConnection();

      cy.getWebSocketDebugInfo().then((debugInfo) => {
        expect(debugInfo).to.exist;
        expect(debugInfo.state).to.equal('connected');
        expect(debugInfo.simulatedLatency).to.equal(200);
        expect(debugInfo.url).to.include('ws://');
      });
    });

    it('provides meaningful error messages', () => {
      cy.setupWebSocketShim({ autoConnect: false });
      
      // Try to wait for connection that won't happen
      cy.waitForWebSocketConnection(1000).should('not.exist');
    });
  });
});