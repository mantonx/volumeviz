import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInterface } from './SearchInterface';
import type {
  SearchInterfaceProps,
  SearchQuery,
  SearchResults,
  SavedSearch,
  SearchSuggestion,
} from './SearchInterface.types';
import {
  createMockSearchResults,
  createMockSavedSearches,
} from './SearchInterface.types';

// Mock components from other modules
vi.mock('../../ui/ProgressBar', () => ({
  ProgressBar: vi.fn(({ children, ...props }) => (
    <div data-testid="progress-bar" {...props}>
      {children}
    </div>
  )),
}));

vi.mock('../../ui/StatusBadge', () => ({
  StatusBadge: vi.fn(({ children, ...props }) => (
    <div data-testid="status-badge" {...props}>
      {children}
    </div>
  )),
}));

// Helper function to create default props
const createDefaultProps = (
  overrides: Partial<SearchInterfaceProps> = {},
): SearchInterfaceProps => ({
  onSearch: vi.fn(),
  onSearchChange: vi.fn(),
  onResultClick: vi.fn(),
  onSaveSearch: vi.fn(),
  onLoadSavedSearch: vi.fn(),
  onDeleteSavedSearch: vi.fn(),
  onSuggestionClick: vi.fn(),
  onFilterChange: vi.fn(),
  onScopeChange: vi.fn(),
  onQueryTypeChange: vi.fn(),
  onExportResults: vi.fn(),
  onPageChange: vi.fn(),
  ...overrides,
});

// Mock data
const mockQuery: SearchQuery = {
  query: 'test search',
  type: 'simple',
  scope: 'all',
  filters: {},
};

const mockResults = createMockSearchResults('test', 10);
const mockSavedSearches = createMockSavedSearches();

const mockSuggestions: SearchSuggestion[] = [
  {
    id: 'suggestion-1',
    text: 'test files',
    type: 'query',
    relevance: 90,
  },
  {
    id: 'suggestion-2',
    text: 'test documents',
    type: 'recent',
    relevance: 85,
  },
];

