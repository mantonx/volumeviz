/**
 * Search API exports
 * Re-exports search-related API functions from the generated client
 */
export * from './orval-generated/api';

import { customFetchClient } from './fetch-client';

export type SearchSuggestion = {
  value: string;
  type: 'file' | 'folder' | 'recent';
  count?: number;
};

export type FileSearchResult = {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified?: Date;
  matched_content?: string;
  highlight_ranges?: Array<{ start: number; end: number }>;
  score?: number;
};

// Raw shape returned by GET /search/files: the backend sends modified_time
// (see internal/api/v1/search/handler.go), not modified.
type RawFileSearchResult = Omit<FileSearchResult, 'modified'> & {
  modified_time?: string;
};

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  filters?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type CreateSavedSearchRequest = {
  name: string;
  query: string;
  filters?: Record<string, unknown>;
};

export type SearchFilesRequest = {
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

// Search API implementation
export const searchApi = {
  getSuggestions: async (query: string): Promise<SearchSuggestion[]> => {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const response = await customFetchClient<SearchSuggestion[]>('/search/suggestions', {
        params: { q: query },
      });
      return response || [];
    } catch (error) {
      // Log error but return empty array for suggestions to not break UX
      // Suggestions are optional and should fail gracefully
      console.warn('Failed to fetch search suggestions:', error);
      return [];
    }
  },

  search: async (request: SearchFilesRequest): Promise<FileSearchResult[]> => {
    if (!request.query || request.query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    try {
      const response = await customFetchClient<{ files: RawFileSearchResult[] }>('/search/files', {
        params: {
          q: request.query,
          minSize: request.size_min,
          maxSize: request.size_max,
          mtimeFrom: request.modified_after,
          mtimeTo: request.modified_before,
          path: request.paths,
          page: request.page || 1,
          perPage: request.page_size || 20,
        },
      });
      return (response.files || []).map((f) => ({
        ...f,
        modified: f.modified_time ? new Date(f.modified_time) : undefined,
      }));
    } catch (error) {
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('Network')) {
          throw new Error('Unable to connect to search service. Please check your connection.');
        }
        if (error.message.includes('404')) {
          throw new Error('Search service not found. Please contact support.');
        }
        if (error.message.includes('500')) {
          throw new Error('Search service error. Please try again later.');
        }
        throw error;
      }
      throw new Error('Search failed. Please try again.');
    }
  },
};
