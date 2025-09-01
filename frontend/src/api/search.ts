/**
 * Search API hooks and utilities
 * 
 * Legacy compatibility layer for search functionality.
 * Provides wrapper hooks that map to modern Orval-generated API hooks.
 */

import { 
  useGetApiV1SearchFiles,
  useGetApiV1SearchSaved,
  usePostApiV1SearchSaved,
  useDeleteApiV1SearchSavedId,
  useGetApiV1SearchSavedId,
  useGetApiV1ExplorerFilesSearch,
} from './orval-generated/api';
import type { 
  InternalApiV1SearchSearchFilesRequest,
  InternalApiV1SearchCreateSavedSearchRequest,
  InternalApiV1SearchFileResult,
  InternalApiV1SearchSavedSearch,
  GetApiV1SearchFilesParams,
  GetApiV1ExplorerFilesSearchParams,
} from './orval-generated/api';

// Legacy type aliases for compatibility
export type FileSearchResult = InternalApiV1SearchFileResult;
export type SavedSearch = InternalApiV1SearchSavedSearch;
export type CreateSavedSearchRequest = InternalApiV1SearchCreateSavedSearchRequest;
export type SearchFilesRequest = InternalApiV1SearchSearchFilesRequest;

// Search suggestion type
export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'file' | 'directory' | 'extension' | 'recent';
  path?: string;
  count?: number;
}

// File search hook
export const useFileSearch = (params?: GetApiV1SearchFilesParams) => {
  const query = useGetApiV1SearchFiles(params);
  
  return {
    results: query.data?.results || [],
    totalCount: query.data?.total_count || 0,
    hasMore: query.data?.has_more || false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Explorer files search hook  
export const useExplorerSearch = (params?: GetApiV1ExplorerFilesSearchParams) => {
  const query = useGetApiV1ExplorerFilesSearch(params);
  
  return {
    files: query.data?.files || [],
    totalCount: query.data?.total_count || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Saved searches management
export const useSavedSearches = () => {
  const getSavedSearches = useGetApiV1SearchSaved();
  const createSavedSearch = usePostApiV1SearchSaved();
  const deleteSavedSearch = useDeleteApiV1SearchSavedId();

  return {
    searches: getSavedSearches.data?.searches || [],
    isLoading: getSavedSearches.isLoading,
    error: getSavedSearches.error,
    refetch: getSavedSearches.refetch,
    createSearch: createSavedSearch.mutate,
    createSearchAsync: createSavedSearch.mutateAsync,
    deleteSearch: deleteSavedSearch.mutate,
    deleteSearchAsync: deleteSavedSearch.mutateAsync,
    isCreating: createSavedSearch.isPending,
    isDeleting: deleteSavedSearch.isPending,
  };
};

// Individual saved search hook
export const useSavedSearch = (searchId: string) => {
  const query = useGetApiV1SearchSavedId(searchId);
  
  return {
    search: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Search API utilities (for autocomplete and suggestions)
export const searchApi = {
  // Get search suggestions based on partial input
  async getSuggestions(query: string): Promise<SearchSuggestion[]> {
    // Placeholder implementation - in real app this would make API call
    const suggestions: SearchSuggestion[] = [];
    
    if (query.length > 0) {
      // Add some basic suggestions based on query
      suggestions.push({
        id: `file-${query}`,
        text: `Files containing "${query}"`,
        type: 'file',
        count: 0,
      });
      
      suggestions.push({
        id: `dir-${query}`,
        text: `Directories containing "${query}"`,
        type: 'directory', 
        count: 0,
      });
      
      if (query.includes('.')) {
        suggestions.push({
          id: `ext-${query}`,
          text: `${query} files`,
          type: 'extension',
          count: 0,
        });
      }
    }
    
    return suggestions;
  },
  
  // Get recent searches
  async getRecentSearches(): Promise<SearchSuggestion[]> {
    // Placeholder - would retrieve from localStorage or API
    return [];
  },
};