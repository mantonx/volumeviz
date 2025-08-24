import { useState, useCallback, useMemo } from 'react';
import type { VolumeMount } from '../useVolumesAndMounts';

export type SelectionMode = 'none' | 'page' | 'all';

export interface UseVolumeSelectionReturn {
  selectedIds: Set<string>;
  selectAllMode: SelectionMode;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string) => void;
  selectAll: (volumes: VolumeMount[]) => void;
  selectPage: (volumes: VolumeMount[]) => void;
  clearSelection: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  selectedCount: number;
  hasSelection: boolean;
}

/**
 * Hook for managing volume selection state
 * Handles individual, page, and all selection modes
 */
export const useVolumeSelection = (
  initialSelection: Set<string> = new Set(),
): UseVolumeSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection);
  const [selectAllMode, setSelectAllMode] = useState<SelectionMode>('none');

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      // Reset select all mode if manually toggling
      if (newSet.size === 0) {
        setSelectAllMode('none');
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((volumes: VolumeMount[]) => {
    const allIds = new Set(volumes.map((v) => v.id));
    setSelectedIds(allIds);
    setSelectAllMode('all');
  }, []);

  const selectPage = useCallback((volumes: VolumeMount[]) => {
    const pageIds = new Set(volumes.map((v) => v.id));
    setSelectedIds(pageIds);
    setSelectAllMode('page');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMode('none');
  }, []);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const hasSelection = useMemo(() => selectedCount > 0, [selectedCount]);

  return {
    selectedIds,
    selectAllMode,
    isSelected,
    toggleSelection,
    selectAll,
    selectPage,
    clearSelection,
    setSelectedIds,
    selectedCount,
    hasSelection,
  };
};

export default useVolumeSelection;
