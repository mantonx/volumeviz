describe('WebSocket Real-time Updates Debug', () => {
  beforeEach(() => {
    // Visit the WebSocket test page
    cy.visit('/websocket-test');
  });

  it('should connect to WebSocket and receive scan progress updates', () => {
    // Wait for WebSocket connection
    cy.contains('Provider WebSocket: Connected').should('be.visible');
    
    // Subscribe to scan progress
    cy.get('button').contains('Subscribe (Provider)').click();
    cy.contains('Subscribed: Yes').should('be.visible');
    
    // Also connect raw WebSocket for comparison
    cy.get('button').contains('Connect Raw WebSocket').click();
    cy.contains('Raw WebSocket: Connected', { timeout: 10000 }).should('be.visible');
    
    // Clear any existing messages
    cy.get('button').contains('Clear Messages').click();
    
    // Start a scan
    cy.get('button').contains('Start Test Scan').click();
    
    // Wait for scan to start and check for messages
    cy.get('[data-cy="provider-messages"]').should('contain', 'scan_started', { timeout: 15000 });
    cy.get('[data-cy="raw-messages"]').should('contain', 'scan_started', { timeout: 15000 });
    
    // Check statistics are updating
    cy.contains('Total Received:').should('be.visible');
    cy.contains('Scan Progress:').should('be.visible');
    
    // Wait for progress updates
    cy.wait(5000);
    
    // Verify we're receiving progress updates
    cy.get('[data-cy="scan-progress-count"]').should('not.contain', '0');
    
    // Check both provider and raw messages are being received
    cy.get('[data-cy="provider-messages"] .mb-2').should('have.length.greaterThan', 0);
    cy.get('[data-cy="raw-messages"] .mb-2').should('have.length.greaterThan', 0);
    
    // Log message counts for debugging
    cy.get('[data-cy="scan-progress-count"]').invoke('text').then((text) => {
      cy.log(`Scan Progress Updates: ${text}`);
    });
    
    cy.get('[data-cy="total-received-count"]').invoke('text').then((text) => {
      cy.log(`Total Messages Received: ${text}`);
    });
  });

  it('should handle WebSocket disconnection and reconnection', () => {
    // Connect and subscribe
    cy.contains('Provider WebSocket: Connected').should('be.visible');
    cy.get('button').contains('Subscribe (Provider)').click();
    cy.get('button').contains('Connect Raw WebSocket').click();
    
    // Disconnect raw WebSocket
    cy.get('button').contains('Disconnect Raw WebSocket').click();
    cy.contains('Raw WebSocket: Disconnected').should('be.visible');
    
    // Reconnect
    cy.get('button').contains('Connect Raw WebSocket').click();
    cy.contains('Raw WebSocket: Connected', { timeout: 10000 }).should('be.visible');
    
    // Test that messages still work after reconnection
    cy.get('button').contains('Clear Messages').click();
    cy.get('button').contains('Start Test Scan').click();
    
    cy.get('[data-cy="raw-messages"]').should('contain', 'scan_started', { timeout: 15000 });
  });

  it('should compare provider vs raw WebSocket message reception', () => {
    // Connect both
    cy.contains('Provider WebSocket: Connected').should('be.visible');
    cy.get('button').contains('Subscribe (Provider)').click();
    cy.get('button').contains('Connect Raw WebSocket').click();
    cy.contains('Raw WebSocket: Connected', { timeout: 10000 }).should('be.visible');
    
    cy.get('button').contains('Clear Messages').click();
    cy.get('button').contains('Start Test Scan').click();
    
    // Wait for some messages
    cy.wait(10000);
    
    // Compare message counts
    cy.get('[data-cy="provider-message-count"]').invoke('text').then((providerCount) => {
      cy.get('[data-cy="raw-message-count"]').invoke('text').then((rawCount) => {
        cy.log(`Provider Messages: ${providerCount}, Raw Messages: ${rawCount}`);
        
        // They should be relatively similar
        const providerNum = parseInt(providerCount.replace(/[()]/g, ''));
        const rawNum = parseInt(rawCount.replace(/[()]/g, ''));
        
        // Allow for some difference but they shouldn't be drastically different
        expect(Math.abs(providerNum - rawNum)).to.be.lessThan(5);
      });
    });
  });

  it('should show real-time scan progress in ScanProgressDisplay', () => {
    // Go to volumes page
    cy.visit('/');
    
    // Find the movies volume and trigger a scan
    cy.contains('volumeviz_movies_dev').should('be.visible');
    
    // Look for scan button or progress display
    cy.get('[data-testid="scan-progress-display"]').should('be.visible');
    
    // Start a scan (you might need to adjust this selector)
    cy.get('button[title*="scan"], button[aria-label*="scan"]').first().click();
    
    // Check if progress display shows updates
    cy.get('[data-testid="scan-progress-display"]').should('contain', '%');
    
    // Wait and check for progress updates
    cy.wait(5000);
    cy.get('[data-testid="scan-progress-display"]').should('be.visible');
  });
});