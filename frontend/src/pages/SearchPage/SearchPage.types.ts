/**
 * Types for Search Page - Advanced file search interface
 */

/**
 * Props for the SearchPage component
 */
export interface SearchPageProps {
  className?: string;
}

/**
 * Search result item structure
 */
export interface SearchResult {
  fileId: number;
  path: string;
  name: string;
  size: number;
  type: string;
  modified: string;
  score?: number;
  highlights?: {
    field: string;
    matches: string[];
  }[];
}

/**
 * Search filter configuration
 */
export interface SearchFilters {
  fileTypes?: string[];
  sizeRange?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  volumes?: string[];
  mediaTypes?: string[];
}

/**
 * Search query configuration
 */
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sortBy?: 'relevance' | 'name' | 'size' | 'modified';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Saved search configuration
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: string;
  updatedAt?: string;
}
