/**
 * TreeMap Visualization Types
 *
 * TypeScript interfaces for TreeMap component and related utilities
 */

export interface FileItem {
  id?: number;
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
}

export interface TreeMapNode {
  name: string;
  value: number; // size in bytes
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  modifiedTime?: string;
  children?: TreeMapNode[];
  parent?: string;
  depth?: number;
  percentage?: number; // percentage of total size
  [key: string]: any; // Index signature for Recharts compatibility
}

export interface TreeMapCell extends TreeMapNode {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  depth: number;
}

export type ColorScheme = 'fileType' | 'age' | 'size';

export interface TreeMapVisualizationProps {
  /** Volume ID to fetch data for */
  volumeId: string;
  /** Current path to display */
  currentPath?: string;
  /** Files data (flat list) */
  files?: FileItem[];
  /** Color scheme to use */
  colorScheme?: ColorScheme;
  /** Callback when a file/folder is clicked */
  onFileClick?: (node: TreeMapNode) => void;
  /** Callback when navigating to a folder */
  onNavigate?: (path: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Width of the treemap */
  width?: number;
  /** Height of the treemap */
  height?: number;
  /** Minimum size to render a cell (in pixels) */
  minCellSize?: number;
}

export interface ColorSchemeOption {
  id: ColorScheme;
  label: string;
  description: string;
}

export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = [
  {
    id: 'fileType',
    label: 'File Type',
    description: 'Color by file type (images, videos, documents, etc.)',
  },
  {
    id: 'age',
    label: 'Age',
    description: 'Color by file age (newer = green, older = red)',
  },
  {
    id: 'size',
    label: 'Size',
    description: 'Color by file size (heat map)',
  },
];
