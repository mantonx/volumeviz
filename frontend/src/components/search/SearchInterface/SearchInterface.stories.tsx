import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { useState } from 'react';

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

const meta: Meta<typeof SearchInterface> = {
  title: 'Domain/SearchInterface',
  component: SearchInterface,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
**SearchInterface** - Advanced search with filters and saved searches

A sophisticated domain composition that provides comprehensive search functionality with advanced filtering, saved searches, and real-time results.

Features:
- Real-time search with debouncing
- Advanced filters (file types, sizes, dates)
- Saved searches with favorites
- Search history and suggestions
- Multiple result view modes
- Export functionality
- Comprehensive keyboard navigation
        `,
      },
    },
  },
  argTypes: {
    query: {
      control: 'object',
      description: 'Current search query object',
    },
    isSearching: {
      control: 'boolean',
      description: 'Whether search is in progress',
    },
    searchError: {
      control: 'text',
      description: 'Search error message',
    },
    enableRealTimeSearch: {
      control: 'boolean',
      description: 'Enable real-time search as user types',
    },
    layout: {
      control: 'radio',
      options: ['compact', 'standard', 'expanded'],
      description: 'Interface layout mode',
    },
    resultsView: {
      control: 'radio',
      options: ['list', 'grid', 'table'],
      description: 'Results display mode',
    },
    showAdvanced: {
      control: 'boolean',
      description: 'Show advanced search options',
    },
    showFilters: {
      control: 'boolean',
      description: 'Show search filters panel',
    },
    showSavedSearches: {
      control: 'boolean',
      description: 'Show saved searches panel',
    },
    showHistory: {
      control: 'boolean',
      description: 'Show search history',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SearchInterface>;

// Mock data generators
const createMockSuggestions = (query: string): SearchSuggestion[] => [
  {
    id: 'suggestion-1',
    text: `${query} files`,
    type: 'query',
    relevance: 90,
  },
  {
    id: 'suggestion-2',
    text: `${query} documents`,
    type: 'query',
    relevance: 85,
  },
  {
    id: 'suggestion-3',
    text: `recent ${query}`,
    type: 'recent',
    relevance: 80,
  },
  {
    id: 'suggestion-4',
    text: `popular ${query}`,
    type: 'popular',
    relevance: 75,
  },
];

// Interactive wrapper component for state management
const InteractiveSearchInterface = (props: Partial<SearchInterfaceProps>) => {
  const [searchState, setSearchState] = useState({
    query: '',
    results: null as SearchResults | null,
    isSearching: false,
    suggestions: [] as SearchSuggestion[],
  });

  const handleSearch = (query: SearchQuery) => {
    action('onSearch')(query);
    if ('query' in query && query.query.trim()) {
      setSearchState((prev) => ({ ...prev, isSearching: true }));

      // Simulate search delay
      setTimeout(() => {
        const results = createMockSearchResults(query.query, 15);
        setSearchState((prev) => ({
          ...prev,
          isSearching: false,
          results,
        }));
      }, 1000);
    }
  };

  const handleSearchChange = (query: SearchQuery) => {
    action('onSearchChange')(query);
    if ('query' in query) {
      setSearchState((prev) => ({
        ...prev,
        query: query.query,
        suggestions:
          query.query.length > 2 ? createMockSuggestions(query.query) : [],
      }));
    }
  };

  return (
    <SearchInterface
      {...props}
      results={searchState.results || undefined}
      isSearching={searchState.isSearching}
      suggestions={searchState.suggestions}
      savedSearches={createMockSavedSearches()}
      onSearch={handleSearch}
      onSearchChange={handleSearchChange}
      onResultClick={action('onResultClick')}
      onSaveSearch={action('onSaveSearch')}
      onLoadSavedSearch={action('onLoadSavedSearch')}
      onDeleteSavedSearch={action('onDeleteSavedSearch')}
      onSuggestionClick={action('onSuggestionClick')}
      onFilterChange={action('onFilterChange')}
      onScopeChange={action('onScopeChange')}
      onQueryTypeChange={action('onQueryTypeChange')}
      onExportResults={action('onExportResults')}
      onPageChange={action('onPageChange')}
    />
  );
};

/**
 * Default search interface with all features enabled
 */
export const Default: Story = {
  render: () => <InteractiveSearchInterface />,
};

/**
 * Search interface with initial query and results
 */
export const WithResults: Story = {
  render: () => {
    const mockResults = createMockSearchResults('document', 20);
    return (
      <SearchInterface
        query={{
          query: 'document',
          type: 'simple',
          scope: 'all',
          filters: {},
        }}
        results={mockResults}
        suggestions={createMockSuggestions('document')}
        savedSearches={createMockSavedSearches()}
        onSearch={action('onSearch')}
        onSearchChange={action('onSearchChange')}
        onResultClick={action('onResultClick')}
        onSaveSearch={action('onSaveSearch')}
        onLoadSavedSearch={action('onLoadSavedSearch')}
        onDeleteSavedSearch={action('onDeleteSavedSearch')}
        onSuggestionClick={action('onSuggestionClick')}
        onFilterChange={action('onFilterChange')}
        onScopeChange={action('onScopeChange')}
        onQueryTypeChange={action('onQueryTypeChange')}
        onExportResults={action('onExportResults')}
        onPageChange={action('onPageChange')}
      />
    );
  },
};

/**
 * Loading state while search is in progress
 */
export const Loading: Story = {
  args: {
    query: {
      query: 'searching...',
      type: 'simple',
      scope: 'all',
      filters: {},
    },
    isSearching: true,
    onSearch: action('onSearch'),
    onSearchChange: action('onSearchChange'),
  },
};

/**
 * Error state with search failure
 */
export const WithError: Story = {
  args: {
    query: {
      query: 'failed search',
      type: 'simple',
      scope: 'all',
      filters: {},
    },
    searchError:
      'Search service temporarily unavailable. Please try again later.',
    onSearch: action('onSearch'),
    onSearchChange: action('onSearchChange'),
  },
};

/**
 * Empty results state
 */
export const EmptyResults: Story = {
  args: {
    query: {
      query: 'nonexistent',
      type: 'simple',
      scope: 'all',
      filters: {},
    },
    results: {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
      searchTime: 156,
      query: {
        query: 'nonexistent',
        type: 'simple',
        scope: 'all',
        filters: {},
      },
      executedAt: new Date(),
    },
    onSearch: action('onSearch'),
    onSearchChange: action('onSearchChange'),
  },
};

/**
 * Compact layout mode
 */
export const CompactLayout: Story = {
  render: () => (
    <InteractiveSearchInterface
      layout="compact"
      showFilters={false}
      showSavedSearches={false}
    />
  ),
};

/**
 * Expanded layout with all panels visible
 */
export const ExpandedLayout: Story = {
  render: () => (
    <InteractiveSearchInterface
      layout="expanded"
      showFilters={true}
      showSavedSearches={true}
      showHistory={true}
    />
  ),
};

/**
 * Advanced search mode with filters
 */
export const WithFilters: Story = {
  render: () => {
    const mockResults = createMockSearchResults('filtered', 12);
    return (
      <SearchInterface
        query={{
          query: 'filtered search',
          type: 'advanced',
          scope: 'volume',
          filters: {
            fileTypes: ['document', 'image'],
            sizeFilter: {
              operator: 'gt',
              value: 1,
              unit: 'MB',
            },
            includeHidden: false,
            caseSensitive: true,
          },
        }}
        results={mockResults}
        showFilters={true}
        showAdvanced={true}
        savedSearches={createMockSavedSearches()}
        onSearch={action('onSearch')}
        onSearchChange={action('onSearchChange')}
        onResultClick={action('onResultClick')}
        onSaveSearch={action('onSaveSearch')}
        onLoadSavedSearch={action('onLoadSavedSearch')}
        onDeleteSavedSearch={action('onDeleteSavedSearch')}
        onSuggestionClick={action('onSuggestionClick')}
        onFilterChange={action('onFilterChange')}
        onScopeChange={action('onScopeChange')}
        onQueryTypeChange={action('onQueryTypeChange')}
        onExportResults={action('onExportResults')}
        onPageChange={action('onPageChange')}
      />
    );
  },
};

/**
 * Grid view mode for results
 */
export const GridView: Story = {
  render: () => <InteractiveSearchInterface resultsView="grid" />,
};

/**
 * Table view mode for results
 */
export const TableView: Story = {
  render: () => <InteractiveSearchInterface resultsView="table" />,
};

/**
 * Real-time search disabled
 */
export const NoRealTimeSearch: Story = {
  render: () => <InteractiveSearchInterface enableRealTimeSearch={false} />,
};

/**
 * Custom empty state
 */
export const CustomEmptyState: Story = {
  args: {
    results: {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
      searchTime: 89,
      query: {
        query: 'custom empty',
        type: 'simple',
        scope: 'all',
        filters: {},
      },
      executedAt: new Date(),
    },
    emptyState: (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-12 h-12 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Files Found
        </h3>
        <p className="text-gray-500 text-center max-w-md">
          We couldn't find any files matching your search criteria. Try
          adjusting your filters or search terms.
        </p>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Clear Filters
        </button>
      </div>
    ),
    onSearch: action('onSearch'),
    onSearchChange: action('onSearchChange'),
  },
};

/**
 * Custom loading state
 */
export const CustomLoadingState: Story = {
  args: {
    isSearching: true,
    loadingState: (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="mt-4 text-center">
          <div className="text-lg font-medium text-gray-900">
            Searching files...
          </div>
          <div className="text-sm text-gray-500 mt-1">
            This may take a few moments
          </div>
        </div>
      </div>
    ),
    onSearch: action('onSearch'),
    onSearchChange: action('onSearchChange'),
  },
};

/**
 * Configuration showcase with different settings
 */
export const ConfigurationShowcase: Story = {
  render: () => (
    <InteractiveSearchInterface
      config={{
        enableAdvancedSearch: true,
        enableSavedSearches: true,
        enableSearchHistory: true,
        enableSuggestions: true,
        enableFacets: true,
        enableSpellCheck: true,
        maxSuggestions: 5,
        maxHistoryItems: 10,
        searchDelay: 500,
        minQueryLength: 2,
        defaultScope: 'volume',
        defaultFilters: {
          showHidden: false,
          showSystem: false,
        },
      }}
      showFilters={true}
      showSavedSearches={true}
    />
  ),
};
