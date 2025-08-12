/**
 * Basic Smoke Test
 * 
 * Simple test to verify the application loads and basic elements exist
 */

describe('Basic Smoke Test', () => {
  it('loads the application successfully', () => {
    cy.visit('/');
    
    // Check that the app root exists
    cy.getByTestId('app-root').should('exist');
    
    // Check that the status pill exists
    cy.getByTestId('status-pill').should('be.visible');
    
    // Take a screenshot to verify what we can see
    cy.takeNamedScreenshot('basic-app-loaded');
  });

  it('can access the volumes page', () => {
    cy.visit('/volumes');
    
    // Check if the volumes page loads
    cy.getByTestId('volumes-page', { timeout: 15000 }).should('exist');
    
    // Take a screenshot
    cy.takeNamedScreenshot('volumes-page-loaded');
  });

  it('shows search input on volumes page', () => {
    cy.visit('/volumes');
    
    // Wait for page to load
    cy.getByTestId('volumes-page', { timeout: 15000 }).should('exist');
    
    // Check if search input exists
    cy.getByTestId('search-input').should('be.visible');
    
    // Try typing in search
    cy.getByTestId('search-input').type('test');
    
    cy.takeNamedScreenshot('search-input-test');
  });
});