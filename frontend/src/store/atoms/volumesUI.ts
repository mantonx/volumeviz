import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type {
  ViewMode,
  SelectionMode,
} from '@/components/domain/VolumesList/VolumesList.types';

// UI State for VolumesList component

// View and display preferences
export const volumesViewModeAtom = atomWithStorage<ViewMode>(
  'volumeviz-volumes-view-mode',
  'table',
);
export const volumesShowFiltersAtom = atom<boolean>(false);
export const volumesShowColumnConfigAtom = atom<boolean>(false);
export const volumesShowKeyboardHelpAtom = atom<boolean>(false);

// Selection state
export const volumesSelectedIdsAtom = atom<Set<string>>(new Set());
export const volumesSelectAllModeAtom = atom<SelectionMode>('none');

// Modal and detail state
export const volumesSelectedForDetailsAtom = atom<string>('');
export const volumesShowDetailsModalAtom = atom<boolean>(false);
export const volumesShowSelectDropdownAtom = atom<boolean>(false);

// Progress tracking state
export const volumesWithDetailedProgressAtom = atom<Set<string>>(new Set());

// Search and filtering state (separate from the main volume filters)
export const volumesSearchQueryAtom = atom<string>('');

// Column visibility (stored persistently)
export const volumesVisibleColumnsAtom = atomWithStorage<string[]>(
  'volumeviz-volumes-visible-columns',
  [
    'name',
    'type',
    'compose_project',
    'containers',
    'status',
    'size_bytes',
    'last_seen',
  ],
);

// Bulk actions UI state
export const volumesBulkActionsVisibleAtom = atom<boolean>((get) => {
  return get(volumesSelectedIdsAtom).size > 0;
});

// Selection helpers (computed)
export const volumesSelectedCountAtom = atom<number>((get) => {
  return get(volumesSelectedIdsAtom).size;
});

export const volumesHasSelectionAtom = atom<boolean>((get) => {
  return get(volumesSelectedCountAtom) > 0;
});

// Selection actions (write-only atoms)
export const volumesToggleSelectionAtom = atom(null, (get, set, id: string) => {
  const currentSelected = get(volumesSelectedIdsAtom);
  const newSelected = new Set(currentSelected);

  if (newSelected.has(id)) {
    newSelected.delete(id);
  } else {
    newSelected.add(id);
  }

  set(volumesSelectedIdsAtom, newSelected);

  // Reset select all mode if manually toggling
  if (newSelected.size === 0) {
    set(volumesSelectAllModeAtom, 'none');
  }
});

export const volumesClearSelectionAtom = atom(null, (get, set) => {
  set(volumesSelectedIdsAtom, new Set());
  set(volumesSelectAllModeAtom, 'none');
  set(volumesShowSelectDropdownAtom, false);
});

export const volumesSelectAllAtom = atom(
  null,
  (get, set, volumeIds: string[]) => {
    const newSelected = new Set(volumeIds);
    set(volumesSelectedIdsAtom, newSelected);
    set(volumesSelectAllModeAtom, 'all');
  },
);

export const volumesSelectPageAtom = atom(
  null,
  (get, set, volumeIds: string[]) => {
    const newSelected = new Set(volumeIds);
    set(volumesSelectedIdsAtom, newSelected);
    set(volumesSelectAllModeAtom, 'page');
  },
);

// Column visibility actions
export const volumesToggleColumnAtom = atom(
  null,
  (get, set, columnKey: string) => {
    const currentColumns = get(volumesVisibleColumnsAtom);
    const newColumns = currentColumns.includes(columnKey)
      ? currentColumns.filter((col) => col !== columnKey)
      : [...currentColumns, columnKey];

    set(volumesVisibleColumnsAtom, newColumns);
  },
);

// Progress tracking actions
export const volumesAddDetailedProgressAtom = atom(
  null,
  (get, set, volumeId: string) => {
    const current = get(volumesWithDetailedProgressAtom);
    const newSet = new Set(current);
    newSet.add(volumeId);
    set(volumesWithDetailedProgressAtom, newSet);
  },
);

export const volumesRemoveDetailedProgressAtom = atom(
  null,
  (get, set, volumeId: string) => {
    const current = get(volumesWithDetailedProgressAtom);
    const newSet = new Set(current);
    newSet.delete(volumeId);
    set(volumesWithDetailedProgressAtom, newSet);
  },
);

// Combined UI state atom for easier consumption
export const volumesUIStateAtom = atom((get) => ({
  // View preferences
  viewMode: get(volumesViewModeAtom),
  showFilters: get(volumesShowFiltersAtom),
  showColumnConfig: get(volumesShowColumnConfigAtom),
  showKeyboardHelp: get(volumesShowKeyboardHelpAtom),

  // Selection state
  selectedIds: get(volumesSelectedIdsAtom),
  selectAllMode: get(volumesSelectAllModeAtom),
  selectedCount: get(volumesSelectedCountAtom),
  hasSelection: get(volumesHasSelectionAtom),

  // Modal and detail state
  selectedForDetails: get(volumesSelectedForDetailsAtom),
  showDetailsModal: get(volumesShowDetailsModalAtom),
  showSelectDropdown: get(volumesShowSelectDropdownAtom),

  // Progress tracking
  volumesWithDetailedProgress: get(volumesWithDetailedProgressAtom),

  // Search and columns
  searchQuery: get(volumesSearchQueryAtom),
  visibleColumns: get(volumesVisibleColumnsAtom),
}));