describe('SearchInterface', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const props = createDefaultProps();
      render(<SearchInterface {...props} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Search files and folders...'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /search/i }),
      ).toBeInTheDocument();
    });

    it('renders with custom test ID', () => {
      const props = createDefaultProps({ testId: 'custom-search' });
      const { container } = render(<SearchInterface {...props} />);

      expect(
        container.querySelector('[data-testid="custom-search"]'),
      ).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const props = createDefaultProps({ className: 'custom-class' });
      const { container } = render(<SearchInterface {...props} />);

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders with initial query', () => {
      const props = createDefaultProps({ query: mockQuery });
      render(<SearchInterface {...props} />);

      expect(screen.getByDisplayValue('test search')).toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('updates input value when typing', async () => {
      const props = createDefaultProps();
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'new search');

      expect(input).toHaveValue('new search');
    });

    it('clears input when clear button is clicked', async () => {
      const props = createDefaultProps({ query: mockQuery });
      render(<SearchInterface {...props} />);

      const input = screen.getByDisplayValue('test search');
      const clearButton = screen.getByRole('button', { name: /clear search/i });

      await user.click(clearButton);

      expect(input).toHaveValue('');
    });

    it('triggers search on enter key', async () => {
      const onSearch = vi.fn();
      const props = createDefaultProps({ onSearch });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          type: 'simple',
          scope: 'all',
        }),
      );
    });

    it('disables input during search', () => {
      const props = createDefaultProps({ isSearching: true });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Real-time Search', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers real-time search with debounce', async () => {
      const onSearchChange = vi.fn();
      const props = createDefaultProps({
        enableRealTimeSearch: true,
        onSearchChange,
        config: { searchDelay: 100 },
      });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      
      // Type text
      await user.type(input, 'test');

      // Should not trigger immediately
      expect(onSearchChange).not.toHaveBeenCalled();

      // Fast-forward timer
      vi.advanceTimersByTime(100);
      
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onSearchChange).toHaveBeenCalled();
    });

    it('does not trigger when real-time search is disabled', async () => {
      const onSearchChange = vi.fn();
      const props = createDefaultProps({
        enableRealTimeSearch: false,
        onSearchChange,
      });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Fast-forward timers
      vi.advanceTimersByTime(1000);
      
      // Give it a moment to process  
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onSearchChange).not.toHaveBeenCalled();
    });
  });

  describe('Search Controls', () => {
    it('changes query type', async () => {
      const onQueryTypeChange = vi.fn();
      const props = createDefaultProps({ onQueryTypeChange });
      render(<SearchInterface {...props} />);

      const typeSelect = screen.getByDisplayValue('Simple');
      await user.selectOptions(typeSelect, 'advanced');

      expect(onQueryTypeChange).toHaveBeenCalledWith('advanced');
    });

    it('changes search scope', async () => {
      const onScopeChange = vi.fn();
      const props = createDefaultProps({ onScopeChange });
      render(<SearchInterface {...props} />);

      const scopeSelect = screen.getByDisplayValue('All');
      await user.selectOptions(scopeSelect, 'volume');

      expect(onScopeChange).toHaveBeenCalledWith('volume');
    });

    it('toggles filters panel', async () => {
      const props = createDefaultProps();
      render(<SearchInterface {...props} />);

      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await user.click(filtersButton);

      expect(screen.getByText('File Types')).toBeInTheDocument();
    });

    it('toggles saved searches panel', async () => {
      const props = createDefaultProps({ savedSearches: mockSavedSearches });
      render(<SearchInterface {...props} />);

      const savedButton = screen.getByRole('button', { name: /saved/i });
      await user.click(savedButton);

      expect(screen.getByText('Saved Searches')).toBeInTheDocument();
    });
  });

  describe('Search Suggestions', () => {
    it('displays suggestions when query is entered', () => {
      const props = createDefaultProps({
        query: { query: 'test', type: 'simple', scope: 'all', filters: {} },
        suggestions: mockSuggestions,
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('test files')).toBeInTheDocument();
      expect(screen.getByText('test documents')).toBeInTheDocument();
    });

    it('navigates suggestions with arrow keys', async () => {
      const props = createDefaultProps({
        query: { query: 'test', type: 'simple', scope: 'all', filters: {} },
        suggestions: mockSuggestions,
      });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Arrow down to select first suggestion
      await user.keyboard('{ArrowDown}');

      const firstSuggestion = screen.getByText('test files').closest('button');
      expect(firstSuggestion).toHaveClass('bg-blue-50');
    });

    it('selects suggestion on click', async () => {
      const onSuggestionClick = vi.fn();
      const props = createDefaultProps({
        query: { query: 'test', type: 'simple', scope: 'all', filters: {} },
        suggestions: mockSuggestions,
        onSuggestionClick,
      });
      render(<SearchInterface {...props} />);

      const suggestion = screen.getByText('test files');
      await user.click(suggestion);

      expect(onSuggestionClick).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  describe('Search Filters', () => {
    it('shows filters panel when enabled', () => {
      const props = createDefaultProps({ showFilters: true });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('File Types')).toBeInTheDocument();
      expect(screen.getByText('File Size')).toBeInTheDocument();
      expect(screen.getByText('Date Modified')).toBeInTheDocument();
    });

    it('toggles file type filters', async () => {
      const onFilterChange = vi.fn();
      const props = createDefaultProps({
        showFilters: true,
        onFilterChange,
      });
      render(<SearchInterface {...props} />);

      const documentCheckbox = screen.getByLabelText(/document/i);
      await user.click(documentCheckbox);

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fileTypes: expect.arrayContaining(['document']),
        }),
      );
    });

    it('configures size filters', async () => {
      const onFilterChange = vi.fn();
      const props = createDefaultProps({
        showFilters: true,
        onFilterChange,
      });
      render(<SearchInterface {...props} />);

      const sizeSelect = screen.getByDisplayValue('Any size');
      await user.selectOptions(sizeSelect, 'gt');

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sizeFilter: expect.objectContaining({
            operator: 'gt',
            value: 1,
            unit: 'MB',
          }),
        }),
      );
    });

    it('toggles additional options', async () => {
      const onFilterChange = vi.fn();
      const props = createDefaultProps({
        showFilters: true,
        onFilterChange,
      });
      render(<SearchInterface {...props} />);

      const hiddenFilesCheckbox =
        screen.getByLabelText(/include hidden files/i);
      await user.click(hiddenFilesCheckbox);

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          includeHidden: true,
        }),
      );
    });
  });

  describe('Saved Searches', () => {
    it('displays saved searches when panel is open', () => {
      const props = createDefaultProps({
        showSavedSearches: true,
        savedSearches: mockSavedSearches,
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('Large Files')).toBeInTheDocument();
      expect(screen.getByText('Recent Images')).toBeInTheDocument();
    });

    it('loads saved search on click', async () => {
      const onLoadSavedSearch = vi.fn();
      const props = createDefaultProps({
        showSavedSearches: true,
        savedSearches: mockSavedSearches,
        onLoadSavedSearch,
      });
      render(<SearchInterface {...props} />);

      const savedSearch = screen.getByText('Large Files');
      await user.click(savedSearch);

      expect(onLoadSavedSearch).toHaveBeenCalledWith(mockSavedSearches[0]);
    });

    it('deletes saved search', async () => {
      const onDeleteSavedSearch = vi.fn();
      const props = createDefaultProps({
        showSavedSearches: true,
        savedSearches: mockSavedSearches,
        onDeleteSavedSearch,
      });
      render(<SearchInterface {...props} />);

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(onDeleteSavedSearch).toHaveBeenCalledWith(mockSavedSearches[0].id);
    });

    it('saves current search', async () => {
      // Mock window.prompt
      const mockPrompt = vi.fn().mockReturnValue('My Search');
      global.prompt = mockPrompt;

      const onSaveSearch = vi.fn();
      const props = createDefaultProps({
        showSavedSearches: true,
        query: mockQuery,
        onSaveSearch,
      });
      render(<SearchInterface {...props} />);

      const saveButton = screen.getByText('Save Current');
      await user.click(saveButton);

      expect(mockPrompt).toHaveBeenCalledWith('Enter a name for this search:');
      expect(onSaveSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Search',
          query: mockQuery,
        }),
      );
    });
  });

  describe('Search Results', () => {
    it('displays search results', () => {
      const props = createDefaultProps({ results: mockResults });
      render(<SearchInterface {...props} />);

      expect(
        screen.getByText(`${mockResults.totalCount.toLocaleString()} results`),
      ).toBeInTheDocument();
      expect(screen.getByText(mockResults.items[0].name)).toBeInTheDocument();
    });

    it('shows loading state', () => {
      const props = createDefaultProps({ isSearching: true });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      const props = createDefaultProps({
        searchError: 'Search failed',
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });

    it('shows empty state', () => {
      const props = createDefaultProps({
        results: {
          ...mockResults,
          items: [],
          totalCount: 0,
        },
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('handles result click', async () => {
      const onResultClick = vi.fn();
      const props = createDefaultProps({
        results: mockResults,
        onResultClick,
      });
      render(<SearchInterface {...props} />);

      const firstResult = screen.getByText(mockResults.items[0].name);
      await user.click(firstResult);

      expect(onResultClick).toHaveBeenCalledWith(mockResults.items[0]);
    });

    it('shows pagination when more results available', () => {
      const props = createDefaultProps({
        results: { ...mockResults, hasMore: true },
      });
      render(<SearchInterface {...props} />);

      expect(
        screen.getByRole('button', { name: /load more/i }),
      ).toBeInTheDocument();
    });

    it('handles pagination', async () => {
      const onPageChange = vi.fn();
      const props = createDefaultProps({
        results: { ...mockResults, hasMore: true, page: 1 },
        onPageChange,
      });
      render(<SearchInterface {...props} />);

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Custom States', () => {
    it('renders custom empty state', () => {
      const customEmpty = <div data-testid="custom-empty">Custom Empty</div>;
      const props = createDefaultProps({
        results: { ...mockResults, items: [], totalCount: 0 },
        emptyState: customEmpty,
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
    });

    it('renders custom loading state', () => {
      const customLoading = (
        <div data-testid="custom-loading">Custom Loading</div>
      );
      const props = createDefaultProps({
        isSearching: true,
        loadingState: customLoading,
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    });

    it('renders custom error state', () => {
      const customError = <div data-testid="custom-error">Custom Error</div>;
      const props = createDefaultProps({
        searchError: 'Error occurred',
        errorState: customError,
      });
      render(<SearchInterface {...props} />);

      expect(screen.getByTestId('custom-error')).toBeInTheDocument();
    });
  });

  describe('Layout Modes', () => {
    it('applies compact layout classes', () => {
      const props = createDefaultProps({ layout: 'compact' });
      const { container } = render(<SearchInterface {...props} />);

      expect(
        container.querySelector('[data-testid="search-interface"]'),
      ).toHaveClass('p-4');
    });

    it('applies expanded layout classes', () => {
      const props = createDefaultProps({ layout: 'expanded' });
      const { container } = render(<SearchInterface {...props} />);

      expect(
        container.querySelector('[data-testid="search-interface"]'),
      ).toHaveClass('p-8');
    });
  });

  describe('Imperative API', () => {
    it('provides focus method', () => {
      const ref = { current: null };
      const props = createDefaultProps();
      render(<SearchInterface ref={ref} {...props} />);

      expect(ref.current).toHaveProperty('focus');
      expect(typeof ref.current?.focus).toBe('function');
    });

    it('provides clear method', () => {
      const ref = { current: null };
      const props = createDefaultProps({ query: mockQuery });
      render(<SearchInterface ref={ref} {...props} />);

      ref.current?.clear();

      // Check that clear method exists and can be called
      expect(ref.current?.getQuery()).toEqual(
        expect.objectContaining({
          query: '',
          type: 'simple',
          scope: 'all',
          filters: {},
        }),
      );
    });

    it('provides search method', () => {
      const onSearch = vi.fn();
      const ref = { current: null };
      const props = createDefaultProps({
        query: mockQuery,
        onSearch,
      });
      render(<SearchInterface ref={ref} {...props} />);

      ref.current?.search();

      expect(onSearch).toHaveBeenCalled();
    });

    it('provides toggle methods', () => {
      const ref = { current: null };
      const props = createDefaultProps();
      render(<SearchInterface ref={ref} {...props} />);

      expect(ref.current).toHaveProperty('toggleAdvanced');
      expect(ref.current).toHaveProperty('toggleFilters');
      expect(typeof ref.current?.toggleAdvanced).toBe('function');
      expect(typeof ref.current?.toggleFilters).toBe('function');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const props = createDefaultProps();
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute(
        'placeholder',
        'Search files and folders...',
      );
    });

    it('supports keyboard navigation', async () => {
      const props = createDefaultProps({
        query: { query: 'test', type: 'simple', scope: 'all', filters: {} },
        suggestions: mockSuggestions,
      });
      render(<SearchInterface {...props} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Test arrow key navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{Escape}');

      // Should not throw any errors
      expect(input).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles search validation errors', async () => {
      const props = createDefaultProps();
      render(<SearchInterface {...props} />);

      const searchButton = screen.getByRole('button', { name: /search/i });

      // Try to search with empty query
      await user.click(searchButton);

      // Should show validation error
      expect(
        screen.getByText('Search query cannot be empty'),
      ).toBeInTheDocument();
    });

    it('handles missing required props gracefully', () => {
      // Test with minimal props
      expect(() => {
        render(<SearchInterface />);
      }).not.toThrow();
    });
  });
});
