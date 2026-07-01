/**
 * TreeMap Visualization Component
 *
 * WinDirStat-style treemap visualization for storage analysis.
 * Features:
 * - Proportional rectangle sizing based on file/folder size
 * - Color-coded by file type, age, or size
 * - Interactive drill-down into folders
 * - Breadcrumb navigation
 * - Responsive and performant
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Home,
  ChevronRight,
  Folder,
  File,
  ArrowLeft,
  Palette,
  Info,
} from 'lucide-react';
import {
  transformToTreeMapData,
  getNodeColor,
  formatFileSize,
  formatPercentage,
  getFileTypeCategory,
  getRelativeTime,
  buildBreadcrumbs,
  findNodeByPath,
} from './treeMapUtils';
import type {
  TreeMapVisualizationProps,
  TreeMapNode,
  ColorScheme,
} from './TreeMapVisualization.types';
import { COLOR_SCHEME_OPTIONS } from './TreeMapVisualization.types';
import { cn } from '@/utils/class-names/cn';

/**
 * Custom TreeMap cell renderer
 */
interface CustomContentProps {
  root?: TreeMapNode;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  colors?: string[];
  node?: TreeMapNode;
  colorScheme?: ColorScheme;
  isDarkMode?: boolean;
  maxSize?: number;
  onCellClick?: (node: TreeMapNode) => void;
}

const CustomTreeMapContent: React.FC<CustomContentProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  value = 0,
  node,
  colorScheme = 'fileType',
  isDarkMode = false,
  maxSize = 0,
  onCellClick,
}) => {
  if (!node || width < 1 || height < 1) return null;

  const color = getNodeColor(node, colorScheme, isDarkMode, maxSize);
  const showLabel = width > 50 && height > 30;
  const showSize = width > 80 && height > 50;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCellClick?.(node);
  };

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: isDarkMode ? '#1f2937' : '#ffffff',
          strokeWidth: 1,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        className="hover:opacity-80"
        onClick={handleClick}
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (showSize ? 8 : 0)}
            textAnchor="middle"
            fill={isDarkMode ? '#ffffff' : '#000000'}
            fontSize={Math.min(width / 8, height / 4, 14)}
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            {name.length > 20 ? name.substring(0, 17) + '...' : name}
          </text>
          {showSize && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 12}
              textAnchor="middle"
              fill={isDarkMode ? '#d1d5db' : '#4b5563'}
              fontSize={Math.min(width / 10, height / 5, 11)}
              style={{ pointerEvents: 'none' }}
            >
              {formatFileSize(value)}
            </text>
          )}
        </>
      )}
    </g>
  );
};

/**
 * Custom Tooltip for TreeMap
 */
interface TreeMapTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: TreeMapNode & {
      root?: TreeMapNode;
      depth?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
  }>;
  totalSize?: number;
}

