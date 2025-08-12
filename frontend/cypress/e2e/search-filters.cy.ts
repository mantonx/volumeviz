/**
 * Search and Filters E2E Tests
 * 
 * Tests search functionality with debouncing, filtering,
 * and various edge cases.
 */

describe('Search and Filters', () => {
  beforeEach(() => {
    cy.setupCommonInterceptors();
    
    // Load test data with multiple volumes for filtering
    cy.fixture('volumes.json').then((volumes) => {
      cy.mockVolumeData(volumes.multipleVolumes);
    });
  });

  describe('Volume Search', () => {
    it('performs basic search with debouncing', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Get the search input
      const searchInput = cy.getByTestId('search-input');
      
      // Verify search input exists
      searchInput.should('be.visible').and('have.attr', 'placeholder');
      
      // Type search term and verify debouncing
      searchInput.type('app');
      
      // Should not immediately filter (debouncing active)
      cy.getByTestId('volume-list')
        .children()
        .should('have.length.greaterThan', 1);
      
      // Wait for debounce to complete
      cy.waitForDebounce(500);
      
      // Now should be filtered
      cy.getByTestId('volume-list')
        .should('contain', 'app-data')
        .and('not.contain', 'orphaned-volume');
      
      // Clear search
      searchInput.clear();
      cy.waitForDebounce(300);
      
      // Should show all volumes again
      cy.getByTestId('volume-list')
        .children()
        .should('have.length.greaterThan', 1);
      
      cy.takeNamedScreenshot('search-basic-functionality');
    });

    it('handles search with no results', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Search for non-existent volume
      cy.testSearch('nonexistent-volume', 0);
      
      // Should show empty state message
      cy.getByTestId('no-results-message')
        .should('be.visible')
        .and('contain', 'No volumes found');
      
      // Should show suggestion to clear search
      cy.getByTestId('clear-search-button').should('be.visible');
      
      // Clear search via button
      cy.getByTestId('clear-search-button').click();
      
      // Should show all volumes
      cy.getByTestId('volume-list')
        .children()
        .should('have.length.greaterThan', 0);
      
      cy.takeNamedScreenshot('search-no-results');
    });

    it('searches across volume names and labels', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Search by volume name
      cy.testSearch('database');
      cy.getByTestId('volume-list')
        .should('contain', 'database-storage')
        .and('not.contain', 'app-data');
      
      // Clear and search by label value
      cy.getByTestId('search-input').clear();
      cy.testSearch('production');
      cy.waitForDebounce(500);
      
      cy.getByTestId('volume-list')
        .should('contain', 'app-data')
        .and('not.contain', 'database-storage');
      
      // Search by label key
      cy.getByTestId('search-input').clear();
      cy.testSearch('backup');
      cy.waitForDebounce(500);
      
      cy.getByTestId('volume-list')
        .should('contain', 'database-storage')
        .and('not.contain', 'app-data');
      
      cy.takeNamedScreenshot('search-labels-and-names');
    });

    it('handles rapid typing with proper debouncing', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      const searchInput = cy.getByTestId('search-input');
      
      // Type rapidly
      searchInput.type('ap');
      cy.wait(100);
      searchInput.type('p');
      cy.wait(100); 
      searchInput.type('-');
      cy.wait(100);
      searchInput.type('da');
      
      // Should not have triggered search yet
      cy.getByTestId('volume-list')
        .children()
        .should('have.length.greaterThan', 1);
      
      // Wait for final debounce
      cy.waitForDebounce(600);
      
      // Now should be filtered to app-data
      cy.getByTestId('volume-list')
        .should('contain', 'app-data')
        .and('not.contain', 'database-storage');
    });

    it('preserves search state on page refresh', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Perform search
      cy.testSearch('app');
      
      // Reload page
      cy.reload();
      cy.wait('@volumesListMocked');
      
      // Search should be preserved (if implemented)
      cy.getByTestId('search-input').should('have.value', 'app');
      cy.getByTestId('volume-list').should('contain', 'app-data');
    });
  });

  describe('Volume Filters', () => {
    it('filters by volume status (orphaned)', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click orphaned filter
      cy.getByTestId('filter-orphaned').click();
      
      // Should show only orphaned volumes
      cy.getByTestId('volume-list')
        .should('contain', 'orphaned-volume')
        .and('not.contain', 'app-data');
      
      // Filter button should show active state
      cy.getByTestId('filter-orphaned')
        .should('have.class', 'active')
        .or('have.attr', 'aria-pressed', 'true');
      
      // Clear filter
      cy.getByTestId('filter-orphaned').click();
      
      // Should show all volumes
      cy.getByTestId('volume-list')
        .children()
        .should('have.length.greaterThan', 1);
      
      cy.takeNamedScreenshot('filter-orphaned-volumes');
    });

    it('filters by volume type (system)', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click system filter
      cy.getByTestId('filter-system').click();
      
      // Should show only system volumes
      cy.getByTestId('volume-list')
        .should('contain', 'system-logs')
        .and('not.contain', 'app-data');
      
      cy.takeNamedScreenshot('filter-system-volumes');
    });

    it('combines search with filters', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Apply filter first
      cy.getByTestId('filter-orphaned').click();
      
      // Then search within filtered results
      cy.testSearch('orphan');
      
      // Should show filtered and searched results
      cy.getByTestId('volume-list')
        .should('contain', 'orphaned-volume')
        .and('not.contain', 'app-data');
      
      // Clear search but keep filter
      cy.getByTestId('search-input').clear();
      cy.waitForDebounce(300);
      
      // Should still show only orphaned volumes
      cy.getByTestId('volume-list').should('contain', 'orphaned-volume');
      
      cy.takeNamedScreenshot('combined-search-and-filters');
    });

    it('shows active filter count', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // No filters initially
      cy.getByTestId('active-filters-count').should('not.exist');
      
      // Apply one filter
      cy.getByTestId('filter-orphaned').click();
      
      cy.getByTestId('active-filters-count')
        .should('be.visible')
        .and('contain', '1');
      
      // Apply second filter
      cy.getByTestId('filter-system').click();
      
      cy.getByTestId('active-filters-count')
        .should('contain', '2');
      
      // Clear all filters button
      cy.getByTestId('clear-all-filters').click();
      
      cy.getByTestId('active-filters-count').should('not.exist');
    });
  });

  describe('Sorting', () => {
    it('sorts volumes by name', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click sort by name
      cy.getByTestId('sort-by-name').click();
      
      // Verify alphabetical order
      cy.getByTestId('volume-list')
        .find('[data-testid="volume-item"]')
        .first()
        .should('contain', 'app-data'); // "app-data" comes before others alphabetically
      
      // Click again for reverse order
      cy.getByTestId('sort-by-name').click();
      
      // Should show reverse alphabetical
      cy.getByTestId('volume-list')
        .find('[data-testid="volume-item"]')
        .first()
        .should('contain', 'system-logs'); // "system-logs" comes last alphabetically
      
      cy.takeNamedScreenshot('sorting-by-name');
    });

    it('sorts volumes by size', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click sort by size
      cy.getByTestId('sort-by-size').click();
      
      // Should show largest first (database-storage has 10485760 bytes)
      cy.getByTestId('volume-list')
        .find('[data-testid="volume-item"]')
        .first()
        .should('contain', 'database-storage');
      
      cy.takeNamedScreenshot('sorting-by-size');
    });

    it('sorts volumes by created date', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Click sort by date
      cy.getByTestId('sort-by-date').click();
      
      // Should show newest first (system-logs created on 2023-01-04)
      cy.getByTestId('volume-list')
        .find('[data-testid="volume-item"]')
        .first()
        .should('contain', 'system-logs');
      
      cy.takeNamedScreenshot('sorting-by-date');
    });
  });

  describe('Search Performance', () => {
    it('handles large datasets efficiently', () => {
      // Create large dataset fixture
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        name: `volume-${i.toString().padStart(3, '0')}`,
        driver: 'local',
        created_at: new Date(2023, 0, i + 1).toISOString(),
        size_bytes: Math.floor(Math.random() * 10000000),
        attachments_count: Math.floor(Math.random() * 3),
        is_system: i % 10 === 0,
        is_orphaned: i % 7 === 0,
        labels: {
          environment: i % 2 === 0 ? 'production' : 'development',
          app: `app-${Math.floor(i / 10)}`
        }
      }));

      cy.mockVolumeData(largeDataset);
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Search should still be responsive
      const startTime = Date.now();
      
      cy.testSearch('volume-050');
      
      // Verify search completed quickly (under 1 second)
      cy.then(() => {
        const endTime = Date.now();
        expect(endTime - startTime).to.be.lessThan(1000);
      });
      
      // Should find the specific volume
      cy.getByTestId('volume-list')
        .should('contain', 'volume-050')
        .and('not.contain', 'volume-051');
      
      cy.takeNamedScreenshot('large-dataset-search');
    });
  });

  describe('URL State Management', () => {
    it('updates URL with search parameters', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Perform search
      cy.testSearch('app');
      
      // URL should include search parameter
      cy.url().should('include', 'search=app');
      
      // Apply filter
      cy.getByTestId('filter-orphaned').click();
      
      // URL should include filter parameter
      cy.url().should('include', 'filter=orphaned');
      
      // Navigate back
      cy.go('back');
      
      // Search should be cleared but filter might remain
      cy.getByTestId('search-input').should('have.value', '');
    });

    it('loads state from URL parameters', () => {
      // Visit with search and filter parameters
      cy.visitPage('/?search=database&filter=orphaned');
      cy.wait('@volumesListMocked');

      // Search input should be populated
      cy.getByTestId('search-input').should('have.value', 'database');
      
      // Filter should be active
      cy.getByTestId('filter-orphaned')
        .should('have.class', 'active')
        .or('have.attr', 'aria-pressed', 'true');
      
      // Results should be filtered
      cy.getByTestId('volume-list')
        .should('contain', 'database')
        .or('be.empty'); // Might be empty if no orphaned volumes match "database"
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Tab to search input
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'search-input');
      
      // Type search
      cy.focused().type('app');
      cy.waitForDebounce(500);
      
      // Tab to filters
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid').and('include', 'filter');
      
      // Activate filter with space or enter
      cy.focused().type('{enter}');
      
      // Filter should be activated
      cy.focused()
        .should('have.class', 'active')
        .or('have.attr', 'aria-pressed', 'true');
    });

    it('announces search results to screen readers', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Check for aria-live region
      cy.getByTestId('search-results-status')
        .should('have.attr', 'aria-live', 'polite');
      
      // Perform search
      cy.testSearch('app');
      
      // Status should be announced
      cy.getByTestId('search-results-status')
        .should('contain', 'found')
        .and('contain', 'volume');
    });

    it('has proper ARIA labels and roles', () => {
      cy.visitPage('/');
      cy.wait('@volumesListMocked');

      // Search input should have proper labeling
      cy.getByTestId('search-input')
        .should('have.attr', 'aria-label')
        .and('have.attr', 'role', 'searchbox');
      
      // Filter buttons should have proper roles
      cy.getByTestId('filter-orphaned')
        .should('have.attr', 'role', 'button')
        .and('have.attr', 'aria-pressed');
      
      // Volume list should have proper structure
      cy.getByTestId('volume-list')
        .should('have.attr', 'role', 'list');
      
      cy.getByTestId('volume-item')
        .first()
        .should('have.attr', 'role', 'listitem');
    });
  });
});