/**
 * SearchInterface Component
 * 
 * Main search interface with URL as single source of truth
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { 
  searchPanelOpenAtom, 
  searchFiltersExpandedAtom,
  searchResultsAtom,
  searchTotalCountAtom,
  searchLoadingAtom,
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
  
  // Update Jotai atoms for SearchResults component
  const setSearchResults = useSetAtom(searchResultsAtom);
  const setSearchTotalCount = useSetAtom(searchTotalCountAtom);
  const setSearchLoading = useSetAtom(searchLoadingAtom);
  
  // URL is the single source of truth
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Search state - managed locally for UI responsiveness
  const [allResults, setAllResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [queryTime, setQueryTime] = React.useState(0);
  const [currentSearchId, setCurrentSearchId] = React.useState<string>('');
  const [loadedPages, setLoadedPages] = React.useState<Set<number>>(new Set());
  
  // Derive all state from URL parameters
  const searchQuery = searchParams.get('q') || '';
  const mediaKind = searchParams.get('mediaKind') || '';
  const mimeTypes = searchParams.getAll('mime');
  const sortField = searchParams.get('sort') || 'relevance';
  const sortOrder = searchParams.get('order') || 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '20', 10);
  
  // Generate search ID for tracking search changes
  const searchId = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (mediaKind) params.set('mediaKind', mediaKind);
    mimeTypes.forEach(mime => params.append('mime', mime));
    params.set('sort', sortField);
    params.set('order', sortOrder);
    // Add other filter params...
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const mtimeFrom = searchParams.get('mtimeFrom');
    const mtimeTo = searchParams.get('mtimeTo');
    const hasGps = searchParams.get('hasGps');
    const hasSubs = searchParams.get('hasSubs');
    if (minSize) params.set('minSize', minSize);
    if (maxSize) params.set('maxSize', maxSize);
    if (mtimeFrom) params.set('mtimeFrom', mtimeFrom);
    if (mtimeTo) params.set('mtimeTo', mtimeTo);
    if (hasGps) params.set('hasGps', hasGps);
    if (hasSubs) params.set('hasSubs', hasSubs);
    return params.toString();
  }, [searchQuery, mediaKind, mimeTypes, sortField, sortOrder, searchParams]);
  
  // Debug URL parsing
  console.log('📍 URL State:', {
    searchQuery,
    mediaKind,
    mimeTypes,
    sortField,
    sortOrder,
    page,
    perPage,
    allParams: Array.from(searchParams.entries())
  });
  
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
  
  // Execute search for a specific page (for infinite scroll)
  const executeSearchPage = useCallback(async (targetPage: number, isNewSearch = false) => {
    if (!searchQuery.trim()) {
      setAllResults([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(null);
      setLoadedPages(new Set());
      return;
    }
    
    // Don't load page if already loaded (unless new search)
    if (!isNewSearch && loadedPages.has(targetPage)) {
      console.log(`⏸️ Page ${targetPage} already loaded`);
      return;
    }
    
    // Mark page as being loaded immediately to prevent duplicates
    if (!isNewSearch) {
      setLoadedPages(prev => new Set([...prev, targetPage]));
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Build search request from URL parameters
      const searchRequest: SearchFilesRequest = {
        q: searchQuery,
        page: targetPage,
        perPage,
        sort: sortField as any,
        order: sortOrder as any,
      };
      
      // Add filters from URL
      if (mediaKind) searchRequest.mediaKind = mediaKind;
      if (mimeTypes.length > 0) searchRequest.mime = mimeTypes;
      
      // Add other URL parameters
      const minSize = searchParams.get('minSize');
      const maxSize = searchParams.get('maxSize');
      const mtimeFrom = searchParams.get('mtimeFrom');
      const mtimeTo = searchParams.get('mtimeTo');
      const hasGps = searchParams.get('hasGps');
      const hasSubs = searchParams.get('hasSubs');
      
      if (minSize) searchRequest.minSize = parseInt(minSize, 10);
      if (maxSize) searchRequest.maxSize = parseInt(maxSize, 10);
      if (mtimeFrom) searchRequest.mtimeFrom = mtimeFrom;
      if (mtimeTo) searchRequest.mtimeTo = mtimeTo;
      if (hasGps) searchRequest.hasGps = hasGps === 'true';
      if (hasSubs) searchRequest.hasSubs = hasSubs === 'true';
      
      console.log(`🔍 Executing search page ${targetPage}:`, searchRequest);
      const response = await searchApi.searchFiles(searchRequest);
      
      setTotalCount(response.total_count || 0);
      setTotalPages(response.total_pages || 0);
      setQueryTime(response.query_time_ms || 0);
      
      if (isNewSearch) {
        // For new search, create array with placeholders for all items
        const totalItems = response.total_count || 0;
        const newResults = new Array(totalItems);
        
        // Fill in the first page
        response.files?.forEach((file, index) => {
          newResults[index] = file;
        });
        
        setAllResults(newResults);
        setLoadedPages(new Set([targetPage]));
      } else {
        // Append results for infinite scroll
        setAllResults(prev => {
          const newResults = [...prev];
          const startIndex = (targetPage - 1) * perPage;
          
          // Insert new page results at correct position
          response.files?.forEach((file, index) => {
            newResults[startIndex + index] = file;
          });
          
          return newResults;
        });
        // Page already added to loadedPages above
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      if (isNewSearch) {
        setAllResults([]);
        setTotalCount(0);
        setTotalPages(0);
        setLoadedPages(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, perPage, sortField, sortOrder, mediaKind, mimeTypes, searchParams, loadedPages]);
  
  // Execute search when URL changes (detect new search vs pagination)
  useEffect(() => {
    console.log('🚀 useEffect triggered with searchId:', searchId);
    console.log('🚀 searchQuery from URL:', searchQuery);
    
    if (searchQuery.trim()) {
      const isNewSearch = currentSearchId !== searchId;
      
      if (isNewSearch) {
        console.log('🔍 Starting NEW search for:', searchQuery);
        setCurrentSearchId(searchId);
        setSearchLoading(true);
        executeSearchPage(1, true); // Load first page for new search
      } else {
        console.log(`🔍 Loading page ${page} for existing search`);
        executeSearchPage(page, false); // Load specific page for existing search
      }
      
      setIsPanelOpen(true);
    } else {
      console.log('❌ No search query, skipping search');
      setCurrentSearchId('');
      setAllResults([]);
      setLoadedPages(new Set());
    }
  }, [searchId, page, executeSearchPage, currentSearchId, searchQuery]);
  
  // Update Jotai atoms when allResults change
  useEffect(() => {
    setSearchResults(allResults);
    setSearchTotalCount(totalCount);
  }, [allResults, totalCount, setSearchResults, setSearchTotalCount]);
  
  // Initialize with default query if provided and no URL query
  useEffect(() => {
    if (defaultQuery && !searchQuery) {
      updateUrl({ q: defaultQuery });
    }
  }, [defaultQuery, searchQuery, updateUrl]);
  
  // Handle infinite scroll load more
  const handleLoadMore = useCallback(() => {
    const nextPage = Math.max(...Array.from(loadedPages), 0) + 1;
    if (nextPage <= totalPages && !loadedPages.has(nextPage)) {
      console.log(`🔄 Loading more: page ${nextPage}, loadedPages:`, Array.from(loadedPages));
      // Update URL to reflect the highest loaded page
      updateUrl({ page: nextPage });
      // Directly execute search for next page
      executeSearchPage(nextPage, false);
    } else {
      console.log(`⏸️ Skipping load: nextPage=${nextPage}, totalPages=${totalPages}, already loaded=${loadedPages.has(nextPage)}`);
    }
  }, [loadedPages, totalPages, updateUrl, executeSearchPage]);
  
  // Handlers that update URL (which triggers search via useEffect)
  const handleSearchSubmit = useCallback((query: string) => {
    updateUrl({ q: query.trim(), page: 1 });
  }, [updateUrl]);
  
  const handleSortChange = useCallback((field: string, order: string) => {
    updateUrl({ sort: field, order });
  }, [updateUrl]);
  
  const handleFilterChange = useCallback((filterUpdates: Record<string, any>) => {
    updateUrl({ ...filterUpdates, page: 1 }); // Reset to page 1 when filters change
  }, [updateUrl]);
  
  const handleClearSearch = useCallback(() => {
    setSearchParams(new URLSearchParams());
    setIsPanelOpen(false);
    setAllResults([]);
    setTotalCount(0);
    setTotalPages(0);
    setError(null);
    setCurrentSearchId('');
    setLoadedPages(new Set());
  }, [setSearchParams, setIsPanelOpen]);
  
  const handlePageChange = useCallback((newPage: number) => {
    updateUrl({ page: newPage });
  }, [updateUrl]);
  
  // Computed properties
  const hasResults = allResults.length > 0;
  const hasNextPage = Math.max(...Array.from(loadedPages), 0) < totalPages;
  const hasActiveFilters = useMemo(() => {
    return mediaKind || mimeTypes.length > 0 || searchParams.get('minSize') || searchParams.get('maxSize') ||
           searchParams.get('mtimeFrom') || searchParams.get('mtimeTo') || searchParams.get('hasGps') || searchParams.get('hasSubs');
  }, [mediaKind, mimeTypes.length, searchParams]);

  if (compact) {
    return (
      <div className={`search-interface-compact ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <SearchAutocomplete
              value={searchQuery}
              onChange={(value) => {
                // Just update input, don't search yet
              }}
              onSuggestionSelect={(suggestion) => {
                if (suggestion.type === 'filter') {
                  setTimeout(() => handleSearchSubmit(searchQuery), 100);
                }
              }}
              placeholder="Search files, folders, and metadata..."
              disabled={loading}
              className="compact"
            />
          </div>
          <Button
            onClick={() => handleSearchSubmit(searchQuery)}
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
            {totalCount.toLocaleString()} files found
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
                onChange={() => {}} // Controlled by URL
                onSuggestionSelect={(suggestion) => {
                  if (suggestion.type === 'filter') {
                    setTimeout(() => handleSearchSubmit(searchQuery), 100);
                  }
                }}
                placeholder="Search files, folders, and metadata..."
                disabled={loading}
              />
            </div>
            <Button
              onClick={() => handleSearchSubmit(searchQuery)}
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
                      onChange={(e) => handleSortChange(e.target.value, sortOrder)}
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
                        onClick={() => handleSortChange(sortField, 'asc')}
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
                        onClick={() => handleSortChange(sortField, 'desc')}
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
            <SearchFilters onFilterChange={handleFilterChange} />
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

        {!error && searchQuery && (
          <SearchResults 
            onFileSelect={onFileSelect}
            onLoadMore={handleLoadMore}
            hasNextPage={hasNextPage}
            allResults={allResults}
          />
        )}

        {!loading && !error && !hasResults && searchQuery && totalCount === 0 && (
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