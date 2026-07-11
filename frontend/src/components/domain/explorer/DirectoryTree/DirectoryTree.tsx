/**
 * DirectoryTree Component
 *
 * Lazy-loading tree view for directory navigation in volumes.
 * Uses the /api/v1/explorer/browse endpoint for efficient folder loading.
 *
 * Features:
 * - Lazy loading of subdirectories
 * - Infinite scroll pagination for large folder lists
 * - Expand/collapse state management
 * - Keyboard navigation
 * - Loading states
 * - Error handling
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { customFetchClient } from '@/api/fetch-client';

export interface DirectoryTreeProps {
  volumeId: string;
  onPathSelect?: (path: string) => void;
  selectedPath?: string;
  searchQuery?: string;
  className?: string;
  /** Called with true once the volume is confirmed to have no directories
   * at all (not loading, not errored) - lets the parent hide the whole
   * sidebar instead of showing a permanently empty box. */
  onEmptyStateChange?: (isEmpty: boolean) => void;
}

interface FolderNode {
  id: number;
  name: string;
  path: string;
  hasChildren: boolean;
  fileCount: number;
  folderCount: number;
  totalSize: number;
}

interface FolderBrowsingResponse {
  volume_id: string;
  current_path: string;
  current?: FolderNode;
  parent?: FolderNode;
  children: FolderNode[];
  total_children: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Hook to manage paginated folder loading with infinite scroll and server-side search
 */
function usePaginatedFolders(volumeId: string, path: string, searchQuery: string, enabled: boolean) {
  const [currentPage, setCurrentPage] = useState(1);
  const [allChildren, setAllChildren] = useState<FolderNode[]>([]);
  const [totalChildren, setTotalChildren] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['folder-browse', volumeId, path, currentPage, searchQuery],
    queryFn: async () => {
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await customFetchClient<FolderBrowsingResponse>(
        `/explorer/browse?volume_id=${volumeId}&path=${encodeURIComponent(path)}&include_children=true&limit=100&page=${currentPage}${searchParam}`,
      );
      return response;
    },
    enabled: enabled,
  });

  // Accumulate children from all pages
  useEffect(() => {
    if (data?.children) {
      setAllChildren((prev) => {
        // If page 1, replace all; otherwise append
        if (currentPage === 1) {
          return data.children;
        }
        // Deduplicate by path
        const existingPaths = new Set(prev.map((f) => f.path));
        const newChildren = data.children.filter((f) => !existingPaths.has(f.path));
        return [...prev, ...newChildren];
      });
      setTotalChildren(data.total_children);
      setTotalPages(data.total_pages);
    }
  }, [data, currentPage]);

  // Reset when path or search changes
  useEffect(() => {
    setCurrentPage(1);
    setAllChildren([]);
    setTotalChildren(0);
    setTotalPages(0);
  }, [volumeId, path, searchQuery]);

  const loadMore = useCallback(() => {
    if (currentPage < totalPages && !isFetching) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages, isFetching]);

  const hasMore = currentPage < totalPages;
  const showingCount = allChildren.length;

  return {
    children: allChildren,
    isLoading,
    error,
    isFetching,
    hasMore,
    loadMore,
    totalChildren,
    showingCount,
  };
}

/**
 * TreeNode component - represents a single folder in the tree
 */
interface TreeNodeProps {
  node: FolderNode;
  volumeId: string;
  level: number;
  selectedPath?: string;
  onPathSelect?: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}

