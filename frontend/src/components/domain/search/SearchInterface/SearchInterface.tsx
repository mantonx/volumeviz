import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Search,
  Filter,
  Clock,
  Star,
  BookmarkPlus,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Grid3x3,
  List,
  Table,
  FileText,
  Folder,
  Image,
  Video,
  Music,
  Archive,
  Code,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

import { StatusBadge } from '@/components/ui';

import type {
  SearchInterfaceProps,
  SearchInterfaceState,
  SearchInterfaceRef,
  SearchQuery,
  SimpleSearchQuery,
  SearchFilters,
  SearchQueryType,
  SearchScope,
  FileTypeCategory,
} from './SearchInterface.types';
import { searchUtils } from '@/utils';

/**
 * SearchInterface - Advanced search with filters and saved searches
 *
 * A sophisticated domain composition that provides comprehensive search
 * functionality with advanced filtering, saved searches, and real-time results.
 */
export const SearchInterface = forwardRef<
  SearchInterfaceRef,
  SearchInterfaceProps
>(
  (
    {
      query,
      results,
      isSearching = false,
      searchError,
      savedSearches = [],
      suggestions = [],
      config = {},
      showAdvanced = false,
      showFilters = false,
      enableFilters = true,
      showSavedSearches = false,
      showHistory = false,
      enableRealTimeSearch = true,
      layout = 'standard',
      resultsView = 'list',
      onSearch,
      onSearchChange,
      onResultClick,
      onSaveSearch,
      onLoadSavedSearch,
      onDeleteSavedSearch,
      onSuggestionClick,
      onFilterChange,
      onScopeChange,
      onQueryTypeChange,
      onExportResults,
      onPageChange,
      renderResult,
      emptyState,
      loadingState,
      errorState,
      className,
      testId = 'search-interface',
    },
    ref,
  ) => {
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Component state
    const [state, setState] = useState<SearchInterfaceState>({
      currentQuery: query || {
        query: '',
        type: 'simple',
        scope: 'all',
        filters: {},
      },
      isAdvancedMode: showAdvanced,
      showFilters,
      showSavedSearches,
      showHistory,
      selectedSuggestion: -1,
      focusedResult: -1,
      localFilters: {},
      validationErrors: [],
    });

    // Derived state
    const currentSimpleQuery = state.currentQuery as SimpleSearchQuery;
    const hasResults = results && results.items.length > 0;
    const hasError = !!searchError;
    const isEmpty = !isSearching && !hasResults && !hasError;

    // File type icons mapping
    const fileTypeIcons: Record<FileTypeCategory, React.ReactNode> = {
      document: <FileText className="w-4 h-4" />,
      image: <Image className="w-4 h-4" />,
      video: <Video className="w-4 h-4" />,
      audio: <Music className="w-4 h-4" />,
      archive: <Archive className="w-4 h-4" />,
      code: <Code className="w-4 h-4" />,
      text: <FileText className="w-4 h-4" />,
      other: <FileText className="w-4 h-4" />,
    };

    // Update state when props change
    useEffect(() => {
      if (query) {
        setState((prev) => ({ ...prev, currentQuery: query }));
      }
    }, [query]);

    // Debounced search effect
    useEffect(() => {
      if (!enableRealTimeSearch) return;

      const timer = setTimeout(() => {
        if (currentSimpleQuery.query.trim() && onSearchChange) {
          onSearchChange(state.currentQuery);
        }
      }, config.searchDelay || 300);

      return () => {
        clearTimeout(timer);
      };
    }, [
      state.currentQuery,
      enableRealTimeSearch,
      config.searchDelay,
      onSearchChange,
      currentSimpleQuery.query,
    ]);

    // Event handlers
    const handleSearchInputChange = useCallback((value: string) => {
      setState((prev) => ({
        ...prev,
        currentQuery: {
          ...prev.currentQuery,
          query: value,
        } as SimpleSearchQuery,
        selectedSuggestion: -1,
      }));
    }, []);

    const handleSearchSubmit = useCallback(() => {
      if (currentSimpleQuery.query.trim()) {
        const errors = searchUtils.validateQuery(state.currentQuery);
        setState((prev) => ({ ...prev, validationErrors: errors }));

        if (errors.length === 0) {
          onSearch?.(state.currentQuery);
        }
      }
    }, [state.currentQuery, onSearch, currentSimpleQuery.query]);

    const handleFilterChange = useCallback(
      (filters: SearchFilters) => {
        setState((prev) => ({
          ...prev,
          currentQuery: {
            ...prev.currentQuery,
            filters,
          } as SimpleSearchQuery,
          localFilters: filters,
        }));
        onFilterChange?.(filters);
      },
      [onFilterChange],
    );

    const handleScopeChange = useCallback(
      (scope: SearchScope) => {
        setState((prev) => ({
          ...prev,
          currentQuery: {
            ...prev.currentQuery,
            scope,
          } as SimpleSearchQuery,
        }));
        onScopeChange?.(scope);
      },
      [onScopeChange],
    );

    const handleQueryTypeChange = useCallback(
      (type: SearchQueryType) => {
        setState((prev) => ({
          ...prev,
          currentQuery: {
            ...prev.currentQuery,
            type,
          } as SimpleSearchQuery,
        }));
        onQueryTypeChange?.(type);
      },
      [onQueryTypeChange],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        switch (event.key) {
          case 'Enter':
            if (
              state.selectedSuggestion >= 0 &&
              suggestions[state.selectedSuggestion]
            ) {
              onSuggestionClick?.(suggestions[state.selectedSuggestion]);
            } else {
              handleSearchSubmit();
            }
            break;
          case 'ArrowDown':
            event.preventDefault();
            setState((prev) => ({
              ...prev,
              selectedSuggestion: Math.min(
                prev.selectedSuggestion + 1,
                suggestions.length - 1,
              ),
            }));
            break;
          case 'ArrowUp':
            event.preventDefault();
            setState((prev) => ({
              ...prev,
              selectedSuggestion: Math.max(prev.selectedSuggestion - 1, -1),
            }));
            break;
          case 'Escape':
            setState((prev) => ({ ...prev, selectedSuggestion: -1 }));
            break;
        }
      },
      [
        state.selectedSuggestion,
        suggestions,
        onSuggestionClick,
        handleSearchSubmit,
      ],
    );

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        focus: () => searchInputRef.current?.focus(),
        clear: () => {
          setState((prev) => ({
            ...prev,
            currentQuery: {
              query: '',
              type: 'simple',
              scope: 'all',
              filters: {},
            },
            validationErrors: [],
          }));
        },
        search: handleSearchSubmit,
        getQuery: () => state.currentQuery,
        setQuery: (newQuery: SearchQuery) => {
          setState((prev) => ({ ...prev, currentQuery: newQuery }));
        },
        toggleAdvanced: () => {
          setState((prev) => ({
            ...prev,
            isAdvancedMode: !prev.isAdvancedMode,
          }));
        },
        toggleFilters: () => {
          setState((prev) => ({ ...prev, showFilters: !prev.showFilters }));
        },
        exportResults: (format) => {
          onExportResults?.(format);
        },
      }),
      [handleSearchSubmit, state.currentQuery, onExportResults],
    );

    // Render search input
    const renderSearchInput = () => (
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={currentSimpleQuery.query}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and folders..."
            className={clsx(
              'w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              layout === 'compact' && 'py-2 text-sm',
              state.validationErrors.length > 0 && 'border-red-500',
            )}
            disabled={isSearching}
          />
          {currentSimpleQuery.query && (
            <button
              onClick={() => handleSearchInputChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && currentSimpleQuery.query && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50">
            {suggestions
              .slice(0, config.maxSuggestions || 10)
              .map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className={clsx(
                    'w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2',
                    index === state.selectedSuggestion &&
                      'bg-blue-50 text-blue-700',
                  )}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span>{suggestion.text}</span>
                  {suggestion.type === 'recent' && (
                    <Clock className="w-3 h-3 text-gray-400 ml-auto" />
                  )}
                </button>
              ))}
          </div>
        )}

        {/* Validation errors */}
        {state.validationErrors.length > 0 && (
          <div className="mt-2 text-sm text-red-600">
            {state.validationErrors.map((error, index) => (
              <div key={index} className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // Render search controls
    const renderSearchControls = () => (
      <div className="flex items-center gap-2 mt-4">
        {/* Query type selector */}
        <select
          value={currentSimpleQuery.type}
          onChange={(e) =>
            handleQueryTypeChange(e.target.value as SearchQueryType)
          }
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
          <option value="regex">Regex</option>
          <option value="fuzzy">Fuzzy</option>
        </select>

        {/* Scope selector */}
        <select
          value={currentSimpleQuery.scope}
          onChange={(e) => handleScopeChange(e.target.value as SearchScope)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All</option>
          <option value="volume">Current Volume</option>
          <option value="path">Current Path</option>
          <option value="metadata">Metadata Only</option>
        </select>

        {/* Filter toggle */}
        {enableFilters && (
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, showFilters: !prev.showFilters }))
            }
            className={clsx(
              'flex items-center gap-1 px-3 py-1 rounded-md text-sm',
              state.showFilters
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {state.showFilters ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Saved searches toggle */}
        <button
          onClick={() =>
            setState((prev) => ({
              ...prev,
              showSavedSearches: !prev.showSavedSearches,
            }))
          }
          className={clsx(
            'flex items-center gap-1 px-3 py-1 rounded-md text-sm',
            state.showSavedSearches
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          )}
        >
          <Star className="w-4 h-4" />
          Saved
        </button>

        {/* History toggle */}
        <button
          onClick={() =>
            setState((prev) => ({ ...prev, showHistory: !prev.showHistory }))
          }
          className={clsx(
            'flex items-center gap-1 px-3 py-1 rounded-md text-sm',
            state.showHistory
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          )}
        >
          <Clock className="w-4 h-4" />
          History
        </button>

        {/* Search button */}
        <button
          onClick={handleSearchSubmit}
          disabled={isSearching || !currentSimpleQuery.query.trim()}
          className="flex items-center gap-1 px-4 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </button>
      </div>
    );

    // Render filters panel
    const renderFiltersPanel = () => {
      if (!state.showFilters) return null;

      const filters = currentSimpleQuery.filters;

      return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* File types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Types
              </label>
              <div className="space-y-2">
                {(
                  [
                    'document',
                    'image',
                    'video',
                    'audio',
                    'archive',
                    'code',
                  ] as FileTypeCategory[]
                ).map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.fileTypes?.includes(type) || false}
                      onChange={(e) => {
                        const newTypes = filters.fileTypes || [];
                        if (e.target.checked) {
                          newTypes.push(type);
                        } else {
                          const index = newTypes.indexOf(type);
                          if (index > -1) newTypes.splice(index, 1);
                        }
                        handleFilterChange({ ...filters, fileTypes: newTypes });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="flex items-center gap-1 text-sm">
                      {fileTypeIcons[type]}
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Size filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Size
              </label>
              <div className="space-y-2">
                <select
                  value={filters.sizeFilter?.operator || ''}
                  onChange={(e) => {
                    const operator = e.target.value;
                    if (operator) {
                      handleFilterChange({
                        ...filters,
                        sizeFilter: {
                          operator: operator as any,
                          value: 1,
                          unit: 'MB',
                        },
                      });
                    } else {
                      const { sizeFilter: _sizeFilter, ...rest } = filters;
                      handleFilterChange(rest);
                    }
                  }}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Any size</option>
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                  <option value="between">Between</option>
                </select>
                {filters.sizeFilter && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={filters.sizeFilter.value}
                      onChange={(e) => {
                        handleFilterChange({
                          ...filters,
                          sizeFilter: {
                            ...filters.sizeFilter!,
                            value: parseInt(e.target.value) || 0,
                          },
                        });
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="0"
                    />
                    <select
                      value={filters.sizeFilter.unit}
                      onChange={(e) => {
                        handleFilterChange({
                          ...filters,
                          sizeFilter: {
                            ...filters.sizeFilter!,
                            unit: e.target.value as any,
                          },
                        });
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="B">B</option>
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Date filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Modified
              </label>
              <div className="space-y-2">
                <select
                  value={filters.dateFilter?.operator || ''}
                  onChange={(e) => {
                    const operator = e.target.value;
                    if (operator) {
                      handleFilterChange({
                        ...filters,
                        dateFilter: {
                          operator: operator as any,
                          value: new Date(),
                          field: 'modified',
                        },
                      });
                    } else {
                      const { dateFilter: _dateFilter, ...rest } = filters;
                      handleFilterChange(rest);
                    }
                  }}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Any date</option>
                  <option value="relative">Last...</option>
                  <option value="gt">After</option>
                  <option value="lt">Before</option>
                </select>
                {filters.dateFilter?.operator === 'relative' && (
                  <select
                    value={
                      typeof filters.dateFilter.value === 'string'
                        ? filters.dateFilter.value
                        : ''
                    }
                    onChange={(e) => {
                      handleFilterChange({
                        ...filters,
                        dateFilter: {
                          ...filters.dateFilter!,
                          value: e.target.value,
                        },
                      });
                    }}
                    className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="1 day ago">1 day</option>
                    <option value="1 week ago">1 week</option>
                    <option value="1 month ago">1 month</option>
                    <option value="3 months ago">3 months</option>
                    <option value="1 year ago">1 year</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Additional options */}
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.includeHidden || false}
                onChange={(e) => {
                  handleFilterChange({
                    ...filters,
                    includeHidden: e.target.checked,
                  });
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Include hidden files</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.includeSystem || false}
                onChange={(e) => {
                  handleFilterChange({
                    ...filters,
                    includeSystem: e.target.checked,
                  });
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Include system files</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.caseSensitive || false}
                onChange={(e) => {
                  handleFilterChange({
                    ...filters,
                    caseSensitive: e.target.checked,
                  });
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Case sensitive</span>
            </label>
          </div>
        </div>
      );
    };

    // Render saved searches panel
    const renderSavedSearches = () => {
      if (!state.showSavedSearches) return null;

      return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Saved Searches</h3>
            <button
              onClick={() => {
                if (onSaveSearch) {
                  const name = prompt('Enter a name for this search:');
                  if (name) {
                    onSaveSearch({
                      name,
                      description: `Search for "${currentSimpleQuery.query}"`,
                      query: state.currentQuery,
                      tags: [],
                      useCount: 0,
                      favorite: false,
                    });
                  }
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <BookmarkPlus className="w-4 h-4" />
              Save Current
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {savedSearches.length === 0 ? (
              <p className="text-sm text-gray-500">No saved searches</p>
            ) : (
              savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50"
                >
                  <button
                    onClick={() => onLoadSavedSearch?.(search)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {search.favorite && (
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      )}
                      <span className="text-sm font-medium">{search.name}</span>
                    </div>
                    {search.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {search.description}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteSavedSearch?.(search.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    aria-label={`Delete saved search: ${search.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      );
    };

    // Render results header
    const renderResultsHeader = () => {
      if (!results) return null;

      return (
        <div className="flex items-center justify-between py-4 border-b">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {results.totalCount.toLocaleString()} results
              {results.searchTime && (
                <span className="ml-2">
                  ({searchUtils.formatSearchTime(results.searchTime)})
                </span>
              )}
            </div>
            {results.correctedQuery && (
              <div className="text-sm">
                <span className="text-gray-500">Did you mean:</span>
                <button
                  onClick={() =>
                    handleSearchInputChange(results.correctedQuery!)
                  }
                  className="ml-1 text-blue-600 hover:underline"
                >
                  {results.correctedQuery}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode selector */}
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => {}} // Would handle view change
                className={clsx(
                  'p-1',
                  resultsView === 'list'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-500',
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => {}} // Would handle view change
                className={clsx(
                  'p-1',
                  resultsView === 'grid'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-500',
                )}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {}} // Would handle view change
                className={clsx(
                  'p-1',
                  resultsView === 'table'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-500',
                )}
              >
                <Table className="w-4 h-4" />
              </button>
            </div>

            {/* Export button */}
            <button
              onClick={() => onExportResults?.('csv')}
              className="flex items-center gap-1 px-2 py-1 text-sm border rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      );
    };

    // Render search results
    const renderResults = () => {
      if (isSearching) {
        return (
          loadingState || (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600">Searching...</span>
              </div>
            </div>
          )
        );
      }

      if (hasError) {
        return (
          errorState || (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-900">
                  Search Error
                </div>
                <div className="text-sm text-gray-500 mt-1">{searchError}</div>
              </div>
            </div>
          )
        );
      }

      if (isEmpty || !hasResults) {
        return (
          emptyState || (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-900">
                  {currentSimpleQuery.query
                    ? 'No results found'
                    : 'Start searching'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {currentSimpleQuery.query
                    ? 'Try adjusting your search terms or filters'
                    : 'Enter a search term to find files and folders'}
                </div>
              </div>
            </div>
          )
        );
      }

      return (
        <div className="space-y-4">
          {renderResultsHeader()}

          <div className="space-y-2">
            {results!.items.map((item, index) =>
              renderResult ? (
                renderResult(item, index)
              ) : (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => onResultClick?.(item)}
                >
                  <div className="flex-shrink-0">
                    {item.type === 'folder' ? (
                      <Folder className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {item.name}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {item.path}
                    </div>
                    {item.highlights && (
                      <div className="text-xs text-blue-600 mt-1">
                        Matches in:{' '}
                        {item.highlights.map((h) => h.field).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {item.size && (
                      <span>{searchUtils.formatFileSize(item.size)}</span>
                    )}
                    {item.modifiedAt && (
                      <span>{item.modifiedAt.toLocaleDateString()}</span>
                    )}
                    <StatusBadge variant="info" size="sm">
                      {Math.round(item.relevanceScore)}%
                    </StatusBadge>
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Pagination */}
          {results!.hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => onPageChange?.(results!.page + 1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Load More Results
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        className={clsx(
          'bg-white border border-gray-200 rounded-lg overflow-hidden',
          layout === 'compact' && 'p-4',
          layout === 'standard' && 'p-6',
          layout === 'expanded' && 'p-8',
          className,
        )}
        data-testid={testId}
      >
        {/* Search input and controls */}
        <div>
          {renderSearchInput()}
          {renderSearchControls()}
          {renderFiltersPanel()}
          {renderSavedSearches()}
        </div>

        {/* Results */}
        <div className="mt-6">{renderResults()}</div>
      </div>
    );
  },
);

SearchInterface.displayName = 'SearchInterface';
