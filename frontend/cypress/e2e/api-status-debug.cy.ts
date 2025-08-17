/// <reference types="cypress" />

describe('API Status Debug', () => {
  it('should check actual API status on dashboard', () => {
    // Visit the dashboard without any mocks
    cy.visit('http://localhost:5173/');
    
    // Wait for page to load
    cy.wait(3000);
    
    // Take screenshot for debugging
    cy.screenshot('dashboard-initial-load');
    
    // Check if the page loads at all
    cy.get('body').should('exist');
    
    // Look for any text containing "API" or "Status"
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      cy.log('Body contains "API":', bodyText.includes('API'));
      cy.log('Body contains "Status":', bodyText.includes('Status'));
      cy.log('Body contains "Connected":', bodyText.includes('Connected'));
      cy.log('Body contains "Disconnected":', bodyText.includes('Disconnected'));
      
      // Log all text content for debugging
      cy.log('Full body text:', bodyText.substring(0, 500) + '...');
    });
    
    // Check if health endpoint is accessible from frontend context
    cy.request({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/health',
      failOnStatusCode: false
    }).then((response) => {
      cy.log('Health check response status:', response.status);
      cy.log('Health check response body:', JSON.stringify(response.body));
      
      if (response.status === 200) {
        // Backend is healthy, so frontend should show connected
        cy.log('Backend is healthy - frontend should show connected');
      } else {
        cy.log('Backend is not healthy - frontend should show disconnected');
      }
    });
    
    // Look for specific selectors that might contain status
    const statusSelectors = [
      '[data-testid="api-status"]',
      '[data-testid="connection-status"]', 
      '[data-testid="status-pill"]',
      '.api-status',
      '.connection-status',
      '.status-indicator'
    ];
    
    statusSelectors.forEach(selector => {
      cy.get('body').then($body => {
        if ($body.find(selector).length > 0) {
          cy.log(`Found element with selector: ${selector}`);
          cy.get(selector).then($el => {
            cy.log(`Content of ${selector}:`, $el.text());
          });
        } else {
          cy.log(`No element found with selector: ${selector}`);
        }
      });
    });
    
    // Wait longer and check again
    cy.wait(5000);
    cy.screenshot('dashboard-after-wait');
    
    // Check for any status-related text
    cy.contains(/api|status|connect/i, { timeout: 1000 }).should('exist').then($el => {
      cy.log('Found status-related element:', $el.text());
    });
  });
  
  it('should test API health endpoint directly', () => {
    // Test the health endpoint directly
    cy.request('http://localhost:8080/api/v1/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status');
      cy.log('Direct health check successful:', JSON.stringify(response.body));
    });
  });
  
  it('should check network requests from frontend', () => {
    // Intercept all API calls to see what's happening
    cy.intercept('GET', '**/api/v1/**').as('apiCalls');
    
    cy.visit('http://localhost:5173/');
    
    // Wait for any API calls
    cy.wait(5000);
    
    // Check what API calls were made
    cy.get('@apiCalls.all').then((interceptions) => {
      cy.log('Number of API calls made:', interceptions.length);
      
      interceptions.forEach((interception, index) => {
        cy.log(`API call ${index + 1}:`, {
          url: interception.request.url,
          status: interception.response?.statusCode,
          body: interception.response?.body
        });
      });
    });
    
    cy.screenshot('dashboard-with-network-debug');
  });
});