import type { ReactNode } from 'react';

/**
 * Search query types
 */
export type SearchQueryType = 'simple' | 'advanced' | 'regex' | 'fuzzy';

/**
 * Search scope
 */
export type SearchScope = 'all' | 'volume' | 'path' | 'metadata';

/**
 * Search operator for advanced queries
 */
export type SearchOperator = 'AND' | 'OR' | 'NOT';

/**
 * Search field types
 */
export type SearchField =
  | 'name'
  | 'content'
  | 'extension'
  | 'size'
  | 'modified'
  | 'created'
  | 'path'
  | 'type'
  | 'tags'
  | 'metadata';

/**
 * Size comparison operators
 */
export type SizeOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

/**
 * Date comparison operators
 */
export type DateOperator =
  | 'eq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'relative';

/**
 * File type categories
 */
export type FileTypeCategory =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'other';

/**
 * Search filter condition
 */
export interface SearchCondition {
  id: string;
  field: SearchField;
  operator: SearchOperator;
  value: string | number | Date | boolean;
  modifier?: string; // For regex flags, fuzzy distance, etc.
}

/**
 * Advanced search query structure
 */
export interface AdvancedSearchQuery {
  conditions: SearchCondition[];
  logic: SearchOperator; // How to combine conditions
  grouping?: {
    [key: string]: string[]; // Group condition IDs
  };
}

/**
 * Size filter configuration
 */
export interface SizeFilter {
  operator: SizeOperator;
  value: number;
  secondValue?: number; // For 'between' operator
  unit: 'B' | 'KB' | 'MB' | 'GB' | 'TB';
}

/**
 * Date filter configuration
 */
export interface DateFilter {
  operator: DateOperator;
  value: Date | string; // String for relative dates like "1 week ago"
  secondValue?: Date;
  field: 'modified' | 'created' | 'accessed';
}

/**
 * Search filters
 */
export interface SearchFilters {
  fileTypes?: FileTypeCategory[];
  extensions?: string[];
  sizeFilter?: SizeFilter;
  dateFilter?: DateFilter;
  pathFilter?: string;
  tagFilter?: string[];
  includeHidden?: boolean;
  includeSystem?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

/**
 * Simple search query
 */
export interface SimpleSearchQuery {
  query: string;
  type: SearchQueryType;
  scope: SearchScope;
  filters: SearchFilters;
}

/**
 * Search query union type
 */
export type SearchQuery = SimpleSearchQuery | AdvancedSearchQuery;

/**
 * Saved search
 */
export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  useCount: number;
  tags?: string[];
  isPublic?: boolean;
  createdBy?: string;
  favorite?: boolean;
}

/**
 * Search result item
 */
export interface SearchResultItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
  extension?: string;
  mimeType?: string;
  relevanceScore: number;
  highlights?: {
    field: string;
    matches: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }[];
  metadata?: Record<string, any>;
  thumbnailUrl?: string;
  previewUrl?: string;
  context?: {
    volumeId: string;
    volumeName: string;
    parentPath: string;
  };
}

/**
 * Search results with metadata
 */
export interface SearchResults {
  items: SearchResultItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchTime: number; // milliseconds
  facets?: {
    [key: string]: Array<{
      value: string;
      count: number;
    }>;
  };
  suggestions?: string[];
  correctedQuery?: string;
  query: SearchQuery;
  executedAt: Date;
}

/**
 * Search suggestions
 */
export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'filter' | 'field' | 'recent' | 'popular';
  category?: string;
  relevance: number;
  metadata?: Record<string, any>;
}

/**
 * Search history item
 */
export interface SearchHistoryItem {
  id: string;
  query: SearchQuery;
  results: {
    totalCount: number;
    searchTime: number;
  };
  executedAt: Date;
  favorite?: boolean;
}

/**
 * Search interface configuration
 */
export interface SearchConfig {
  enableAdvancedSearch?: boolean;
  enableSavedSearches?: boolean;
  enableSearchHistory?: boolean;
  enableSuggestions?: boolean;
  enableFacets?: boolean;
  enableSpellCheck?: boolean;
  maxSuggestions?: number;
  maxHistoryItems?: number;
  searchDelay?: number; // Debounce delay in ms
  minQueryLength?: number;
  defaultScope?: SearchScope;
  defaultFilters?: SearchFilters;
}

/**
 * Main component props
 */
export interface SearchInterfaceProps {
  /** Current search query */
  query?: SearchQuery;

  /** Search results */
  results?: SearchResults;

  /** Whether search is in progress */
  isSearching?: boolean;

  /** Search error message */
  searchError?: string;

  /** Saved searches */
  savedSearches?: SavedSearch[];

  /** Search history */
  searchHistory?: SearchHistoryItem[];

  /** Search suggestions */
  suggestions?: SearchSuggestion[];

  /** Search configuration */
  config?: SearchConfig;

  /** Show advanced search options */
  showAdvanced?: boolean;

  /** Show search filters */
  showFilters?: boolean;

  /** Show saved searches panel */
  showSavedSearches?: boolean;

  /** Show search history */
  showHistory?: boolean;

  /** Enable real-time search */
  enableRealTimeSearch?: boolean;

  /** Layout mode */
  layout?: 'compact' | 'standard' | 'expanded';

