export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: Date;
  permissions?: string;
  extension?: string;
  mimeType?: string;
  thumbnail?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  expanded?: boolean;
  hasChildren?: boolean;
}

// Navigation state types
export type ViewMode = 'list' | 'grid' | 'treemap';

export type SortField = 'name' | 'size' | 'modified' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface NavigationState {
  volumeId: string | null;
  path: string;
  viewMode: ViewMode;
  sortConfig: SortConfig;
  selectedIds: Set<string>;
  searchQuery: string;
  filters: ExplorerFilters;
  breadcrumbPath: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  name: string;
  path: string;
  isClickable: boolean;
}

export interface ExplorerFilters {
  fileTypes: Set<string>;
  sizeRange: {
    min: number | null;
    max: number | null;
  };
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  showHidden: boolean;
}
