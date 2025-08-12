/**
 * Scan Operations E2E Tests
 * 
 * Tests volume scanning functionality with WebSocket integration,
 * progress tracking, and error handling.
 */

describe('Scan Operations', () => {
  beforeEach(() => {
    cy.setupCommonInterceptors();
    
    // Load test volumes
    cy.fixture('volumes.json').then((volumes) => {
      cy.mockVolumeData(volumes.multipleVolumes);
    });
    
    // Mock scan endpoints
    cy.intercept('POST', '/api/v1/volumes/*/scan', {
      statusCode: 200,
      body: {
        data: {
          scan_id: 'scan-123',
          volume_id: 'test-volume',
          status: 'started',
          method: 'du'
        }
      }
    }).as('scanStart');
    
    cy.intercept('GET', '/api/v1/scans/*/status', {
      statusCode: 200,
      body: {
        data: {
          scan_id: 'scan-123',
          status: 'running',
          progress: 45,
          current_size: 1024000,
          method: 'du'
        }
      }
    }).as('scanStatus');
  });

  describe('Scan Initiation', () => {
    it('starts scan from volume list', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Find scan button on volume item
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      // Should call scan API
      cy.wait('@scanStart');
      
      // Should show scanning state
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
          cy.getByTestId('scan-button').should('be.disabled');
        });
      
      cy.takeNamedScreenshot('scan-initiated-from-list');
    });

    it('starts scan from volume details modal', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Open volume details
      cy.getByTestId('volume-item').first().click();
      
      // Wait for modal to load
      cy.getByTestId('volume-details-modal').should('be.visible');
      
      // Click scan button in modal
      cy.getByTestId('start-scan-button').click();
      
      // Should call scan API
      cy.wait('@scanStart');
      
      // Should show scanning indicator in modal
      cy.getByTestId('scanning-indicator').should('be.visible');
      cy.getByTestId('scan-progress-section').should('be.visible');
      
      cy.takeNamedScreenshot('scan-initiated-from-modal');
    });

    it('shows scan method selection dialog', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Right-click or long-press scan button for options
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-options-button').click();
        });
      
      // Should show method selection
      cy.getByTestId('scan-method-dialog').should('be.visible');
      
      // Should show available methods
      cy.getByTestId('scan-method-du').should('be.visible');
      cy.getByTestId('scan-method-manual').should('be.visible');
      
      // Select du method
      cy.getByTestId('scan-method-du').click();
      cy.getByTestId('confirm-scan-method').click();
      
      // Should start scan with selected method
      cy.wait('@scanStart').then((interception) => {
        expect(interception.request.body).to.include('du');
      });
      
      cy.takeNamedScreenshot('scan-method-selection');
    });
  });

  describe('Scan Progress with WebSocket', () => {
    it('shows real-time progress updates', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start mock scan with progress events
      cy.mockScanOperation('app-data', {
        duration: 3000,
        finalSize: 5242880, // 5MB
        shouldFail: false
      });

      // Click scan button
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');

      // Should show progress bar
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-progress-bar').should('be.visible');
          cy.getByTestId('scan-progress-percentage').should('be.visible');
        });

      // Wait for first progress update
      cy.waitForWebSocketEvent('scan_progress', 5000);

      // Progress should be updating
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-progress-percentage').should('not.contain', '0%');
          cy.getByTestId('current-size').should('be.visible');
        });

      // Wait for completion
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Should show final results
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Complete');
          cy.getByTestId('volume-size').should('contain', '5.2 MB');
          cy.getByTestId('scan-button').should('not.be.disabled');
        });
      
      cy.takeNamedScreenshot('scan-progress-complete');
    });

    it('shows detailed progress in modal', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Open volume details modal
      cy.getByTestId('volume-item').first().click();
      cy.getByTestId('volume-details-modal').should('be.visible');

      // Start scan with detailed progress
      cy.mockScanOperation('app-data', {
        duration: 4000,
        finalSize: 10485760, // 10MB
        shouldFail: false
      });

      cy.getByTestId('start-scan-button').click();
      cy.wait('@scanStart');

      // Should show detailed progress section
      cy.getByTestId('scan-progress-section').should('be.visible');
      cy.getByTestId('scan-method-display').should('contain', 'du');
      cy.getByTestId('files-processed-count').should('be.visible');
      cy.getByTestId('scan-start-time').should('be.visible');

      // Wait for progress updates
      cy.waitForWebSocketEvent('scan_progress', 5000);

      // Should show increasing progress
      cy.getByTestId('scan-progress-bar')
        .should('have.attr', 'style')
        .and('include', 'width:');
      
      cy.getByTestId('files-processed-count').should('not.contain', '0');
      cy.getByTestId('current-size').should('be.visible');

      // Wait for completion
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Should show final statistics
      cy.getByTestId('scan-completion-stats').should('be.visible');
      cy.getByTestId('total-files-count').should('contain', '50');
      cy.getByTestId('total-directories-count').should('contain', '5');
      cy.getByTestId('scan-duration').should('contain', 'seconds');
      
      cy.takeNamedScreenshot('scan-detailed-progress-modal');
    });

    it('handles multiple concurrent scans', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start first scan
      cy.mockScanOperation('app-data', {
        duration: 3000,
        finalSize: 2097152,
        shouldFail: false
      });

      cy.getByTestId('volume-item')
        .contains('app-data')
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');

      // Start second scan on different volume
      cy.mockScanOperation('database-storage', {
        duration: 4000,
        finalSize: 15728640,
        shouldFail: false
      });

      cy.getByTestId('volume-item')
        .contains('database-storage')
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');

      // Both should show scanning status
      cy.getByTestId('volume-item')
        .contains('app-data')
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
        });

      cy.getByTestId('volume-item')
        .contains('database-storage')
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
        });

      // Wait for both to complete
      cy.waitForWebSocketEvent('scan_complete', 10000);
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Both should show completion
      cy.getByTestId('volume-item')
        .contains('app-data')
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Complete');
        });

      cy.getByTestId('volume-item')
        .contains('database-storage')
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Complete');
        });
      
      cy.takeNamedScreenshot('multiple-concurrent-scans');
    });

    it('updates scan progress with rate limiting', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start scan and emit rapid progress updates
      cy.mockScanOperation('app-data', {
        duration: 2000,
        finalSize: 1048576,
        shouldFail: false
      });

      cy.getByTestId('volume-item').first().click();
      cy.getByTestId('start-scan-button').click();
      
      // Emit many progress events rapidly to test rate limiting
      cy.window().then((win) => {
        if (win.__TEST_WS__) {
          // Emit 20 events in quick succession
          for (let i = 1; i <= 20; i++) {
            setTimeout(() => {
              win.__TEST_WS__.emit('scan_progress', {
                volume_id: 'app-data',
                progress: (i / 20) * 100,
                current_size: (1048576 * i) / 20,
                files_processed: i * 5,
                method: 'du',
                started_at: new Date().toISOString()
              });
            }, i * 50); // 50ms apart = 20/second, should be rate limited to ≤4/s
          }
        }
      });

      // Progress should update but be throttled
      cy.getByTestId('scan-progress-bar').should('be.visible');
      
      // Take screenshot after rate limiting settles
      cy.wait(3000);
      cy.takeNamedScreenshot('scan-progress-rate-limited');
    });
  });

  describe('Scan Error Handling', () => {
    it('handles scan failure with error display', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start scan that will fail
      cy.mockScanOperation('app-data', {
        duration: 1500,
        shouldFail: true
      });

      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');

      // Wait for error event
      cy.waitForWebSocketEvent('scan_error', 5000);

      // Should show error state
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Error');
          cy.getByTestId('scan-error-icon').should('be.visible');
          cy.getByTestId('scan-button').should('not.be.disabled'); // Re-enabled for retry
        });

      // Click to see error details
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-error-details').click();
        });

      // Should show error message
      cy.getByTestId('scan-error-tooltip')
        .should('be.visible')
        .and('contain', 'Permission denied');
      
      cy.takeNamedScreenshot('scan-error-display');
    });

    it('allows retry after scan failure', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // First scan fails
      cy.mockScanOperation('app-data', {
        duration: 1000,
        shouldFail: true
      });

      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');
      cy.waitForWebSocketEvent('scan_error', 5000);

      // Set up successful retry scan
      cy.mockScanOperation('app-data', {
        duration: 2000,
        finalSize: 2097152,
        shouldFail: false
      });

      // Click retry
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });

      cy.wait('@scanStart');

      // Should show scanning again
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
        });

      // Wait for successful completion
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Should show success
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Complete');
          cy.getByTestId('volume-size').should('contain', '2.1 MB');
        });
      
      cy.takeNamedScreenshot('scan-retry-success');
    });

    it('handles network disconnection during scan', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start scan
      cy.mockScanOperation('app-data', {
        duration: 5000,
        finalSize: 1048576,
        shouldFail: false
      });

      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });
      
      cy.wait('@scanStart');

      // Simulate WebSocket disconnection
      cy.window().then((win) => {
        win.__TEST_WS__?.simulateError('Connection lost');
      });

      // Should show connection error in scan status
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-connection-error').should('be.visible');
        });

      // Reconnect WebSocket
      cy.window().then((win) => {
        win.__TEST_WS__?.reconnect();
      });
      
      cy.waitForWebSocketConnection();

      // Should resume or restart scan
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('not.contain', 'Error');
        });
      
      cy.takeNamedScreenshot('scan-network-disconnection');
    });
  });

  describe('Scan History', () => {
    it('shows scan history in volume details', () => {
      // Mock scan history endpoint
      cy.intercept('GET', '/api/v1/volumes/*/scans', {
        statusCode: 200,
        body: {
          data: [
            {
              scan_id: 'scan-123',
              started_at: '2023-01-01T10:00:00Z',
              completed_at: '2023-01-01T10:02:30Z',
              status: 'completed',
              method: 'du',
              total_size: 2097152,
              file_count: 45,
              duration: 150
            },
            {
              scan_id: 'scan-122',
              started_at: '2023-01-01T09:00:00Z',
              completed_at: null,
              status: 'failed',
              method: 'manual',
              error: 'Permission denied'
            }
          ]
        }
      }).as('scanHistory');

      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Open volume details
      cy.getByTestId('volume-item').first().click();
      cy.wait('@scanHistory');

      // Click scan history tab
      cy.getByTestId('scan-history-tab').click();

      // Should show scan history
      cy.getByTestId('scan-history-list').should('be.visible');
      
      // Should show completed scan
      cy.getByTestId('scan-item-scan-123')
        .should('contain', 'Completed')
        .and('contain', '2.1 MB')
        .and('contain', '2:30');

      // Should show failed scan
      cy.getByTestId('scan-item-scan-122')
        .should('contain', 'Failed')
        .and('contain', 'Permission denied');
      
      cy.takeNamedScreenshot('scan-history-display');
    });

    it('allows viewing detailed scan results', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      cy.getByTestId('volume-item').first().click();
      cy.getByTestId('scan-history-tab').click();

      // Click on completed scan for details
      cy.getByTestId('scan-item-scan-123').click();

      // Should show detailed scan results
      cy.getByTestId('scan-details-modal').should('be.visible');
      cy.getByTestId('scan-method').should('contain', 'du');
      cy.getByTestId('scan-duration').should('contain', '2:30');
      cy.getByTestId('scan-file-count').should('contain', '45');
      cy.getByTestId('scan-total-size').should('contain', '2.1 MB');
      
      cy.takeNamedScreenshot('scan-detailed-results');
    });
  });

  describe('Bulk Scan Operations', () => {
    it('allows scanning multiple volumes', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Select multiple volumes (checkbox selection)
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('volume-checkbox').click();
        });

      cy.getByTestId('volume-item')
        .eq(1)
        .within(() => {
          cy.getByTestId('volume-checkbox').click();
        });

      // Bulk action bar should appear
      cy.getByTestId('bulk-actions-bar').should('be.visible');
      cy.getByTestId('selected-count').should('contain', '2');

      // Click bulk scan
      cy.getByTestId('bulk-scan-button').click();

      // Should confirm bulk operation
      cy.getByTestId('bulk-scan-confirmation')
        .should('be.visible')
        .and('contain', '2 volumes');

      cy.getByTestId('confirm-bulk-scan').click();

      // Should start scans for both volumes
      cy.wait('@scanStart');
      cy.wait('@scanStart');

      // Both should show scanning status
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
        });

      cy.getByTestId('volume-item')
        .eq(1)
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Scanning');
        });
      
      cy.takeNamedScreenshot('bulk-scan-operation');
    });

    it('shows bulk scan progress summary', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Start bulk scan (mock multiple scans)
      cy.mockScanOperation('app-data', {
        duration: 2000,
        finalSize: 2097152,
        shouldFail: false
      });
      
      cy.mockScanOperation('database-storage', {
        duration: 3000,  
        finalSize: 10485760,
        shouldFail: false
      });

      // Select and scan multiple volumes
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('volume-checkbox').click();
        });

      cy.getByTestId('volume-item')
        .eq(1)
        .within(() => {
          cy.getByTestId('volume-checkbox').click();
        });

      cy.getByTestId('bulk-scan-button').click();
      cy.getByTestId('confirm-bulk-scan').click();

      // Should show bulk scan progress summary
      cy.getByTestId('bulk-scan-progress').should('be.visible');
      cy.getByTestId('bulk-progress-summary').should('contain', '0 of 2 complete');

      // Wait for scans to progress
      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Summary should update
      cy.getByTestId('bulk-progress-summary').should('contain', '1 of 2 complete');

      // Wait for all to complete
      cy.waitForWebSocketEvent('scan_complete', 10000);
      
      // All should be complete
      cy.getByTestId('bulk-progress-summary').should('contain', '2 of 2 complete');
      
      cy.takeNamedScreenshot('bulk-scan-progress-summary');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles very large scan results', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Mock scan with very large size (1TB)
      cy.mockScanOperation('app-data', {
        duration: 2000,
        finalSize: 1099511627776, // 1TB
        shouldFail: false
      });

      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });

      cy.waitForWebSocketEvent('scan_complete', 10000);

      // Should display large size properly
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('volume-size').should('contain', 'TB');
        });
      
      cy.takeNamedScreenshot('scan-very-large-volume');
    });

    it('cancels running scan', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');

      // Mock scan cancellation endpoint
      cy.intercept('DELETE', '/api/v1/scans/*/cancel', {
        statusCode: 200,
        body: { data: { status: 'cancelled' } }
      }).as('scanCancel');

      // Start long-running scan
      cy.mockScanOperation('app-data', {
        duration: 10000, // Long duration
        finalSize: 1048576,
        shouldFail: false
      });

      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-button').click();
        });

      // Wait for scan to start
      cy.waitForWebSocketEvent('scan_progress', 5000);

      // Click cancel button
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('cancel-scan-button').click();
        });

      cy.wait('@scanCancel');

      // Should show cancelled state
      cy.getByTestId('volume-item')
        .first()
        .within(() => {
          cy.getByTestId('scan-status').should('contain', 'Cancelled');
          cy.getByTestId('scan-button').should('not.be.disabled');
        });
      
      cy.takeNamedScreenshot('scan-cancelled');
    });
  });
});