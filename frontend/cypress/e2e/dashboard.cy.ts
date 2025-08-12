/// <reference types="cypress" />
/**
 * Dashboard E2E Tests
 *
 * Tests core dashboard functionality including loading states,
 * status pills, and WebSocket integration.
 */

describe('Dashboard', () => {
  beforeEach(() => {
    // Set up test environment
    cy.setupCommonInterceptors();

    // Mock basic volume data
    cy.mockVolumeData();

    // Mock system info
    cy.intercept('GET', '/api/v1/system*', {
      fixture: 'api-responses.json',
      statusCode: 200
    }).as('systemInfo');
  });

  describe('Page Loading', () => {
    it('loads successfully with API-only mode', () => {
      // Disable WebSocket for this test
      cy.visitPage('/', {
        onBeforeLoad: (win) => {
          win.__TEST_MODE__ = true;
          // Don't set up WebSocket shim
        }
      });

      // Check that app loads
      cy.getByTestId('app-root').should('be.visible');

      // Check API calls were made
      cy.wait('@healthCheck');
      cy.wait('@volumesListMocked');
      cy.wait('@systemInfo');

      // Check status pill shows API-only mode
      cy.checkStatusPill({
        api: 'OK',
        hasWebSocket: false
      });

      // Take screenshot for visual verification
      cy.takeNamedScreenshot('dashboard-loaded-api-only');
    });

    it('loads successfully with WebSocket enabled', () => {
      // Set up WebSocket shim
      cy.visitPage('/', {
        onBeforeLoad: (win) => {
          win.__TEST_MODE__ = true;
          cy.setupWebSocketShim({ autoConnect: true });
        }
      });

      // Wait for WebSocket connection
      cy.waitForWebSocketConnection();

      // Check that app loads
      cy.getByTestId('app-root').should('be.visible');

      // Check status pill shows WebSocket mode
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Connected',
        hasWebSocket: true
      });

      // Take screenshot
      cy.takeNamedScreenshot('dashboard-loaded-with-websocket');
    });

    it('handles API errors gracefully', () => {
      // Mock API health as error
      cy.mockApiHealth('error');

      cy.visitPage('/');

      // Check error state is displayed
      cy.checkStatusPill({
        api: 'Error',
        hasWebSocket: false
      });

      // Check that error boundary or error state is shown
      cy.getByTestId('error-state').should('be.visible');

      cy.takeNamedScreenshot('dashboard-api-error');
    });
  });

  describe('Status Pills', () => {
    it('shows correct status pill states', () => {
      cy.visitPage('/');

      // Initially should show API OK
      cy.checkStatusPill({ api: 'OK', hasWebSocket: false });

      // Mock API going offline
      cy.mockApiHealth('offline');

      // Trigger health check again
      cy.window().then((win) => {
        // Simulate health check interval
        win.fetch('/api/v1/health').catch(() => {});
      });

      cy.wait(1000); // Wait for health check debouncing

      // Should now show error
      cy.checkStatusPill({ api: 'Error', hasWebSocket: false });
    });

    it('shows WebSocket connection states', () => {
      cy.setupWebSocketShim({ autoConnect: false });
      cy.visitPage('/');

      // Initially disconnected
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Disconnected',
        hasWebSocket: true
      });

      // Start connecting
      cy.window().then((win) => {
        win.__TEST_WS__?.connect();
      });

      // Should show connecting state
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Connecting',
        hasWebSocket: true
      });

      // Wait for connection
      cy.waitForWebSocketConnection();

      // Should show connected state
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Connected',
        hasWebSocket: true
      });

      // Simulate disconnect
      cy.disconnectWebSocket();

      // Should show disconnected state
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Disconnected',
        hasWebSocket: true
      });
    });

    it('handles WebSocket reconnection', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');

      cy.waitForWebSocketConnection();

      // Simulate connection failure and reconnection
      cy.simulateWebSocketReconnection({
        disconnectDuration: 1000,
        maxAttempts: 3
      });

      // Should show reconnecting state
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Reconnecting',
        hasWebSocket: true
      });

      // Should eventually reconnect
      cy.waitForWebSocketConnection();

      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Connected',
        hasWebSocket: true
      });
    });
  });

  describe('WebSocket Dev Panel', () => {
    it('opens dev panel with Ctrl+Shift+W', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');

      // Open dev panel with keyboard shortcut
      cy.get('body').type('{ctrl+shift+w}');

      // Dev panel should be visible
      cy.getByTestId('websocket-dev-panel').should('be.visible');

      // Should show connection info
      cy.getByTestId('connection-status').should('contain', 'Connected');

      // Should have send message functionality
      cy.getByTestId('send-message-button').should('be.visible');

      // Close panel
      cy.getByTestId('dev-panel-close').click();
      cy.getByTestId('websocket-dev-panel').should('not.exist');
    });

    it('sends test messages through dev panel', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');

      cy.waitForWebSocketConnection();

      // Open dev panel
      cy.get('body').type('{ctrl+shift+w}');

      // Send ping message
      cy.getByTestId('send-ping-button').click();

      // Check message log shows ping sent
      cy.getByTestId('message-log')
        .should('contain', 'ping')
        .and('contain', 'Sent');

      // Send custom message
      cy.getByTestId('custom-message-input')
        .type('{"test": "message"}');

      cy.getByTestId('send-custom-button').click();

      // Check custom message appears in log
      cy.getByTestId('message-log')
        .should('contain', 'test')
        .and('contain', 'message');
    });
  });

  describe('Real-time Updates', () => {
    it('receives and displays volume updates', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');

      cy.waitForWebSocketConnection();

      // Wait for initial load
      cy.wait('@volumesListMocked');

      // Emit volume update event
      cy.emitWebSocketEvent('volume_update', {
        volume_id: 'new-volume',
        volume_name: 'test-volume-new',
        action: 'created',
        details: {
          driver: 'local',
          size_bytes: 1024000
        }
      });

      // Wait for UI to update
      cy.waitForAnimation('[data-testid="volume-list"]', 500);

      // Check that new volume appears (or update indicator)
      cy.getByTestId('volumes-page').should('contain', 'test-volume-new');

      // Take screenshot of updated state
      cy.takeNamedScreenshot('dashboard-volume-update-received');
    });

    it('handles scan progress updates', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');

      cy.waitForWebSocketConnection();

      // Start a mock scan
      cy.mockScanOperation('test-volume-1', {
        duration: 2000,
        finalSize: 2048000,
        shouldFail: false
      });

      // Trigger scan start (this would normally be done via UI)
      cy.window().then((win) => {
        fetch('/api/v1/volumes/test-volume-1/scan', { method: 'POST' });
      });

      // Wait for scan progress events
      cy.waitForWebSocketEvent('scan_progress', 10000);

      // Check progress indicator appears
      cy.getByTestId('scan-progress').should('be.visible');

      // Wait for scan completion
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Check completion state
      cy.getByTestId('scan-complete-indicator').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors', () => {
      cy.setupWebSocketShim({ autoConnect: false });
      cy.visitPage('/');

      // Simulate connection error
      cy.window().then((win) => {
        win.__TEST_WS__?.simulateError('Connection refused');
      });

      // Should show error state
      cy.checkStatusPill({
        api: 'OK',
        websocket: 'Error',
        hasWebSocket: true
      });
    });

    it('continues working when WebSocket is disabled', () => {
      // Visit without WebSocket
      cy.visitPage('/', {
        onBeforeLoad: (win) => {
          win.__TEST_MODE__ = true;
          // Explicitly no WebSocket setup
        }
      });

      // App should still function
      cy.getByTestId('app-root').should('be.visible');
      cy.wait('@volumesListMocked');

      // Status should show API-only mode
      cy.checkStatusPill({
        api: 'OK',
        hasWebSocket: false
      });

      // Core functionality should work
      cy.getByTestId('volumes-page').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('works on mobile viewports', () => {
      cy.viewport('iphone-x');
      cy.visitPage('/');

      // Check mobile layout
      cy.getByTestId('app-root').should('be.visible');
      cy.getByTestId('status-pill').should('be.visible');

      // Take mobile screenshot
      cy.takeNamedScreenshot('dashboard-mobile');
    });

    it('works on tablet viewports', () => {
      cy.viewport('ipad-2');
      cy.visitPage('/');

      // Check tablet layout
      cy.getByTestId('app-root').should('be.visible');

      // Take tablet screenshot
      cy.takeNamedScreenshot('dashboard-tablet');
    });
  });
});
