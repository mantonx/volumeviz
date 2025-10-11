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
} from '@/atoms/search';
import {
  getSearchFiles,
  getSearchSaved,
  type GetSearchFilesParams,
} from '@/api/orval-generated/api';

// Main search hook
export const useSearch = () => {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [filters, setFilters] = useAtom(advancedFiltersAtom);
  const [results, setResults] = useAtom(searchResultsAtom);
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
    async (searchQuery?: string, page: number = 1) => {
      const queryToUse = searchQuery !== undefined ? searchQuery : query;
      if (!queryToUse.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        // Build search request with proper parameter mapping
        const searchParams: GetSearchFilesParams = {
          q: queryToUse,
          mediaKind: filters.fileType,
          minSize: filters.sizeRange?.min,
          maxSize: filters.sizeRange?.max,
          mtimeFrom: filters.dateRange?.from?.toISOString(),
          mtimeTo: filters.dateRange?.to?.toISOString(),
          path: filters.location,
          page,
          perPage: pagination.pageSize,
        };

        // Make actual API call
        const response = await getSearchFiles(searchParams);

        // Extract data from response
        const responseData = response as any;
        const files = responseData?.files || [];
        const totalCount = responseData?.total_count || 0;
        const totalPages = responseData?.total_pages || 0;

        setResults(files);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });

        // Add to search history if it's a new search
        if (page === 1 && queryToUse && !history.includes(queryToUse)) {
          setHistory((prev) => [queryToUse, ...prev.slice(0, 9)]); // Keep last 10 searches
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
      filters,
      pagination.pageSize,
      history,
      setIsLoading,
      setError,
      setResults,
      setPagination,
      setHistory,
    ],
  );

  // Search with new query
  const search = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      performSearch(newQuery, 1);
    },
    [setQuery, performSearch],
  );

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
  const updateFilters = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters);
      if (query) {
        performSearch(query, 1);
      }
    },
    [setFilters, query, performSearch],
  );

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

// Saved searches hook
export const useSavedSearches = () => {
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedSearches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSearchSaved();
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
