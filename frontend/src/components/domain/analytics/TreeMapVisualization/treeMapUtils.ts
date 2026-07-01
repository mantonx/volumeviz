/**
 * TreeMap Utility Functions
 *
 * Data transformation and helper functions for TreeMap visualization
 */

import type { FileItem, TreeMapNode, ColorScheme } from './TreeMapVisualization.types';

/**
 * Transform flat file list into hierarchical tree structure
 */
export function transformToTreeMapData(
  files: FileItem[],
  rootPath: string = '/',
): TreeMapNode[] {
  console.log('[treeMapUtils] Transform called with:', {
    filesCount: files?.length,
    rootPath,
    sampleFile: files?.[0]
  });

  if (!files || files.length === 0) {
    console.log('[treeMapUtils] No files, returning empty array');
    return [];
  }

  // Build a map of path -> node
  const nodeMap = new Map<string, TreeMapNode>();
  const rootNodes: TreeMapNode[] = [];

  // Sort files to process directories first, then files
  const sortedFiles = [...files].sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    return 0;
  });

  sortedFiles.forEach((file) => {
    const node: TreeMapNode = {
      name: file.name,
      path: file.path,
      value: file.size || 0,
      type: file.is_directory ? 'directory' : 'file',
      extension: file.extension,
      modifiedTime: file.modified_time,
      children: file.is_directory ? [] : undefined,
      // Add unique key based on full path to avoid duplicate key issues
      key: file.path,
    };

    nodeMap.set(file.path, node);

    // Determine parent path
    const parentPath = getParentPath(file.path);

    if (parentPath === rootPath || parentPath === '') {
      // This is a root-level item
      rootNodes.push(node);
    } else {
      // Find or create parent
      const parent = nodeMap.get(parentPath);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        node.parent = parentPath;
      } else {
        // Parent doesn't exist yet, add to root
        rootNodes.push(node);
      }
    }
  });

  // Calculate sizes bottom-up for directories
  const calculateDirectorySize = (node: TreeMapNode): number => {
    if (node.type === 'file') {
      return node.value;
    }

    if (node.children && node.children.length > 0) {
      const totalSize = node.children.reduce(
        (sum, child) => sum + calculateDirectorySize(child),
        0,
      );
      node.value = totalSize;
      return totalSize;
    }

    return node.value;
  };

  rootNodes.forEach(calculateDirectorySize);

  // Sort by size (largest first)
  rootNodes.sort((a, b) => b.value - a.value);
  rootNodes.forEach((node) => sortChildren(node));

  console.log('[treeMapUtils] Returning tree data:', {
    rootNodesCount: rootNodes.length,
    sampleNode: rootNodes[0],
    totalSize: rootNodes.reduce((sum, n) => sum + n.value, 0)
  });

  return rootNodes;
}

/**
 * Recursively sort children by size
 */
function sortChildren(node: TreeMapNode): void {
  if (node.children && node.children.length > 0) {
    node.children.sort((a, b) => b.value - a.value);
    node.children.forEach(sortChildren);
  }
}

/**
 * Get parent path from a file path
 */
function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  parts.pop();
  return '/' + parts.join('/');
}

/**
 * Flatten hierarchical tree into a list suitable for Recharts Treemap
 */
export function flattenTreeMapData(
  nodes: TreeMapNode[],
  maxDepth: number = 3,
  currentDepth: number = 0,
): TreeMapNode[] {
  if (currentDepth >= maxDepth) return [];

  const result: TreeMapNode[] = [];

  nodes.forEach((node) => {
    const nodeWithDepth = { ...node, depth: currentDepth };
    result.push(nodeWithDepth);

    if (node.children && node.children.length > 0 && currentDepth < maxDepth - 1) {
      const childNodes = flattenTreeMapData(node.children, maxDepth, currentDepth + 1);
      result.push(...childNodes);
    }
  });

  return result;
}

/**
 * Get color based on file type
 */
export function getFileTypeColor(node: TreeMapNode, isDarkMode: boolean = false): string {
  if (node.type === 'directory') {
    return isDarkMode ? '#60A5FA' : '#3B82F6'; // blue-400 : blue-500
  }

  const ext = node.extension?.toLowerCase() || '';

  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return isDarkMode ? '#60A5FA' : '#3B82F6'; // blue
  }

  // Video files
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
    return isDarkMode ? '#F87171' : '#EF4444'; // red
  }

  // Audio files
  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma'].includes(ext)) {
    return isDarkMode ? '#A78BFA' : '#8B5CF6'; // purple
  }

  // Document files
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages'].includes(ext)) {
    return isDarkMode ? '#34D399' : '#10B981'; // green
  }

  // Archive files
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz', 'iso'].includes(ext)) {
    return isDarkMode ? '#FBBF24' : '#F59E0B'; // amber
  }

  // Code files
  if (
    ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(ext)
  ) {
    return isDarkMode ? '#818CF8' : '#6366F1'; // indigo
  }

  // Spreadsheet files
  if (['xlsx', 'xls', 'csv', 'ods', 'numbers'].includes(ext)) {
    return isDarkMode ? '#34D399' : '#059669'; // emerald
  }

  // Presentation files
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) {
    return isDarkMode ? '#FB923C' : '#F97316'; // orange
  }

  // Database files
  if (['db', 'sqlite', 'sql', 'mdb'].includes(ext)) {
    return isDarkMode ? '#A78BFA' : '#7C3AED'; // violet
  }

  // Other
  return isDarkMode ? '#9CA3AF' : '#6B7280'; // gray
}

