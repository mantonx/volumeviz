/**
 * DirectoryTree Component
 *
 * Lazy-loading tree view for directory navigation in volumes.
 * Uses the /api/v1/explorer/browse endpoint for efficient folder loading.
 *
 * Features:
 * - Lazy loading of subdirectories
 * - Expand/collapse state management
 * - Keyboard navigation
 * - Loading states
 * - Error handling
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { customFetchClient } from '@/api/fetch-client';

export interface DirectoryTreeProps {
  volumeId: string;
  onPathSelect?: (path: string) => void;
  selectedPath?: string;
  className?: string;
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

  // Fetch children when expanded
  const { data, isLoading, error } = useQuery({
    queryKey: ['folder-browse', volumeId, node.path],
    queryFn: async () => {
      const response = await customFetchClient<FolderBrowsingResponse>(
        `/explorer/browse?volume_id=${volumeId}&path=${encodeURIComponent(node.path)}&include_children=true&limit=100`,
      );
      return response;
    },
    enabled: isExpanded && node.hasChildren,
  });

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

  const children = data?.children || [];

  return (
    <div className="select-none">
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
          {isLoading ? (
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
 * DirectoryTree component - main tree container
 */
export function DirectoryTree({
  volumeId,
  onPathSelect,
  selectedPath,
  className = '',
}: DirectoryTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));

  // Fetch root level folders
  const {
    data: rootData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['folder-browse-root', volumeId],
    queryFn: async () => {
      const response = await customFetchClient<FolderBrowsingResponse>(
        `/explorer/browse?volume_id=${volumeId}&path=/&include_children=true&limit=100`,
      );
      return response;
    },
  });

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

  const rootFolders = useMemo(() => rootData?.children || [], [rootData]);

  if (isLoading) {
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

  if (rootFolders.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-sm text-tertiary italic">
          No directories found in this volume
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto ${className}`}>
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
        {rootFolders.length > 0 && (
          <span className="text-xs text-tertiary">
            {rootFolders.length}
          </span>
        )}
      </div>

      {/* Child folders */}
      {rootFolders.map((folder) => (
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
    </div>
  );
}