  /** Results view mode */
  resultsView?: 'list' | 'grid' | 'table';

  /** Event handlers */
  onSearch?: (query: SearchQuery) => void;
  onSearchChange?: (query: SearchQuery) => void;
  onResultClick?: (item: SearchResultItem) => void;
  onResultPreview?: (item: SearchResultItem) => void;
  onSaveSearch?: (
    search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void;
  onLoadSavedSearch?: (search: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
  onClearHistory?: () => void;
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
  onFilterChange?: (filters: SearchFilters) => void;
  onScopeChange?: (scope: SearchScope) => void;
  onQueryTypeChange?: (type: SearchQueryType) => void;
  onExportResults?: (format: 'csv' | 'json' | 'xlsx') => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  /** Custom result renderer */
  renderResult?: (item: SearchResultItem, index: number) => ReactNode;

  /** Custom filter renderer */
  renderFilters?: (
    filters: SearchFilters,
    onChange: (filters: SearchFilters) => void,
  ) => ReactNode;

  /** Custom empty state */
  emptyState?: ReactNode;

  /** Custom loading state */
  loadingState?: ReactNode;

  /** Custom error state */
  errorState?: ReactNode;

  /** Custom CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

/**
 * Component state
 */
export interface SearchInterfaceState {
  currentQuery: SearchQuery;
  isAdvancedMode: boolean;
  showFilters: boolean;
  showSavedSearches: boolean;
  showHistory: boolean;
  selectedSuggestion: number;
  focusedResult: number;
  localFilters: SearchFilters;
  validationErrors: string[];
}

/**
 * Component ref interface
 */
export interface SearchInterfaceRef {
  /** Focus the search input */
  focus(): void;
  /** Clear the search */
  clear(): void;
  /** Execute current search */
  search(): void;
  /** Get current query */
  getQuery(): SearchQuery;
  /** Set query programmatically */
  setQuery(query: SearchQuery): void;
  /** Toggle advanced mode */
  toggleAdvanced(): void;
  /** Toggle filters */
  toggleFilters(): void;
  /** Export current results */
  exportResults(format: 'csv' | 'json' | 'xlsx'): void;
}


/**
 * Create mock search data for testing
 */
export const createMockSearchResults = (
  query: string,
  count = 20,
): SearchResults => {
  const items: SearchResultItem[] = [];

  for (let i = 0; i < count; i++) {
    const extensions = ['pdf', 'doc', 'txt', 'jpg', 'png', 'mp4', 'zip'];
    const extension = extensions[Math.floor(Math.random() * extensions.length)];
    const isFolder = Math.random() > 0.7;

    items.push({
      id: `item-${i}`,
      name: isFolder ? `Folder ${i + 1}` : `Document ${i + 1}.${extension}`,
      path: `/Users/Documents/${isFolder ? `Folder ${i + 1}` : `Document ${i + 1}.${extension}`}`,
      type: isFolder ? 'folder' : 'file',
      size: isFolder ? undefined : Math.floor(Math.random() * 10000000),
      modifiedAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
      ),
      createdAt: new Date(
        Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000,
      ),
      extension: isFolder ? undefined : extension,
      mimeType: isFolder ? undefined : `application/${extension}`,
      relevanceScore: Math.floor(Math.random() * 100),
      highlights: query
        ? [
            {
              field: 'name',
              matches: [
                {
                  start: 0,
                  end: query.length,
                  text: query,
                },
              ],
            },
          ]
        : undefined,
      context: {
        volumeId: 'vol-001',
        volumeName: 'System Drive',
        parentPath: '/Users/Documents',
      },
    });
  }

  return {
    items,
    totalCount: count * 5, // Simulate more results available
    page: 1,
    pageSize: count,
    hasMore: true,
    searchTime: Math.floor(Math.random() * 500) + 50,
    query: {
      query,
      type: 'simple',
      scope: 'all',
      filters: {},
    },
    executedAt: new Date(),
    facets: {
      fileType: [
        { value: 'document', count: 8 },
        { value: 'image', count: 5 },
        { value: 'video', count: 2 },
      ],
      extension: [
        { value: 'pdf', count: 4 },
        { value: 'doc', count: 3 },
        { value: 'jpg', count: 3 },
      ],
    },
    suggestions: [`${query} files`, `${query} documents`, `${query} in folder`],
  };
};

export const createMockSavedSearches = (): SavedSearch[] => [
  {
    id: 'saved-1',
    name: 'Large Files',
    description: 'Files larger than 100MB',
    query: {
      query: '',
      type: 'simple',
      scope: 'all',
      filters: {
        sizeFilter: {
          operator: 'gt',
          value: 100,
          unit: 'MB',
        },
      },
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    lastUsed: new Date('2023-06-01'),
    useCount: 15,
    favorite: true,
  },
  {
    id: 'saved-2',
    name: 'Recent Images',
    description: 'Images modified in the last 30 days',
    query: {
      query: '',
      type: 'simple',
      scope: 'all',
      filters: {
        fileTypes: ['image'],
        dateFilter: {
          operator: 'relative',
          value: '30 days ago',
          field: 'modified',
        },
      },
    },
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2023-02-01'),
    lastUsed: new Date('2023-06-15'),
    useCount: 8,
    favorite: false,
  },
];
