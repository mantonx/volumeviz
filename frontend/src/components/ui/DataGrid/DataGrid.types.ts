import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';

/**
 * DataGrid component types and configurations
 */

// Core types
export type DataGridSize = 'sm' | 'md' | 'lg';
export type DataGridVariant = 'default' | 'striped' | 'bordered' | 'minimal';
export type SortDirection = 'asc' | 'desc' | null;
export type ColumnType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'fileSize'
  | 'duration'
  | 'custom';
export type SelectionMode = 'none' | 'single' | 'multiple';
export type LoadingState = 'idle' | 'loading' | 'error' | 'success';

// Column definition
export interface DataGridColumn<T = any> {
  id: string;
  key: keyof T | string;
  title: string;
  type?: ColumnType;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  hidden?: boolean;
  pinned?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, rowIndex: number) => ReactNode;
  headerRender?: () => ReactNode;
  footerRender?: (data: T[]) => ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string | ((value: any, row: T, rowIndex: number) => string);
  sortKey?: string;
  sortFn?: (a: T, b: T, direction: SortDirection) => number;
  filterFn?: (value: any, filterValue: any) => boolean;
  aggregateFn?: (values: any[]) => any;
}

// Row data
export interface DataGridRow<T = any> {
  id: string | number;
  data: T;
  selected?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: (row: T, rowIndex: number) => void;
  onDoubleClick?: (row: T, rowIndex: number) => void;
  onContextMenu?: (row: T, rowIndex: number, event: React.MouseEvent) => void;
}

// Sorting configuration
export interface SortConfig {
  key: string;
  direction: SortDirection;
}

// Filter configuration
export interface FilterConfig {
  [key: string]: any;
}

// Selection state
export interface SelectionState {
  selectedRows: Set<string | number>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

// Pagination configuration
export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
  pageSizeOptions?: number[];
}

// Virtualization configuration
export interface VirtualizationConfig {
  enabled: boolean;
  rowHeight: number;
  overscan?: number;
  scrollToAlignment?: 'auto' | 'start' | 'center' | 'end';
}

// Loading configuration
export interface LoadingConfig {
  state: LoadingState;
  message?: string;
  skeleton?: boolean;
  overlay?: boolean;
}

// Empty state configuration
export interface EmptyStateConfig {
  message?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// DataGrid props
export interface DataGridProps<T = any> {
  // Data
  data: T[];
  columns: DataGridColumn<T>[];
  keyField?: keyof T | string;

  // Appearance
  size?: DataGridSize;
  variant?: DataGridVariant;
  height?: number | string;
  maxHeight?: number | string;
  bordered?: boolean;
  striped?: boolean;
  hoverable?: boolean;

  // Selection
  selectionMode?: SelectionMode;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selection: SelectionState) => void;

  // Sorting
  sortable?: boolean;
  sortConfig?: SortConfig;
  onSortChange?: (sortConfig: SortConfig) => void;

  // Filtering
  filterable?: boolean;
  filterConfig?: FilterConfig;
  onFilterChange?: (filters: FilterConfig) => void;

  // Pagination
  pagination?: PaginationConfig;
  onPaginationChange?: (pagination: PaginationConfig) => void;

  // Virtualization
  virtualization?: VirtualizationConfig;

  // Loading and empty states
  loading?: LoadingConfig;
  emptyState?: EmptyStateConfig;

  // Row configuration
  rowHeight?: number;
  expandableRows?: boolean;
  rowExpansion?: {
    render: (row: T, rowIndex: number) => ReactNode;
    expandedRowKeys?: Set<string | number>;
    onExpansionChange?: (expandedKeys: Set<string | number>) => void;
  };

  // Events
  onRowClick?: (row: T, rowIndex: number) => void;
  onRowDoubleClick?: (row: T, rowIndex: number) => void;
  onRowContextMenu?: (
    row: T,
    rowIndex: number,
    event: React.MouseEvent,
  ) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (sourceIndex: number, targetIndex: number) => void;

  // Styling
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  rowClassName?: string | ((row: T, rowIndex: number) => string);

  // Accessibility
  ariaLabel?: string;
  ariaDescribedBy?: string;
  testId?: string;
}

