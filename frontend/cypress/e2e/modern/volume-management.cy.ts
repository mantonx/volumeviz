/**
 * End-to-end tests for volume management flows
 * Tests real user interactions with the VolumeViz application
 */

describe('Volume Management E2E', () => {
  beforeEach(() => {
    // Visit the volumes page
    cy.visit('/volumes');
    
    // Wait for initial data load
    cy.get('[data-testid="volume-list"]').should('be.visible');
  });

  describe('Volume Discovery', () => {
    it('should display all volumes on initial load', () => {
      // Verify volumes are displayed
      cy.get('[data-testid="volume-card"]').should('have.length.at.least', 1);
      
      // Verify volume information is shown
      cy.get('[data-testid="volume-card"]').first().within(() => {
        cy.get('[data-testid="volume-name"]').should('be.visible');
        cy.get('[data-testid="volume-size"]').should('be.visible');
        cy.get('[data-testid="volume-status"]').should('be.visible');
      });
    });

    it('should search and filter volumes', () => {
      // Type in search box
      cy.get('[data-testid="search-input"]').type('production');
      
      // Verify filtered results
      cy.get('[data-testid="volume-card"]').should('have.length', 1);
      cy.get('[data-testid="volume-name"]').should('contain', 'production');
      
      // Clear search
      cy.get('[data-testid="search-input"]').clear();
      
      // Verify all volumes are shown again
      cy.get('[data-testid="volume-card"]').should('have.length.at.least', 2);
    });

    it('should filter orphaned volumes', () => {
      // Click filter dropdown
      cy.get('[data-testid="filter-button"]').click();
      
      // Select orphaned filter
      cy.get('[data-testid="filter-orphaned"]').click();
      
      // Verify only orphaned volumes are shown
      cy.get('[data-testid="volume-card"]').each(($card) => {
        cy.wrap($card).find('[data-testid="orphaned-badge"]').should('be.visible');
      });
    });

    it('should sort volumes by size', () => {
      // Click sort dropdown
      cy.get('[data-testid="sort-button"]').click();
      
      // Select size sorting
      cy.get('[data-testid="sort-size-desc"]').click();
      
      // Get all volume sizes and verify they're sorted
      const sizes: number[] = [];
      cy.get('[data-testid="volume-size"]').each(($size) => {
        const sizeText = $size.text();
        const sizeValue = parseFloat(sizeText.replace(/[^0-9.]/g, ''));
        sizes.push(sizeValue);
      }).then(() => {
        // Verify descending order
        for (let i = 1; i < sizes.length; i++) {
          expect(sizes[i]).to.be.lte(sizes[i - 1]);
        }
      });
    });
  });

  describe('Volume Scanning', () => {
    it('should scan a single volume', () => {
      // Find first volume and click scan button
      cy.get('[data-testid="volume-card"]').first().within(() => {
        cy.get('[data-testid="scan-button"]').click();
      });
      
      // Verify scan progress indicator
      cy.get('[data-testid="scan-progress"]').should('be.visible');
      cy.get('[data-testid="scan-status"]').should('contain', 'Scanning');
      
      // Wait for scan to complete (mocked to be fast)
      cy.get('[data-testid="scan-status"]', { timeout: 10000 })
        .should('contain', 'Completed');
      
      // Verify updated timestamp
      cy.get('[data-testid="last-scan-time"]').should('contain', 'Just now');
    });

    it('should perform bulk scan', () => {
      // Select multiple volumes
      cy.get('[data-testid="volume-checkbox"]').eq(0).check();
      cy.get('[data-testid="volume-checkbox"]').eq(1).check();
      cy.get('[data-testid="volume-checkbox"]').eq(2).check();
      
      // Verify bulk actions bar appears
      cy.get('[data-testid="bulk-actions-bar"]').should('be.visible');
      cy.get('[data-testid="selected-count"]').should('contain', '3 selected');
      
      // Click bulk scan button
      cy.get('[data-testid="bulk-scan-button"]').click();
      
      // Confirm bulk operation
      cy.get('[data-testid="confirm-dialog"]').should('be.visible');
      cy.get('[data-testid="confirm-button"]').click();
      
      // Verify bulk scan progress
      cy.get('[data-testid="bulk-scan-progress"]').should('be.visible');
      cy.get('[data-testid="bulk-scan-status"]').should('contain', 'Scanning 3 volumes');
      
      // Wait for completion
      cy.get('[data-testid="bulk-scan-status"]', { timeout: 15000 })
        .should('contain', 'Completed');
    });

    it('should handle scan errors gracefully', () => {
      // Intercept scan request to simulate error
      cy.intercept('POST', '/api/v1/volumes/*/scan', {
        statusCode: 500,
        body: { error: 'Volume is busy' }
      }).as('scanError');
      
      // Attempt to scan
      cy.get('[data-testid="volume-card"]').first().within(() => {
        cy.get('[data-testid="scan-button"]').click();
      });
      
      // Wait for error response
      cy.wait('@scanError');
      
      // Verify error message
      cy.get('[data-testid="error-toast"]').should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain', 'Volume is busy');
      
      // Verify retry option
      cy.get('[data-testid="retry-button"]').should('be.visible');
    });
  });

  describe('Volume Details', () => {
    it('should navigate to volume details', () => {
      // Click on volume name
      cy.get('[data-testid="volume-name"]').first().click();
      
      // Verify navigation to details page
      cy.url().should('include', '/volumes/');
      
      // Verify details page content
      cy.get('[data-testid="volume-details-header"]').should('be.visible');
      cy.get('[data-testid="volume-info-panel"]').should('be.visible');
      cy.get('[data-testid="volume-stats-panel"]').should('be.visible');
    });

    it('should browse volume files', () => {
      // Navigate to volume details
      cy.get('[data-testid="volume-name"]').first().click();
      
      // Click on Files tab
      cy.get('[data-testid="files-tab"]').click();
      
      // Verify file browser is shown
      cy.get('[data-testid="file-browser"]').should('be.visible');
      cy.get('[data-testid="file-list"]').should('be.visible');
      
      // Navigate into a directory
      cy.get('[data-testid="directory-item"]').first().dblclick();
      
      // Verify breadcrumbs update
      cy.get('[data-testid="breadcrumbs"]').should('contain', '/');
      
      // Navigate back using breadcrumbs
      cy.get('[data-testid="breadcrumb-root"]').click();
      cy.get('[data-testid="file-list"]').should('be.visible');
    });

    it('should display volume statistics', () => {
      // Navigate to volume details
      cy.get('[data-testid="volume-name"]').first().click();
      
      // Click on Statistics tab
      cy.get('[data-testid="stats-tab"]').click();
      
      // Verify charts are displayed
      cy.get('[data-testid="size-chart"]').should('be.visible');
      cy.get('[data-testid="growth-chart"]').should('be.visible');
      cy.get('[data-testid="file-type-chart"]').should('be.visible');
      
      // Verify time range selector
      cy.get('[data-testid="time-range-selector"]').should('be.visible');
      
      // Change time range
      cy.get('[data-testid="time-range-selector"]').select('7d');
      
      // Verify charts update (check for loading indicator)
      cy.get('[data-testid="chart-loading"]').should('be.visible');
      cy.get('[data-testid="chart-loading"]').should('not.exist');
    });
  });

  describe('Real-time Updates', () => {
    it('should receive real-time scan progress updates', () => {
      // Start a scan
      cy.get('[data-testid="volume-card"]').first().within(() => {
        cy.get('[data-testid="scan-button"]').click();
      });
      
      // Verify initial progress
      cy.get('[data-testid="scan-progress-bar"]').should('be.visible');
      
      // Verify progress updates (should see multiple different values)
      const progressValues = new Set();
      
      cy.get('[data-testid="scan-progress-value"]')
        .should(($el) => {
          progressValues.add($el.text());
        });
      
      // Wait and check again
      cy.wait(1000);
      
      cy.get('[data-testid="scan-progress-value"]')
        .should(($el) => {
          progressValues.add($el.text());
          // Should have seen at least 2 different progress values
          expect(progressValues.size).to.be.at.least(2);
        });
    });

    it('should update volume list when new volume is added', () => {
      // Get initial volume count
      cy.get('[data-testid="volume-card"]').then(($cards) => {
        const initialCount = $cards.length;
        
        // Simulate new volume event (in real app, this would come from WebSocket)
        cy.window().then((win) => {
          win.postMessage({
            type: 'volume_added',
            data: {
              name: 'new-test-volume',
              size_bytes: 1048576
            }
          }, '*');
        });
        
        // Verify new volume appears
        cy.get('[data-testid="volume-card"]')
          .should('have.length', initialCount + 1);
        
        cy.get('[data-testid="volume-name"]')
          .should('contain', 'new-test-volume');
      });
    });
  });

  describe('Organization Context', () => {
    it('should switch between organizations', () => {
      // Open organization selector
      cy.get('[data-testid="org-selector"]').click();
      
      // Verify organizations are listed
      cy.get('[data-testid="org-option"]').should('have.length.at.least', 1);
      
      // Select different organization
      cy.get('[data-testid="org-option"]').eq(1).click();
      
      // Verify volumes reload for new org
      cy.get('[data-testid="loading-spinner"]').should('be.visible');
      cy.get('[data-testid="loading-spinner"]').should('not.exist');
      
      // Verify org name is updated
      cy.get('[data-testid="current-org-name"]').should('not.contain', 'Demo Organization');
    });

    it('should display organization statistics', () => {
      // Verify org stats panel
      cy.get('[data-testid="org-stats-panel"]').should('be.visible');
      
      // Verify stats are displayed
      cy.get('[data-testid="total-volumes-stat"]').should('be.visible');
      cy.get('[data-testid="total-size-stat"]').should('be.visible');
      cy.get('[data-testid="active-users-stat"]').should('be.visible');
      
      // Click on stats for details
      cy.get('[data-testid="total-volumes-stat"]').click();
      
      // Verify modal with details
      cy.get('[data-testid="stats-detail-modal"]').should('be.visible');
      cy.get('[data-testid="close-modal"]').click();
    });
  });

  describe('Offline Support', () => {
    it('should work offline with cached data', () => {
      // Load page normally first
      cy.get('[data-testid="volume-list"]').should('be.visible');
      
      // Go offline
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false);
      });
      
      // Trigger offline event
      cy.window().trigger('offline');
      
      // Verify offline indicator
      cy.get('[data-testid="offline-indicator"]').should('be.visible');
      
      // Verify cached data is still displayed
      cy.get('[data-testid="volume-card"]').should('have.length.at.least', 1);
      
      // Try to perform an action
      cy.get('[data-testid="scan-button"]').first().click();
      
      // Verify offline message
      cy.get('[data-testid="offline-toast"]').should('be.visible');
      cy.get('[data-testid="offline-message"]').should('contain', 'Operation queued');
      
      // Go back online
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(true);
      });
      cy.window().trigger('online');
      
      // Verify sync starts
      cy.get('[data-testid="sync-indicator"]').should('be.visible');
      cy.get('[data-testid="sync-status"]').should('contain', 'Syncing');
      
      // Verify sync completes
      cy.get('[data-testid="sync-status"]', { timeout: 5000 })
        .should('contain', 'Synced');
    });
  });

  describe('Performance', () => {
    it('should load volumes list quickly', () => {
      // Measure page load time
      cy.visit('/volumes', {
        onBeforeLoad: (win) => {
          win.performance.mark('pageStart');
        },
        onLoad: (win) => {
          win.performance.mark('pageEnd');
          win.performance.measure('pageLoad', 'pageStart', 'pageEnd');
        }
      });
      
      // Verify performance
      cy.window().then((win) => {
        const measure = win.performance.getEntriesByName('pageLoad')[0];
        expect(measure.duration).to.be.lessThan(3000); // Less than 3 seconds
      });
    });

    it('should handle large volume lists efficiently', () => {
      // Mock large dataset
      cy.intercept('GET', '/api/v1/volumes*', {
        fixture: 'large-volume-list.json' // 1000+ volumes
      }).as('largeList');
      
      cy.visit('/volumes');
      cy.wait('@largeList');
      
      // Verify virtualization is working
      cy.get('[data-testid="volume-list"]').should('be.visible');
      
      // Check only visible items are rendered
      cy.get('[data-testid="volume-card"]').should('have.length.lessThan', 50);
      
      // Scroll to bottom
      cy.get('[data-testid="volume-list"]').scrollTo('bottom');
      
      // Verify more items are loaded
      cy.get('[data-testid="volume-card"]').should('have.length.greaterThan', 20);
    });
  });
});