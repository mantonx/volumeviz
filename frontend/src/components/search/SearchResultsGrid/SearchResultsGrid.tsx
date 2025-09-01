/**
 * SearchResultsGrid Component
 *
 * Displays search results in a grid layout with thumbnail previews and infinite scroll
 */

import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { useAtomValue } from 'jotai';
import { VariableSizeGrid as Grid } from 'react-window';
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

export interface SearchResultsGridProps {
  onFileSelect?: (fileId: number) => void;
  className?: string;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  allResults?: FileSearchResult[];
}

interface GridItemProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    results: FileSearchResult[];
    onFileSelect?: (fileId: number) => void;
    columnsPerRow: number;
    isItemLoaded: (index: number) => boolean;
  };
}

// Calculate responsive grid dimensions
const getGridDimensions = () => {
  if (typeof window === 'undefined') {
    return { columnsPerRow: 4, itemWidth: 200, itemHeight: 280 };
  }

  const width = window.innerWidth;
  const isMobile = width < 768;
  const isTablet = width < 1024;

  if (isMobile) {
    return { columnsPerRow: 2, itemWidth: 180, itemHeight: 240 };
  } else if (isTablet) {
    return { columnsPerRow: 3, itemWidth: 200, itemHeight: 260 };
  } else {
    return { columnsPerRow: 4, itemWidth: 220, itemHeight: 280 };
  }
};

// Individual grid item component
const GridItem: React.FC<GridItemProps> = ({
  columnIndex,
  rowIndex,
  style,
  data,
}) => {
  const { results, onFileSelect, columnsPerRow, isItemLoaded } = data;
  const index = rowIndex * columnsPerRow + columnIndex;
  const file = results[index];

  // Show loading placeholder if item is not loaded yet
  if (!isItemLoaded(index)) {
    return (
      <div style={style} className="p-2">
        <Card className="h-full animate-pulse">
          <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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

  // Get file extension for fallback icon
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
    <div style={style} className="p-2">
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
        {/* Thumbnail Area */}
        <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800">
          <PreviewThumbnail
            fileId={file.id}
            fileName={file.name}
            mimeType={file.mime_type}
            mediaKind={file.media_kind}
            size="medium"
            context="grid"
            lazy={true}
            showBlurUp={true}
            className="w-full h-full"
            onClick={onFileSelect ? () => onFileSelect(file.id) : undefined}
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            {onFileSelect && (
              <Button
                onClick={() => onFileSelect(file.id)}
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View
              </Button>
            )}
          </div>
        </div>

        {/* File Details */}
        <div className="p-3 space-y-2">
          <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
            {file.name}
          </h3>

          {/* Metadata */}
          <div className="space-y-1">
            {file.size && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Size:</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getFileSizeBadgeColor(file.size)}`}
                >
                  {formatFileSize(file.size)}
                </span>
              </div>
            )}

            {file.media_kind && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Type:</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getMediaKindBadgeColor(file.media_kind)}`}
                >
                  {file.media_kind}
                </span>
              </div>
            )}

            {/* Dimensions for images/videos */}
            {file.width && file.height && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Size:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {file.width} × {file.height}px
                </span>
              </div>
            )}

            {/* Duration for videos/audio */}
            {file.duration_ms && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Duration:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {Math.round(file.duration_ms / 1000)}s
                </span>
              </div>
            )}
          </div>

          {/* Additional indicators */}
          <div className="flex flex-wrap gap-1 text-xs">
            {file.has_gps && (
              <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                📍
              </span>
            )}
            {file.has_subs && (
              <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                📝
              </span>
            )}
            {file.hash && (
              <span className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                🔒
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export const SearchResultsGrid: React.FC<SearchResultsGridProps> = ({
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

  // Grid dimensions state
  const [gridDimensions, setGridDimensions] = useState(getGridDimensions);
  const [containerHeight, setContainerHeight] = useState(600);
  const infiniteLoaderRef = useRef<InfiniteLoader>(null);

  // Update responsive state on resize
  useEffect(() => {
    const handleResize = () => {
      setGridDimensions(getGridDimensions());
      setContainerHeight(Math.max(600, window.innerHeight - 200));
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

  // Calculate grid layout
  const { columnsPerRow, itemWidth, itemHeight } = gridDimensions;
  const rowCount = Math.ceil(results.length / columnsPerRow);
  const columnCount = columnsPerRow;

  // Column width function for VariableSizeGrid
  const getColumnWidth = useCallback(() => itemWidth, [itemWidth]);
  const getRowHeight = useCallback(() => itemHeight, [itemHeight]);

  // Memoize item data for react-window
  const itemData = useMemo(
    () => ({
      results,
      onFileSelect,
      columnsPerRow,
      isItemLoaded,
    }),
    [results, onFileSelect, columnsPerRow, isItemLoaded],
  );

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
    <div className={`search-results-grid ${className}`}>
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

      {/* Grid Container */}
      <Card className="overflow-hidden">
        <Grid
          height={containerHeight}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={getColumnWidth}
          rowHeight={getRowHeight}
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        >
          {GridItem}
        </Grid>
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
