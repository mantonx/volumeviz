/**
 * Volume Details Modal E2E Tests
 * 
 * Tests volume details modal functionality including data display,
 * empty states, actions, and modal behavior.
 */

describe('Volume Details Modal', () => {
  beforeEach(() => {
    cy.setupCommonInterceptors();
    
    // Load test volumes
    cy.fixture('volumes.json').then((volumes) => {
      cy.mockVolumeData(volumes.multipleVolumes);
    });
    
    // Mock volume details endpoint
    cy.intercept('GET', '/api/v1/volumes/*/details', {
      statusCode: 200,
      body: {
        data: {
          name: 'app-data',
          driver: 'local',
          mount_point: '/var/lib/docker/volumes/app-data/_data',
          created_at: '2023-01-01T00:00:00Z',
          size_bytes: 2097152,
          attachments_count: 1,
          is_system: false,
          is_orphaned: false,
          labels: {
            app: 'frontend',
            environment: 'production'
          },
          containers: [
            {
              id: 'container-123',
              name: 'web-app',
              status: 'running',
              mount_path: '/app/data'
            }
          ],
          file_tree: {
            directories: 3,
            files: 47,
            total_size: 2097152,
            last_scanned: '2023-01-01T12:00:00Z'
          }
        }
      }
    }).as('volumeDetails');
  });

  describe('Modal Opening and Closing', () => {
    it('opens modal when volume item is clicked', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click on first volume item
      cy.getByTestId('volume-item').first().click();
      
      // Modal should be visible
      cy.getByTestId('volume-details-modal').should('be.visible');
      
      // Should fetch volume details
      cy.wait('@volumeDetails');
      
      // Modal should have correct title
      cy.getByTestId('modal-title').should('contain', 'app-data');
      
      cy.takeNamedScreenshot('volume-details-modal-opened');
    });

    it('closes modal with close button', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Open modal
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');
      
      // Close with close button
      cy.getByTestId('modal-close-button').click();
      
      // Modal should not be visible
      cy.getByTestId('volume-details-modal').should('not.exist');
    });

    it('closes modal with escape key', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Open modal
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');
      
      // Press escape
      cy.get('body').type('{esc}');
      
      // Modal should close
      cy.getByTestId('volume-details-modal').should('not.exist');
    });

    it('closes modal when clicking backdrop', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Open modal
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');
      
      // Click backdrop (outside modal content)
      cy.getByTestId('modal-backdrop').click({ force: true });
      
      // Modal should close
      cy.getByTestId('volume-details-modal').should('not.exist');
    });

    it('prevents body scroll when modal is open', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Check body can scroll initially
      cy.get('body').should('not.have.class', 'overflow-hidden');
      
      // Open modal
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');
      
      // Body should have scroll prevention
      cy.get('body').should('have.class', 'overflow-hidden');
      
      // Close modal
      cy.getByTestId('modal-close-button').click();
      
      // Body scroll should be restored
      cy.get('body').should('not.have.class', 'overflow-hidden');
    });
  });

  describe('Volume Information Display', () => {
    it('displays basic volume information', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Check basic info is displayed
      cy.getByTestId('volume-name').should('contain', 'app-data');
      cy.getByTestId('volume-driver').should('contain', 'local');
      cy.getByTestId('volume-created').should('contain', '2023-01-01');
      cy.getByTestId('volume-size').should('contain', '2.1 MB');
      cy.getByTestId('volume-mount-point').should('contain', '/var/lib/docker/volumes');
      
      cy.takeNamedScreenshot('volume-basic-info-display');
    });

    it('displays volume labels', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Check labels section
      cy.getByTestId('volume-labels').should('be.visible');
      
      // Should show specific labels
      cy.getByTestId('label-app').should('contain', 'frontend');
      cy.getByTestId('label-environment').should('contain', 'production');
      
      cy.takeNamedScreenshot('volume-labels-display');
    });

    it('displays attached containers', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Check containers section
      cy.getByTestId('attached-containers').should('be.visible');
      
      // Should show container info
      cy.getByTestId('container-item').should('have.length', 1);
      cy.getByTestId('container-name').should('contain', 'web-app');
      cy.getByTestId('container-status').should('contain', 'running');
      cy.getByTestId('container-mount').should('contain', '/app/data');
      
      cy.takeNamedScreenshot('volume-containers-display');
    });

    it('displays file system information', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Check file system section
      cy.getByTestId('file-system-info').should('be.visible');
      
      // Should show file/directory counts
      cy.getByTestId('directories-count').should('contain', '3');
      cy.getByTestId('files-count').should('contain', '47');
      cy.getByTestId('total-size').should('contain', '2.1 MB');
      cy.getByTestId('last-scanned').should('contain', '2023-01-01');
      
      cy.takeNamedScreenshot('volume-filesystem-info');
    });

    it('shows volume status indicators', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Should show status badges
      cy.getByTestId('status-badges').should('be.visible');
      
      // Check for non-orphaned status
      cy.getByTestId('orphaned-badge').should('not.exist');
      
      // Check for non-system status 
      cy.getByTestId('system-badge').should('not.exist');
      
      // Should show attached status
      cy.getByTestId('attached-badge').should('be.visible');
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no containers attached', () => {
      // Mock volume with no containers
      cy.intercept('GET', '/api/v1/volumes/*/details', {
        statusCode: 200,
        body: {
          data: {
            name: 'orphaned-volume',
            driver: 'local',
            created_at: '2023-01-03T00:00:00Z',
            size_bytes: 524288,
            attachments_count: 0,
            is_orphaned: true,
            containers: [],
            labels: {}
          }
        }
      }).as('orphanedVolumeDetails');
      
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Click on orphaned volume (assuming it exists in the list)
      cy.getByTestId('volume-item').contains('orphaned').click();
      cy.wait('@orphanedVolumeDetails');

      // Should show empty containers state
      cy.getByTestId('no-containers-message')
        .should('be.visible')
        .and('contain', 'No containers');
      
      // Should show orphaned indicator
      cy.getByTestId('orphaned-badge').should('be.visible');
      
      cy.takeNamedScreenshot('volume-no-containers-empty-state');
    });

    it('shows empty state when no labels', () => {
      // Mock volume with no labels
      cy.intercept('GET', '/api/v1/volumes/*/details', {
        statusCode: 200,
        body: {
          data: {
            name: 'unlabeled-volume',
            driver: 'local',
            created_at: '2023-01-01T00:00:00Z',
            size_bytes: 1048576,
            labels: {},
            containers: []
          }
        }
      }).as('unlabeledVolumeDetails');
      
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@unlabeledVolumeDetails');

      // Should show empty labels state
      cy.getByTestId('no-labels-message')
        .should('be.visible')
        .and('contain', 'No labels');
      
      cy.takeNamedScreenshot('volume-no-labels-empty-state');
    });

    it('shows empty state when no scan data available', () => {
      // Mock volume with no file tree data
      cy.intercept('GET', '/api/v1/volumes/*/details', {
        statusCode: 200,
        body: {
          data: {
            name: 'unscanned-volume',
            driver: 'local',
            created_at: '2023-01-01T00:00:00Z',
            size_bytes: null,
            file_tree: null,
            containers: []
          }
        }
      }).as('unscannedVolumeDetails');
      
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@unscannedVolumeDetails');

      // Should show scan prompt
      cy.getByTestId('no-scan-data-message')
        .should('be.visible')
        .and('contain', 'not been scanned');
      
      // Should show scan button
      cy.getByTestId('start-scan-button').should('be.visible');
      
      cy.takeNamedScreenshot('volume-no-scan-data-empty-state');
    });
  });

  describe('Volume Actions', () => {
    it('initiates volume scan', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Mock scan start endpoint
      cy.intercept('POST', '/api/v1/volumes/*/scan', {
        statusCode: 200,
        body: {
          data: {
            scan_id: 'scan-123',
            volume_id: 'app-data',
            status: 'started',
            method: 'du'
          }
        }
      }).as('scanStart');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Click scan button
      cy.getByTestId('start-scan-button').click();
      
      // Should call scan endpoint
      cy.wait('@scanStart');
      
      // Should show scanning state
      cy.getByTestId('scanning-indicator').should('be.visible');
      
      // Scan button should be disabled
      cy.getByTestId('start-scan-button').should('be.disabled');
      
      cy.takeNamedScreenshot('volume-scan-initiated');
    });

    it('shows scan progress with WebSocket', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Start mock scan operation
      cy.mockScanOperation('app-data', {
        duration: 2000,
        finalSize: 3145728, // 3MB
        shouldFail: false
      });
      
      // Click scan button
      cy.getByTestId('start-scan-button').click();
      
      // Should show progress bar
      cy.getByTestId('scan-progress-bar').should('be.visible');
      
      // Wait for progress updates
      cy.waitForWebSocketEvent('scan_progress', 5000);
      
      // Progress should increase
      cy.getByTestId('scan-progress-percentage').should('not.contain', '0%');
      
      // Wait for completion
      cy.waitForWebSocketEvent('scan_complete', 10000);
      
      // Should show updated size
      cy.getByTestId('volume-size').should('contain', '3.1 MB');
      
      cy.takeNamedScreenshot('volume-scan-progress-complete');
    });

    it('handles scan errors gracefully', () => {
      cy.setupWebSocketShim({ autoConnect: true });
      cy.visitPage('/');
      cy.waitForWebSocketConnection();
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Start mock scan that will fail
      cy.mockScanOperation('app-data', {
        duration: 1000,
        shouldFail: true
      });
      
      // Click scan button
      cy.getByTestId('start-scan-button').click();
      
      // Wait for error event
      cy.waitForWebSocketEvent('scan_error', 5000);
      
      // Should show error message
      cy.getByTestId('scan-error-message')
        .should('be.visible')
        .and('contain', 'Permission denied');
      
      // Scan button should be re-enabled
      cy.getByTestId('start-scan-button').should('not.be.disabled');
      
      cy.takeNamedScreenshot('volume-scan-error');
    });

    it('shows volume removal confirmation', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Click remove button
      cy.getByTestId('remove-volume-button').click();
      
      // Should show confirmation dialog
      cy.getByTestId('remove-confirmation-dialog').should('be.visible');
      
      // Should show volume name in confirmation
      cy.getByTestId('confirmation-volume-name').should('contain', 'app-data');
      
      // Should warn about data loss
      cy.getByTestId('data-loss-warning').should('be.visible');
      
      // Cancel removal
      cy.getByTestId('cancel-remove-button').click();
      
      // Confirmation should disappear
      cy.getByTestId('remove-confirmation-dialog').should('not.exist');
      
      cy.takeNamedScreenshot('volume-remove-confirmation');
    });
  });

  describe('Modal Responsiveness', () => {
    it('adapts to mobile viewports', () => {
      cy.viewport('iphone-x');
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Open modal
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Modal should be full-screen on mobile
      cy.getByTestId('volume-details-modal')
        .should('be.visible')
        .and('have.class', 'mobile-fullscreen');
      
      // Content should be scrollable
      cy.getByTestId('modal-content').should('be.visible');
      
      cy.takeNamedScreenshot('volume-details-modal-mobile');
    });

    it('shows proper layout on tablet', () => {
      cy.viewport('ipad-2');
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Modal should have appropriate sizing on tablet
      cy.getByTestId('volume-details-modal').should('be.visible');
      
      cy.takeNamedScreenshot('volume-details-modal-tablet');
    });
  });

  describe('Accessibility', () => {
    it('maintains focus management', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      // Focus first volume item
      cy.getByTestId('volume-item').first().focus();
      
      // Open modal with Enter key
      cy.focused().type('{enter}');
      cy.wait('@volumeDetails');
      
      // Focus should move to modal
      cy.focused().should('be.within', '[data-testid="volume-details-modal"]');
      
      // Close modal with Escape
      cy.get('body').type('{esc}');
      
      // Focus should return to original element
      cy.focused().should('have.attr', 'data-testid', 'volume-item');
    });

    it('has proper ARIA attributes', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Modal should have proper ARIA attributes
      cy.getByTestId('volume-details-modal')
        .should('have.attr', 'role', 'dialog')
        .and('have.attr', 'aria-labelledby')
        .and('have.attr', 'aria-describedby');
      
      // Close button should have proper label
      cy.getByTestId('modal-close-button')
        .should('have.attr', 'aria-label', 'Close modal');
      
      // Sections should have proper headings
      cy.getByTestId('containers-section')
        .find('h3')
        .should('exist');
    });

    it('announces modal content to screen readers', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetails');

      // Modal content should have live region for dynamic updates
      cy.getByTestId('scan-status-announcements')
        .should('have.attr', 'aria-live', 'polite');
      
      // Important information should be in announcement region
      cy.getByTestId('volume-status-announcement')
        .should('have.attr', 'role', 'status');
    });
  });

  describe('Error Handling', () => {
    it('handles volume details loading errors', () => {
      // Mock failed details request
      cy.intercept('GET', '/api/v1/volumes/*/details', {
        statusCode: 404,
        body: {
          error: 'Volume not found'
        }
      }).as('volumeDetailsError');
      
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      cy.wait('@volumeDetailsError');

      // Should show error state in modal
      cy.getByTestId('volume-details-error')
        .should('be.visible')
        .and('contain', 'Volume not found');
      
      // Should provide retry option
      cy.getByTestId('retry-load-button').should('be.visible');
      
      cy.takeNamedScreenshot('volume-details-load-error');
    });

    it('shows loading state while fetching details', () => {
      // Mock slow response
      cy.intercept('GET', '/api/v1/volumes/*/details', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              statusCode: 200,
              body: { data: { name: 'app-data' } }
            });
          }, 2000);
        });
      }).as('slowVolumeDetails');
      
      cy.visitPage('/');
      cy.wait('@volumesListMocked');
      
      cy.getByTestId('volume-item').first().click();
      
      // Should show loading state
      cy.getByTestId('volume-details-loading').should('be.visible');
      
      // Loading spinner should be present
      cy.getByTestId('loading-spinner').should('be.visible');
      
      cy.takeNamedScreenshot('volume-details-loading');
    });
  });
});