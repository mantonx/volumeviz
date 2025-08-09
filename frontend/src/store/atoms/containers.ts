import { atom } from 'jotai';
import { VolumeAttachedContainer, ContainerFilters, SortConfig } from '@/types';

/**
 * Primary container data storage atom.
 */
export const containersAtom = atom<VolumeAttachedContainer[]>([]);

/**
 * Container loading state.
 */
export const containersLoadingAtom = atom<boolean>(false);

/**
 * Container fetch errors.
 */
export const containersErrorAtom = atom<string | null>(null);

/**
 * Container list filters.
 */
export const containerFiltersAtom = atom<ContainerFilters>({});

/**
 * Container sorting configuration.
 */
export const containerSortAtom = atom<SortConfig>({
  field: 'name',
  direction: 'asc',
});

/**
 * Computed filtered and sorted containers.
 */
export const filteredContainersAtom = atom<VolumeAttachedContainer[]>((get) => {
  const containers = get(containersAtom);
  const filters = get(containerFiltersAtom);
  const sortConfig = get(containerSortAtom);

  // Apply filters
  let filtered = containers.filter((container) => {
    // Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(container.status)) {
        return false;
      }
    }

    // Name filter
    if (filters.name) {
      if (!container.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    const aValue = a[sortConfig.field];
    const bValue = b[sortConfig.field];

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortConfig.direction === 'desc' ? -comparison : comparison;
  });

  return filtered;
});

/**
 * Computed container statistics summary.
 */
export const containerStatsAtom = atom((get) => {
  const containers = get(containersAtom);

  const stats = containers.reduce(
    (acc, container) => {
      acc.total += 1;
      if (container.status === 'running') {
        acc.running += 1;
      } else if (container.status === 'stopped') {
        acc.stopped += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { total: 0, running: 0, stopped: 0, unknown: 0 },
  );

  return stats;
});
