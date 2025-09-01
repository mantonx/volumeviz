/**
 * E2E tests for Search and Analytics using modern Orval-generated API
 * Tests file search, saved searches, and analytics dashboard
 */

describe('Search and Analytics Workflow (Modern API)', () => {
  beforeEach(() => {
    // Intercept search API calls
    cy.intercept('GET', '/api/v1/search/files*', (req) => {
      const query = req.query.q as string || '';
      const volumeId = req.query.volume_id as string;
      
      // Return different results based on query
      if (query.includes('config')) {
        req.reply({ fixture: 'modern/search-config-results.json' });
      } else if (query.includes('log')) {
        req.reply({ fixture: 'modern/search-log-results.json' });
      } else if (volumeId) {
        req.reply({ fixture: 'modern/search-volume-specific.json' });
      } else {
        req.reply({ fixture: 'modern/search-all-results.json' });
      }
    }).as('searchFiles');

    cy.intercept('GET', '/api/v1/search/saved', {
      fixture: 'modern/saved-searches.json'
    }).as('getSavedSearches');

    cy.intercept('POST', '/api/v1/search/saved', {
      statusCode: 201,
      body: {
        id: 'search-new-123',
        name: 'New Saved Search',
        query: 'test query',
        filters: {},
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString()
      }
    }).as('saveSearch');

    cy.intercept('DELETE', '/api/v1/search/saved/*', {
      statusCode: 200,
      body: { success: true }
    }).as('deleteSavedSearch');

    // Analytics API calls
    cy.intercept('GET', '/api/v1/analytics/storage', {
      fixture: 'modern/analytics-storage.json'
    }).as('getStorageAnalytics');

    cy.intercept('GET', '/api/v1/analytics/file-types', {
      fixture: 'modern/analytics-file-types.json'
    }).as('getFileTypeAnalytics');

    cy.intercept('GET', '/api/v1/analytics/top-files*', {
      fixture: 'modern/analytics-top-files.json'
    }).as('getTopFiles');

    cy.intercept('GET', '/api/v1/analytics/volume-usage*', {
      fixture: 'modern/analytics-volume-usage.json'
    }).as('getVolumeUsage');
  });

  describe('File Search Functionality', () => {
    beforeEach(() => {
      cy.visit('/search');
    });

    it('should perform basic file search', () => {
      // Enter search query
      cy.get('[data-cy=search-input]')
        .should('be.visible')
        .type('config');

      // Submit search
      cy.get('[data-cy=search-submit]').click();

      // Wait for search results
      cy.wait('@searchFiles');

      // Verify search results
      cy.get('[data-cy=search-results]').should('be.visible');
      cy.get('[data-cy=search-result-item]').should('have.length.greaterThan', 0);

      // Check result details
      cy.get('[data-cy=search-result-item]').first().within(() => {
        cy.contains('config.json').should('be.visible');
        cy.contains('2.0 KB').should('be.visible');
        cy.contains('app-data').should('be.visible'); // Volume name
      });

      // Verify result count
      cy.get('[data-cy=results-count]').should('contain', 'Found 5 files');
    });

    it('should apply advanced search filters', () => {
      // Open advanced filters
      cy.get('[data-cy=advanced-filters-toggle]').click();
      cy.get('[data-cy=advanced-filters-panel]').should('be.visible');

      // Set file type filter
      cy.get('[data-cy=file-type-filter]').select('file');

      // Set size range
      cy.get('[data-cy=min-size-filter]').type('1048576'); // 1MB
      cy.get('[data-cy=max-size-filter]').type('104857600'); // 100MB

      // Set date range
      cy.get('[data-cy=modified-after-filter]').type('2024-01-01');
      cy.get('[data-cy=modified-before-filter]').type('2024-01-31');

      // Select specific volume
      cy.get('[data-cy=volume-filter]').select('production-db-data');

      // Apply search with filters
      cy.get('[data-cy=search-input]').type('log');
      cy.get('[data-cy=search-submit]').click();

      cy.wait('@searchFiles');

      // Verify filtered results
      cy.get('[data-cy=search-result-item]').each($item => {
        cy.wrap($item).within(() => {
          // Should only show files from selected volume
          cy.contains('production-db-data').should('be.visible');
          
          // Should only show files (not directories)
          cy.get('[data-cy=file-type-icon]').should('have.attr', 'data-type', 'file');
        });
      });

      // Verify applied filters display
      cy.get('[data-cy=active-filters]').should('be.visible');
      cy.get('[data-cy=filter-chip]').should('have.length', 4);
    });

    it('should handle search with no results', () => {
      // Mock empty results
      cy.intercept('GET', '/api/v1/search/files*', {
        body: {
          results: [],
          total_results: 0,
          query: 'nonexistent',
          pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 }
        }
      }).as('emptySearch');

      cy.get('[data-cy=search-input]').type('nonexistentfile.xyz');
      cy.get('[data-cy=search-submit]').click();

      cy.wait('@emptySearch');

      // Verify empty state
      cy.get('[data-cy=no-results]').should('be.visible');
      cy.contains('No files found matching your search').should('be.visible');
      cy.get('[data-cy=search-suggestions]').should('be.visible');
    });

    it('should paginate search results', () => {
      // Mock large result set
      cy.intercept('GET', '/api/v1/search/files*', (req) => {
        const page = parseInt(req.query.page as string) || 1;
        req.reply({
          fixture: page === 1 ? 'modern/search-results-page1.json' : 'modern/search-results-page2.json'
        });
      }).as('paginatedSearch');

      cy.get('[data-cy=search-input]').type('*'); // Search all
      cy.get('[data-cy=search-submit]').click();

      cy.wait('@paginatedSearch');

      // Verify pagination controls
      cy.get('[data-cy=pagination]').should('be.visible');
      cy.get('[data-cy=page-info]').should('contain', 'Page 1 of 5');

      // Navigate to next page
      cy.get('[data-cy=next-page]').click();
      cy.wait('@paginatedSearch');

      // Verify page changed
      cy.get('[data-cy=page-info]').should('contain', 'Page 2 of 5');
      cy.get('[data-cy=prev-page]').should('be.enabled');
    });
  });

  describe('Saved Searches', () => {
    beforeEach(() => {
      cy.visit('/search');
    });

    it('should save a search query', () => {
      // Perform a search
      cy.get('[data-cy=search-input]').type('important files');
      cy.get('[data-cy=search-submit]').click();
      cy.wait('@searchFiles');

      // Save the search
      cy.get('[data-cy=save-search-btn]').click();
      cy.get('[data-cy=save-search-modal]').should('be.visible');

      // Enter search name
      cy.get('[data-cy=search-name-input]').type('Important Files Search');
      cy.get('[data-cy=search-description-input]').type('Search for files containing "important"');

      // Submit save
      cy.get('[data-cy=confirm-save-search]').click();
      cy.wait('@saveSearch');

      // Verify success
      cy.get('[data-cy=notification]').should('contain', 'Search saved successfully');
      cy.get('[data-cy=save-search-modal]').should('not.exist');
    });

    it('should load and execute saved searches', () => {
      // Open saved searches panel
      cy.get('[data-cy=saved-searches-btn]').click();
      cy.wait('@getSavedSearches');

      cy.get('[data-cy=saved-searches-panel]').should('be.visible');

      // Verify saved searches are displayed
      cy.get('[data-cy=saved-search-item]').should('have.length.greaterThan', 0);
      
      // Check saved search details
      cy.get('[data-cy=saved-search-item]').first().within(() => {
        cy.contains('Large Log Files').should('be.visible');
        cy.contains('*.log').should('be.visible');
        cy.get('[data-cy=search-last-used]').should('contain', 'Last used');
      });

      // Execute a saved search
      cy.get('[data-cy=saved-search-item]').first().within(() => {
        cy.get('[data-cy=execute-saved-search]').click();
      });

      cy.wait('@searchFiles');

      // Verify search was executed
      cy.get('[data-cy=search-input]').should('have.value', '*.log');
      cy.get('[data-cy=search-results]').should('be.visible');
    });

    it('should delete saved searches', () => {
      cy.get('[data-cy=saved-searches-btn]').click();
      cy.wait('@getSavedSearches');

      // Delete a saved search
      cy.get('[data-cy=saved-search-item]').first().within(() => {
        cy.get('[data-cy=delete-saved-search]').click();
      });

      // Confirm deletion
      cy.get('[data-cy=confirm-delete-modal]').should('be.visible');
      cy.get('[data-cy=confirm-delete]').click();
      cy.wait('@deleteSavedSearch');

      // Verify deletion
      cy.get('[data-cy=notification]').should('contain', 'Search deleted');
    });
  });

  describe('Analytics Dashboard', () => {
    beforeEach(() => {
      cy.visit('/analytics');
      
      // Wait for all analytics data to load
      cy.wait('@getStorageAnalytics');
      cy.wait('@getFileTypeAnalytics');
      cy.wait('@getTopFiles');
    });

    it('should display storage overview analytics', () => {
      // Verify storage metrics
      cy.get('[data-cy=total-storage]').should('contain', '1.0 TB');
      cy.get('[data-cy=used-storage]').should('contain', '500.0 GB');
      cy.get('[data-cy=available-storage]').should('contain', '500.0 GB');
      cy.get('[data-cy=usage-percentage]').should('contain', '50%');

      // Verify storage by volume chart
      cy.get('[data-cy=storage-by-volume-chart]').should('be.visible');
      
      // Check volume breakdown
      cy.get('[data-cy=volume-storage-item]').should('have.length.greaterThan', 0);
      cy.get('[data-cy=volume-storage-item]').first().within(() => {
        cy.contains('db-data').should('be.visible');
        cy.contains('200.0 GB').should('be.visible');
        cy.contains('39.1%').should('be.visible');
      });

      // Verify growth trend chart
      cy.get('[data-cy=growth-trend-chart]').should('be.visible');
      cy.get('[data-cy=chart-tooltip]').should('exist');
    });

    it('should display file type distribution', () => {
      // Verify file type chart
      cy.get('[data-cy=file-type-chart]').should('be.visible');

      // Check file type breakdown
      cy.get('[data-cy=file-type-item]').should('have.length.greaterThan', 0);
      
      cy.get('[data-cy=file-type-item]').first().within(() => {
        cy.contains('Database Files').should('be.visible');
        cy.contains('45 files').should('be.visible');
        cy.contains('250.0 GB').should('be.visible');
        cy.contains('48.8%').should('be.visible');
      });

      // Test interactive chart
      cy.get('[data-cy=file-type-chart] [data-testid=pie]').first().click();
      cy.get('[data-cy=file-type-details]').should('be.visible');
      cy.get('[data-cy=file-type-extensions]').should('contain', '.db, .sqlite, .sql');
    });

    it('should display top files by size', () => {
      // Verify top files table
      cy.get('[data-cy=top-files-table]').should('be.visible');
      cy.get('[data-cy=top-file-item]').should('have.length.greaterThan', 0);

      // Check first top file
      cy.get('[data-cy=top-file-item]').first().within(() => {
        cy.contains('main.db').should('be.visible');
        cy.contains('80.0 GB').should('be.visible');
        cy.contains('db-data').should('be.visible');
      });

      // Test sorting
      cy.get('[data-cy=sort-by-name]').click();
      cy.wait('@getTopFiles');
      
      // Verify sort order changed
      cy.get('[data-cy=top-file-item]').first().within(() => {
        cy.contains('application.log').should('be.visible');
      });
    });

    it('should allow filtering analytics by time period', () => {
      // Change time period
      cy.get('[data-cy=time-period-filter]').select('7d');
      
      // Should reload all analytics
      cy.wait('@getStorageAnalytics');
      cy.wait('@getFileTypeAnalytics');
      cy.wait('@getTopFiles');

      // Verify period indicator
      cy.get('[data-cy=period-indicator]').should('contain', 'Last 7 days');

      // Change to custom range
      cy.get('[data-cy=time-period-filter]').select('custom');
      cy.get('[data-cy=custom-date-range]').should('be.visible');

      cy.get('[data-cy=start-date]').type('2024-01-01');
      cy.get('[data-cy=end-date]').type('2024-01-31');
      cy.get('[data-cy=apply-custom-range]').click();

      // Should reload with custom range
      cy.wait('@getStorageAnalytics');
    });

    it('should navigate to volume-specific analytics', () => {
      // Click on a volume in the storage breakdown
      cy.get('[data-cy=volume-storage-item]').first().within(() => {
        cy.get('[data-cy=view-volume-details]').click();
      });

      cy.wait('@getVolumeUsage');

      // Should navigate to volume analytics page
      cy.url().should('include', '/analytics/volume/db-data');
      
      // Verify volume-specific data
      cy.get('[data-cy=volume-name]').should('contain', 'db-data');
      cy.get('[data-cy=volume-usage-chart]').should('be.visible');
      cy.get('[data-cy=volume-file-breakdown]').should('be.visible');
    });

    it('should export analytics data', () => {
      // Test CSV export
      cy.get('[data-cy=export-dropdown]').click();
      cy.get('[data-cy=export-csv]').click();

      // Should trigger download (mock)
      cy.get('[data-cy=notification]').should('contain', 'Analytics exported to CSV');

      // Test PDF export
      cy.get('[data-cy=export-dropdown]').click();
      cy.get('[data-cy=export-pdf]').click();

      cy.get('[data-cy=notification]').should('contain', 'Analytics report generated');
    });
  });

  describe('Search Performance and UX', () => {
    it('should show search suggestions and autocomplete', () => {
      cy.visit('/search');

      // Start typing
      cy.get('[data-cy=search-input]').type('con');

      // Should show suggestions dropdown
      cy.get('[data-cy=search-suggestions]').should('be.visible');
      cy.get('[data-cy=suggestion-item]').should('contain', 'config');
      cy.get('[data-cy=suggestion-item]').should('contain', 'container');

      // Click a suggestion
      cy.get('[data-cy=suggestion-item]').first().click();

      // Should populate search input
      cy.get('[data-cy=search-input]').should('have.value', 'config');
    });

    it('should handle search keyboard shortcuts', () => {
      cy.visit('/');

      // Test global search shortcut (Ctrl+K or Cmd+K)
      cy.get('body').type('{ctrl+k}');
      
      // Should open search modal or navigate to search
      cy.get('[data-cy=search-modal]').should('be.visible');
      
      // Should focus search input
      cy.get('[data-cy=search-input]').should('be.focused');

      // Test escape to close
      cy.get('body').type('{esc}');
      cy.get('[data-cy=search-modal]').should('not.exist');
    });

    it('should provide search result previews', () => {
      cy.visit('/search');
      
      cy.get('[data-cy=search-input]').type('config.json');
      cy.get('[data-cy=search-submit]').click();
      cy.wait('@searchFiles');

      // Click preview button on search result
      cy.get('[data-cy=search-result-item]').first().within(() => {
        cy.get('[data-cy=preview-file]').click();
      });

      // Should show file preview modal
      cy.get('[data-cy=file-preview-modal]').should('be.visible');
      cy.get('[data-cy=file-content-preview]').should('be.visible');
      cy.get('[data-cy=file-metadata]').should('be.visible');

      // Should show syntax highlighting for JSON
      cy.get('[data-cy=file-content-preview]').should('have.class', 'language-json');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle search API errors gracefully', () => {
      // Mock search error
      cy.intercept('GET', '/api/v1/search/files*', {
        statusCode: 500,
        body: { error: 'Search service unavailable' }
      }).as('searchError');

      cy.visit('/search');
      cy.get('[data-cy=search-input]').type('test');
      cy.get('[data-cy=search-submit]').click();

      cy.wait('@searchError');

      // Should show error message
      cy.get('[data-cy=search-error]').should('be.visible');
      cy.get('[data-cy=search-error]').should('contain', 'Search service unavailable');

      // Should provide retry option
      cy.get('[data-cy=retry-search]').should('be.visible');
    });

    it('should handle slow search responses', () => {
      // Mock slow search response
      cy.intercept('GET', '/api/v1/search/files*', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ fixture: 'modern/search-all-results.json' });
          }, 3000);
        });
      }).as('slowSearch');

      cy.visit('/search');
      cy.get('[data-cy=search-input]').type('test');
      cy.get('[data-cy=search-submit]').click();

      // Should show loading state
      cy.get('[data-cy=search-loading]').should('be.visible');
      cy.get('[data-cy=search-progress]').should('be.visible');

      // Should allow cancellation
      cy.get('[data-cy=cancel-search]').should('be.visible');

      cy.wait('@slowSearch');

      // Loading should disappear
      cy.get('[data-cy=search-loading]').should('not.exist');
      cy.get('[data-cy=search-results]').should('be.visible');
    });

    it('should validate search input and filters', () => {
      cy.visit('/search');

      // Test empty search
      cy.get('[data-cy=search-submit]').click();
      cy.get('[data-cy=search-validation-error]').should('contain', 'Please enter a search query');

      // Test invalid date range
      cy.get('[data-cy=advanced-filters-toggle]').click();
      cy.get('[data-cy=modified-after-filter]').type('2024-12-31');
      cy.get('[data-cy=modified-before-filter]').type('2024-01-01');

      cy.get('[data-cy=search-input]').type('test');
      cy.get('[data-cy=search-submit]').click();

      cy.get('[data-cy=filter-validation-error]').should('contain', 'Start date must be before end date');
    });
  });
});