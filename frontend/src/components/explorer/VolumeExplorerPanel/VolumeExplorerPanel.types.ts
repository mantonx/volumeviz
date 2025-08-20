import type { ReactNode } from 'react';

/**
 * File/folder item in the explorer
 */
export interface ExplorerItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
  mimeType?: string;
  extension?: string;
  permissions?: string;
  owner?: string;
  group?: string;
  isHidden?: boolean;
  isSystem?: boolean;
  isSymlink?: boolean;
  symlinkTarget?: string;
  hasChildren?: boolean;
  childCount?: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    codec?: string;
    [key: string]: any;
  };
  previewUrl?: string;
  thumbnailUrl?: string;
  tags?: string[];
  starred?: boolean;
  selected?: boolean;
  expanded?: boolean;
  loading?: boolean;
  error?: string;
}

/**
 * View mode for the explorer
 */
export type ExplorerViewMode = 'grid' | 'list' | 'tree' | 'columns';

/**
 * Sort options
 */
export type ExplorerSortBy = 'name' | 'size' | 'type' | 'modified' | 'created';
export type ExplorerSortOrder = 'asc' | 'desc';

/**
 * Filter options
 */
export interface ExplorerFilter {
  query?: string;
  types?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  showHidden?: boolean;
  showSystem?: boolean;
  extensions?: string[];
  tags?: string[];
  starred?: boolean;
}

/**
 * Selection state
 */
export interface ExplorerSelection {
  items: Set<string>;
  lastSelected?: string;
  rangeStart?: string;
  mode: 'single' | 'multiple' | 'range';
}

/**
 * Context menu action
 */
export interface ExplorerContextAction {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  handler: (items: ExplorerItem[]) => void | Promise<void>;
  visible?: (items: ExplorerItem[]) => boolean;
  submenu?: ExplorerContextAction[];
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  id: string;
  label: string;
  path: string;
  icon?: ReactNode;
}

/**
 * Preview configuration
 */
export interface PreviewConfig {
  enabled: boolean;
  mode: 'inline' | 'modal' | 'sidebar';
  maxFileSize?: number;
  supportedTypes?: string[];
  autoplay?: boolean;
  showMetadata?: boolean;
  enableDownload?: boolean;
  enableShare?: boolean;
  customRenderers?: Record<string, (item: ExplorerItem) => ReactNode>;
}

/**
 * Main component props
 */
export interface VolumeExplorerPanelProps {
  /** Volume identifier */
  volumeId: string;

  /** Current path in the volume */
  currentPath?: string;

  /** Explorer items to display */
  items: ExplorerItem[];

  /** Whether data is loading */
  isLoading?: boolean;

  /** Loading more items (pagination) */
  isLoadingMore?: boolean;

  /** Error state */
  error?: string;

  /** Total item count */
  totalItems?: number;

  /** View mode */
  viewMode?: ExplorerViewMode;

  /** Sort configuration */
  sortBy?: ExplorerSortBy;
  sortOrder?: ExplorerSortOrder;

  /** Filter configuration */
  filter?: ExplorerFilter;

  /** Selection configuration */
  selection?: ExplorerSelection;

  /** Enable multi-select */
  multiSelect?: boolean;

  /** Enable drag and drop */
  enableDragDrop?: boolean;

  /** Enable context menu */
  enableContextMenu?: boolean;

  /** Context menu actions */
  contextActions?: ExplorerContextAction[];

  /** Preview configuration */
  preview?: PreviewConfig;

  /** Show breadcrumb navigation */
  showBreadcrumb?: boolean;

  /** Breadcrumb items */
  breadcrumb?: BreadcrumbItem[];

  /** Show toolbar */
  showToolbar?: boolean;

  /** Show status bar */
  showStatusBar?: boolean;

  /** Show sidebar */
  showSidebar?: boolean;

  /** Sidebar content */
  sidebarContent?: ReactNode;

  /** Custom toolbar actions */
  toolbarActions?: ReactNode;

  /** Enable search */
  enableSearch?: boolean;

  /** Search placeholder */
  searchPlaceholder?: string;

  /** Grid configuration */
  gridConfig?: {
    itemWidth?: number;
    itemHeight?: number;
    gap?: number;
    columns?: number | 'auto';
  };

  /** List configuration */
  listConfig?: {
    rowHeight?: number;
    showIcons?: boolean;
    showSize?: boolean;
    showModified?: boolean;
    showType?: boolean;
    compactMode?: boolean;
  };

  /** Tree configuration */
  treeConfig?: {
    indentSize?: number;
    showLines?: boolean;
    expandOnClick?: boolean;
    loadChildrenOnExpand?: boolean;
  };

  /** Virtual scrolling */
  virtualScroll?: boolean;

  /** Items per page for pagination */
  pageSize?: number;

