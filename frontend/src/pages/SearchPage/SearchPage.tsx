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

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  AlertCircle,
} from 'lucide-react';
import { SearchInterface, type SearchQuery } from '@/components/domain/search';
import { ExportButton } from '@/components/shared/ExportButton';
import { exportFilesToCSV, exportFilesToJSON, getDefaultFileExportOptions } from '@/utils/fileExport';
import { searchApi } from '@/api/search';
import type { SearchPageProps, SearchState } from './SearchPage.types';

export const SearchPage: React.FC<SearchPageProps> = ({ className = '' }) => {
  const navigate = useNavigate();

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

  // Handlers
  const handleSearch = useCallback(async (searchQuery: SearchQuery) => {
    // Extract the actual query string from the SearchQuery object
    const queryString = 'query' in searchQuery ? searchQuery.query : '';

    setSearchState((prev) => ({ ...prev, query: queryString }));
    setIsSearching(true);
    setError(null);

    const startTime = Date.now();

    try {
      const rawResults = await searchApi.search({
        query: queryString,
        page: 1,
        page_size: 50,
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
  }, []);

  const handleFileSelect = useCallback(
    (fileId: string) => {
      // Navigate to explorer with file selected
      navigate(`/explorer?file=${fileId}`);
    },
    [navigate],
  );

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


        {/* Main Search Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <SearchInterface
            results={searchResults}
            isSearching={isSearching}
            searchError={error || undefined}
            onSearch={handleSearch}
            onResultClick={(result) => handleFileSelect(result.id)}
            onExportResults={(format) => {
              setIsExportModalOpen(true);
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
