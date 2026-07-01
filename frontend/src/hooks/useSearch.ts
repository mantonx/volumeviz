/**
 * Search management hooks
 *
 * Provides centralized hooks for search functionality, combining API calls with local state.
 */

import { useCallback, useState } from 'react';
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
  type SearchFilters,
} from '@/atoms/search';
import {
  getApiV1SearchFiles,
  getApiV1SearchSaved,
  type GetApiV1SearchFilesParams,
} from '@/api/orval-generated/api';

// Main search hook
export const useSearch = () => {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [filters, setFilters] = useAtom(advancedFiltersAtom);
  const [, setResults] = useAtom(searchResultsAtom);
  const [isLoading, setIsLoading] = useAtom(searchLoadingAtom);
  const [error, setError] = useAtom(searchErrorAtom);
  const [pagination, setPagination] = useAtom(searchPaginationAtom);
  const [history, setHistory] = useAtom(searchHistoryAtom);
  const [selectedResults, setSelectedResults] = useAtom(
    selectedSearchResultsAtom,
  );

  const filteredResults = useAtomValue(filteredSearchResultsAtom);
  const stats = useAtomValue(searchStatsAtom);
  const hasActiveFilters = useAtomValue(hasActiveFiltersAtom);
  const clearResults = useSetAtom(clearSearchResultsAtom);
  const resetState = useSetAtom(resetSearchStateAtom);

  // Perform search
  const performSearch = useCallback(
    async (searchText?: string, page: number = 1) => {
      const textToUse = searchText !== undefined ? searchText : query.text;
      if (!textToUse.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        // Build search request with proper parameter mapping
        const searchParams: GetApiV1SearchFilesParams = {
          q: textToUse,
          mediaKind: query.filters.fileTypes[0],
          minSize: query.filters.sizeRange?.min,
          maxSize: query.filters.sizeRange?.max,
          mtimeFrom: query.filters.dateRange?.start?.toISOString(),
          mtimeTo: query.filters.dateRange?.end?.toISOString(),
          path: query.filters.location,
          page,
          perPage: pagination.limit,
        };

        // Make actual API call
        const response = await getApiV1SearchFiles(searchParams);
        const responseData =
          response.status === 200 ? response.data : undefined;
        const files = responseData?.files ?? [];
        const total = responseData?.total_count ?? 0;

        setResults(files);
        setPagination({
          page,
          limit: pagination.limit,
          total,
        });

        // Add to search history if it's a new search
        if (page === 1 && textToUse && !history.includes(textToUse)) {
          setHistory((prev) => [textToUse, ...prev.slice(0, 9)]); // Keep last 10 searches
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      query,
      pagination.limit,
      history,
      setIsLoading,
      setError,
      setResults,
      setPagination,
      setHistory,
    ],
  );

  // Search with new query text
  const search = useCallback(
    (newText: string) => {
      setQuery((prev) => ({ ...prev, text: newText }));
      performSearch(newText, 1);
    },
    [setQuery, performSearch],
  );

  const hasNextPage = pagination.page * pagination.limit < pagination.total;
  const hasPreviousPage = pagination.page > 1;

  // Search next page
  const searchNextPage = useCallback(() => {
    if (hasNextPage) {
      performSearch(query.text, pagination.page + 1);
    }
  }, [hasNextPage, performSearch, query.text, pagination.page]);

  // Search previous page
  const searchPreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      performSearch(query.text, pagination.page - 1);
    }
  }, [hasPreviousPage, performSearch, query.text, pagination.page]);

  // Update filters and re-search
  const updateFilters = useCallback(
    (newFilters: SearchFilters) => {
      setQuery((prev) => ({ ...prev, filters: newFilters }));
      if (query.text) {
        performSearch(query.text, 1);
      }
    },
    [setQuery, query.text, performSearch],
  );

  // Clear search
  const clearSearch = useCallback(() => {
    clearResults();
    setQuery((prev) => ({ ...prev, text: '' }));
  }, [clearResults, setQuery]);

  return {
    // State
    query: query.text,
    filters: query.filters,
    advancedFilters: filters,
    setAdvancedFilters: setFilters,
    results: filteredResults,
    isLoading,
    error,
    pagination: { ...pagination, hasNextPage, hasPreviousPage },
    history,
    selectedResults,
    stats,
    hasActiveFilters,

    // Actions
    setQuery: search,
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

// Saved searches hook
export const useSavedSearches = () => {
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedSearches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getApiV1SearchSaved();
      const data = response as any;
      setSavedSearches(data?.searches || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch saved searches';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    savedSearches,
    isLoading,
    error,
    fetchSavedSearches,
  };
};

// Search history hook
export const useSearchHistory = () => {
  const [history, setHistory] = useAtom(searchHistoryAtom);

  const addToHistory = useCallback(
    (query: string) => {
      if (query && !history.includes(query)) {
        setHistory((prev) => [query, ...prev.slice(0, 9)]);
      }
    },
    [history, setHistory],
  );

  const removeFromHistory = useCallback(
    (query: string) => {
      setHistory((prev) => prev.filter((item) => item !== query));
    },
    [setHistory],
  );

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
