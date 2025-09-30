/**
 * Search management hooks
 * 
 * Provides centralized hooks for search functionality, combining API calls with local state.
 */

import { useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  searchQueryAtom,
  advancedFiltersAtom,
  searchResultsAtom,
  searchLoadingAtom,
  searchErrorAtom,
  searchPaginationAtom,
  searchHistoryAtom,
  selectedSearchResultsAtom,
  filteredSearchResultsAtom,
  searchStatsAtom,
  hasActiveFiltersAtom,
  clearSearchResultsAtom,
  resetSearchStateAtom,
} from '@/atoms/search';
// TODO: Implement these API functions when backend search endpoints are ready
// import {
//   useFileSearch,
//   useSavedSearches as useApiSavedSearches,
//   type SearchFilesRequest,
// } from '@/api/search';

// Temporary placeholder types until API is ready
type SearchFilesRequest = {
  query: string;
  file_types?: string;
  size_min?: number;
  size_max?: number;
  modified_after?: string;
  modified_before?: string;
  paths?: string;
  owners?: string;
  page?: number;
  page_size?: number;
};

// Main search hook
export const useSearch = () => {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [filters, setFilters] = useAtom(advancedFiltersAtom);
  const [results, setResults] = useAtom(searchResultsAtom);
  const [isLoading, setIsLoading] = useAtom(searchLoadingAtom);
  const [error, setError] = useAtom(searchErrorAtom);
  const [pagination, setPagination] = useAtom(searchPaginationAtom);
  const [history, setHistory] = useAtom(searchHistoryAtom);
  const [selectedResults, setSelectedResults] = useAtom(selectedSearchResultsAtom);
  
  const filteredResults = useAtomValue(filteredSearchResultsAtom);
  const stats = useAtomValue(searchStatsAtom);
  const hasActiveFilters = useAtomValue(hasActiveFiltersAtom);
  const clearResults = useSetAtom(clearSearchResultsAtom);
  const resetState = useSetAtom(resetSearchStateAtom);

  // Perform search
  const performSearch = useCallback(async (searchQuery?: string, page: number = 1) => {
    const queryToUse = searchQuery !== undefined ? searchQuery : query;
    if (!queryToUse.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build search request
      const searchRequest: SearchFilesRequest = {
        query: queryToUse,
        file_types: filters.fileType,
        size_min: filters.sizeRange?.min,
        size_max: filters.sizeRange?.max,
        modified_after: filters.dateRange?.from?.toISOString(),
        modified_before: filters.dateRange?.to?.toISOString(),
        paths: filters.location,
        owners: filters.owner,
        // Add other filter mappings as needed
      };

      // TODO: Make actual API call when backend search endpoint is ready
      // For now, return empty results
      setResults([]);
      setPagination({
        page,
        pageSize: pagination.pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: page > 1,
      });

      // Add to search history if it's a new search
      if (page === 1 && queryToUse && !history.includes(queryToUse)) {
        setHistory(prev => [queryToUse, ...prev.slice(0, 9)]); // Keep last 10 searches
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, pagination.pageSize, history, setIsLoading, setError, setResults, setPagination, setHistory]);

  // Search with new query
  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
    performSearch(newQuery, 1);
  }, [setQuery, performSearch]);

  // Search next page
  const searchNextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      performSearch(query, pagination.page + 1);
    }
  }, [pagination, performSearch, query]);

  // Search previous page
  const searchPreviousPage = useCallback(() => {
    if (pagination.hasPreviousPage) {
      performSearch(query, pagination.page - 1);
    }
  }, [pagination, performSearch, query]);

  // Update filters and re-search
  const updateFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    if (query) {
      performSearch(query, 1);
    }
  }, [setFilters, query, performSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    clearResults();
    setQuery('');
  }, [clearResults, setQuery]);

  return {
    // State
    query,
    filters,
    results: filteredResults,
    isLoading,
    error,
    pagination,
    history,
    selectedResults,
    stats,
    hasActiveFilters,

    // Actions
    setQuery,
    setFilters: updateFilters,
    search,
    performSearch,
    searchNextPage,
    searchPreviousPage,
    clearSearch,
    clearResults,
    resetState,
    setSelectedResults,
  };
};

// TODO: Saved searches hook (implement when API is ready)
// Temporary stub until API is ready
export const useSavedSearches = () => {
  return {
    savedSearches: [],
    isLoading: false,
    createSavedSearch: async () => {},
    deleteSavedSearch: async () => {},
    updateSavedSearch: async () => {},
  };
};

// Search history hook
export const useSearchHistory = () => {
  const [history, setHistory] = useAtom(searchHistoryAtom);

  const addToHistory = useCallback((query: string) => {
    if (query && !history.includes(query)) {
      setHistory(prev => [query, ...prev.slice(0, 9)]);
    }
  }, [history, setHistory]);

  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => prev.filter(item => item !== query));
  }, [setHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
};