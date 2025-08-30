import { useAtomValue, useSetAtom } from 'jotai';
import {
  volumesUIStateAtom,
  volumesViewModeAtom,
  volumesShowFiltersAtom,
  volumesShowColumnConfigAtom,
  volumesShowKeyboardHelpAtom,
  volumesToggleSelectionAtom,
  volumesClearSelectionAtom,
  volumesSelectAllAtom,
  volumesSelectPageAtom,
  volumesToggleColumnAtom,
} from '@/store';

/**
 * Hook to access and manage the VolumesList UI state using Jotai atoms
 * Provides a clean interface for components to interact with volume UI state
 */
export const useVolumeUIState = () => {
  // Get the combined UI state
  const uiState = useAtomValue(volumesUIStateAtom);

  // Get action setters
  const toggleSelection = useSetAtom(volumesToggleSelectionAtom);
  const clearSelection = useSetAtom(volumesClearSelectionAtom);
  const selectAll = useSetAtom(volumesSelectAllAtom);
  const selectPage = useSetAtom(volumesSelectPageAtom);
  const toggleColumn = useSetAtom(volumesToggleColumnAtom);

  // Get individual state setters for direct updates
  const setViewMode = useSetAtom(volumesViewModeAtom);
  const setShowFilters = useSetAtom(volumesShowFiltersAtom);
  const setShowColumnConfig = useSetAtom(volumesShowColumnConfigAtom);
  const setShowKeyboardHelp = useSetAtom(volumesShowKeyboardHelpAtom);

  return {
    // Current state
    ...uiState,

    // Selection actions
    toggleSelection,
    clearSelection,
    selectAll,
    selectPage,

    // UI actions
    setViewMode,
    setShowFilters,
    setShowColumnConfig,
    setShowKeyboardHelp,
    toggleColumn,
  };
};

export default useVolumeUIState;
