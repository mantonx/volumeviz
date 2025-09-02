/**
 * Search page component for VolumeViz advanced file search.
 *
 * Provides comprehensive search functionality including:
 * - Full-text search across file names and metadata
 * - Advanced filtering by file type, size, date, and media properties
 * - Search result ranking and highlighting
 * - Saved searches and search history
 * - Export of search results
 * - Integration with file explorer for result navigation
 *
 * The search interface uses the backend search API for
 * efficient querying across large file collections.
 */
export { SearchPage } from './SearchPage';
export { SearchPage as default } from './SearchPage';
export type {
  SearchPageProps,
  SearchResult,
  SearchFilters,
  SearchQuery,
  SavedSearch,
} from './SearchPage.types';
