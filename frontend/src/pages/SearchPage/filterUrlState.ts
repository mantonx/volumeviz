/**
 * URL state management for search filters
 *
 * Provides utilities to sync filter state with URL search parameters
 * for shareable search links and state persistence
 */

import type { FilterState } from './AdvancedFilters.types';

/**
 * Convert filter state to URL search parameters
 */
export const filtersToUrlParams = (filters: FilterState): URLSearchParams => {
  const params = new URLSearchParams();

  // Size range
  if (filters.sizeRange) {
    if (filters.sizeRange.min !== undefined) {
      params.set('sizeMin', filters.sizeRange.min.toString());
      params.set('sizeMinUnit', filters.sizeRange.minUnit || 'MB');
    }
    if (filters.sizeRange.max !== undefined) {
      params.set('sizeMax', filters.sizeRange.max.toString());
      params.set('sizeMaxUnit', filters.sizeRange.maxUnit || 'MB');
    }
  }

  // Date range
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      params.set('dateStart', filters.dateRange.start.toISOString());
    }
    if (filters.dateRange.end) {
      params.set('dateEnd', filters.dateRange.end.toISOString());
    }
  }

  // Media types
  if (filters.mediaTypes && filters.mediaTypes.length > 0) {
    params.set('mediaTypes', filters.mediaTypes.join(','));
  }

  // File types
  if (filters.fileTypes && filters.fileTypes.length > 0) {
    params.set('fileTypes', filters.fileTypes.join(','));
  }

  // Volumes
  if (filters.volumes && filters.volumes.length > 0) {
    params.set('volumes', filters.volumes.join(','));
  }

  // Path filter
  if (filters.pathFilter) {
    params.set('path', filters.pathFilter);
  }

  return params;
};

/**
 * Convert URL search parameters to filter state
 */
export const urlParamsToFilters = (searchParams: URLSearchParams): FilterState => {
  const filters: FilterState = {};

  // Size range
  const sizeMin = searchParams.get('sizeMin');
  const sizeMinUnit = searchParams.get('sizeMinUnit');
  const sizeMax = searchParams.get('sizeMax');
  const sizeMaxUnit = searchParams.get('sizeMaxUnit');

  if (sizeMin || sizeMax) {
    filters.sizeRange = {
      min: sizeMin ? parseInt(sizeMin) : undefined,
      minUnit: (sizeMinUnit as 'B' | 'KB' | 'MB' | 'GB') || 'MB',
      max: sizeMax ? parseInt(sizeMax) : undefined,
      maxUnit: (sizeMaxUnit as 'B' | 'KB' | 'MB' | 'GB') || 'MB',
    };
  }

  // Date range
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');

  if (dateStart || dateEnd) {
    filters.dateRange = {
      start: dateStart ? new Date(dateStart) : undefined,
      end: dateEnd ? new Date(dateEnd) : undefined,
    };
  }

  // Media types
  const mediaTypes = searchParams.get('mediaTypes');
  if (mediaTypes) {
    filters.mediaTypes = mediaTypes.split(',') as any;
  }

  // File types
  const fileTypes = searchParams.get('fileTypes');
  if (fileTypes) {
    filters.fileTypes = fileTypes.split(',');
  }

  // Volumes
  const volumes = searchParams.get('volumes');
  if (volumes) {
    filters.volumes = volumes.split(',');
  }

  // Path filter
  const path = searchParams.get('path');
  if (path) {
    filters.pathFilter = path;
  }

  return filters;
};

/**
 * Update URL with new filter state without navigation
 */
export const updateUrlWithFilters = (
  filters: FilterState,
  query?: string
): void => {
  const params = filtersToUrlParams(filters);

  // Add query if provided
  if (query) {
    params.set('q', query);
  }

  // Update URL without navigation
  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
};

/**
 * Get current filters from URL
 */
export const getFiltersFromUrl = (): { filters: FilterState; query: string } => {
  const searchParams = new URLSearchParams(window.location.search);
  const filters = urlParamsToFilters(searchParams);
  const query = searchParams.get('q') || '';

  return { filters, query };
};

/**
 * Clear all filters from URL
 */
export const clearFiltersFromUrl = (keepQuery = true): void => {
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q');

  const newUrl = keepQuery && query
    ? `${window.location.pathname}?q=${encodeURIComponent(query)}`
    : window.location.pathname;

  window.history.replaceState({}, '', newUrl);
};
