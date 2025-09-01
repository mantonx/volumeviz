/**
 * Search state atoms
 * 
 * Jotai atoms for managing search queries, filters, results, and search history.
 */

import { atom } from 'jotai';

// Advanced search filters interface
export interface AdvancedFilters {
  fileType?: string[];
  sizeRange?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  location?: string[];
  owner?: string[];
  permissions?: string[];
  tags?: string[];
}

// Search result interface
export interface SearchResult {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: Date;
  matched_content?: string;
  highlight_ranges?: Array<{ start: number; end: number }>;
  score?: number;
}

// Search pagination interface
export interface SearchPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Search query atom
export const searchQueryAtom = atom<string>('');

// Advanced filters atom
export const advancedFiltersAtom = atom<AdvancedFilters>({});

// Search results atom
export const searchResultsAtom = atom<SearchResult[]>([]);

// Search loading state
export const searchLoadingAtom = atom<boolean>(false);

// Search error state
export const searchErrorAtom = atom<string | null>(null);

// Search pagination atom
export const searchPaginationAtom = atom<SearchPagination>({
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

// Search history atom (recent searches)
export const searchHistoryAtom = atom<string[]>([]);

// Search suggestions atom
export const searchSuggestionsAtom = atom<string[]>([]);

// Selected search results (for bulk operations)
export const selectedSearchResultsAtom = atom<string[]>([]);

// Search view mode (list, grid, table)
export const searchViewModeAtom = atom<'list' | 'grid' | 'table'>('list');

// Search sort options
export interface SearchSortOption {
  field: 'relevance' | 'name' | 'size' | 'modified' | 'path';
  direction: 'asc' | 'desc';
}

export const searchSortAtom = atom<SearchSortOption>({
  field: 'relevance',
  direction: 'desc',
});

// Search filters panel visibility
export const filtersVisibleAtom = atom<boolean>(false);

// Computed atoms

// Has active filters atom
export const hasActiveFiltersAtom = atom((get) => {
  const filters = get(advancedFiltersAtom);
  return Object.values(filters).some(value => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== undefined && v !== null);
    }
    return value !== undefined && value !== null && value !== '';
  });
});

// Search stats atom
export const searchStatsAtom = atom((get) => {
  const results = get(searchResultsAtom);
  const pagination = get(searchPaginationAtom);
  
  return {
    totalResults: pagination.totalCount,
    currentPageResults: results.length,
    filesCount: results.filter(r => r.type === 'file').length,
    directoriesCount: results.filter(r => r.type === 'directory').length,
  };
});

// Filtered and sorted results atom (applies local sorting/filtering on top of API results)
export const filteredSearchResultsAtom = atom((get) => {
  const results = get(searchResultsAtom);
  const sortOption = get(searchSortAtom);
  
  // Apply sorting if not relevance-based (API handles relevance sorting)
  if (sortOption.field !== 'relevance') {
    const sorted = [...results].sort((a, b) => {
      let comparison = 0;
      
      switch (sortOption.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
        case 'path':
          comparison = a.path.localeCompare(b.path);
          break;
        default:
          return results; // Return unsorted for relevance
      }
      
      return sortOption.direction === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }
  
  return results;
});

// Clear search results action atom
export const clearSearchResultsAtom = atom(
  null,
  (get, set) => {
    set(searchResultsAtom, []);
    set(searchErrorAtom, null);
    set(searchLoadingAtom, false);
    set(selectedSearchResultsAtom, []);
    set(searchPaginationAtom, {
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  }
);

// Reset all search state action atom
export const resetSearchStateAtom = atom(
  null,
  (get, set) => {
    set(searchQueryAtom, '');
    set(advancedFiltersAtom, {});
    set(clearSearchResultsAtom);
  }
);

// Legacy compatibility alias
export const searchTotalCountAtom = atom((get) => {
  const pagination = get(searchPaginationAtom);
  return pagination.totalCount;
});