/**
 * E2E tests for Volume Management using modern Orval-generated API
 * Tests complete user workflows for volume operations
 */

describe('Volume Management Workflow (Modern API)', () => {
  beforeEach(() => {
    // Intercept API calls with realistic responses
    cy.intercept('GET', '/api/v1/organizations/me', {
      fixture: 'modern/organization.json'
    }).as('getOrganization');

    cy.intercept('GET', '/api/v1/volumes*', {
      fixture: 'modern/volumes-list.json'
    }).as('getVolumes');

    cy.intercept('POST', '/api/v1/volumes/*/size/refresh', {
      statusCode: 200,
      body: {
        volume_id: 'test-volume',
        size_bytes: 2147483648,
        file_count: 15000,
        last_updated: new Date().toISOString()
      }
    }).as('refreshVolumeSize');

    cy.intercept('POST', '/api/v1/volumes/*/scan', {
      statusCode: 200,
      body: {
        scan_id: 'scan_123',
        status: 'started',
        volume_name: 'test-volume',
        started_at: new Date().toISOString()
      }
    }).as('scanVolume');

    cy.intercept('POST', '/api/v1/volumes/*/filesystem/index', {
      statusCode: 200,
      body: {
        index_id: 'index_456',
        status: 'started',
        volume_name: 'test-volume',
        started_at: new Date().toISOString()
      }
    }).as('indexFilesystem');

    cy.intercept('POST', '/api/v1/volumes/bulk-scan', {
      statusCode: 200,
      body: {
        results: [
          {
            volume_id: 'volume-1',
            size_bytes: 1073741824,
            file_count: 5000,
            last_updated: new Date().toISOString()
          },
          {
            volume_id: 'volume-2',
            size_bytes: 2147483648,
            file_count: 10000,
            last_updated: new Date().toISOString()
          }
        ]
      }
    }).as('bulkScan');

    // Visit the dashboard
    cy.visit('/');
    
    // Wait for initial data to load
    cy.wait('@getOrganization');
    cy.wait('@getVolumes');
  });

  describe('Dashboard Loading and Display', () => {
    it('should load dashboard with organization and volume data', () => {
      // Verify organization info is displayed
      cy.contains('VolumeViz Test Org').should('be.visible');
      cy.contains('test@volumeviz.com').should('be.visible');

      // Verify volumes are displayed
      cy.contains('production-db-data').should('be.visible');
      cy.contains('app-logs-volume').should('be.visible');
      cy.contains('cache-storage').should('be.visible');

      // Verify volume details
      cy.contains('2.0 GB').should('be.visible'); // Size
      cy.contains('1 container').should('be.visible'); // Attachments
      cy.contains('Orphaned').should('be.visible'); // Status
    });

    it('should display correct volume statistics', () => {
      // Check volume counts
      cy.get('[data-cy=volume-card]').should('have.length', 3);
      
      // Check storage totals
      cy.contains('Total Storage').should('be.visible');
      cy.contains('3.5 GB').should('be.visible'); // Total size
      
      // Check file counts
      cy.contains('Total Files').should('be.visible');
      cy.contains('42,500').should('be.visible'); // Total file count
    });

    it('should show correct scan status indicators', () => {
      // Completed scan
      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.get('[data-cy=scan-status]').should('contain', 'Completed');
        cy.get('[data-cy=scan-status]').should('have.class', 'text-green-600');
      });

      // Pending scan
      cy.get('[data-cy=volume-card]').eq(1).within(() => {
        cy.get('[data-cy=scan-status]').should('contain', 'Pending');
        cy.get('[data-cy=scan-status]').should('have.class', 'text-yellow-600');
      });

      // Scanning in progress
      cy.get('[data-cy=volume-card]').eq(2).within(() => {
        cy.get('[data-cy=scan-status]').should('contain', 'Scanning');
        cy.get('[data-cy=scan-status]').should('have.class', 'text-blue-600');
      });
    });
  });

  describe('Volume Operations', () => {
    it('should refresh volume size successfully', () => {
      // Find the first volume card
      cy.get('[data-cy=volume-card]').first().within(() => {
        // Click the refresh size button
        cy.get('[data-cy=refresh-size-btn]').click();
        
        // Button should show loading state
        cy.get('[data-cy=refresh-size-btn]').should('be.disabled');
        cy.get('[data-cy=refresh-size-btn]').should('contain', 'Refreshing...');
      });

      // Wait for API call
      cy.wait('@refreshVolumeSize');

      // Verify success notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Size refreshed successfully');

      // Button should return to normal state
      cy.get('[data-cy=refresh-size-btn]').should('not.be.disabled');
      cy.get('[data-cy=refresh-size-btn]').should('contain', 'Refresh Size');
    });

    it('should start volume scan successfully', () => {
      cy.get('[data-cy=volume-card]').first().within(() => {
        // Click the scan button
        cy.get('[data-cy=scan-btn]').click();
        
        // Button should show loading state
        cy.get('[data-cy=scan-btn]').should('be.disabled');
        cy.get('[data-cy=scan-btn]').should('contain', 'Starting...');
      });

      // Wait for API call
      cy.wait('@scanVolume');

      // Verify success notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Scan started successfully');

      // Scan status should update
      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.get('[data-cy=scan-status]').should('contain', 'Scanning');
      });
    });

    it('should index filesystem successfully', () => {
      cy.get('[data-cy=volume-card]').first().within(() => {
        // Open actions dropdown
        cy.get('[data-cy=volume-actions-dropdown]').click();
        
        // Click index filesystem option
        cy.get('[data-cy=index-filesystem-btn]').click();
      });

      // Wait for API call
      cy.wait('@indexFilesystem');

      // Verify success notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Filesystem indexing started');
    });

    it('should handle operation errors gracefully', () => {
      // Mock an error response
      cy.intercept('POST', '/api/v1/volumes/*/size/refresh', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('refreshError');

      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.get('[data-cy=refresh-size-btn]').click();
      });

      cy.wait('@refreshError');

      // Should show error notification
      cy.get('[data-cy=error-notification]').should('be.visible');
      cy.get('[data-cy=error-notification]').should('contain', 'Failed to refresh volume size');

      // Button should return to normal state
      cy.get('[data-cy=refresh-size-btn]').should('not.be.disabled');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk scan operation', () => {
      // Select multiple volumes
      cy.get('[data-cy=volume-checkbox]').eq(0).check();
      cy.get('[data-cy=volume-checkbox]').eq(1).check();

      // Bulk actions toolbar should appear
      cy.get('[data-cy=bulk-actions]').should('be.visible');
      cy.get('[data-cy=selected-count]').should('contain', '2 selected');

      // Click bulk scan button
      cy.get('[data-cy=bulk-scan-btn]').click();

      // Confirm bulk operation
      cy.get('[data-cy=confirm-bulk-scan]').click();

      // Wait for API call
      cy.wait('@bulkScan');

      // Should show success notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Bulk scan started for 2 volumes');

      // Selections should be cleared
      cy.get('[data-cy=volume-checkbox]').should('not.be.checked');
      cy.get('[data-cy=bulk-actions]').should('not.be.visible');
    });

    it('should handle bulk operation with mixed results', () => {
      // Mock partial success response
      cy.intercept('POST', '/api/v1/volumes/bulk-scan', {
        statusCode: 207, // Multi-status
        body: {
          results: [
            {
              volume_id: 'volume-1',
              size_bytes: 1073741824,
              file_count: 5000,
              last_updated: new Date().toISOString(),
              status: 'success'
            },
            {
              volume_id: 'volume-2',
              error: 'Volume not accessible',
              status: 'error'
            }
          ]
        }
      }).as('partialBulkScan');

      // Select volumes and perform bulk scan
      cy.get('[data-cy=volume-checkbox]').eq(0).check();
      cy.get('[data-cy=volume-checkbox]').eq(1).check();
      cy.get('[data-cy=bulk-scan-btn]').click();
      cy.get('[data-cy=confirm-bulk-scan]').click();

      cy.wait('@partialBulkScan');

      // Should show partial success notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Bulk scan completed: 1 succeeded, 1 failed');
    });
  });

  describe('Real-time Updates', () => {
    it('should update volume data via WebSocket', () => {
      // Mock WebSocket connection
      cy.window().then((win) => {
        // Simulate WebSocket message for volume update
        const mockWebSocket = {
          send: cy.stub(),
          close: cy.stub(),
          readyState: WebSocket.OPEN
        };

        // Override WebSocket constructor
        win.WebSocket = function() {
          return mockWebSocket;
        } as any;
      });

      // Visit page to establish WebSocket connection
      cy.reload();
      
      // Simulate receiving volume update message
      cy.window().then((win) => {
        const updateEvent = new CustomEvent('websocket-message', {
          detail: {
            type: 'volume_update',
            data: {
              volume_name: 'production-db-data',
              size_bytes: 3221225472, // 3GB (updated)
              file_count: 20000,
              scan_status: 'completed'
            }
          }
        });
        win.dispatchEvent(updateEvent);
      });

      // Verify UI updates
      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.contains('3.0 GB').should('be.visible'); // Updated size
        cy.contains('20,000').should('be.visible'); // Updated file count
      });
    });
  });

  describe('Offline Functionality', () => {
    it('should queue operations when offline', () => {
      // Simulate offline state
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'onLine', {
          writable: true,
          value: false
        });
        
        // Trigger offline event
        win.dispatchEvent(new Event('offline'));
      });

      // Verify offline indicator
      cy.get('[data-cy=offline-indicator]').should('be.visible');
      cy.contains('You are currently offline').should('be.visible');

      // Attempt a volume operation
      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.get('[data-cy=refresh-size-btn]').click();
      });

      // Should show queued notification
      cy.get('[data-cy=notification]').should('be.visible');
      cy.get('[data-cy=notification]').should('contain', 'Operation queued for when you\'re back online');

      // Simulate coming back online
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'onLine', {
          writable: true,
          value: true
        });
        
        // Trigger online event
        win.dispatchEvent(new Event('online'));
      });

      // Should automatically sync queued operations
      cy.wait('@refreshVolumeSize');
      cy.get('[data-cy=notification]').should('contain', 'Synced 1 pending operation');
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed operations', () => {
      // Mock initial failure then success
      let attemptCount = 0;
      cy.intercept('POST', '/api/v1/volumes/*/size/refresh', (req) => {
        attemptCount++;
        if (attemptCount === 1) {
          req.reply({ statusCode: 500, body: { error: 'Server error' } });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              volume_id: 'test-volume',
              size_bytes: 2147483648,
              file_count: 15000,
              last_updated: new Date().toISOString()
            }
          });
        }
      }).as('refreshWithRetry');

      // Enable automatic retry in settings
      cy.get('[data-cy=settings-btn]').click();
      cy.get('[data-cy=auto-retry-toggle]').check();
      cy.get('[data-cy=save-settings]').click();

      // Trigger operation
      cy.get('[data-cy=volume-card]').first().within(() => {
        cy.get('[data-cy=refresh-size-btn]').click();
      });

      // Should show retry notification
      cy.get('[data-cy=notification]').should('contain', 'Retrying operation...');

      // Wait for both attempts
      cy.wait('@refreshWithRetry');
      cy.wait('@refreshWithRetry');

      // Should eventually succeed
      cy.get('[data-cy=notification]').should('contain', 'Size refreshed successfully');
    });
  });

  describe('Performance and Loading States', () => {
    it('should handle large volume lists efficiently', () => {
      // Mock response with many volumes
      cy.intercept('GET', '/api/v1/volumes*', {
        fixture: 'modern/large-volumes-list.json'
      }).as('getLargeVolumesList');

      cy.visit('/');
      cy.wait('@getLargeVolumesList');

      // Should implement virtual scrolling
      cy.get('[data-cy=virtual-list]').should('exist');
      
      // Should only render visible items
      cy.get('[data-cy=volume-card]').should('have.length.at.most', 20);

      // Should load more when scrolling
      cy.get('[data-cy=volume-list-container]').scrollTo('bottom');
      cy.get('[data-cy=volume-card]').should('have.length.at.most', 40);
    });

    it('should show appropriate loading states', () => {
      // Slow loading simulation
      cy.intercept('GET', '/api/v1/volumes*', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ fixture: 'modern/volumes-list.json' });
          }, 2000);
        });
      }).as('getSlowVolumes');

      cy.visit('/');

      // Should show loading skeleton
      cy.get('[data-cy=volume-skeleton]').should('be.visible');
      cy.get('[data-cy=loading-spinner]').should('be.visible');

      // Should show progress indicator
      cy.contains('Loading volumes...').should('be.visible');

      cy.wait('@getSlowVolumes');

      // Loading states should disappear
      cy.get('[data-cy=volume-skeleton]').should('not.exist');
      cy.get('[data-cy=loading-spinner]').should('not.exist');
    });
  });
});