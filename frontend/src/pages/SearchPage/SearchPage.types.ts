/**
 * Types for Search Page - Advanced file search interface
 */

/**
 * Props for the SearchPage component
 */
export interface SearchPageProps {
  className?: string;
  /**
   * Volume filter from FilesPage
   * - 'all' = search across all volumes (global search)
   * - specific volume name = search only in that volume
   */
  selectedVolumeFilter?: string;
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

/**
 * Search page state
 */
export interface SearchState {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  isSearching: boolean;
  selectedResults: string[];
  showDuplicates: boolean;
  showHistory: boolean;
}

/**
 * Duplicate detection options
 */
export interface DuplicateDetectionOptions {
  byContentHash: boolean;
  bySizeAndName: boolean;
  fuzzyMatching: boolean;
  minFileSize?: number;
  excludePatterns?: string[];
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json' | 'excel';

/**
 * Search statistics
 */
export interface SearchStatistics {
  totalResults: number;
  potentialDuplicates: number;
  totalSize: number;
  recentSearches: number;
}
