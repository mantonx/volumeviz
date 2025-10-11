/**
 * Types for Explorer Page - File system exploration interface
 */

/**
 * Props for the ExplorerPage component
 */
export interface ExplorerPageProps {
  className?: string;
  /**
   * Volume filter from FilesPage
   * - 'all' = show files from all volumes (global view)
   * - specific volume name = show files from that volume only
   */
  selectedVolumeFilter?: string;
}

/**
 * File item representation in the explorer
 */
export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  extension?: string;
  mediaType?: string;
}

/**
 * Directory tree node structure
 */
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  hasChildren?: boolean;
}

/**
 * File metadata for drawer display
 */
export interface FileMetadata {
  fileId: string;
  rawJson?: Record<string, unknown>;
  normalizedFields?: {
    name: string;
    size: number;
    type: string;
    modified: string;
    created?: string;
    permissions?: string;
    owner?: string;
    group?: string;
  };
  mediaProperties?: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    format?: string;
    codec?: string;
  };
}
