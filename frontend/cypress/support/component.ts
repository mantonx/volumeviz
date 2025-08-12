// Import Cypress component testing support
import { mount } from 'cypress/react18';

// Import custom commands from e2e support
import './commands';
import './types';

// Add mount command to Cypress
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);

// Component testing configuration
beforeEach(() => {
  // Set up test environment for component tests
  cy.window().then((win) => {
    win.__TEST_MODE__ = true;
  });
});

// Handle uncaught exceptions in component tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore specific component testing errors
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('Non-Error promise rejection captured')
  ) {
    return false;
  }
  
  return true;
});