/**
 * useVolumeSelection Hook
 *
 * Manages multi-selection state for volumes with utilities for:
 * - Single item selection/deselection
 * - Select all/deselect all
 * - Partial selection state
 * - Clear selection
 * - Get selected items
 *
 * Compatible with both array-based and Set-based selection patterns.
 */

import { useState, useCallback } from 'react';

export interface UseVolumeSelectionOptions {
  /**
   * Initial selected volume IDs
   */
  initialSelection?: string[];

  /**
   * Callback when selection changes
   */
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface UseVolumeSelectionReturn {
  /**
   * Currently selected volume IDs as array
   */
  selectedIds: string[];

  /**
   * Set selected IDs directly
   */
  setSelectedIds: (ids: string[]) => void;

  /**
   * Toggle selection for a single volume
   */
  toggleSelection: (volumeId: string) => void;

  /**
   * Select all volumes from provided list
   */
  selectAll: (volumes: Array<{ name: string }>) => void;

  /**
   * Toggle between select all and deselect all
   */
  toggleSelectAll: (volumes: Array<{ name: string }>) => void;

  /**
   * Deselect all volumes
   */
  clearSelection: () => void;

  /**
   * Check if a specific volume is selected
   */
  isSelected: (volumeId: string) => boolean;

  /**
   * Check if all provided volumes are selected
   */
  isAllSelected: (volumes: Array<{ name: string }>) => boolean;

  /**
   * Check if some (but not all) volumes are selected
   */
  isPartiallySelected: (volumes: Array<{ name: string }>) => boolean;

  /**
   * Number of selected volumes
   */
  selectedCount: number;

  /**
   * Whether any volumes are selected
   */
  hasSelection: boolean;

  /**
   * Get selected volume objects from a list
   */
  getSelectedVolumes: <T extends { name: string }>(volumes: T[]) => T[];
}

/**
 * Custom hook for managing volume selection state
 */
export const useVolumeSelection = (
  options: UseVolumeSelectionOptions = {}
): UseVolumeSelectionReturn => {
  const { initialSelection = [], onSelectionChange } = options;

  const [selectedIds, setSelectedIdsInternal] = useState<string[]>(initialSelection);

  // Wrapper to call onChange callback
  const setSelectedIds = useCallback(
    (ids: string[]) => {
      setSelectedIdsInternal(ids);
      onSelectionChange?.(ids);
    },
    [onSelectionChange]
  );

  const toggleSelection = useCallback(
    (volumeId: string) => {
      setSelectedIdsInternal((prev: string[]) =>
        prev.includes(volumeId)
          ? prev.filter((id: string) => id !== volumeId)
          : [...prev, volumeId]
      );
      const newSelection = selectedIds.includes(volumeId)
        ? selectedIds.filter((id: string) => id !== volumeId)
        : [...selectedIds, volumeId];
      onSelectionChange?.(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  const selectAll = useCallback(
    (volumes: Array<{ name: string }>) => {
      setSelectedIds(volumes.map((v) => v.name));
    },
    [setSelectedIds]
  );

  const toggleSelectAll = useCallback(
    (volumes: Array<{ name: string }>) => {
      if (selectedIds.length === volumes.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(volumes.map((v) => v.name));
      }
    },
    [selectedIds.length, setSelectedIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  const isSelected = useCallback(
    (volumeId: string) => {
      return selectedIds.includes(volumeId);
    },
    [selectedIds]
  );

  const isAllSelected = useCallback(
    (volumes: Array<{ name: string }>) => {
      return volumes.length > 0 && selectedIds.length === volumes.length;
    },
    [selectedIds]
  );

  const isPartiallySelected = useCallback(
    (volumes: Array<{ name: string }>) => {
      return selectedIds.length > 0 && selectedIds.length < volumes.length;
    },
    [selectedIds]
  );

  const selectedCount = selectedIds.length;
  const hasSelection = selectedCount > 0;

  const getSelectedVolumes = useCallback(
    <T extends { name: string }>(volumes: T[]): T[] => {
      return volumes.filter((v) => selectedIds.includes(v.name));
    },
    [selectedIds]
  );

  return {
    selectedIds,
    setSelectedIds,
    toggleSelection,
    selectAll,
    toggleSelectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectedCount,
    hasSelection,
    getSelectedVolumes,
  };
};

export default useVolumeSelection;