const TreeMapCustomTooltip: React.FC<TreeMapTooltipProps> = ({
  active,
  payload,
  totalSize = 0,
}) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  if (!data) return null;

  const node: TreeMapNode = {
    name: data.name,
    value: data.value,
    path: data.path,
    type: data.type,
    extension: data.extension,
    modifiedTime: data.modifiedTime,
    children: data.children,
  };

  return (
    <div className="bg-surface border border-line rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-start gap-2 mb-2">
        {node.type === 'directory' ? (
          <Folder className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        ) : (
          <File className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-primary truncate">
            {node.name}
          </p>
          <p className="text-xs text-tertiary truncate">
            {node.path}
          </p>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-secondary">Size:</span>
          <span className="font-medium text-primary">
            {formatFileSize(node.value)}
          </span>
        </div>
        {totalSize > 0 && (
          <div className="flex justify-between">
            <span className="text-secondary">Percentage:</span>
            <span className="font-medium text-primary">
              {formatPercentage(node.value, totalSize)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-secondary">Type:</span>
          <span className="font-medium text-primary">
            {getFileTypeCategory(node)}
          </span>
        </div>
        {node.modifiedTime && (
          <div className="flex justify-between">
            <span className="text-secondary">Modified:</span>
            <span className="font-medium text-primary">
              {getRelativeTime(node.modifiedTime)}
            </span>
          </div>
        )}
        {node.type === 'directory' && node.children && (
          <div className="flex justify-between">
            <span className="text-secondary">Items:</span>
            <span className="font-medium text-primary">
              {node.children.length}
            </span>
          </div>
        )}
      </div>
      {node.type === 'directory' && (
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">
          Click to drill down
        </p>
      )}
    </div>
  );
};

/**
 * Main TreeMap Visualization Component
 */
export const TreeMapVisualization: React.FC<TreeMapVisualizationProps> = ({
  files = [],
  currentPath = '/',
  colorScheme: initialColorScheme = 'fileType',
  onFileClick,
  onNavigate,
  className,
  width,
  height = 600,
}) => {
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorScheme>(initialColorScheme);
  const [zoomedPath, setZoomedPath] = useState<string>(currentPath);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDarkMode] = useState(false); // TODO: Connect to theme context

  // Transform flat file list to hierarchical tree
  const treeData = useMemo(() => {
    console.log('[TreeMap] Transforming data:', {
      filesCount: files?.length,
      currentPath,
      sampleFile: files?.[0]
    });
    if (!files || files.length === 0) {
      console.log('[TreeMap] No files to display');
      return [];
    }
    const result = transformToTreeMapData(files, currentPath);
    console.log('[TreeMap] Transformed data:', {
      nodesCount: result.length,
      sampleNode: result[0]
    });
    return result;
  }, [files, currentPath]);

  // Get current view data (for drill-down)
  const currentViewData = useMemo(() => {
    if (zoomedPath === currentPath || zoomedPath === '/') {
      return treeData;
    }

    const node = findNodeByPath(treeData, zoomedPath);
    return node?.children || treeData;
  }, [treeData, zoomedPath, currentPath]);

  // Calculate total size
  const totalSize = useMemo(() => {
    return currentViewData.reduce((sum, node) => sum + node.value, 0);
  }, [currentViewData]);

  // Calculate max size for size-based coloring
  const maxSize = useMemo(() => {
    return Math.max(...currentViewData.map((node) => node.value), 0);
  }, [currentViewData]);

  // Build breadcrumbs
  const breadcrumbs = useMemo(() => {
    return buildBreadcrumbs(zoomedPath);
  }, [zoomedPath]);

  // Handle cell click (drill-down)
  const handleCellClick = useCallback(
    (node: TreeMapNode) => {
      if (node.type === 'directory') {
        setZoomedPath(node.path);
        onNavigate?.(node.path);
      }
      onFileClick?.(node);
    },
    [onFileClick, onNavigate],
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback((path: string) => {
    setZoomedPath(path);
  }, []);

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    const parts = zoomedPath.split('/').filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    const newPath = '/' + parts.join('/');
    setZoomedPath(newPath === '/' ? currentPath : newPath);
  }, [zoomedPath, currentPath]);

  // Reset to root
  const handleReset = useCallback(() => {
    setZoomedPath(currentPath);
  }, [currentPath]);

  // Color scheme selector
  const handleColorSchemeChange = useCallback((scheme: ColorScheme) => {
    setSelectedColorScheme(scheme);
    setShowColorPicker(false);
  }, []);

  if (!files || files.length === 0) {
    return (
      <Card className={cn('p-8', className)}>
        <div className="text-center">
          <Folder className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-primary mb-2">
            No Data Available
          </h3>
          <p className="text-secondary">
            No files or folders to display in this directory.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-primary">
              Storage TreeMap
            </h3>
            <span className="text-sm text-tertiary">
              ({formatFileSize(totalSize)} total)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {zoomedPath !== currentPath && (
              <>
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <Home className="w-4 h-4 mr-1" />
                  Reset
                </Button>
              </>
            )}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <Palette className="w-4 h-4 mr-1" />
                {COLOR_SCHEME_OPTIONS.find((s) => s.id === selectedColorScheme)?.label}
              </Button>
              {showColorPicker && (
                <div className="absolute right-0 top-full mt-2 bg-surface border border-line rounded-lg shadow-lg p-2 z-10 min-w-[240px]">
                  {COLOR_SCHEME_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleColorSchemeChange(option.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded hover:bg-surface-hover',
                        selectedColorScheme === option.id &&
                          'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-tertiary">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Home className="h-4 w-4 text-gray-400" />
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.path)}
                className={cn(
                  'hover:text-blue-600 dark:hover:text-blue-400 transition-colors',
                  index === breadcrumbs.length - 1
                    ? 'text-primary font-medium'
                    : 'text-secondary',
                )}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* TreeMap Visualization */}
      <Card className="p-4">
        <ResponsiveContainer width={width || '100%'} height={height}>
          <Treemap
            data={currentViewData}
            dataKey="value"
            nameKey="key"
            stroke={isDarkMode ? '#1f2937' : '#ffffff'}
            fill="#8884d8"
            content={
              <CustomTreeMapContent
                colorScheme={selectedColorScheme}
                isDarkMode={isDarkMode}
                maxSize={maxSize}
                onCellClick={handleCellClick}
              />
            }
          >
            <Tooltip
              content={
                <TreeMapCustomTooltip
                  totalSize={totalSize}
                />
              }
            />
          </Treemap>
        </ResponsiveContainer>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h4 className="font-medium text-primary mb-2">
              How to Use
            </h4>
            <ul className="text-sm text-secondary space-y-1">
              <li>• Rectangle size represents file/folder size</li>
              <li>• Hover over rectangles to see details</li>
              <li>• Click on folders to drill down</li>
              <li>• Use breadcrumbs or Back button to navigate up</li>
            </ul>
          </div>
          {selectedColorScheme === 'fileType' && (
            <div className="flex-1">
              <h4 className="font-medium text-primary mb-2">
                File Types
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { color: '#3B82F6', label: 'Images/Dirs' },
                  { color: '#EF4444', label: 'Videos' },
                  { color: '#8B5CF6', label: 'Audio' },
                  { color: '#10B981', label: 'Documents' },
                  { color: '#F59E0B', label: 'Archives' },
                  { color: '#6366F1', label: 'Code' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-secondary">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedColorScheme === 'age' && (
            <div className="flex-1">
              <h4 className="font-medium text-primary mb-2">
                File Age
              </h4>
              <div className="space-y-1 text-sm">
                {[
                  { color: '#059669', label: '< 1 month (very recent)' },
                  { color: '#10B981', label: '1-3 months (recent)' },
                  { color: '#F59E0B', label: '3-6 months (medium)' },
                  { color: '#F97316', label: '6-12 months (old)' },
                  { color: '#EF4444', label: '> 1 year (very old)' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-secondary">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TreeMapVisualization;
