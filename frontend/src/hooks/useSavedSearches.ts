/**
 * useSavedSearches - Hook for managing saved searches
 *
 * Features:
 * - List all saved searches for the current user
 * - Create new saved search
 * - Update existing saved search
 * - Delete saved search
 * - Execute saved search
 * - Track execution count and last used date
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getApiV1SearchSaved,
  postApiV1SearchSaved,
  getApiV1SearchSavedId,
  putApiV1SearchSavedId,
  deleteApiV1SearchSavedId,
  postApiV1SearchSavedIdRun,
} from '@/api/orval-generated/api';
import type {
  SavedSearch,
  CreateSavedSearchRequest,
  UpdateSavedSearchRequest,
} from '@/components/domain/search/SavedSearches/SavedSearches.types';

interface UseSavedSearchesReturn {
  savedSearches: SavedSearch[];
  isLoading: boolean;
  error: Error | null;
  createSearch: (request: CreateSavedSearchRequest) => Promise<SavedSearch>;
  updateSearch: (
    id: number,
    request: UpdateSavedSearchRequest,
  ) => Promise<SavedSearch>;
  deleteSearch: (id: number) => Promise<void>;
  runSearch: (id: number) => Promise<any>;
  refresh: () => Promise<void>;
}

export const useSavedSearches = (): UseSavedSearchesReturn => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSavedSearches = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getApiV1SearchSaved({
        page: 1,
        perPage: 100, // Get all saved searches
      });

      const responseData = response as any;
      const searches = responseData?.searches || [];

      setSavedSearches(searches);
    } catch (err) {
      console.error('Failed to fetch saved searches:', err);
      setError(err as Error);
      setSavedSearches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSearch = useCallback(
    async (request: CreateSavedSearchRequest): Promise<SavedSearch> => {
      try {
        const response = await postApiV1SearchSaved(request as any);
        const newSearch = response as any;

        // Refresh the list
        await fetchSavedSearches();

        return newSearch;
      } catch (err) {
        console.error('Failed to create saved search:', err);
        throw err;
      }
    },
    [fetchSavedSearches],
  );

  const updateSearch = useCallback(
    async (
      id: number,
      request: UpdateSavedSearchRequest,
    ): Promise<SavedSearch> => {
      try {
        const response = await putApiV1SearchSavedId(id, request as any);
        const updatedSearch = response as any;

        // Refresh the list
        await fetchSavedSearches();

        return updatedSearch;
      } catch (err) {
        console.error('Failed to update saved search:', err);
        throw err;
      }
    },
    [fetchSavedSearches],
  );

  const deleteSearch = useCallback(
    async (id: number): Promise<void> => {
      try {
        await deleteApiV1SearchSavedId(id);

        // Refresh the list
        await fetchSavedSearches();
      } catch (err) {
        console.error('Failed to delete saved search:', err);
        throw err;
      }
    },
    [fetchSavedSearches],
  );

  const runSearch = useCallback(
    async (id: number): Promise<any> => {
      try {
        const response = await postApiV1SearchSavedIdRun(id, {
          page: 1,
          perPage: 20,
        });

        // Refresh the list to update execution count and last used date
        await fetchSavedSearches();

        return response;
      } catch (err) {
        console.error('Failed to run saved search:', err);
        throw err;
      }
    },
    [fetchSavedSearches],
  );

  const refresh = useCallback(async () => {
    await fetchSavedSearches();
  }, [fetchSavedSearches]);

  // Initial fetch
  useEffect(() => {
    fetchSavedSearches();
  }, [fetchSavedSearches]);

  return {
    savedSearches,
    isLoading,
    error,
    createSearch,
    updateSearch,
    deleteSearch,
    runSearch,
    refresh,
  };
};

export default useSavedSearches;
