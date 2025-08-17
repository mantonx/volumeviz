
describe('Volumes List + Scan Flow', () => {
  beforeEach(() => {
    // Mock API responses
    cy.intercept('GET', '/api/volumes*', {
      fixture: 'volumes.json',
    }).as('getVolumes');

    cy.intercept('POST', '/api/volumes/*/scan', {
      statusCode: 200,
      body: {
        scan_id: 'scan-123',
        volume_id: 'vol-123',
        status: 'pending',
        started_at: new Date().toISOString(),
      },
    }).as('startScan');

    cy.intercept('GET', '/api/scans/*/status', (req) => {
      const scanId = req.url.split('/')[4];
      cy.fixture('scan-status.json').then((statuses) => {
        req.reply(statuses[scanId] || statuses.default);
      });
    }).as('getScanStatus');

    cy.intercept('POST', '/api/scans/*/cancel', {
      statusCode: 200,
      body: { message: 'Scan cancelled' },
    }).as('cancelScan');

    cy.visit('/volumes');
  });

  describe('Volume List Display', () => {
    it('displays volume list correctly', () => {
      cy.wait('@getVolumes');

      // Check page header
      cy.contains('h1', 'Volume Management').should('be.visible');
      cy.contains('Manage Docker volumes, run scans').should('be.visible');

      // Check table headers
      cy.contains('th', 'Name').should('be.visible');
      cy.contains('th', 'Driver').should('be.visible');
      cy.contains('th', 'Status').should('be.visible');
      cy.contains('th', 'Mount Point').should('be.visible');
      cy.contains('th', 'Created').should('be.visible');
      cy.contains('th', 'Scan Status').should('be.visible');
      cy.contains('th', 'Actions').should('be.visible');

      // Check volume rows
      cy.get('tbody tr').should('have.length.greaterThan', 0);
      cy.get('tbody tr').first().should('contain', 'test-volume-1');
    });

    it('shows volume stats correctly', () => {
      cy.wait('@getVolumes');
      cy.contains('5 volumes (3 active, 2 inactive)').should('be.visible');
    });

    it('displays volume badges correctly', () => {
      cy.wait('@getVolumes');

      // Check driver badges
      cy.get('[data-testid="driver-badge"]').should('exist');
      cy.contains('[data-testid="driver-badge"]', 'local').should('be.visible');

      // Check status badges
      cy.get('[data-testid="status-badge"]').should('exist');
      cy.contains('[data-testid="status-badge"]', 'Active').should('be.visible');
    });
  });

  describe('Search and Filtering', () => {
    it('filters volumes by search term', () => {
      cy.wait('@getVolumes');

      // Initial state - all volumes visible
      cy.get('tbody tr').should('have.length', 5);

      // Search for specific volume
      cy.get('input[placeholder="Search volumes..."]').type('test-volume-1');

      // Should show filtered results
      cy.get('tbody tr').should('have.length', 1);
      cy.get('tbody tr').first().should('contain', 'test-volume-1');

      // Clear search
      cy.get('input[placeholder="Search volumes..."]').clear();
      cy.get('tbody tr').should('have.length', 5);
    });

    it('filters volumes by status', () => {
      cy.wait('@getVolumes');

      // Filter by active status
      cy.get('select').eq(0).select('active');
      cy.get('tbody tr').should('have.length', 3);

      // Filter by inactive status
      cy.get('select').eq(0).select('inactive');
      cy.get('tbody tr').should('have.length', 2);

      // Reset filter
      cy.get('select').eq(0).select('all');
      cy.get('tbody tr').should('have.length', 5);
    });

    it('filters volumes by driver', () => {
      cy.wait('@getVolumes');

      // Filter by local driver
      cy.get('select').eq(1).select('local');
      cy.get('tbody tr').should('have.length.greaterThan', 0);

      // Reset filter
      cy.get('select').eq(1).select('all');
      cy.get('tbody tr').should('have.length', 5);
    });

    it('clears all filters with clear button', () => {
      cy.wait('@getVolumes');

      // Apply multiple filters
      cy.get('input[placeholder="Search volumes..."]').type('test');
      cy.get('select').eq(0).select('active');

      // Clear filters button should appear
      cy.contains('button', 'Clear').should('be.visible').click();

      // All filters should be reset
      cy.get('input[placeholder="Search volumes..."]').should('have.value', '');
      cy.get('select').eq(0).should('have.value', 'all');
      cy.get('tbody tr').should('have.length', 5);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      cy.wait('@getVolumes');
    });

    it('sorts volumes by name', () => {
      // Click name header to sort
      cy.contains('button', 'Name').click();

      // Should show sort indicator
      cy.contains('button', 'Name').within(() => {
        cy.get('svg').should('exist'); // Sort icon
      });

      // Click again to reverse sort
      cy.contains('button', 'Name').click();

      // Sort icon should change direction
      cy.contains('button', 'Name').within(() => {
        cy.get('svg').should('exist');
      });
    });

    it('sorts volumes by driver', () => {
      cy.contains('button', 'Driver').click();
      cy.contains('button', 'Driver').within(() => {
        cy.get('svg').should('exist');
      });
    });

    it('sorts volumes by created date', () => {
      cy.contains('button', 'Created').click();
      cy.contains('button', 'Created').within(() => {
        cy.get('svg').should('exist');
      });
    });
  });

  describe('Scan Flow - Happy Path', () => {
    it('starts a scan successfully', () => {
      cy.wait('@getVolumes');

      // Find scan button for first volume
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').click();
        });

      cy.wait('@startScan');

      // Should show scan is pending/running
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('Pending...').should('be.visible');
          cy.contains('button', 'Cancel').should('be.visible');
        });
    });

    it('shows scan progress updates', () => {
      cy.wait('@getVolumes');

      // Mock progressive scan status updates
      let callCount = 0;
      cy.intercept('GET', '/api/scans/*/status', (req) => {
        callCount++;
        const responses = [
          { status: 'pending', progress: 0 },
          { status: 'running', progress: 25 },
          { status: 'running', progress: 50 },
          { status: 'running', progress: 75 },
          { status: 'completed', progress: 100, result: { total_size: 1024000 } },
        ];
        req.reply(responses[Math.min(callCount - 1, responses.length - 1)]);
      }).as('getScanStatusProgressive');

      // Start scan
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').click();
        });

      cy.wait('@startScan');

      // Should eventually show completion
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('Complete', { timeout: 10000 }).should('be.visible');
        });
    });

    it('cancels a running scan', () => {
      cy.wait('@getVolumes');

      // Start scan first
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').click();
        });

      cy.wait('@startScan');

      // Cancel the scan
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Cancel').click();
        });

      cy.wait('@cancelScan');

      // Should return to idle state
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').should('be.visible');
        });
    });
  });

  describe('Scan Flow - Error Cases', () => {
    it('handles scan start failure', () => {
      cy.intercept('POST', '/api/volumes/*/scan', {
        statusCode: 500,
        body: { error: 'Failed to start scan' },
      }).as('startScanError');

      cy.wait('@getVolumes');

      // Try to start scan
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').click();
        });

      cy.wait('@startScanError');

      // Should show error state
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('Error').should('be.visible');
        });
    });

    it('handles scan status polling failure', () => {
      cy.wait('@getVolumes');

      // Start scan successfully
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').click();
        });

      cy.wait('@startScan');

      // Mock status polling failure
      cy.intercept('GET', '/api/scans/*/status', {
        statusCode: 500,
        body: { error: 'Failed to get scan status' },
      }).as('getScanStatusError');

      // Should eventually show error
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('Error', { timeout: 10000 }).should('be.visible');
        });
    });

    it('handles network offline scenario', () => {
      // Simulate offline by failing all network requests
      cy.intercept('**', { forceNetworkError: true }).as('networkError');

      cy.wait('@getVolumes');

      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Scan').should('be.disabled');
        });
    });
  });

  describe('Volume Actions', () => {
    it('opens volume details', () => {
      cy.wait('@getVolumes');

      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.contains('button', 'Open').click();
        });

      // This would typically navigate or open a modal
      // Implementation depends on the onVolumeSelect callback
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile viewport', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.wait('@getVolumes');

      // Table should scroll horizontally on mobile
      cy.get('.overflow-x-auto').should('exist');

      // Main content should be visible
      cy.contains('h1', 'Volume Management').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      cy.wait('@getVolumes');

      // Check table has proper structure
      cy.get('table').should('have.attr', 'role', 'table');
      cy.get('th').should('have.attr', 'scope');

      // Check buttons have accessible names
      cy.get('button').each(($btn) => {
        cy.wrap($btn).should('have.attr', 'aria-label').or('contain.text');
      });
    });

    it('supports keyboard navigation', () => {
      cy.wait('@getVolumes');

      // Tab through interactive elements
      cy.get('body').tab();
      cy.focused().should('match', 'input'); // Search input

      cy.tab();
      cy.focused().should('match', 'select'); // Status filter

      cy.tab();
      cy.focused().should('match', 'select'); // Driver filter
    });
  });
});