/**
 * Get color based on file age
 */
export function getAgeColor(node: TreeMapNode): string {
  if (!node.modifiedTime) {
    return '#6B7280'; // gray for unknown age
  }

  const now = new Date();
  const modified = new Date(node.modifiedTime);
  const ageInDays = (now.getTime() - modified.getTime()) / (1000 * 60 * 60 * 24);

  // Very recent (<1 month) - Dark green
  if (ageInDays < 30) return '#059669';
  // Recent (1-3 months) - Light green
  if (ageInDays < 90) return '#10B981';
  // Medium (3-6 months) - Yellow
  if (ageInDays < 180) return '#F59E0B';
  // Old (6-12 months) - Orange
  if (ageInDays < 365) return '#F97316';
  // Very old (>1 year) - Red
  return '#EF4444';
}

/**
 * Get color based on file size (heat map)
 */
export function getSizeColor(node: TreeMapNode, maxSize: number): string {
  if (maxSize === 0) return '#6B7280';

  const ratio = node.value / maxSize;

  // Blue (small) to Red (large)
  if (ratio < 0.2) return '#3B82F6'; // blue
  if (ratio < 0.4) return '#10B981'; // green
  if (ratio < 0.6) return '#F59E0B'; // amber
  if (ratio < 0.8) return '#F97316'; // orange
  return '#EF4444'; // red
}

/**
 * Get color for a tree map node based on color scheme
 */
export function getNodeColor(
  node: TreeMapNode,
  colorScheme: ColorScheme,
  isDarkMode: boolean = false,
  maxSize?: number,
): string {
  switch (colorScheme) {
    case 'fileType':
      return getFileTypeColor(node, isDarkMode);
    case 'age':
      return getAgeColor(node);
    case 'size':
      return getSizeColor(node, maxSize || 0);
    default:
      return getFileTypeColor(node, isDarkMode);
  }
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!bytes || bytes < 0) return 'Unknown';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i >= sizes.length) return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(1)} ${sizes[sizes.length - 1]}`;

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  if (percentage < 0.1) return '<0.1%';
  if (percentage < 1) return percentage.toFixed(1) + '%';
  return percentage.toFixed(0) + '%';
}

/**
 * Get file type category for display
 */
export function getFileTypeCategory(node: TreeMapNode): string {
  if (node.type === 'directory') return 'Directory';

  const ext = node.extension?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'Image';
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) return 'Video';
  if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma'].includes(ext)) return 'Audio';
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages'].includes(ext)) return 'Document';
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz', 'iso'].includes(ext)) return 'Archive';
  if (
    ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(ext)
  ) {
    return 'Code';
  }
  if (['xlsx', 'xls', 'csv', 'ods', 'numbers'].includes(ext)) return 'Spreadsheet';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'Presentation';
  if (['db', 'sqlite', 'sql', 'mdb'].includes(ext)) return 'Database';

  return 'Other';
}

/**
 * Calculate relative time string
 */
export function getRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Build breadcrumb path array
 */
export function buildBreadcrumbs(currentPath: string): Array<{ name: string; path: string }> {
  if (currentPath === '/') return [{ name: 'Root', path: '/' }];

  const parts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = [{ name: 'Root', path: '/' }];

  let accumulatedPath = '';
  parts.forEach((part) => {
    accumulatedPath += `/${part}`;
    breadcrumbs.push({ name: part, path: accumulatedPath });
  });

  return breadcrumbs;
}

/**
 * Find node by path in tree
 */
export function findNodeByPath(nodes: TreeMapNode[], path: string): TreeMapNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Filter nodes by minimum size (for performance)
 */
export function filterByMinSize(nodes: TreeMapNode[], minSize: number): TreeMapNode[] {
  return nodes
    .filter((node) => node.value >= minSize)
    .map((node) => ({
      ...node,
      children: node.children ? filterByMinSize(node.children, minSize) : undefined,
    }));
}

/**
 * Limit depth of tree
 */
export function limitTreeDepth(nodes: TreeMapNode[], maxDepth: number, currentDepth: number = 0): TreeMapNode[] {
  if (currentDepth >= maxDepth) return nodes.map((node) => ({ ...node, children: undefined }));

  return nodes.map((node) => ({
    ...node,
    children: node.children ? limitTreeDepth(node.children, maxDepth, currentDepth + 1) : undefined,
  }));
}
