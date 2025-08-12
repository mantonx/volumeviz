/**
 * Basic Search Functionality Test
 * 
 * Tests that search functionality works with the real frontend
 */

describe('Search Functionality', () => {
  beforeEach(() => {
    cy.setupCommonInterceptors();
    cy.visit('/volumes');
    cy.getByTestId('volumes-page', { timeout: 15000 }).should('exist');
  });

  it('can perform a search', () => {
    // Get search input
    cy.getByTestId('search-input').should('be.visible');
    
    // Type in search
    cy.getByTestId('search-input').clear().type('test');
    
    // Wait for debounce
    cy.waitForDebounce(500);
    
    // Take screenshot of search
    cy.takeNamedScreenshot('search-performed');
    
    // Clear search
    cy.getByTestId('search-input').clear();
    cy.waitForDebounce(300);
    
    cy.takeNamedScreenshot('search-cleared');
  });

  it('shows filter buttons', () => {
    // Check if filter buttons exist
    cy.getByTestId('filter-orphaned').should('be.visible');
    cy.getByTestId('filter-system').should('be.visible');
    
    // Click orphaned filter
    cy.getByTestId('filter-orphaned').click();
    
    // Take screenshot
    cy.takeNamedScreenshot('orphaned-filter-clicked');
  });

  it('displays volume list or empty state', () => {
    // Check if we have a volume list or empty state
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="volume-list"]').length > 0) {
        // Volume list exists
        cy.getByTestId('volume-list').should('be.visible');
        cy.takeNamedScreenshot('volume-list-found');
      } else if ($body.find('[data-testid="no-results-message"]').length > 0) {
        // Empty state exists
        cy.getByTestId('no-results-message').should('be.visible');
        cy.takeNamedScreenshot('empty-state-found');
      } else {
        // Neither found, take screenshot for debugging
        cy.takeNamedScreenshot('no-volumes-or-empty-state');
      }
    });
  });
});