// DataGrid ref API
export interface DataGridRef<T = any> {
  scrollToRow: (
    rowIndex: number,
    align?: 'auto' | 'start' | 'center' | 'end',
  ) => void;
  scrollToColumn: (columnIndex: number) => void;
  selectRow: (rowId: string | number) => void;
  selectRows: (rowIds: (string | number)[]) => void;
  deselectRow: (rowId: string | number) => void;
  deselectAll: () => void;
  selectAll: () => void;
  getSelectedRows: () => T[];
  expandRow: (rowId: string | number) => void;
  collapseRow: (rowId: string | number) => void;
  toggleRowExpansion: (rowId: string | number) => void;
  getElement: () => HTMLDivElement | null;
  refresh: () => void;
}

// Size configurations
export interface DataGridSizeConfig {
  container: string;
  header: string;
  cell: string;
  rowHeight: number;
  fontSize: string;
  padding: string;
}

export const defaultDataGridSizes: Record<DataGridSize, DataGridSizeConfig> = {
  sm: {
    container: 'text-xs',
    header: 'h-8 px-2',
    cell: 'h-8 px-2',
    rowHeight: 32,
    fontSize: 'text-xs',
    padding: 'px-2 py-1',
  },
  md: {
    container: 'text-sm',
    header: 'h-10 px-3',
    cell: 'h-10 px-3',
    rowHeight: 40,
    fontSize: 'text-sm',
    padding: 'px-3 py-2',
  },
  lg: {
    container: 'text-base',
    header: 'h-12 px-4',
    cell: 'h-12 px-4',
    rowHeight: 48,
    fontSize: 'text-base',
    padding: 'px-4 py-3',
  },
};

// Variant configurations
export interface DataGridVariantConfig {
  container: string;
  header: string;
  headerCell: string;
  row: string;
  cell: string;
  border: string;
}

export const defaultDataGridVariants: Record<
  DataGridVariant,
  DataGridVariantConfig
> = {
  default: {
    container: 'bg-white border border-gray-200 rounded-lg overflow-hidden',
    header: 'bg-gray-50 border-b border-gray-200',
    headerCell:
      'font-medium text-gray-900 border-r border-gray-200 last:border-r-0',
    row: 'border-b border-gray-100 hover:bg-gray-50 last:border-b-0',
    cell: 'text-gray-900 border-r border-gray-100 last:border-r-0',
    border: 'border-gray-200',
  },
  striped: {
    container: 'bg-white border border-gray-200 rounded-lg overflow-hidden',
    header: 'bg-gray-50 border-b border-gray-200',
    headerCell:
      'font-medium text-gray-900 border-r border-gray-200 last:border-r-0',
    row: 'border-b border-gray-100 even:bg-gray-50/50 hover:bg-gray-100 last:border-b-0',
    cell: 'text-gray-900 border-r border-gray-100 last:border-r-0',
    border: 'border-gray-200',
  },
  bordered: {
    container: 'bg-white border-2 border-gray-300 rounded-lg overflow-hidden',
    header: 'bg-gray-100 border-b-2 border-gray-300',
    headerCell:
      'font-semibold text-gray-900 border-r-2 border-gray-300 last:border-r-0',
    row: 'border-b border-gray-200 hover:bg-gray-50 last:border-b-0',
    cell: 'text-gray-900 border-r border-gray-200 last:border-r-0',
    border: 'border-gray-300',
  },
  minimal: {
    container: 'bg-white',
    header: 'border-b border-gray-200',
    headerCell: 'font-medium text-gray-900',
    row: 'border-b border-gray-100 hover:bg-gray-50 last:border-b-0',
    cell: 'text-gray-900',
    border: 'border-gray-200',
  },
};

// Column type renderers
export interface ColumnRenderer<T = any> {
  render: (value: any, row: T, column: DataGridColumn<T>) => ReactNode;
  sort?: (a: T, b: T, column: DataGridColumn<T>) => number;
  filter?: (value: any, filterValue: any, column: DataGridColumn<T>) => boolean;
}

// Built-in formatters
export interface DataGridFormatters {
  fileSize: (bytes: number) => string;
  duration: (milliseconds: number) => string;
  date: (date: Date | string, format?: string) => string;
  number: (value: number, decimals?: number) => string;
  percentage: (value: number) => string;
  boolean: (value: boolean, trueText?: string, falseText?: string) => string;
}

