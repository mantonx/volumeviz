import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SearchQuery, SearchFilters, AdvancedFilters } from './search.types';

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
export const advancedFiltersAtom = atomWithStorage<AdvancedFilters>('advanced-filters', {
  includeHidden: false,
  caseSensitive: false,
  useRegex: false,
  searchContent: false,
});

// Search results loading state
export const searchLoadingAtom = atom<boolean>(false);

// Search results
export const searchResultsAtom = atom<any[]>([]);