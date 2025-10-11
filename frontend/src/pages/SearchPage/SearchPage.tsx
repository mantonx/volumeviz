/**
 * SearchPage - Comprehensive file search with advanced filtering
 *
 * Features:
 * - Multi-criteria search (name, content, metadata)
 * - Advanced filtering (size, type, date, volume)
 * - Saved searches for recurring queries
 * - Search history tracking
 * - Export search results (CSV, JSON)
 * - Real-time search suggestions
 * - Bulk operations on results
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { SearchInterface, type SearchQuery } from '@/components/domain/search';
import { ExportButton } from '@/components/shared/ExportButton';
import { exportFilesToCSV, exportFilesToJSON, getDefaultFileExportOptions } from '@/utils/fileExport';
import { searchApi } from '@/api/search';
import { AdvancedFilters } from './AdvancedFilters';
import { FilterChips } from './FilterChips';
import {
  filtersToUrlParams,
  urlParamsToFilters,
  updateUrlWithFilters,
  getFiltersFromUrl,
  clearFiltersFromUrl
} from './filterUrlState';
import type { SearchPageProps, SearchState } from './SearchPage.types';
import type { FilterState } from './AdvancedFilters.types';

export const SearchPage: React.FC<SearchPageProps> = ({
  className = '',
  selectedVolumeFilter = 'all',
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {},
    results: [],
    isSearching: false,
    selectedResults: [],
    showDuplicates: false,
    showHistory: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({});

  // Apply volume filter automatically
  useEffect(() => {
    if (selectedVolumeFilter && selectedVolumeFilter !== 'all') {
      setAdvancedFilters(prev => ({
        ...prev,
        volumes: [selectedVolumeFilter],
      }));
    } else {
      // Clear volume filter when 'all' is selected
      setAdvancedFilters(prev => {
        const { volumes, ...rest } = prev;
        return rest;
      });
    }
  }, [selectedVolumeFilter]);

  // Initialize filters from URL on mount
  useEffect(() => {
    const { filters, query } = getFiltersFromUrl();
    setAdvancedFilters(filters);
    if (query) {
      setSearchState((prev) => ({ ...prev, query }));
    }
  }, []);

  // Handlers
  const handleSearch = useCallback(async (searchQuery: SearchQuery) => {
    // Extract the actual query string from the SearchQuery object
    const queryString = 'query' in searchQuery ? searchQuery.query : '';

    setSearchState((prev) => ({ ...prev, query: queryString }));
    setIsSearching(true);
    setError(null);

    // Update URL with current query and filters
    updateUrlWithFilters(advancedFilters, queryString);

    const startTime = Date.now();

    // Helper to convert size to bytes
    const convertToBytes = (value: number, unit: 'B' | 'KB' | 'MB' | 'GB' = 'MB'): number => {
      const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
      return value * multipliers[unit];
    };

    try {
      const rawResults = await searchApi.search({
        query: queryString,
        page: 1,
        page_size: 50,
        // Add advanced filters to API call
        size_min: advancedFilters.sizeRange?.min
          ? convertToBytes(advancedFilters.sizeRange.min, advancedFilters.sizeRange.minUnit)
          : undefined,
        size_max: advancedFilters.sizeRange?.max
          ? convertToBytes(advancedFilters.sizeRange.max, advancedFilters.sizeRange.maxUnit)
          : undefined,
        modified_after: advancedFilters.dateRange?.start?.toISOString(),
        modified_before: advancedFilters.dateRange?.end?.toISOString(),
        file_types: advancedFilters.fileTypes?.join(','),
        paths: advancedFilters.pathFilter,
      });

      // Transform API results to SearchInterface format
      const formattedResults = {
        items: rawResults.map((r: any) => ({
          id: r.id,
          name: r.name,
          path: r.path,
          type: r.type || 'file',
          size: r.size,
          modifiedAt: r.modified ? new Date(r.modified) : undefined,
          relevanceScore: r.score || 100,
          highlights: r.matched_content ? [{
            field: 'content',
            matches: [{
              start: 0,
              end: r.matched_content.length,
              text: r.matched_content,
            }]
          }] : undefined,
        })),
        totalCount: rawResults.length,
        page: 1,
        pageSize: 50,
        hasMore: false,
        searchTime: Date.now() - startTime,
      };

      setSearchResults(formattedResults);
      setSearchState((prev) => ({
        ...prev,
        results: rawResults,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed. Please try again.';
      setError(errorMessage);
      setSearchResults(null);
      setSearchState((prev) => ({ ...prev, results: [] }));
    } finally {
      setIsSearching(false);
    }
  }, [advancedFilters]);

  const handleFileSelect = useCallback(
    (fileId: string) => {
      // Navigate to explorer with file selected
      navigate(`/explorer?file=${fileId}`);
    },
    [navigate],
  );

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setAdvancedFilters(newFilters);
    // Update URL immediately when filters change
    updateUrlWithFilters(newFilters, searchState.query);
  }, [searchState.query]);

  const handleRemoveFilter = useCallback((key: keyof FilterState, value?: string) => {
    setAdvancedFilters((prev) => {
      const updated = { ...prev };

      if (value) {
        // Remove specific value from array filter
        if (key === 'mediaTypes' && Array.isArray(updated[key])) {
          updated[key] = updated[key]?.filter((v) => v !== value);
          if (updated[key]?.length === 0) delete updated[key];
        } else if (key === 'fileTypes' && Array.isArray(updated[key])) {
          updated[key] = updated[key]?.filter((v) => v !== value);
          if (updated[key]?.length === 0) delete updated[key];
        } else if (key === 'volumes' && Array.isArray(updated[key])) {
          updated[key] = updated[key]?.filter((v) => v !== value);
          if (updated[key]?.length === 0) delete updated[key];
        }
      } else {
        // Remove entire filter
        delete updated[key];
      }

      updateUrlWithFilters(updated, searchState.query);
      return updated;
    });
  }, [searchState.query]);

  const handleClearAllFilters = useCallback(() => {
    setAdvancedFilters({});
    clearFiltersFromUrl(true);
  }, []);

  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      const defaultOptions = getDefaultFileExportOptions('search');
      const exportOptions = {
        ...defaultOptions,
        filename: `search-results-${searchState.query.replace(/\s+/g, '-')}-${Date.now()}`,
        includeMetadata: true,
        metadata: {
          query: searchState.query,
          resultCount: searchState.results.length,
          exportedAt: new Date().toISOString(),
        },
      };

      try {
        if (format === 'csv') {
          exportFilesToCSV(searchState.results, exportOptions);
        } else {
          exportFilesToJSON(searchState.results, exportOptions);
        }
      } catch (err) {
        setError('Failed to export results. Please try again.');
      }
    },
    [searchState.query, searchState.results],
  );

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <SearchIcon className="w-8 h-8 text-blue-600" />
                Search & Discovery
              </h1>
              <p className="mt-2 text-gray-600">
                Find files and analyze your storage
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <ExportButton
                onExport={handleExport}
                disabled={searchState.results.length === 0}
                label="Export Results"
                variant="outline"
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <span className="sr-only">Dismiss</span>
              ✕
            </button>
          </div>
        )}

        {/* Advanced Filters */}
        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={handleFiltersChange}
          className="mb-6"
        />

        {/* Active Filter Chips */}
        {Object.keys(advancedFilters).length > 0 && (
          <div className="mb-6">
            <FilterChips
              filters={advancedFilters}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearAllFilters}
            />
          </div>
        )}

        {/* Results Summary */}
        {searchResults && searchResults.items.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <SearchIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Found {searchResults.totalCount.toLocaleString()} file{searchResults.totalCount !== 1 ? 's' : ''}
                  {searchState.query && ` matching "${searchState.query}"`}
                </p>
                {Object.keys(advancedFilters).length > 0 && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    with {Object.keys(advancedFilters).length} active filter{Object.keys(advancedFilters).length !== 1 ? 's' : ''}
                  </p>
                )}
                {searchResults.searchTime && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Search completed in {searchResults.searchTime}ms
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Search Interface */}
        <div className="bg-surface-elevated rounded-lg shadow-md border border-line p-6">
          <SearchInterface
            results={searchResults}
            isSearching={isSearching}
            searchError={error || undefined}
            onSearch={handleSearch}
            onResultClick={(result) => handleFileSelect(result.id)}
            onExportResults={(format) => {
              handleExport(format as 'csv' | 'json');
            }}
            showAdvanced={true}
            showFilters={true}
            showSavedSearches={true}
            showHistory={true}
            enableRealTimeSearch={false}
            className="max-w-none"
          />
        </div>

      </div>
    </div>
  );
};
