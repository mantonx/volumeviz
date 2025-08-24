export interface VolumeListHeaderProps {
  // Search
  /** Current search query */
  searchQuery: string;
  /** Handler for search query changes */
  onSearchChange: (query: string) => void;

  // View controls
  /** Current view mode */
  viewMode: 'table' | 'cards';
  /** Handler for view mode changes */
  onViewModeChange: (mode: 'table' | 'cards') => void;

  // Filters
  /** Number of active filters */
  filterCount: number;
  /** Whether filters panel is shown */
  showFilters: boolean;
  /** Handler to toggle filters panel */
  onToggleFilters: () => void;

  // Column config
  /** Whether column config panel is shown */
  showColumnConfig: boolean;
  /** Handler to toggle column config panel */
  onToggleColumnConfig: () => void;
  /** Number of visible columns */
  visibleColumnsCount: number;
  /** Total number of available columns */
  totalColumnsCount: number;

  // Actions
  /** Handler for refresh action */
  onRefresh: () => void;
  /** Handler for export action */
  onExport: () => void;
  /** Handler to show keyboard shortcuts */
  onShowKeyboardHelp: () => void;
  /** Handler to discover new volumes */
  onDiscoverVolumes: () => void;

  // State
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Total number of volumes */
  totalVolumes?: number;

  /** Additional CSS classes */
  className?: string;
}
