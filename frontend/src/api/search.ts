/**
 * Search API Client
 *
 * Provides typed API functions for file search and saved search operations
 */

import { Api } from './generated/Api';

// Create configured API client
const api = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Search suggestions types
export interface SearchSuggestion {
  text: string;
  type: 'filename' | 'extension' | 'path' | 'filter' | 'recent';
  description?: string;
  count?: number;
}

export interface SearchSuggestionsResponse {
  suggestions: SearchSuggestion[];
  query_time_ms: number;
}

// Search request types
export interface SearchFilesRequest {
  // Text search
  q?: string;
  path?: string;
  glob?: string;
  regex?: string;

  // Media filters
  mediaKind?: string;
  mime?: string[];

  // Size filters
  minSize?: number;
  maxSize?: number;

  // Time filters
  mtimeFrom?: string; // ISO 8601 date string
  mtimeTo?: string;

  // Media metadata filters
  durationFrom?: number; // Duration in ms
  durationTo?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  hasGps?: boolean;
  hasSubs?: boolean;
  hashPresent?: boolean;

  // Pagination and sorting
  page?: number;
  perPage?: number;
  sort?:
    | 'relevance'
    | 'name'
    | 'size'
    | 'mtime'
    | 'ctime'
    | 'duration'
    | 'type'
    | 'media_kind';
  order?: 'asc' | 'desc';
}

// Search response types
export interface FileSearchResult {
  id: number;
  volume_id: string;
  path: string;
  name: string;
  size: number;
  disk_usage: number;
  extension?: string;
  mime_type?: string;
  media_kind?: string;
  modified_time?: string;
  created_time?: string;
  metadata?: Record<string, any>;

  // Media metadata
  duration_ms?: number;
  width?: number;
  height?: number;
  video_codec?: string;
  audio_codec?: string;
  has_gps?: boolean;
  gps_lat?: number;
  gps_lon?: number;
  camera_model?: string;
  capture_date?: string;
  hash?: string;
  has_subs?: boolean;

  // Computed fields for display
  mtime?: string; // alias for modified_time
}

export interface FileResult {
  id: number;
  volume_id: string;
  path: string;
  name: string;
  size: number;
  disk_usage: number;
  extension?: string;
  mime_type?: string;
  media_kind?: string;
  modified_time?: string;
  created_time?: string;
  metadata?: Record<string, any>;

  // Media metadata
  duration_ms?: number;
  width?: number;
  height?: number;
  video_codec?: string;
  audio_codec?: string;
  has_gps?: boolean;
  gps_lat?: number;
  gps_lon?: number;
  camera_model?: string;
  capture_date?: string;
  hash?: string;
  has_subs?: boolean;
}

export interface SearchFilesResponse {
  files: FileSearchResult[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  query_time_ms: number;
  filters: Record<string, any>;
}

// Saved search types
export interface SavedSearch {
  id: number;
  name: string;
  description?: string;
  query: SearchFilesRequest;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  run_count: number;
  metadata?: Record<string, any>;
}

export interface CreateSavedSearchRequest {
  name: string;
  description?: string;
  query: SearchFilesRequest;
  tags?: string[];
  is_public?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateSavedSearchRequest {
  name?: string;
  description?: string;
  query?: SearchFilesRequest;
  tags?: string[];
  is_public?: boolean;
  metadata?: Record<string, any>;
}

export interface ListSavedSearchesResponse {
  searches: SavedSearch[];
  total_count: number;
  page: number;
  per_page: number;
}

// Search API client
export const searchApi = {
  /**
   * Search files with advanced filters
   */
  async searchFiles(params: SearchFilesRequest): Promise<SearchFilesResponse> {
    try {
      // Ensure required pagination parameters have defaults
      const searchParams = {
        page: 1,
        perPage: 20,
        ...params,
      };

      const urlParams = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => urlParams.append(key, String(v)));
          } else {
            urlParams.append(key, String(value));
          }
        }
      });

      const url = `${api.baseUrl}/search/files?${urlParams}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          'Search API error:',
          response.status,
          response.statusText,
          errorText,
        ); // Debug logging
        throw new Error(
          `Search failed: ${response.status} ${response.statusText}: ${errorText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to search files: ${error}`);
    }
  },

  /**
   * Create a new saved search
   */
  async createSavedSearch(
    request: CreateSavedSearchRequest,
  ): Promise<SavedSearch> {
    try {
      const response = await fetch(`${api.baseUrl}/search/saved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create saved search: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to create saved search: ${error}`);
    }
  },

  /**
   * List saved searches with pagination
   */
  async listSavedSearches(params?: {
    page?: number;
    perPage?: number;
    tags?: string[];
  }): Promise<ListSavedSearchesResponse> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', String(params.page));
      if (params?.perPage)
        searchParams.append('perPage', String(params.perPage));
      if (params?.tags) {
        params.tags.forEach((tag) => searchParams.append('tags', tag));
      }

      const response = await fetch(
        `${api.baseUrl}/search/saved?${searchParams}`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to list saved searches: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to list saved searches: ${error}`);
    }
  },

  /**
   * Get a saved search by ID
   */
  async getSavedSearch(id: number): Promise<SavedSearch> {
    try {
      const response = await fetch(`${api.baseUrl}/search/saved/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to get saved search: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get saved search: ${error}`);
    }
  },

  /**
   * Update a saved search
   */
  async updateSavedSearch(
    id: number,
    request: UpdateSavedSearchRequest,
  ): Promise<SavedSearch> {
    try {
      const response = await fetch(`${api.baseUrl}/search/saved/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update saved search: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to update saved search: ${error}`);
    }
  },

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: number): Promise<void> {
    try {
      const response = await fetch(`${api.baseUrl}/search/saved/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete saved search: ${response.statusText}`,
        );
      }
    } catch (error) {
      throw new Error(`Failed to delete saved search: ${error}`);
    }
  },

  /**
   * Run a saved search by ID
   */
  async runSavedSearch(id: number): Promise<SearchFilesResponse> {
    try {
      const response = await fetch(`${api.baseUrl}/search/saved/${id}/run`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to run saved search: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to run saved search: ${error}`);
    }
  },

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(params: {
    q: string;
    limit?: number;
    type?: string;
  }): Promise<SearchSuggestionsResponse> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.append('q', params.q);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.type) searchParams.append('type', params.type);

      const response = await fetch(
        `${api.baseUrl}/search/suggestions?${searchParams}`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get search suggestions: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get search suggestions: ${error}`);
    }
  },
};

export default searchApi;