function TreeNode({
  node,
  volumeId,
  level,
  selectedPath,
  onPathSelect,
  expandedPaths,
  onToggleExpand,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use paginated folder hook (no search for expanded nodes)
  const {
    children,
    isLoading,
    error,
    isFetching,
    hasMore,
    loadMore,
    totalChildren,
    showingCount,
  } = usePaginatedFolders(volumeId, node.path, '', isExpanded && node.hasChildren);

  // Infinite scroll detection
  useEffect(() => {
    if (!isExpanded || !hasMore || isFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isExpanded, hasMore, isFetching, loadMore]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.hasChildren) {
        onToggleExpand(node.path);
      }
    },
    [node.hasChildren, node.path, onToggleExpand],
  );

  const handleSelect = useCallback(() => {
    onPathSelect?.(node.path);
  }, [node.path, onPathSelect]);

  return (
    <div className="select-none" ref={containerRef}>
      {/* Current node */}
      <div
        className={`
          flex items-center gap-1 py-1 px-2 rounded cursor-pointer
          hover:bg-surface-hover transition-colors
          ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-gray-200 hover:bg-surface-hover rounded"
          disabled={!node.hasChildren}
        >
          {isLoading && children.length === 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : node.hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-secondary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-secondary" />
            )
          ) : (
            <div className="w-4 h-4" /> /* Spacer */
          )}
        </button>

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
        )}

        {/* Folder name and stats */}
        <span className="text-sm font-medium truncate flex-1">{node.name}</span>
        {node.folderCount > 0 && (
          <span className="text-xs text-tertiary">
            {node.folderCount}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && isExpanded && (
        <div
          className="text-xs text-red-600 dark:text-red-400 py-1"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          Failed to load subdirectories
        </div>
      )}

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              volumeId={volumeId}
              level={level + 1}
              selectedPath={selectedPath}
              onPathSelect={onPathSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}

          {/* Infinite scroll trigger & loading indicator */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="text-xs text-tertiary py-2 text-center italic"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              {isFetching ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading more...</span>
                </div>
              ) : (
                <span>Showing {showingCount} of {totalChildren} folders</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state for expanded folders with no children */}
      {isExpanded && children.length === 0 && !isLoading && !error && node.hasChildren && (
        <div
          className="text-xs text-tertiary py-1 italic"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          No subdirectories
        </div>
      )}
    </div>
  );
}

/**
 * DirectoryTree component - main tree container with infinite scroll
 */
export function DirectoryTree({
  volumeId,
  onPathSelect,
  selectedPath,
  searchQuery = '',
  className = '',
  onEmptyStateChange,
}: DirectoryTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use paginated folder hook for root (with server-side search)
  const {
    children: rootFolders,
    isLoading,
    error,
    isFetching,
    hasMore,
    loadMore,
    totalChildren,
    showingCount,
  } = usePaginatedFolders(volumeId, '/', searchQuery, true);

  // No client-side filtering needed - server does the search
  const filteredRootFolders = rootFolders;

  // Report genuinely-empty state (no directories at all, not just no search
  // matches) so the parent can hide the sidebar instead of showing a
  // permanently empty box.
  useEffect(() => {
    if (!searchQuery.trim() && !isLoading) {
      onEmptyStateChange?.(rootFolders.length === 0);
    }
  }, [searchQuery, isLoading, rootFolders.length, onEmptyStateChange]);

  // Infinite scroll detection for root folders
  useEffect(() => {
    if (!hasMore || isFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetching, loadMore]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (isLoading && rootFolders.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading directory tree...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load directory tree
        </div>
      </div>
    );
  }

  if (rootFolders.length === 0 && !isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-sm text-tertiary italic">
          No directories found in this volume
        </div>
      </div>
    );
  }

  // Show "no matches" if search is active but no results
  if (searchQuery.trim() && filteredRootFolders.length === 0 && !isLoading) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        {/* Folder count header */}
        <div className="px-3 py-2 border-b border-border bg-surface-subtle">
          <div className="text-xs text-secondary font-medium">
            {showingCount === totalChildren ? (
              <span>All {totalChildren} folders loaded ✓</span>
            ) : (
              <span>Showing {showingCount} of {totalChildren} folders</span>
            )}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-sm text-tertiary italic">
            No folders match "{searchQuery}"
          </div>
          <div className="text-xs text-tertiary mt-1">
            Loaded {showingCount} of {totalChildren} folders
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Folder count header */}
      {totalChildren > 0 && (
        <div className="px-3 py-2 border-b border-border bg-surface-subtle">
          <div className="text-xs text-secondary font-medium">
            {searchQuery.trim() ? (
              <span>
                {filteredRootFolders.length} matching folder{filteredRootFolders.length !== 1 ? 's' : ''}
                {' '}(of {showingCount} loaded)
              </span>
            ) : showingCount === totalChildren ? (
              <span>All {totalChildren} folders loaded ✓</span>
            ) : (
              <span>Showing {showingCount} of {totalChildren} folders</span>
            )}
          </div>
        </div>
      )}

      {/* Scrollable tree content */}
      <div className="overflow-y-auto flex-1">
        {/* Root node */}
        <div
          className={`
            flex items-center gap-2 py-2 px-2 mb-1 rounded cursor-pointer
            hover:bg-surface-hover transition-colors
            ${selectedPath === '/' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''}
          `}
          onClick={() => onPathSelect?.('/')}
        >
          <FolderOpen className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Root</span>
          {filteredRootFolders.length > 0 && (
            <span className="text-xs text-tertiary">
              {filteredRootFolders.length}
            </span>
          )}
        </div>

        {/* Child folders */}
        {filteredRootFolders.map((folder) => (
          <TreeNode
            key={folder.path}
            node={folder}
            volumeId={volumeId}
            level={0}
            selectedPath={selectedPath}
            onPathSelect={onPathSelect}
            expandedPaths={expandedPaths}
            onToggleExpand={handleToggleExpand}
          />
        ))}

        {/* Infinite scroll trigger & loading indicator for root */}
        {hasMore && !searchQuery.trim() && (
          <div
            ref={loadMoreRef}
            className="text-xs text-tertiary py-3 text-center italic"
          >
            {isFetching ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading more folders...</span>
              </div>
            ) : (
              <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={loadMore}>
                Load more folders...
              </span>
            )}
          </div>
        )}

        {/* Show load more for search results */}
        {searchQuery.trim() && hasMore && (
          <div className="text-xs text-tertiary py-3 text-center italic">
            Showing {showingCount} of {totalChildren} matching folders.
            <button
              onClick={loadMore}
              className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Load more results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
