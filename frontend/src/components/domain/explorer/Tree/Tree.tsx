/**
 * Tree Component
 *
 * Lazy-loading directory tree component for volume exploration.
 */

import { useTreeNavigation } from '@/api/explorer';
import type { TreeNode } from '@/atoms/explorer';
import { currentVolumeAtom } from '@/atoms/explorer';
import { cn } from '@/utils';
import { useSetAtom } from 'jotai';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderIcon,
} from 'lucide-react';
import React, { useCallback, useEffect } from 'react';

interface TreeProps {
  volumeId: string;
  onNodeSelect?: (node: TreeNode) => void;
  className?: string;
}

interface TreeNodeProps {
  node: TreeNode;
  onSelect: (node: TreeNode) => void;
  onToggleExpand: (path: string) => Promise<void>;
  isSelected: boolean;
  isExpanded: boolean;
  children: TreeNode[];
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({
  node,
  onSelect,
  onToggleExpand,
  isSelected,
  isExpanded,
  children,
}) => {
  const handleClick = useCallback(() => {
    onSelect(node);
  }, [node, onSelect]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.type === 'folder') {
        onToggleExpand(node.path);
      }
    },
    [node, onToggleExpand],
  );

  const canExpand = node.type === 'folder' && node.hasChildren;

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center space-x-1 px-2 py-1 cursor-pointer hover:bg-surface-hover rounded',
          isSelected && 'bg-blue-100 dark:bg-blue-900/30',
        )}
        onClick={handleClick}
      >
        {canExpand ? (
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-4 h-4 hover:bg-gray-200 hover:bg-surface-hover rounded"
          >
            {node.isLoading ? (
              <LoaderIcon className="w-3 h-3 animate-spin" />
            ) : isExpanded ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}

        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpenIcon className="w-4 h-4 text-blue-500" />
          ) : (
            <FolderIcon className="w-4 h-4 text-blue-500" />
          )
        ) : (
          <div className="w-4 h-4" />
        )}

        <span className="flex-1 text-sm text-primary truncate">
          {node.name}
        </span>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              isSelected={false}
              isExpanded={false}
              children={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Tree: React.FC<TreeProps> = ({
  volumeId,
  onNodeSelect,
  className = '',
}) => {
  const setCurrentVolume = useSetAtom(currentVolumeAtom);
  const {
    treeNodes,
    expandedNodes,
    isLoading,
    error,
    loadTreeChildren,
    toggleNode,
  } = useTreeNavigation();

  // Set the current volume when component mounts
  useEffect(() => {
    setCurrentVolume(volumeId);
  }, [volumeId, setCurrentVolume]);

  // Load root level on mount
  useEffect(() => {
    if (volumeId) {
      loadTreeChildren('/');
    }
  }, [volumeId, loadTreeChildren]);

  const handleNodeSelect = useCallback(
    (node: TreeNode) => {
      onNodeSelect?.(node);
    },
    [onNodeSelect],
  );

  const handleToggleExpand = useCallback(
    async (path: string) => {
      await toggleNode(path);
    },
    [toggleNode],
  );

  const rootNodes = treeNodes['/'] || [];

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.path);
    const children = isExpanded ? treeNodes[node.path] || [] : [];

    return (
      <TreeNodeComponent
        key={node.id}
        node={node}
        onSelect={handleNodeSelect}
        onToggleExpand={handleToggleExpand}
        isSelected={false}
        isExpanded={isExpanded}
        children={children}
      />
    );
  };

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-red-600 dark:text-red-400 text-sm">
          Error loading directory tree: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className}`}>
      {isLoading && rootNodes.length === 0 ? (
        <div className="flex items-center justify-center p-4">
          <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-secondary">
            Loading directory tree...
          </span>
        </div>
      ) : (
        <div className="space-y-1">{rootNodes.map(renderNode)}</div>
      )}
    </div>
  );
};
