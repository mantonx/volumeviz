/**
 * Search API exports
 * Re-exports search-related API functions from the generated client
 */
export * from './orval-generated/api';

// TODO: These types and APIs are placeholders until backend implements search endpoints

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
  modified: Date;
  matched_content?: string;
  highlight_ranges?: Array<{ start: number; end: number }>;
  score?: number;
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

// Placeholder API object until backend is ready
export const searchApi = {
  getSuggestions: async (query: string): Promise<SearchSuggestion[]> => {
    // TODO: Implement when backend endpoint exists
    return [];
  },
  search: async (request: SearchFilesRequest): Promise<FileSearchResult[]> => {
    // TODO: Implement when backend endpoint exists
    return [];
  },
};