  /** Current page */
  currentPage?: number;

  /** Event handlers */
  onItemClick?: (item: ExplorerItem, event: React.MouseEvent) => void;
  onItemDoubleClick?: (item: ExplorerItem) => void;
  onItemContextMenu?: (item: ExplorerItem, event: React.MouseEvent) => void;
  onSelectionChange?: (selection: ExplorerSelection) => void;
  onPathChange?: (path: string) => void;
  onViewModeChange?: (mode: ExplorerViewMode) => void;
  onSortChange?: (sortBy: ExplorerSortBy, sortOrder: ExplorerSortOrder) => void;
  onFilterChange?: (filter: ExplorerFilter) => void;
  onSearch?: (query: string) => void;
  onLoadMore?: () => void;
  onPageChange?: (page: number) => void;
  onItemExpand?: (item: ExplorerItem) => void | Promise<ExplorerItem[]>;
  onItemCollapse?: (item: ExplorerItem) => void;
  onDragStart?: (items: ExplorerItem[], event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onDrop?: (
    items: ExplorerItem[],
    target: ExplorerItem | null,
    event: DragEvent,
  ) => void;
  onPreview?: (item: ExplorerItem) => void;
  onDownload?: (items: ExplorerItem[]) => void;
  onDelete?: (items: ExplorerItem[]) => void;
  onRename?: (item: ExplorerItem, newName: string) => void;
  onCreateFolder?: (parentPath: string, name: string) => void;
  onUpload?: (files: File[], targetPath: string) => void;
  onRefresh?: () => void;

  /** Custom empty state */
  emptyState?: ReactNode;

  /** Custom loading state */
  loadingState?: ReactNode;

  /** Custom error state */
  errorState?: ReactNode;

  /** Custom item renderer */
  renderItem?: (item: ExplorerItem, viewMode: ExplorerViewMode) => ReactNode;

  /** Custom CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

/**
 * Component state
 */
export interface VolumeExplorerPanelState {
  viewMode: ExplorerViewMode;
  sortBy: ExplorerSortBy;
  sortOrder: ExplorerSortOrder;
  filter: ExplorerFilter;
  selection: ExplorerSelection;
  expandedItems: Set<string>;
  focusedItem?: string;
  searchQuery: string;
  contextMenu?: {
    x: number;
    y: number;
    items: ExplorerItem[];
  };
  previewItem?: ExplorerItem;
  draggedItems?: ExplorerItem[];
  dropTarget?: string;
  columnWidths?: number[];
}

/**
 * Component ref interface
 */
export interface VolumeExplorerPanelRef {
  /** Select items */
  selectItems(itemIds: string[]): void;
  /** Clear selection */
  clearSelection(): void;
  /** Focus an item */
  focusItem(itemId: string): void;
  /** Expand folder */
  expandFolder(itemId: string): void;
  /** Collapse folder */
  collapseFolder(itemId: string): void;
  /** Toggle folder expansion */
  toggleFolder(itemId: string): void;
  /** Navigate to path */
  navigateTo(path: string): void;
  /** Go back in history */
  goBack(): void;
  /** Go forward in history */
  goForward(): void;
  /** Refresh current view */
  refresh(): void;
  /** Open preview */
  openPreview(itemId: string): void;
  /** Close preview */
  closePreview(): void;
  /** Get selected items */
  getSelectedItems(): ExplorerItem[];
  /** Get current path */
  getCurrentPath(): string;
  /** Set view mode */
  setViewMode(mode: ExplorerViewMode): void;
}


/**
 * Create mock explorer data for testing
 */
export const createMockExplorerData = (
  count = 20,
  path = '/',
): ExplorerItem[] => {
  const items: ExplorerItem[] = [];
  const types = ['folder', 'file'] as const;
  const extensions = ['pdf', 'jpg', 'doc', 'xlsx', 'mp4', 'zip', 'txt', 'png'];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const extension =
      type === 'file'
        ? extensions[Math.floor(Math.random() * extensions.length)]
        : undefined;
    const name =
      type === 'folder'
        ? `Folder ${i + 1}`
        : `document${i + 1}.${extension}`;

    items.push({
      id: `item-${i}`,
      name,
      path: `${path}${name}`,
      type,
      size: type === 'file' ? Math.floor(Math.random() * 10000000) : undefined,
      modifiedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      extension,
      mimeType:
        type === 'file' ? `application/${extension || 'octet-stream'}` : undefined,
      hasChildren: type === 'folder' ? Math.random() > 0.3 : false,
      childCount: type === 'folder' ? Math.floor(Math.random() * 50) : undefined,
      starred: Math.random() > 0.8,
      isHidden: Math.random() > 0.9,
      isSystem: Math.random() > 0.95,
    });
  }

  return items;
};