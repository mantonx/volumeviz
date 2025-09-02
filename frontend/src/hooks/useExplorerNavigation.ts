import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import {
  explorerNavigationStateAtom,
  explorerNavigationActionsAtom,
  currentVolumeAtom,
  currentPathAtom,
  explorerViewModeAtom,
  explorerSortConfigAtom,
  explorerSearchQueryAtom,
  explorerFiltersAtom,
  selectedFilesAtom,
  explorerBreadcrumbAtom,
  undoRollbackVisibleAtom,
  exportDialogVisibleAtom,
} from '@/atoms/explorer';
import type {
  NavigationState,
  ViewMode,
  SortConfig,
  ExplorerFilters,
  BreadcrumbItem,
} from '@/atoms/explorer';

export interface UseExplorerNavigationReturn {
  // State
  navigationState: NavigationState;
  volumeId: string | null;
  path: string;
  viewMode: ViewMode;
  sortConfig: SortConfig;
  searchQuery: string;
  filters: ExplorerFilters;
  selectedIds: Set<string>;
  breadcrumb: BreadcrumbItem[];
  undoRollbackVisible: boolean;
  exportDialogVisible: boolean;
  
  // Actions
  setVolume: (volumeId: string | null) => void;
  navigateToPath: (path: string, breadcrumb?: BreadcrumbItem[]) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortConfig: (config: SortConfig) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: ExplorerFilters) => void;
  toggleSelection: (id: string) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  goBack: () => void;
  toggleUndoRollback: () => void;
  toggleExportDialog: () => void;
  
  // Derived state
  hasSelection: boolean;
  selectionCount: number;
  canGoBack: boolean;
  isSearchActive: boolean;
  hasFilters: boolean;
}

/**
 * Hook for managing explorer navigation state and actions
 * Provides synchronized navigation state management across all explorer components
 */
export function useExplorerNavigation(): UseExplorerNavigationReturn {
  // State atoms
  const navigationState = useAtomValue(explorerNavigationStateAtom);
  const volumeId = useAtomValue(currentVolumeAtom);
  const path = useAtomValue(currentPathAtom);
  const viewMode = useAtomValue(explorerViewModeAtom);
  const sortConfig = useAtomValue(explorerSortConfigAtom);
  const searchQuery = useAtomValue(explorerSearchQueryAtom);
  const filters = useAtomValue(explorerFiltersAtom);
  const selectedIds = useAtomValue(selectedFilesAtom);
  const undoRollbackVisible = useAtomValue(undoRollbackVisibleAtom);
  const exportDialogVisible = useAtomValue(exportDialogVisibleAtom);
  const breadcrumb = useAtomValue(explorerBreadcrumbAtom);
  
  // Action atom
  const dispatch = useSetAtom(explorerNavigationActionsAtom);
  
  // Actions
  const setVolume = useCallback((volumeId: string | null) => {
    dispatch({ type: 'SET_VOLUME', payload: volumeId });
  }, [dispatch]);
  
  const navigateToPath = useCallback((newPath: string, newBreadcrumb?: BreadcrumbItem[]) => {
    const breadcrumbPath = newBreadcrumb || generateBreadcrumb(newPath);
    dispatch({ 
      type: 'NAVIGATE_TO_PATH', 
      payload: { path: newPath, breadcrumb: breadcrumbPath }
    });
  }, [dispatch]);
  
  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, [dispatch]);
  
  const setSortConfig = useCallback((config: SortConfig) => {
    dispatch({ type: 'SET_SORT_CONFIG', payload: config });
  }, [dispatch]);
  
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, [dispatch]);
  
  const setFilters = useCallback((newFilters: ExplorerFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  }, [dispatch]);
  
  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', payload: id });
  }, [dispatch]);
  
  const setSelection = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTION', payload: ids });
  }, [dispatch]);
  
  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [dispatch]);
  
  const goBack = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, [dispatch]);
  
  const toggleUndoRollback = useCallback(() => {
    dispatch({ type: 'TOGGLE_UNDO_ROLLBACK' });
  }, [dispatch]);
  
  const toggleExportDialog = useCallback(() => {
    dispatch({ type: 'TOGGLE_EXPORT_DIALOG' });
  }, [dispatch]);
  
  // Derived state
  const hasSelection = selectedIds.size > 0;
  const selectionCount = selectedIds.size;
  const canGoBack = path !== '/';
  const isSearchActive = searchQuery.trim() !== '';
  const hasFilters = useMemo(() => {
    return (
      filters.fileTypes.size > 0 ||
      filters.sizeRange.min !== null ||
      filters.sizeRange.max !== null ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.showHidden
    );
  }, [filters]);
  
  return {
    // State
    navigationState,
    volumeId,
    path,
    viewMode,
    sortConfig,
    searchQuery,
    filters,
    selectedIds,
    breadcrumb,
    undoRollbackVisible,
    exportDialogVisible,
    
    // Actions
    setVolume,
    navigateToPath,
    setViewMode,
    setSortConfig,
    setSearchQuery,
    setFilters,
    toggleSelection,
    setSelection,
    clearSelection,
    goBack,
    toggleUndoRollback,
    toggleExportDialog,
    
    // Derived state
    hasSelection,
    selectionCount,
    canGoBack,
    isSearchActive,
    hasFilters,
  };
}

/**
 * Generate breadcrumb items from a path
 */
function generateBreadcrumb(path: string): BreadcrumbItem[] {
  if (path === '/') {
    return [{ name: 'Root', path: '/', isClickable: true }];
  }
  
  const segments = path.split('/').filter(Boolean);
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: 'Root', path: '/', isClickable: true }
  ];
  
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    breadcrumbItems.push({
      name: segment,
      path: currentPath,
      isClickable: true
    });
  });
  
  return breadcrumbItems;
}

/**
 * Hook for quick access to selection operations
 */
export function useExplorerSelection() {
  const selectedIds = useAtomValue(selectedFilesAtom);
  const dispatch = useSetAtom(explorerNavigationActionsAtom);
  
  const selectAll = useCallback((fileIds: string[]) => {
    dispatch({ type: 'SET_SELECTION', payload: fileIds });
  }, [dispatch]);
  
  const selectNone = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [dispatch]);
  
  const toggleItem = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', payload: id });
  }, [dispatch]);
  
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);
  
  return {
    selectedIds,
    count: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    selectAll,
    selectNone,
    toggleItem,
    isSelected,
  };
}

/**
 * Hook for view mode management
 */
export function useExplorerViewMode() {
  const [viewMode, setViewMode] = useAtom(explorerViewModeAtom);
  
  const isListView = viewMode === 'list';
  const isGridView = viewMode === 'grid';
  const isTreemapView = viewMode === 'treemap';
  
  return {
    viewMode,
    setViewMode,
    isListView,
    isGridView,
    isTreemapView,
  };
}