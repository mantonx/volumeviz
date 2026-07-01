import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SearchQuery, AdvancedFilters } from './search.types';

// Search query atom
export const searchQueryAtom = atom<SearchQuery>({
  text: '',
  filters: {
    fileTypes: [],
    sizeRange: {},
    dateRange: {},
  },
});

// Advanced search filters
export const advancedFiltersAtom = atomWithStorage<AdvancedFilters>(
  'advanced-filters',
  {
    includeHidden: false,
    caseSensitive: false,
    useRegex: false,
    searchContent: false,
  },
);

// Search results loading state
export const searchLoadingAtom = atom<boolean>(false);

// Search results
export const searchResultsAtom = atom<any[]>([]);

// Search total count
export const searchTotalCountAtom = atom<number>(0);

// Search error state
export const searchErrorAtom = atom<string | null>(null);

// Search pagination
export const searchPaginationAtom = atom<{
  page: number;
  limit: number;
  total: number;
}>({
  page: 1,
  limit: 20,
  total: 0,
});

// Search history
export const searchHistoryAtom = atomWithStorage<string[]>(
  'search-history',
  [],
);

// Selected search results
export const selectedSearchResultsAtom = atom<string[]>([]);

// Filtered search results (derived atom)
export const filteredSearchResultsAtom = atom((get) => {
  const results = get(searchResultsAtom);
  // For now, just return all results - can add filtering logic later
  return results;
});

// Search stats
export const searchStatsAtom = atom<{
  totalResults: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}>({
  totalResults: 0,
  totalSize: 0,
  fileTypes: {},
});

// Has active filters (derived atom)
export const hasActiveFiltersAtom = atom((get) => {
  const query = get(searchQueryAtom);
  const hasTextFilter = query.text.length > 0;
  const hasFileTypeFilter = query.filters.fileTypes.length > 0;
  const hasSizeFilter = Object.keys(query.filters.sizeRange).length > 0;
  const hasDateFilter = Object.keys(query.filters.dateRange).length > 0;

  return hasTextFilter || hasFileTypeFilter || hasSizeFilter || hasDateFilter;
});

// Clear search results action
export const clearSearchResultsAtom = atom(null, (_get, set) => {
  set(searchResultsAtom, []);
  set(searchTotalCountAtom, 0);
  set(searchErrorAtom, null);
  set(selectedSearchResultsAtom, []);
});

// Reset search state action
export const resetSearchStateAtom = atom(null, (_get, set) => {
  set(searchQueryAtom, {
    text: '',
    filters: {
      fileTypes: [],
      sizeRange: {},
      dateRange: {},
    },
  });
  set(searchResultsAtom, []);
  set(searchTotalCountAtom, 0);
  set(searchErrorAtom, null);
  set(searchLoadingAtom, false);
  set(selectedSearchResultsAtom, []);
});
