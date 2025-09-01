/**
 * SearchResults Component
 *
 * Displays search results with infinite scroll and URL-based pagination
 */

import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { useAtomValue } from 'jotai';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import {
  searchResultsAtom,
  searchTotalCountAtom,
  searchLoadingAtom,
} from '@/atoms/search';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PreviewThumbnail } from '@/components/preview/PreviewThumbnail';
import type { FileSearchResult } from '@/api/search';
import {
  getFileIcon,
  getFileSizeBadgeColor,
  getMediaKindBadgeColor,
} from '@/utils/fileIcons';

interface SearchResultsProps {
  onFileSelect?: (fileId: number) => void;
  className?: string;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  allResults?: FileSearchResult[];
}

interface SearchResultItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    results: FileSearchResult[];
    onFileSelect?: (fileId: number) => void;
    hasNextPage: boolean;
    isItemLoaded: (index: number) => boolean;
  };
}

const ITEM_HEIGHT = 120;
const MOBILE_ITEM_HEIGHT = 140;
const LOADING_ITEM_HEIGHT = 80;
const getContainerHeight = () => {
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    const availableHeight = window.innerHeight - 200; // Account for header, search bar (no pagination)
    return Math.max(
      isMobile ? 500 : 600,
      Math.min(window.innerHeight - 150, availableHeight),
    );
  }
  return 700;
};

// Individual search result item component
const SearchResultItem: React.FC<SearchResultItemProps> = ({
  index,
  style,
  data,
}) => {
  const { results, onFileSelect, hasNextPage, isItemLoaded } = data;
  const file = results[index];

  // Show loading placeholder if item is not loaded yet
  if (!isItemLoaded(index)) {
    return (
      <div style={style} className="px-2 sm:px-4">
        <Card className="p-3 sm:p-4 animate-pulse">
          <div className="flex items-start space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="flex space-x-2">
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
      minute: '2-digit',
    });
  };

  // Get file extension from filename
  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
  };

  const fileIconInfo = getFileIcon(
    file.media_kind,
    file.mime_type,
    getFileExtension(file.name),
  );

  return (
    <div style={style} className="px-2 sm:px-4">
      <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start space-x-3 sm:space-x-4">
          {/* File Icon or Thumbnail */}
          <div className="flex-shrink-0">
            <PreviewThumbnail
              fileId={file.id}
              fileName={file.name}
              mimeType={file.mime_type}
              mediaKind={file.media_kind}
              size="small"
              context="list"
              lazy={true}
              showBlurUp={true}
              className="w-10 h-10 sm:w-12 sm:h-12"
              onClick={onFileSelect ? () => onFileSelect(file.id) : undefined}
            />
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
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getFileSizeBadgeColor(file.size)}`}
                >
                  {formatFileSize(file.size)}
                </span>
              )}
              {file.mime_type && <span>{file.mime_type}</span>}
              {(file.modified_time || file.mtime) && (
                <span>
                  Modified {formatDate(file.modified_time || file.mtime!)}
                </span>
              )}
              {file.media_kind && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMediaKindBadgeColor(file.media_kind)}`}
                >
                  {file.media_kind}
                </span>
              )}
            </div>

            {/* Additional Metadata */}
            {(file.width || file.height || file.duration_ms) && (
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                {file.width && file.height && (
                  <span>
                    {file.width} × {file.height}px
                  </span>
                )}
                {file.duration_ms && (
                  <span>{Math.round(file.duration_ms / 1000)}s</span>
                )}
                {file.has_gps && <span className="text-green-600">📍 GPS</span>}
                {file.has_subs && (
                  <span className="text-blue-600">📝 Subtitles</span>
                )}
                {file.hash && <span className="text-purple-600">🔒 Hash</span>}
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
  onLoadMore,
  hasNextPage = false,
  allResults,
}) => {
  const atomResults = useAtomValue(searchResultsAtom);
  const totalCount = useAtomValue(searchTotalCountAtom);
  const loading = useAtomValue(searchLoadingAtom);

  // Use provided allResults or fall back to atom results
  const results = allResults || atomResults;

  // Responsive state
  const [containerHeight, setContainerHeight] = useState(getContainerHeight);
  const [isMobile, setIsMobile] = useState(false);
  const infiniteLoaderRef = useRef<InfiniteLoader>(null);

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

  // Check if an item is loaded
  const isItemLoaded = useCallback(
    (index: number) => {
      return !!results[index];
    },
    [results],
  );

  // Load more items when scrolling
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      if (onLoadMore && hasNextPage) {
        onLoadMore();
      }
    },
    [onLoadMore, hasNextPage],
  );

  // Use the results array length as item count (it includes placeholders)
  const itemCount = results.length;

  // Memoize item data for react-window
  const itemData = useMemo(
    () => ({
      results,
      onFileSelect,
      hasNextPage,
      isItemLoaded,
    }),
    [results, onFileSelect, hasNextPage, isItemLoaded],
  );

  // Reset infinite loader when results change (new search)
  useEffect(() => {
    if (infiniteLoaderRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache();
    }
  }, [results.length === 0]); // Reset when starting new search

  // Show loading state if we're loading the first page of a new search
  if (loading && results.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="inline-flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span>Searching files...</span>
        </div>
      </Card>
    );
  }

  // Don't render if we have no results and aren't loading
  if (results.length === 0) {
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
            {results.length.toLocaleString()} of {totalCount.toLocaleString()}{' '}
            files
          </span>
        </div>

        {hasNextPage && (
          <div className="text-xs text-gray-500">Scroll for more results</div>
        )}
      </div>

      {/* Infinite Scroll Results List */}
      <Card className="overflow-hidden">
        <InfiniteLoader
          ref={infiniteLoaderRef}
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={containerHeight}
              itemCount={itemCount}
              itemSize={isMobile ? MOBILE_ITEM_HEIGHT : ITEM_HEIGHT}
              itemData={itemData}
              onItemsRendered={onItemsRendered}
              className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            >
              {SearchResultItem}
            </List>
          )}
        </InfiniteLoader>
      </Card>

      {/* Loading indicator for infinite scroll */}
      {loading && hasNextPage && (
        <div className="mt-4 p-4 text-center">
          <div className="inline-flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-sm">Loading more results...</span>
          </div>
        </div>
      )}

      {/* End of results indicator */}
      {!hasNextPage && results.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center py-4">
          All {totalCount.toLocaleString()} results shown
        </div>
      )}
    </div>
  );
};
