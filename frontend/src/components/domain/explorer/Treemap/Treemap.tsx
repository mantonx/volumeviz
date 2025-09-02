/**
 * Treemap Visualization Component
 * 
 * A high-performance treemap implementation for visualizing hierarchical file system data.
 * Features:
 * - Area-based size visualization
 * - Color coding by file type
 * - Interactive hover and selection
 * - Smooth animations
 * - Drill-down navigation
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/utils';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  value: number; // size in bytes
  type: 'file' | 'directory';
  children?: TreeNode[];
  extension?: string;
  mimeType?: string;
  modified?: Date;
}

export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: TreeNode;
  depth: number;
}

export interface TreemapProps {
  data: TreeNode[];
  width?: number;
  height?: number;
  onNodeClick?: (node: TreeNode, event: React.MouseEvent) => void;
  onNodeHover?: (node: TreeNode | null) => void;
  selectedNodes?: Set<string>;
  highlightedNodes?: Set<string>;
  colorScheme?: 'type' | 'size' | 'age';
  showLabels?: boolean;
  labelThreshold?: number; // Minimum area to show label (0-1)
  className?: string;
}

interface HierarchyNode {
  data: TreeNode;
  value: number;
  children?: HierarchyNode[];
  depth: number;
  height: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Color schemes for different file types
const TYPE_COLORS = {
  directory: '#3b82f6', // blue
  image: '#10b981', // green
  video: '#ef4444', // red
  audio: '#8b5cf6', // purple
  text: '#6b7280', // gray
  document: '#f59e0b', // yellow
  archive: '#f97316', // orange
  code: '#06b6d4', // cyan
  default: '#94a3b8', // slate
};

// Simple treemap algorithm implementation
const treemap = (
  nodes: HierarchyNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
) => {
  const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);
  if (totalValue === 0) return;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const horizontal = dx >= dy;
  
  let offset = horizontal ? x0 : y0;
  
  for (const node of nodes) {
    const ratio = node.value / totalValue;
    
    if (horizontal) {
      const width = dx * ratio;
      node.x0 = offset;
      node.y0 = y0;
      node.x1 = offset + width;
      node.y1 = y1;
      offset += width;
    } else {
      const height = dy * ratio;
      node.x0 = x0;
      node.y0 = offset;
      node.x1 = x1;
      node.y1 = offset + height;
      offset += height;
    }
  }
};

// Create hierarchy from flat tree structure
const hierarchy = (data: TreeNode[], depth = 0): HierarchyNode[] => {
  return data.map(node => {
    const hierarchyNode: HierarchyNode = {
      data: node,
      value: node.value || 0,
      depth,
      height: node.children ? 1 + Math.max(...node.children.map(child => 
        hierarchy([child], depth + 1)[0]?.height || 0
      )) : 0,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
    };

    if (node.children) {
      hierarchyNode.children = hierarchy(node.children, depth + 1);
      // For directories, use sum of children if no explicit value
      if (!node.value) {
        hierarchyNode.value = hierarchyNode.children.reduce((sum, child) => sum + child.value, 0);
      }
    }

    return hierarchyNode;
  });
};

// Recursively layout treemap
const layoutTreemap = (
  nodes: HierarchyNode[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rects: TreemapRect[] = []
): TreemapRect[] => {
  // Layout current level
  treemap(nodes, x0, y0, x1, y1);
  
  // Add rectangles and process children
  for (const node of nodes) {
    const rect: TreemapRect = {
      x: node.x0,
      y: node.y0,
      width: node.x1 - node.x0,
      height: node.y1 - node.y0,
      node: node.data,
      depth: node.depth,
    };
    rects.push(rect);

    // Recursively layout children with padding
    if (node.children && node.children.length > 0) {
      const padding = Math.max(1, Math.min(4, rect.width / 20, rect.height / 20));
      layoutTreemap(
        node.children,
        node.x0 + padding,
        node.y0 + padding,
        node.x1 - padding,
        node.y1 - padding,
        rects
      );
    }
  }

  return rects;
};

// Get color for a node based on scheme
const getNodeColor = (node: TreeNode, scheme: string): string => {
  switch (scheme) {
    case 'type': {
      if (node.type === 'directory') return TYPE_COLORS.directory;
      
      if (node.mimeType) {
        if (node.mimeType.startsWith('image/')) return TYPE_COLORS.image;
        if (node.mimeType.startsWith('video/')) return TYPE_COLORS.video;
        if (node.mimeType.startsWith('audio/')) return TYPE_COLORS.audio;
        if (node.mimeType.startsWith('text/')) return TYPE_COLORS.text;
        if (node.mimeType.includes('document')) return TYPE_COLORS.document;
        if (node.mimeType.includes('zip') || node.mimeType.includes('archive')) return TYPE_COLORS.archive;
      }
      
      if (node.extension) {
        const ext = node.extension.toLowerCase();
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) {
          return TYPE_COLORS.code;
        }
      }
      
      return TYPE_COLORS.default;
    }
    case 'size': {
      // Color by size (darker = larger)
      const sizeRatio = Math.min(node.value / (10 * 1024 * 1024), 1); // Normalize to 10MB max
      const intensity = Math.floor(255 * (1 - sizeRatio * 0.7));
      return `rgb(${intensity}, ${intensity}, 255)`;
    }
    case 'age': {
      // Color by age (newer = warmer colors)
      if (!node.modified) return TYPE_COLORS.default;
      const ageInDays = (Date.now() - node.modified.getTime()) / (1000 * 60 * 60 * 24);
      const ageRatio = Math.min(ageInDays / 365, 1); // Normalize to 1 year
      const red = Math.floor(255 * (1 - ageRatio));
      const blue = Math.floor(255 * ageRatio);
      return `rgb(${red}, 100, ${blue})`;
    }
    default:
      return TYPE_COLORS.default;
  }
};

// Format file size for display
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const Treemap: React.FC<TreemapProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  selectedNodes = new Set(),
  highlightedNodes = new Set(),
  colorScheme = 'type',
  showLabels = true,
  labelThreshold = 0.01,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  // Calculate treemap layout
  const rectangles = useMemo(() => {
    if (!data.length) return [];
    
    const hierarchyNodes = hierarchy(data);
    return layoutTreemap(hierarchyNodes, 0, 0, width, height);
  }, [data, width, height]);

  // Handle mouse events
  const handleMouseEnter = useCallback((rect: TreemapRect, event: React.MouseEvent) => {
    setHoveredNode(rect.node);
    onNodeHover?.(rect.node);
    
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setTooltip({
        x: event.clientX - svgRect.left + 10,
        y: event.clientY - svgRect.top - 10,
        node: rect.node,
      });
    }
  }, [onNodeHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    onNodeHover?.(null);
    setTooltip(null);
  }, [onNodeHover]);

  const handleClick = useCallback((rect: TreemapRect, event: React.MouseEvent) => {
    onNodeClick?.(rect.node, event);
  }, [onNodeClick]);

  // Filter rectangles that are large enough to be meaningful
  const visibleRects = useMemo(() => {
    const minArea = width * height * 0.001; // 0.1% of total area
    return rectangles.filter(rect => rect.width * rect.height >= minArea);
  }, [rectangles, width, height]);

  if (!data.length) {
    return (
      <div 
        className={cn('flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg', className)}
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="text-gray-500">No data to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        {visibleRects.map((rect) => {
          const isSelected = selectedNodes.has(rect.node.id);
          const isHighlighted = highlightedNodes.has(rect.node.id);
          const isHovered = hoveredNode?.id === rect.node.id;
          const color = getNodeColor(rect.node, colorScheme);
          const shouldShowLabel = showLabels && 
            (rect.width * rect.height) / (width * height) > labelThreshold;

          return (
            <g key={rect.node.id}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={color}
                stroke={isSelected ? '#3b82f6' : isHighlighted ? '#f59e0b' : '#ffffff'}
                strokeWidth={isSelected ? 2 : isHighlighted ? 1.5 : 0.5}
                opacity={isHovered ? 0.8 : isHighlighted ? 1 : 0.9}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={(e) => handleMouseEnter(rect, e)}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => handleClick(rect, e)}
              />
              
              {shouldShowLabel && rect.width > 60 && rect.height > 20 && (
                <text
                  x={rect.x + 4}
                  y={rect.y + 16}
                  fontSize={Math.min(12, rect.width / 8, rect.height / 3)}
                  fill="white"
                  style={{
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                  className="font-medium"
                >
                  <tspan className="truncate">
                    {rect.node.name.length > 20 ? `${rect.node.name.slice(0, 20)}...` : rect.node.name}
                  </tspan>
                  {rect.height > 35 && (
                    <tspan x={rect.x + 4} y={rect.y + 32} fontSize="10" opacity={0.9}>
                      {formatSize(rect.node.value)}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-medium">{tooltip.node.name}</div>
          <div className="text-xs opacity-90">
            Size: {formatSize(tooltip.node.value)}
          </div>
          {tooltip.node.type === 'directory' && (
            <div className="text-xs opacity-90">
              {tooltip.node.children?.length || 0} items
            </div>
          )}
          {tooltip.node.modified && (
            <div className="text-xs opacity-90">
              Modified: {tooltip.node.modified.toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};