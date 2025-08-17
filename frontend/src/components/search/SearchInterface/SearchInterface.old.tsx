/**
 * SearchInterface Component
 * 
 * Main search interface with advanced filters and results display
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { 
  searchPanelOpenAtom, 
  searchFiltersExpandedAtom,
} from '@/store/atoms/search';
import { useSearchParams } from 'react-router-dom';
import { searchApi, type SearchFilesRequest } from '@/api/search';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SearchFilters } from '../SearchFilters';
import { SearchResults } from '../SearchResults';
import { SavedSearchPanel } from '../SavedSearchPanel';
import { SearchAutocomplete } from '../SearchAutocomplete';

interface SearchInterfaceProps {
  className?: string;
  defaultQuery?: string;
  onFileSelect?: (fileId: number) => void;
  compact?: boolean;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  className = '',
  defaultQuery = '',
  onFileSelect,
  compact = false,
}) => {
  const [isPanelOpen, setIsPanelOpen] = useAtom(searchPanelOpenAtom);
  const [filtersExpanded, setFiltersExpanded] = useAtom(searchFiltersExpandedAtom);
  
  // URL is the single source of truth
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Search state - managed locally for UI responsiveness
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  
  // Derive all state from URL
  const searchQuery = searchParams.get('q') || '';
  const mediaKind = searchParams.get('mediaKind') || '';
  const mimeTypes = searchParams.getAll('mime');
  const sortField = searchParams.get('sort') || 'relevance';
  const sortOrder = searchParams.get('order') || 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '20', 10);
  
  // Helper to update URL (single source of truth)
  const updateUrl = useCallback((updates: Record<string, any>) => {
    setSearchParams(current => {
      const newParams = new URLSearchParams(current);
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.delete(key); // Clear existing
          value.forEach(v => newParams.append(key, String(v)));
        } else {
          newParams.set(key, String(value));
        }
      });
      
      return newParams;
    });
  }, [setSearchParams]);

  // Execute search when query changes
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsQuickSearch(false);
    
    // Update URL with search query
    updateUrlPreservingAll({ 
      q: searchQuery.trim(),
      page: 1, // Reset to first page for new search
    });
    
    await searchFiles(searchQuery.trim());
    
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  }, [searchQuery, searchFiles, isPanelOpen, setIsPanelOpen, setUrlState]);

  // Execute search when advanced filters change
  const handleAdvancedSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsQuickSearch(false);
    
    // Update URL with current search state and filters
    const urlUpdate: any = {
      q: searchQuery.trim(),
      page: 1, // Reset to first page when filters change
    };
    
    // Add advanced filters to URL
    if (advancedFilters.mediaKind) urlUpdate.mediaKind = advancedFilters.mediaKind;
    if (advancedFilters.mimeTypes?.length) urlUpdate.mime = advancedFilters.mimeTypes;
    if (advancedFilters.sizeRange?.min) urlUpdate.minSize = advancedFilters.sizeRange.min;
    if (advancedFilters.sizeRange?.max) urlUpdate.maxSize = advancedFilters.sizeRange.max;
    if (advancedFilters.timeRange?.from) urlUpdate.mtimeFrom = advancedFilters.timeRange.from;
    if (advancedFilters.timeRange?.to) urlUpdate.mtimeTo = advancedFilters.timeRange.to;
    if (advancedFilters.durationRange?.min) urlUpdate.durationFrom = advancedFilters.durationRange.min;
    if (advancedFilters.durationRange?.max) urlUpdate.durationTo = advancedFilters.durationRange.max;
    if (advancedFilters.dimensionsRange?.width?.min) urlUpdate.minWidth = advancedFilters.dimensionsRange.width.min;
    if (advancedFilters.dimensionsRange?.width?.max) urlUpdate.maxWidth = advancedFilters.dimensionsRange.width.max;
    if (advancedFilters.dimensionsRange?.height?.min) urlUpdate.minHeight = advancedFilters.dimensionsRange.height.min;
    if (advancedFilters.dimensionsRange?.height?.max) urlUpdate.maxHeight = advancedFilters.dimensionsRange.height.max;
    if (advancedFilters.booleanFilters?.hasGps !== undefined) urlUpdate.hasGps = advancedFilters.booleanFilters.hasGps;
    if (advancedFilters.booleanFilters?.hasSubs !== undefined) urlUpdate.hasSubs = advancedFilters.booleanFilters.hasSubs;
    if (advancedFilters.booleanFilters?.hashPresent !== undefined) urlUpdate.hashPresent = advancedFilters.booleanFilters.hashPresent;
    
    updateUrlPreservingAll(urlUpdate);
    
    // Use executeSearch to preserve the current query and apply new filters
    await executeSearch({
      q: searchQuery.trim(),
      page: 1,
      perPage: 20,
      sort: 'name',
      order: 'asc',
    });
  }, [searchQuery, executeSearch, advancedFilters, setUrlState]);

  // Quick search for instant results as user types
  const handleQuickSearch = useCallback(async (query: string) => {
    if (query.length < 3) return;
    
    setIsQuickSearch(true);
    await searchFiles(query, { perPage: 10 });
  }, [searchFiles]);

  // Handle Enter key in search input
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  // Clear all search data
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    clearSearch();
    setIsPanelOpen(false);
    
    // Clear URL parameters
    setUrlState({
      q: '',
      mediaKind: '',
      mime: [],
      minSize: undefined,
      maxSize: undefined,
      mtimeFrom: '',
      mtimeTo: '',
      durationFrom: undefined,
      durationTo: undefined,
      minWidth: undefined,
      maxWidth: undefined,
      minHeight: undefined,
      maxHeight: undefined,
      hasGps: undefined,
      hasSubs: undefined,
      hashPresent: undefined,
      page: 1,
      perPage: 20,
      sort: 'name',
      order: 'asc',
    });
  }, [clearSearch, setIsPanelOpen, setUrlState]);

  // Check if advanced filters are active (memoized to prevent unnecessary re-renders)
  const hasActiveFilters = useMemo(() => {
    return Object.values(advancedFilters).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== undefined && v !== null && v !== '');
      }
      return value !== undefined && value !== null && value !== '';
    });
  }, [advancedFilters]);

  // Initialize from URL on mount only
  useEffect(() => {
    if (urlState.q && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Set search query from URL
      setSearchQuery(urlState.q);
      setIsPanelOpen(true);
      
      // Set advanced filters from URL
      if (urlState.mediaKind || urlState.mime?.length || urlState.minSize || urlState.maxSize ||
          urlState.mtimeFrom || urlState.mtimeTo || urlState.durationFrom || urlState.durationTo ||
          urlState.minWidth || urlState.maxWidth || urlState.minHeight || urlState.maxHeight ||
          urlState.hasGps !== undefined || urlState.hasSubs !== undefined || urlState.hashPresent !== undefined) {
        
        setAdvancedFilters({
          mediaKind: urlState.mediaKind || undefined,
          mimeTypes: urlState.mime || [],
          sizeRange: { 
            min: urlState.minSize, 
            max: urlState.maxSize 
          },
          timeRange: { 
            from: urlState.mtimeFrom || undefined, 
            to: urlState.mtimeTo || undefined 
          },
          durationRange: { 
            min: urlState.durationFrom, 
            max: urlState.durationTo 
          },
          dimensionsRange: { 
            width: { min: urlState.minWidth, max: urlState.maxWidth },
            height: { min: urlState.minHeight, max: urlState.maxHeight }
          },
          booleanFilters: {
            hasGps: urlState.hasGps,
            hasSubs: urlState.hasSubs,
            hashPresent: urlState.hashPresent,
          },
        });
      }
      
      // Execute search after a short delay
      setTimeout(() => {
        executeSearch({
          q: urlState.q,
          page: urlState.page || 1,
          perPage: urlState.perPage || 20,
          sort: urlState.sort || 'relevance',
          order: urlState.order || 'desc',
        });
      }, 100);
      
    } else if (defaultQuery && !searchQuery && !urlState.q) {
      setSearchQuery(defaultQuery);
    }
  }, []); // Run only on mount

  // Sync sorting state from URL
  useEffect(() => {
    if (urlState.sort && urlState.sort !== sortField) {
      // Don't trigger search, just update the sort state to match URL
      changeSorting(urlState.sort, urlState.order || 'asc');
    }
  }, [urlState.sort, urlState.order, sortField, changeSorting]);

  // Auto-execute search when advanced filters change (if we have a query)
  useEffect(() => {
    // Only auto-search if we've initialized and have a query
    if (hasInitializedRef.current && searchQuery.trim()) {
      // Debounce filter changes to avoid excessive API calls
      const timeoutId = setTimeout(() => {
        handleAdvancedSearch();
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  }, [advancedFilters, searchQuery]); // Remove handleAdvancedSearch from dependencies

  if (compact) {
    return (
      <div className={`search-interface-compact ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <SearchAutocomplete
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                if (value.length >= 3) {
                  handleQuickSearch(value);
                }
              }}
              onSuggestionSelect={(suggestion) => {
                if (suggestion.type === 'filter') {
                  setTimeout(() => handleSearch(), 100);
                } else if (searchQuery.length >= 3) {
                  setTimeout(() => handleQuickSearch(searchQuery), 100);
                }
              }}
              placeholder="Search files, folders, and metadata..."
              disabled={loading}
              className="compact"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || loading}
            className="px-4 py-2"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
          {(hasResults || hasActiveFilters) && (
            <Button
              onClick={handleClearSearch}
              variant="outline"
              className="px-3 py-2"
            >
              Clear
            </Button>
          )}
        </div>
        
        {hasResults && (
          <div className="mt-2 text-sm text-gray-600">
            {isQuickSearch ? `${Math.min(10, totalCount)} of ` : ''}{totalCount} files found
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`search-interface ${className}`}>
      {/* Search Header */}
      <div className="search-header mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">File Search</h1>
          <div className="flex items-center space-x-2">
            <SavedSearchPanel />
            {(hasResults || hasActiveFilters) && (
              <Button
                onClick={handleClearSearch}
                variant="outline"
                size="sm"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Main Search Bar */}
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <SearchAutocomplete
                value={searchQuery}
                onChange={setSearchQuery}
                onSuggestionSelect={(suggestion) => {
                  // Auto-trigger search when a suggestion is selected
                  if (suggestion.type === 'filter') {
                    setTimeout(() => handleSearch(), 100);
                  }
                }}
                placeholder="Search files, folders, and metadata..."
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || loading}
              size="lg"
              className="px-6 py-3"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <span>Advanced Filters</span>
                <span className={`transform transition-transform ${filtersExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Active
                  </span>
                )}
              </Button>
              
              {hasResults && (
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    {totalCount.toLocaleString()} files found
                  </div>
                  
                  {/* Sorting Controls */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Sort by:</span>
                    
                    {/* Sort Field Selector */}
                    <select
                      value={sortField}
                      onChange={(e) => {
                        const newSortField = e.target.value;
                        updateUrlPreservingAll({ 
                          sort: newSortField, 
                          order: sortOrder 
                        });
                        changeSorting(newSortField, sortOrder);
                      }}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <optgroup label="Relevance">
                        <option value="relevance">Best Match</option>
                      </optgroup>
                      <optgroup label="Date & Time">
                        <option value="mtime">Modified Date</option>
                        <option value="ctime">Created Date</option>
                      </optgroup>
                      <optgroup label="File Properties">
                        <option value="name">Name</option>
                        <option value="size">File Size</option>
                        <option value="type">File Type</option>
                        <option value="media_kind">Media Type</option>
                      </optgroup>
                      <optgroup label="Media Properties">
                        <option value="duration">Duration</option>
                      </optgroup>
                    </select>

                    {/* Sort Direction Toggle */}
                    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          updateUrlPreservingAll({ 
                            sort: sortField, 
                            order: 'asc' 
                          });
                          changeSorting(sortField, 'asc');
                        }}
                        className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                          sortOrder === 'asc'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                        }`}
                        title={`Sort ${sortField === 'size' ? 'smallest to largest' : sortField === 'mtime' || sortField === 'ctime' ? 'oldest to newest' : 'A to Z'}`}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                        </svg>
                        <span className="text-xs">
                          {sortField === 'size' ? 'Small' : sortField === 'mtime' || sortField === 'ctime' ? 'Old' : 'A-Z'}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          updateUrlPreservingAll({ 
                            sort: sortField, 
                            order: 'desc' 
                          });
                          changeSorting(sortField, 'desc');
                        }}
                        className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                          sortOrder === 'desc'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                        }`}
                        title={`Sort ${sortField === 'size' ? 'largest to smallest' : sortField === 'mtime' || sortField === 'ctime' ? 'newest to oldest' : 'Z to A'}`}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="17 20V8m0 12l4-4m-4 4l-4-4" />
                        </svg>
                        <span className="text-xs">
                          {sortField === 'size' ? 'Large' : sortField === 'mtime' || sortField === 'ctime' ? 'New' : 'Z-A'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Advanced Filters Panel */}
        {filtersExpanded && (
          <div className="mt-4">
            <SearchFilters />
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="search-results">
        {error && (
          <Card className="p-4 mb-4 border-red-200 bg-red-50">
            <div className="text-red-700">
              <strong>Search Error:</strong> {error}
            </div>
          </Card>
        )}

        {loading && (
          <Card className="p-8 text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span>Searching files...</span>
            </div>
          </Card>
        )}

        {!loading && !error && hasResults && (
          <SearchResults onFileSelect={onFileSelect} />
        )}

        {!loading && !error && !hasResults && searchQuery && (
          <Card className="p-8 text-center text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No files found</h3>
            <p className="text-gray-500">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
          </Card>
        )}

        {!loading && !error && !hasResults && !searchQuery && (
          <Card className="p-8 text-center text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Search Files</h3>
            <p className="text-gray-500">
              Enter search terms to find files across all volumes with powerful filtering options.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};