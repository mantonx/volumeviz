/**
 * SearchResults Component
 * 
 * Displays search results with virtualization for performance
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { FixedSizeList as List } from 'react-window';
import { searchResultsAtom, searchTotalCountAtom, searchLoadingAtom } from '@/store/atoms/search';
import { useSearch } from '@/hooks/useSearch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { FileSearchResult } from '@/api/search';
import { getFileIcon, getFileSizeBadgeColor, getMediaKindBadgeColor } from '@/utils/fileIcons';

interface SearchResultsProps {
  onFileSelect?: (fileId: number) => void;
  className?: string;
}

interface SearchResultItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    results: FileSearchResult[];
    onFileSelect?: (fileId: number) => void;
  };
}

const ITEM_HEIGHT = 120;
const MOBILE_ITEM_HEIGHT = 140;
const getContainerHeight = () => {
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    const availableHeight = window.innerHeight - 300; // Account for header, search bar, pagination
    return Math.max(isMobile ? 400 : 500, Math.min(800, availableHeight));
  }
  return 600;
};

// Individual search result item component
const SearchResultItem: React.FC<SearchResultItemProps> = ({ index, style, data }) => {
  const { results, onFileSelect } = data;
  const file = results[index];

  if (!file) return null;

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get file extension from filename
  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
  };

  const fileIconInfo = getFileIcon(file.media_kind, file.mime_type, getFileExtension(file.name));

  return (
    <div style={style} className="px-2 sm:px-4">
      <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start space-x-3 sm:space-x-4">
          {/* File Icon */}
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center ${fileIconInfo.bgColor} rounded-lg text-xl sm:text-2xl ${fileIconInfo.color}`}>
              {fileIconInfo.icon}
            </div>
          </div>

          {/* File Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate mt-1">
                  {file.path}
                </p>
              </div>
              
              {onFileSelect && (
                <Button
                  onClick={() => onFileSelect(file.id)}
                  size="sm"
                  variant="outline"
                  className="ml-2 flex-shrink-0 text-xs sm:text-sm"
                >
                  View
                </Button>
              )}
            </div>

            {/* Metadata Row */}
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              {file.size && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFileSizeBadgeColor(file.size)}`}>
                  {formatFileSize(file.size)}
                </span>
              )}
              {file.mime_type && (
                <span>{file.mime_type}</span>
              )}
              {(file.modified_time || file.mtime) && (
                <span>Modified {formatDate(file.modified_time || file.mtime!)}</span>
              )}
              {file.media_kind && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMediaKindBadgeColor(file.media_kind)}`}>
                  {file.media_kind}
                </span>
              )}
            </div>

            {/* Additional Metadata */}
            {(file.width || file.height || file.duration_ms) && (
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                {(file.width && file.height) && (
                  <span>{file.width} × {file.height}px</span>
                )}
                {file.duration_ms && (
                  <span>{Math.round(file.duration_ms / 1000)}s</span>
                )}
                {file.has_gps && (
                  <span className="text-green-600">📍 GPS</span>
                )}
                {file.has_subs && (
                  <span className="text-blue-600">📝 Subtitles</span>
                )}
                {file.hash && (
                  <span className="text-purple-600">🔒 Hash</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  onFileSelect,
  className = '',
}) => {
  const results = useAtomValue(searchResultsAtom);
  const totalCount = useAtomValue(searchTotalCountAtom);
  const loading = useAtomValue(searchLoadingAtom);
  const { currentPage, totalPages, perPage, goToPage, changePageSize } = useSearch();
  
  // Responsive state
  const [containerHeight, setContainerHeight] = useState(getContainerHeight);
  const [isMobile, setIsMobile] = useState(false);
  
  // Update responsive state on resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setContainerHeight(getContainerHeight());
    };
    
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Memoize item data for react-window
  const itemData = useMemo(() => ({
    results,
    onFileSelect,
  }), [results, onFileSelect]);

  // Handle page navigation
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    changePageSize(newSize);
  }, [changePageSize]);

  if (loading || results.length === 0) {
    return null;
  }

  return (
    <div className={`search-results ${className}`}>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search Results
          </h2>
          <span className="text-sm text-gray-500">
            {totalCount.toLocaleString()} files found
          </span>
        </div>
        
        {/* Page Size Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Show:</span>
          <select
            value={perPage}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-700 dark:text-gray-300">per page</span>
        </div>
      </div>

      {/* Virtualized Results List */}
      <Card className="overflow-hidden">
        <List
          height={containerHeight}
          itemCount={results.length}
          itemSize={isMobile ? MOBILE_ITEM_HEIGHT : ITEM_HEIGHT}
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        >
          {SearchResultItem}
        </List>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          {/* Mobile pagination */}
          {isMobile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="flex-1 mr-2"
                >
                  ← Previous
                </Button>
                <span className="text-sm text-gray-700 dark:text-gray-300 px-4">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="flex-1 ml-2"
                >
                  Next →
                </Button>
              </div>
              {totalPages > 10 && (
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = Number(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        goToPage(page);
                      }
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Desktop pagination */
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  ← Previous
                </Button>
                <Button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next →
                </Button>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                
                {/* Quick page jumper */}
                {totalPages <= 10 ? (
                  <div className="flex space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        onClick={() => goToPage(page)}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Go to page:</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const page = Number(e.target.value);
                        if (page >= 1 && page <= totalPages) {
                          goToPage(page);
                        }
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        Showing {Math.min(perPage, results.length)} of {totalCount.toLocaleString()} files
        {currentPage > 1 && ` (page ${currentPage})`}
      </div>
    </div>
  );
};