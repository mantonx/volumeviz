/**
 * SearchInterface Component
 *
 * Advanced search interface with filters, saved searches, and real-time results.
 * Part of the Domain-Specific Compositions tier (Tier 3).
 */

export { SearchInterface } from './SearchInterface';
export type {
  SearchInterfaceProps,
  SearchInterfaceState,
  SearchInterfaceRef,
  SearchQuery,
  SimpleSearchQuery,
  AdvancedSearchQuery,
  SearchFilters,
  SearchResultItem,
  SearchResults,
  SavedSearch,
  SearchSuggestion,
  SearchHistoryItem,
  SearchConfig,
  SearchCondition,
  SearchUtils,
  SearchQueryType,
  SearchScope,
  SearchOperator,
  SearchField,
  SizeOperator,
  DateOperator,
  FileTypeCategory,
  SizeFilter,
  DateFilter,
} from './SearchInterface.types';
export {
  createMockSearchResults,
  createMockSavedSearches,
} from './SearchInterface.types';
