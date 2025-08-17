/**
 * Search State Management with Jotai
 * 
 * Atoms for managing file search and saved search state
 */

import { atom } from 'jotai';
import type {
  SearchFilesRequest,
  FileSearchResult,
  SavedSearch,
} from '@/api/search';

// Search query state
export const searchQueryAtom = atom<SearchFilesRequest>({
  page: 1,
  perPage: 20,
  sort: 'name',
  order: 'asc',
});

// Search results state
export const searchResultsAtom = atom<FileSearchResult[]>([]);
export const searchTotalCountAtom = atom<number>(0);
export const searchTotalPagesAtom = atom<number>(0);
export const searchQueryTimeAtom = atom<number>(0);
export const searchActiveFiltersAtom = atom<Record<string, any>>({});

// Search loading and error state
export const searchLoadingAtom = atom<boolean>(false);
export const searchErrorAtom = atom<string | null>(null);

// Search pagination state
export const searchCurrentPageAtom = atom<number>(1);
export const searchPerPageAtom = atom<number>(20);

// Search sorting state
export const searchSortFieldAtom = atom<string>('name');
export const searchSortOrderAtom = atom<'asc' | 'desc'>('asc');

// Derived atom for search metadata
export const searchMetadataAtom = atom((get) => ({
  totalCount: get(searchTotalCountAtom),
  totalPages: get(searchTotalPagesAtom),
  currentPage: get(searchCurrentPageAtom),
  perPage: get(searchPerPageAtom),
  queryTime: get(searchQueryTimeAtom),
  activeFilters: get(searchActiveFiltersAtom),
}));

// Saved searches state
export const savedSearchesAtom = atom<SavedSearch[]>([]);
export const savedSearchesTotalCountAtom = atom<number>(0);
export const savedSearchesLoadingAtom = atom<boolean>(false);
export const savedSearchesErrorAtom = atom<string | null>(null);

// Current saved search being viewed/edited
export const currentSavedSearchAtom = atom<SavedSearch | null>(null);

// Search UI state
export const searchPanelOpenAtom = atom<boolean>(false);
export const savedSearchesPanelOpenAtom = atom<boolean>(false);
export const searchFiltersExpandedAtom = atom<boolean>(false);

// Advanced search filters state
export const advancedFiltersAtom = atom<{
  mediaKind?: string;
  mimeTypes: string[];
  sizeRange: { min?: number; max?: number };
  timeRange: { from?: string; to?: string };
  durationRange: { min?: number; max?: number };
  dimensionsRange: { 
    width: { min?: number; max?: number };
    height: { min?: number; max?: number };
  };
  booleanFilters: {
    hasGps?: boolean;
    hasSubs?: boolean;
    hashPresent?: boolean;
  };
}>({
  mimeTypes: [],
  sizeRange: {},
  timeRange: {},
  durationRange: {},
  dimensionsRange: { width: {}, height: {} },
  booleanFilters: {},
});

// Search history (recent searches)
export const searchHistoryAtom = atom<SearchFilesRequest[]>([]);

// Selected files for bulk operations
export const selectedFilesAtom = atom<FileSearchResult[]>([]);

// Search preferences
export const searchPreferencesAtom = atom<{
  defaultSort: string;
  defaultOrder: 'asc' | 'desc';
  defaultPerPage: number;
  rememberFilters: boolean;
  enableAutoComplete: boolean;
}>({
  defaultSort: 'name',
  defaultOrder: 'asc',
  defaultPerPage: 20,
  rememberFilters: true,
  enableAutoComplete: true,
});

// Virtual scrolling state for large result sets
export const virtualScrollStateAtom = atom<{
  startIndex: number;
  endIndex: number;
  overscan: number;
}>({
  startIndex: 0,
  endIndex: 50,
  overscan: 10,
});

// Export commonly used derived atoms
export const hasSearchResultsAtom = atom((get) => get(searchResultsAtom).length > 0);
export const hasActiveFiltersAtom = atom((get) => 
  Object.keys(get(searchActiveFiltersAtom)).length > 0
);
export const isSearchingAtom = atom((get) => get(searchLoadingAtom));
export const hasSearchErrorAtom = atom((get) => get(searchErrorAtom) !== null);

// Actions atoms (write-only atoms for state updates)
export const clearSearchResultsAtom = atom(null, (_get, set) => {
  set(searchResultsAtom, []);
  set(searchTotalCountAtom, 0);
  set(searchTotalPagesAtom, 0);
  set(searchQueryTimeAtom, 0);
  set(searchActiveFiltersAtom, {});
  set(searchErrorAtom, null);
});

export const clearSearchFiltersAtom = atom(null, (get, set) => {
  set(advancedFiltersAtom, {
    mimeTypes: [],
    sizeRange: {},
    timeRange: {},
    durationRange: {},
    dimensionsRange: { width: {}, height: {} },
    booleanFilters: {},
  });
  set(searchQueryAtom, {
    page: 1,
    perPage: get(searchPerPageAtom),
    sort: 'name',
    order: 'asc',
  });
});

export const addToSearchHistoryAtom = atom(null, (get, set, query: SearchFilesRequest) => {
  const history = get(searchHistoryAtom);
  const newHistory = [query, ...history.filter(q => 
    JSON.stringify(q) !== JSON.stringify(query)
  )].slice(0, 10); // Keep only last 10 searches
  set(searchHistoryAtom, newHistory);
});