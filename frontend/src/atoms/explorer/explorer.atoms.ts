import { atom } from 'jotai';
import type { 
  FileItem, 
  TreeNode, 
  NavigationState, 
  ViewMode, 
  SortConfig, 
  ExplorerFilters,
  BreadcrumbItem 
} from './explorer.types';

// Current volume atom
export const currentVolumeAtom = atom<string | null>(null);

// Current path atom  
export const currentPathAtom = atom<string>('/');

// Explorer files atom
export const explorerFilesAtom = atom<FileItem[]>([]);

// Explorer tree atom
export const explorerTreeAtom = atom<TreeNode[]>([]);

// Explorer loading state
export const explorerLoadingAtom = atom<boolean>(false);

// Selected files atom (updated to use Set for better performance)
export const selectedFilesAtom = atom<Set<string>>(new Set());

// View mode atom
export const explorerViewModeAtom = atom<ViewMode>('list');

// Sort configuration atom
export const explorerSortConfigAtom = atom<SortConfig>({
  field: 'name',
  direction: 'asc'
});

// Search query atom
export const explorerSearchQueryAtom = atom<string>('');

// Explorer filters atom
export const explorerFiltersAtom = atom<ExplorerFilters>({
  fileTypes: new Set(),
  sizeRange: { min: null, max: null },
  dateRange: { from: null, to: null },
  showHidden: false
});

// Breadcrumb path atom
export const explorerBreadcrumbAtom = atom<BreadcrumbItem[]>([
  { name: 'Root', path: '/', isClickable: true }
]);

// Undo/Rollback overlay visibility atom
export const undoRollbackVisibleAtom = atom<boolean>(false);

// Export dialog visibility atom
export const exportDialogVisibleAtom = atom<boolean>(false);

// Derived navigation state atom (read-only)
export const explorerNavigationStateAtom = atom<NavigationState>((get) => ({
  volumeId: get(currentVolumeAtom),
  path: get(currentPathAtom),
  viewMode: get(explorerViewModeAtom),
  sortConfig: get(explorerSortConfigAtom),
  selectedIds: get(selectedFilesAtom),
  searchQuery: get(explorerSearchQueryAtom),
  filters: get(explorerFiltersAtom),
  breadcrumbPath: get(explorerBreadcrumbAtom)
}));

// Navigation actions atom
export const explorerNavigationActionsAtom = atom(
  null,
  (get, set, action: NavigationAction) => {
    switch (action.type) {
      case 'SET_VOLUME':
        set(currentVolumeAtom, action.payload);
        set(currentPathAtom, '/');
        set(selectedFilesAtom, new Set());
        set(explorerBreadcrumbAtom, [
          { name: 'Root', path: '/', isClickable: true }
        ]);
        break;
        
      case 'NAVIGATE_TO_PATH':
        set(currentPathAtom, action.payload.path);
        set(explorerBreadcrumbAtom, action.payload.breadcrumb);
        set(selectedFilesAtom, new Set());
        break;
        
      case 'SET_VIEW_MODE':
        set(explorerViewModeAtom, action.payload);
        break;
        
      case 'SET_SORT_CONFIG':
        set(explorerSortConfigAtom, action.payload);
        break;
        
      case 'SET_SEARCH_QUERY':
        set(explorerSearchQueryAtom, action.payload);
        break;
        
      case 'SET_FILTERS':
        set(explorerFiltersAtom, action.payload);
        break;
        
      case 'TOGGLE_SELECTION':
        const currentSelection = get(selectedFilesAtom);
        const newSelection = new Set(currentSelection);
        if (newSelection.has(action.payload)) {
          newSelection.delete(action.payload);
        } else {
          newSelection.add(action.payload);
        }
        set(selectedFilesAtom, newSelection);
        break;
        
      case 'SET_SELECTION':
        set(selectedFilesAtom, new Set(action.payload));
        break;
        
      case 'CLEAR_SELECTION':
        set(selectedFilesAtom, new Set());
        break;
        
      case 'BACK':
        const currentPath = get(currentPathAtom);
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        const breadcrumbs = get(explorerBreadcrumbAtom);
        const newBreadcrumbs = breadcrumbs.slice(0, -1);
        
        set(currentPathAtom, parentPath);
        set(explorerBreadcrumbAtom, newBreadcrumbs);
        set(selectedFilesAtom, new Set());
        break;
        
      case 'TOGGLE_UNDO_ROLLBACK':
        const currentVisible = get(undoRollbackVisibleAtom);
        set(undoRollbackVisibleAtom, !currentVisible);
        break;
        
      case 'TOGGLE_EXPORT_DIALOG':
        const currentExportVisible = get(exportDialogVisibleAtom);
        set(exportDialogVisibleAtom, !currentExportVisible);
        break;
    }
  }
);

// Navigation action types
export type NavigationAction =
  | { type: 'SET_VOLUME'; payload: string | null }
  | { type: 'NAVIGATE_TO_PATH'; payload: { path: string; breadcrumb: BreadcrumbItem[] } }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SORT_CONFIG'; payload: SortConfig }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTERS'; payload: ExplorerFilters }
  | { type: 'TOGGLE_SELECTION'; payload: string }
  | { type: 'SET_SELECTION'; payload: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BACK' }
  | { type: 'TOGGLE_UNDO_ROLLBACK' }
  | { type: 'TOGGLE_EXPORT_DIALOG' };