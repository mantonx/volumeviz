/**
 * useSearch Hook
 *
 * Provides comprehensive search functionality with state management
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import {
  searchApi,
  type SearchFilesRequest,
  type SearchFilesResponse,
} from '@/api/search';
import {
  searchQueryAtom,
  searchResultsAtom,
  searchTotalCountAtom,
  searchTotalPagesAtom,
  searchQueryTimeAtom,
  searchActiveFiltersAtom,
  searchLoadingAtom,
  searchErrorAtom,
  searchCurrentPageAtom,
  searchPerPageAtom,
  searchSortFieldAtom,
  searchSortOrderAtom,
  addToSearchHistoryAtom,
  clearSearchResultsAtom,
  advancedFiltersAtom,
} from '@/store/atoms/search';
import { getErrorMessage } from '@/utils/errorHandling';

export function useSearch() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [results, setResults] = useAtom(searchResultsAtom);
  const [totalCount, setTotalCount] = useAtom(searchTotalCountAtom);
  const [totalPages, setTotalPages] = useAtom(searchTotalPagesAtom);
  const [queryTime, setQueryTime] = useAtom(searchQueryTimeAtom);
  const [activeFilters, setActiveFilters] = useAtom(searchActiveFiltersAtom);
  const [loading, setLoading] = useAtom(searchLoadingAtom);
  const [error, setError] = useAtom(searchErrorAtom);
  const [currentPage, setCurrentPage] = useAtom(searchCurrentPageAtom);
  const [perPage, setPerPage] = useAtom(searchPerPageAtom);
  const [sortField, setSortField] = useAtom(searchSortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(searchSortOrderAtom);

  const advancedFilters = useAtomValue(advancedFiltersAtom);
  const addToHistory = useSetAtom(addToSearchHistoryAtom);
  const clearResults = useSetAtom(clearSearchResultsAtom);

  const requestSeqRef = useRef(0); // Prevent race conditions
  const lastSearchQueryRef = useRef<SearchFilesRequest | null>(null); // Store last successful query

  // Build complete search request from query and advanced filters
  const buildSearchRequest = useCallback(
    (baseQuery: SearchFilesRequest): SearchFilesRequest => {
      const request: SearchFilesRequest = {
        ...baseQuery,
        page: currentPage,
        perPage,
      };

      // Add advanced filters with null safety
      if (advancedFilters?.mediaKind) {
        request.mediaKind = advancedFilters.mediaKind;
      }

      if (advancedFilters?.mimeTypes && advancedFilters.mimeTypes.length > 0) {
        request.mime = advancedFilters.mimeTypes;
      }

      if (advancedFilters?.sizeRange?.min !== undefined) {
        request.minSize = advancedFilters.sizeRange.min;
      }
      if (advancedFilters?.sizeRange?.max !== undefined) {
        request.maxSize = advancedFilters.sizeRange.max;
      }

      if (advancedFilters?.timeRange?.from) {
        request.mtimeFrom = advancedFilters.timeRange.from;
      }
      if (advancedFilters?.timeRange?.to) {
        request.mtimeTo = advancedFilters.timeRange.to;
      }

      if (advancedFilters?.durationRange?.min !== undefined) {
        request.durationFrom = advancedFilters.durationRange.min;
      }
      if (advancedFilters?.durationRange?.max !== undefined) {
        request.durationTo = advancedFilters.durationRange.max;
      }

      if (advancedFilters?.dimensionsRange?.width?.min !== undefined) {
        request.minWidth = advancedFilters.dimensionsRange.width.min;
      }
      if (advancedFilters?.dimensionsRange?.width?.max !== undefined) {
        request.maxWidth = advancedFilters.dimensionsRange.width.max;
      }
      if (advancedFilters?.dimensionsRange?.height?.min !== undefined) {
        request.minHeight = advancedFilters.dimensionsRange.height.min;
      }
      if (advancedFilters?.dimensionsRange?.height?.max !== undefined) {
        request.maxHeight = advancedFilters.dimensionsRange.height.max;
      }

      if (advancedFilters?.booleanFilters?.hasGps !== undefined) {
        request.hasGps = advancedFilters.booleanFilters.hasGps;
      }
      if (advancedFilters?.booleanFilters?.hasSubs !== undefined) {
        request.hasSubs = advancedFilters.booleanFilters.hasSubs;
      }
      if (advancedFilters?.booleanFilters?.hashPresent !== undefined) {
        request.hashPresent = advancedFilters.booleanFilters.hashPresent;
      }

      return request;
    },
    [currentPage, perPage, advancedFilters],
  );

  // Execute search with current query and filters
  const executeSearch = useCallback(
    async (searchQuery?: SearchFilesRequest) => {
      const seq = ++requestSeqRef.current;

      try {
        setLoading(true);
        setError(null);

        const queryToUse = searchQuery || {
          page: currentPage,
          perPage,
          sort: 'name',
          order: 'asc',
        };
        const fullRequest = buildSearchRequest(queryToUse);

        // Add to search history if it's a new search (not pagination)
        if (!searchQuery || searchQuery.page === 1) {
          addToHistory(fullRequest);
        }

        console.log('🔍 Search Request:', fullRequest); // Debug logging
        const response: SearchFilesResponse =
          await searchApi.searchFiles(fullRequest);
        console.log('📊 Search Response:', response); // Debug logging

        // Ignore stale responses
        if (seq !== requestSeqRef.current) return;

        setResults(response.files || []);
        setTotalCount(response.total_count || 0);
        setTotalPages(response.total_pages || 0);
        setQueryTime(response.query_time_ms || 0);
        setActiveFilters(response.filters || {});

        // Update pagination state
        setCurrentPage(response.page || 1);
        setPerPage(response.per_page || 20);

        // Store the successful query for pagination
        lastSearchQueryRef.current = fullRequest;
      } catch (err) {
        if (seq !== requestSeqRef.current) return;

        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        setResults([]);
        setTotalCount(0);
        setTotalPages(0);
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [
      buildSearchRequest,
      addToHistory,
      setLoading,
      setError,
      setResults,
      setTotalCount,
      setTotalPages,
      setQueryTime,
      setActiveFilters,
      setCurrentPage,
      setPerPage,
    ],
  );

  // Search with text query
  const searchFiles = useCallback(
    async (textQuery: string, options?: Partial<SearchFilesRequest>) => {
      const searchQuery: SearchFilesRequest = {
        q: textQuery,
        page: 1,
        perPage,
        sort: 'name',
        order: 'asc',
        ...options,
      };

      await executeSearch(searchQuery);
    },
    [executeSearch, perPage],
  );

  // Navigate to specific page
  const goToPage = useCallback(
    async (page: number) => {
      if (page < 1 || page > totalPages || !lastSearchQueryRef.current) return;

      const pageQuery = {
        ...lastSearchQueryRef.current,
        page,
      };
      await executeSearch(pageQuery);
    },
    [executeSearch, totalPages],
  );

  // Change page size
  const changePageSize = useCallback(
    async (newPerPage: number) => {
      if (!lastSearchQueryRef.current) return;

      setPerPage(newPerPage);
      const pageQuery = {
        ...lastSearchQueryRef.current,
        page: 1,
        perPage: newPerPage,
      };
      await executeSearch(pageQuery);
    },
    [executeSearch, setPerPage],
  );

  // Change sorting
  const changeSorting = useCallback(
    async (sort: string, order: 'asc' | 'desc' = 'asc') => {
      if (!lastSearchQueryRef.current) return;

      // Update sort state
      setSortField(sort);
      setSortOrder(order);

      const sortQuery = {
        ...lastSearchQueryRef.current,
        page: 1,
        sort,
        order,
      };
      await executeSearch(sortQuery);
    },
    [executeSearch, setSortField, setSortOrder],
  );

  // Refresh current search
  const refreshSearch = useCallback(async () => {
    await executeSearch();
  }, [executeSearch]);

  // Clear all search results and filters
  const clearSearch = useCallback(() => {
    clearResults();
    setCurrentPage(1);
  }, [clearResults, setCurrentPage]);

  return {
    // Current state
    results: results || [], // Ensure never null
    totalCount,
    totalPages,
    queryTime,
    activeFilters,
    loading,
    error,
    currentPage,
    perPage,
    sortField,
    sortOrder,

    // Actions
    searchFiles,
    executeSearch,
    goToPage,
    changePageSize,
    changeSorting,
    refreshSearch,
    clearSearch,

    // Computed properties
    hasResults: (results || []).length > 0,
    hasError: error !== null,
    isLoading: loading,
    isEmpty: !loading && (results || []).length === 0 && !error,
  };
}