// Context menu configuration
export interface ContextMenuConfig<T = any> {
  items: ContextMenuItem<T>[];
  trigger?: 'rightClick' | 'longPress';
}

export interface ContextMenuItem<T = any> {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean | ((row: T) => boolean);
  divider?: boolean;
  submenu?: ContextMenuItem<T>[];
  onClick: (row: T, rowIndex: number) => void;
}

// Bulk action configuration
export interface BulkActionsConfig<T = any> {
  actions: BulkAction<T>[];
  position?: 'top' | 'bottom' | 'both';
}

export interface BulkAction<T = any> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'destructive';
  disabled?: boolean | ((selectedRows: T[]) => boolean);
  confirm?: {
    title: string;
    message: string;
  };
  onClick: (selectedRows: T[]) => void | Promise<void>;
}

// Export configuration
export interface ExportConfig<T = any> {
  formats: ExportFormat[];
  filename?: string;
  transform?: (data: T[]) => any[];
}

export interface ExportFormat {
  id: string;
  label: string;
  mimeType: string;
  extension: string;
  exporter: (data: any[], columns: DataGridColumn[]) => string | Blob;
}

// Column visibility configuration
export interface ColumnVisibilityConfig {
  hiddenColumns: Set<string>;
  onVisibilityChange: (columnId: string, visible: boolean) => void;
}

// Search configuration
export interface SearchConfig {
  enabled: boolean;
  placeholder?: string;
  searchKeys?: string[];
  debounceMs?: number;
  caseSensitive?: boolean;
  highlightMatches?: boolean;
}

// Density configuration
export type DataGridDensity = 'compact' | 'standard' | 'comfortable';

// Performance optimization
export interface PerformanceConfig {
  virtualization?: boolean;
  lazyLoading?: boolean;
  memoizeRows?: boolean;
  debounceSearch?: number;
  throttleScroll?: number;
}

// File-specific types for scan monitoring
export interface FileEntry {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  extension?: string;
  mimeType?: string;
  dateCreated: Date;
  dateModified: Date;
  dateAccessed?: Date;
  permissions?: string;
  owner?: string;
  group?: string;
  isHidden?: boolean;
  isSymlink?: boolean;
  target?: string;
  checksum?: string;
  scanId?: string;
  metadata?: Record<string, any>;
}

export interface ScanResult {
  id: string;
  volumeId: string;
  scanId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: 'volume_scan' | 'filesystem_indexing' | 'media_enrichment';
  progress: number;
  startTime: Date;
  endTime?: Date;
  filesFound: number;
  filesProcessed: number;
  errorsCount: number;
  warnings: string[];
  errors: string[];
  totalSize: number;
  processedSize: number;
  speed: number;
  estimatedCompletion?: Date;
}

// Advanced features
export interface AdvancedDataGridFeatures<T = any> {
  grouping?: {
    enabled: boolean;
    groupBy?: keyof T | string;
    expandedGroups?: Set<string>;
    onGroupToggle?: (groupKey: string, expanded: boolean) => void;
    groupRenderer?: (
      groupKey: string,
      groupData: T[],
      isExpanded: boolean,
    ) => ReactNode;
  };

  aggregation?: {
    enabled: boolean;
    aggregators: Record<string, (values: any[]) => any>;
    showInFooter?: boolean;
    showInGroups?: boolean;
  };

  columnReordering?: {
    enabled: boolean;
    onReorder?: (sourceIndex: number, targetIndex: number) => void;
  };

  columnResizing?: {
    enabled: boolean;
    onResize?: (columnId: string, width: number) => void;
  };

  rowReordering?: {
    enabled: boolean;
    onReorder?: (sourceIndex: number, targetIndex: number) => void;
  };
}

// Helper types
export type DataGridColumnConfig<T> = Partial<DataGridColumn<T>>;
export type DataGridRowConfig<T> = Partial<DataGridRow<T>>;

/**
 * Utility types for common scan monitoring use cases
 */
export type FileDataGridProps = DataGridProps<FileEntry>;
export type ScanResultDataGridProps = DataGridProps<ScanResult>;

/**
 * Common column configurations for scan monitoring
 */
export interface ScanMonitoringColumns {
  fileColumns: DataGridColumn<FileEntry>[];
  scanResultColumns: DataGridColumn<ScanResult>[];
  volumeColumns: DataGridColumn<any>[];
}
