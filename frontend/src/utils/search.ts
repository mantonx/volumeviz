import type { ReactNode } from 'react';
import type {
  SearchQuery,
  SimpleSearchQuery,
  SearchResultItem,
  SearchFilters,
} from '../components/search/SearchInterface/SearchInterface.types';

/**
 * Search utilities interface
 */
export interface SearchUtils {
  /** Parse query string into SearchQuery */
  parseQuery(queryString: string): SimpleSearchQuery;
  /** Convert SearchQuery to string */
  queryToString(query: SearchQuery): string;
  /** Validate search query */
  validateQuery(query: SearchQuery): string[];
  /** Build search URL */
  buildSearchUrl(query: SearchQuery, baseUrl?: string): string;
  /** Format file size for display */
  formatFileSize(bytes: number): string;
  /** Format search time */
  formatSearchTime(milliseconds: number): string;
  /** Highlight search terms in text */
  highlightMatches(
    text: string,
    matches: SearchResultItem['highlights'],
  ): ReactNode;
  /** Calculate relevance score */
  calculateRelevance(item: SearchResultItem, query: SearchQuery): number;
  /** Group results by category */
  groupResults(results: SearchResultItem[]): Record<string, SearchResultItem[]>;
  /** Filter results by criteria */
  filterResults(
    results: SearchResultItem[],
    filters: SearchFilters,
  ): SearchResultItem[];
  /** Sort results by field */
  sortResults(
    results: SearchResultItem[],
    field: string,
    order: 'asc' | 'desc',
  ): SearchResultItem[];
}

// Helper function for size filtering
function getUnitMultiplier(unit: string): number {
  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return multipliers[unit as keyof typeof multipliers] || 1;
}

export const searchUtils: SearchUtils = {
  parseQuery: (queryString: string): SimpleSearchQuery => {
    // Simple implementation - can be enhanced for complex parsing
    return {
      query: queryString,
      type: 'simple',
      scope: 'all',
      filters: {},
    };
  },

  queryToString: (query: SearchQuery): string => {
    if ('query' in query) {
      return query.query;
    }
    // Convert advanced query to string representation
    return query.conditions.map((c) => `${c.field}:${c.value}`).join(' ');
  },

  validateQuery: (query: SearchQuery): string[] => {
    const errors: string[] = [];

    if ('query' in query) {
      if (!query.query.trim()) {
        errors.push('Search query cannot be empty');
      }
      if (query.query.length > 1000) {
        errors.push('Search query is too long (max 1000 characters)');
      }
    } else {
      if (query.conditions.length === 0) {
        errors.push('At least one search condition is required');
      }
    }

    return errors;
  },

  buildSearchUrl: (query: SearchQuery, baseUrl = '/search'): string => {
    const params = new URLSearchParams();

    if ('query' in query) {
      params.set('q', query.query);
      params.set('type', query.type);
      params.set('scope', query.scope);

      if (query.filters.fileTypes?.length) {
        params.set('types', query.filters.fileTypes.join(','));
      }
      if (query.filters.extensions?.length) {
        params.set('ext', query.filters.extensions.join(','));
      }
    } else {
      params.set('advanced', '1');
      params.set('conditions', JSON.stringify(query.conditions));
    }

    return `${baseUrl}?${params.toString()}`;
  },

  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  },

  formatSearchTime: (milliseconds: number): string => {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`;
    }
  },

  highlightMatches: (
    text: string,
    matches?: SearchResultItem['highlights'],
  ): ReactNode => {
    if (!matches?.length) return text;

    // Simple implementation - would need React.createElement for actual highlighting
    return text;
  },

  calculateRelevance: (item: SearchResultItem, query: SearchQuery): number => {
    // Simple relevance calculation
    let score = item.relevanceScore || 0;

    if ('query' in query) {
      const queryLower = query.query.toLowerCase();
      const nameLower = item.name.toLowerCase();

      if (nameLower === queryLower) score += 100;
      else if (nameLower.startsWith(queryLower)) score += 50;
      else if (nameLower.includes(queryLower)) score += 25;
    }

    return Math.min(100, Math.max(0, score));
  },

  groupResults: (
    results: SearchResultItem[],
  ): Record<string, SearchResultItem[]> => {
    return results.reduce(
      (groups, item) => {
        const key = item.type === 'folder' ? 'Folders' : 'Files';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
        return groups;
      },
      {} as Record<string, SearchResultItem[]>,
    );
  },

  filterResults: (
    results: SearchResultItem[],
    filters: SearchFilters,
  ): SearchResultItem[] => {
    return results.filter((item) => {
      if (filters.fileTypes?.length) {
        // Implementation would check file type categories
      }
      if (filters.extensions?.length) {
        if (item.extension && !filters.extensions.includes(item.extension)) {
          return false;
        }
      }
      if (filters.sizeFilter && item.size !== undefined) {
        const { operator, value, unit } = filters.sizeFilter;
        const itemSizeInUnit = item.size / getUnitMultiplier(unit);

        switch (operator) {
          case 'gt':
            return itemSizeInUnit > value;
          case 'gte':
            return itemSizeInUnit >= value;
          case 'lt':
            return itemSizeInUnit < value;
          case 'lte':
            return itemSizeInUnit <= value;
          case 'eq':
            return Math.abs(itemSizeInUnit - value) < 0.1;
          default:
            return true;
        }
      }
      return true;
    });
  },

  sortResults: (
    results: SearchResultItem[],
    field: string,
    order: 'asc' | 'desc',
  ): SearchResultItem[] => {
    return [...results].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          comparison =
            (a.modifiedAt?.getTime() || 0) - (b.modifiedAt?.getTime() || 0);
          break;
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        default:
          return 0;
      }

      return order === 'asc' ? comparison : -comparison;
    });
  },
};