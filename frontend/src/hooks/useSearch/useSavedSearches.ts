/**
 * useSavedSearches Hook
 * 
 * Manages saved search operations and state
 */

import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import { 
  searchApi, 
  type SavedSearch, 
  type CreateSavedSearchRequest, 
  type UpdateSavedSearchRequest 
} from '@/api/search';
import {
  savedSearchesAtom,
  savedSearchesTotalCountAtom,
  savedSearchesLoadingAtom,
  savedSearchesErrorAtom,
  currentSavedSearchAtom,
} from '@/store/atoms/search';
import { getErrorMessage } from '@/utils/errorHandling';

export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useAtom(savedSearchesAtom);
  const [totalCount, setTotalCount] = useAtom(savedSearchesTotalCountAtom);
  const [loading, setLoading] = useAtom(savedSearchesLoadingAtom);
  const [error, setError] = useAtom(savedSearchesErrorAtom);
  const [currentSavedSearch, setCurrentSavedSearch] = useAtom(currentSavedSearchAtom);
  
  const requestSeqRef = useRef(0);

  // Fetch saved searches with pagination
  const fetchSavedSearches = useCallback(async (params?: {
    page?: number;
    perPage?: number;
    tags?: string[];
  }) => {
    const seq = ++requestSeqRef.current;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await searchApi.listSavedSearches(params);
      
      if (seq !== requestSeqRef.current) return;
      
      setSavedSearches(response.searches || []);
      setTotalCount(response.total_count || 0);
      
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [setSavedSearches, setTotalCount, setLoading, setError]);

  // Create a new saved search
  const createSavedSearch = useCallback(async (request: CreateSavedSearchRequest): Promise<SavedSearch> => {
    try {
      setError(null);
      
      const newSearch = await searchApi.createSavedSearch(request);
      
      // Add to local state
      setSavedSearches(prev => [newSearch, ...(prev || [])]);
      setTotalCount(prev => prev + 1);
      
      return newSearch;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [setSavedSearches, setTotalCount, setError]);

  // Get a specific saved search
  const getSavedSearch = useCallback(async (id: number): Promise<SavedSearch> => {
    try {
      setError(null);
      
      const search = await searchApi.getSavedSearch(id);
      setCurrentSavedSearch(search);
      
      return search;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [setCurrentSavedSearch, setError]);

  // Update a saved search
  const updateSavedSearch = useCallback(async (
    id: number, 
    request: UpdateSavedSearchRequest
  ): Promise<SavedSearch> => {
    try {
      setError(null);
      
      const updatedSearch = await searchApi.updateSavedSearch(id, request);
      
      // Update local state
      setSavedSearches(prev => 
        (prev || []).map(search => search.id === id ? updatedSearch : search)
      );
      
      if (currentSavedSearch?.id === id) {
        setCurrentSavedSearch(updatedSearch);
      }
      
      return updatedSearch;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [setSavedSearches, currentSavedSearch, setCurrentSavedSearch, setError]);

  // Delete a saved search
  const deleteSavedSearch = useCallback(async (id: number): Promise<void> => {
    try {
      setError(null);
      
      await searchApi.deleteSavedSearch(id);
      
      // Remove from local state
      setSavedSearches(prev => (prev || []).filter(search => search.id !== id));
      setTotalCount(prev => prev - 1);
      
      if (currentSavedSearch?.id === id) {
        setCurrentSavedSearch(null);
      }
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [setSavedSearches, setTotalCount, currentSavedSearch, setCurrentSavedSearch, setError]);

  // Run a saved search and return results
  const runSavedSearch = useCallback(async (id: number) => {
    try {
      setError(null);
      
      const results = await searchApi.runSavedSearch(id);
      
      // Update run count for the saved search
      setSavedSearches(prev => 
        (prev || []).map(search => 
          search.id === id 
            ? { ...search, run_count: search.run_count + 1, last_run_at: new Date().toISOString() }
            : search
        )
      );
      
      return results;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [setSavedSearches, setError]);

  // Duplicate a saved search
  const duplicateSavedSearch = useCallback(async (
    id: number, 
    newName?: string
  ): Promise<SavedSearch> => {
    try {
      const originalSearch = await getSavedSearch(id);
      
      const duplicateRequest: CreateSavedSearchRequest = {
        name: newName || `${originalSearch.name} (Copy)`,
        description: originalSearch.description,
        query: originalSearch.query,
        tags: [...originalSearch.tags],
        is_public: false, // Duplicates are private by default
        metadata: originalSearch.metadata,
      };
      
      return await createSavedSearch(duplicateRequest);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  }, [getSavedSearch, createSavedSearch, setError]);

  // Export a saved search (for sharing)
  const exportSavedSearch = useCallback((search: SavedSearch) => {
    const exportData = {
      name: search.name,
      description: search.description,
      query: search.query,
      tags: search.tags,
      metadata: search.metadata,
      exported_at: new Date().toISOString(),
      exported_from: 'VolumeViz',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${search.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_search.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Filter saved searches by tags
  const filterByTags = useCallback((tags: string[]) => {
    return (savedSearches || []).filter(search =>
      tags.some(tag => search.tags.includes(tag))
    );
  }, [savedSearches]);

  // Get all unique tags from saved searches
  const getAllTags = useCallback(() => {
    const allTags = (savedSearches || []).flatMap(search => search.tags);
    return Array.from(new Set(allTags)).sort();
  }, [savedSearches]);

  return {
    // State
    savedSearches,
    totalCount,
    loading,
    error,
    currentSavedSearch,
    
    // Actions
    fetchSavedSearches,
    createSavedSearch,
    getSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    runSavedSearch,
    duplicateSavedSearch,
    exportSavedSearch,
    
    // Utilities
    filterByTags,
    getAllTags,
    
    // Computed
    hasSavedSearches: (savedSearches || []).length > 0,
    isLoading: loading,
    hasError: error !== null,
  };
}