// Import Cypress commands
import './commands';
import './websocket-commands';

// Import global type definitions
import './types';

// Cypress configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore specific errors that don't affect test validity
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('Non-Error promise rejection captured') ||
    err.message.includes('ChunkLoadError')
  ) {
    return false;
  }
  
  // Don't fail on unhandled promise rejections in dev mode
  if (err.message.includes('Uncaught (in promise)') && Cypress.env('NODE_ENV') === 'development') {
    return false;
  }
  
  return true;
});

// Global before hook
beforeEach(() => {
  // Set up viewport
  cy.viewport(1280, 720);
  
  // Clear localStorage and sessionStorage
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();
  
  // Clear cookies
  cy.clearCookies();
  
  // Set up common interceptors
  cy.setupCommonInterceptors();
});

// Global after hook
afterEach(() => {
  // Clean up any test artifacts
  cy.window().then((win) => {
    // Clean up WebSocket connections
    if (win.__TEST_WS__) {
      win.__TEST_WS__.cleanup?.();
    }
    
    // Clean up any global test state
    delete win.__TEST_WS__;
    delete win.__TEST_DATA__;
  });
});

// Configure Cypress to handle modern web APIs
Cypress.on('window:before:load', (win) => {
  // Stub console methods to reduce noise in test output
  cy.stub(win.console, 'log').as('consoleLog');
  cy.stub(win.console, 'warn').as('consoleWarn');
  cy.stub(win.console, 'error').as('consoleError');
});

// Add custom assertions
chai.use((chai, utils) => {
  // Add custom assertion for WebSocket state
  chai.Assertion.addMethod('webSocketState', function(expectedState) {
    const obj = this._obj;
    const actualState = obj.status || obj;
    
    this.assert(
      actualState === expectedState,
      `expected WebSocket state to be ${expectedState} but got ${actualState}`,
      `expected WebSocket state not to be ${expectedState}`,
      expectedState,
      actualState
    );
  });
  
  // Add custom assertion for API response structure
  chai.Assertion.addMethod('validApiResponse', function() {
    const obj = this._obj;
    
    this.assert(
      obj && typeof obj === 'object' && ('data' in obj || 'error' in obj),
      'expected valid API response structure with data or error property',
      'expected invalid API response structure',
      { data: 'any', error: 'any' },
      obj
    );
  });
});

// Global error handling
Cypress.on('fail', (error, runnable) => {
  // Log additional context on test failure
  cy.window().then((win) => {
    console.log('Test failure context:', {
      url: win.location.href,
      userAgent: win.navigator.userAgent,
      webSocketState: win.__TEST_WS__?.getState?.(),
      timestamp: new Date().toISOString(),
    });
  });
  
  throw error;
});