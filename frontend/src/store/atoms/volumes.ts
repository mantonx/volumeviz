import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type {
  VolumeListResponse,
  VolumeResponse,
  ScanResponse,
  AsyncScanResponse,
} from '@/api/client';

// Types for volume state management
export interface VolumeFilters {
  driver?: string;
  name?: string;
  label?: Record<string, string>;
  status?: 'active' | 'inactive';
}

export interface VolumeSortConfig {
  field: 'name' | 'driver' | 'created_at' | 'size';
  direction: 'asc' | 'desc';
}

export interface VolumeState {
  volumes: VolumeResponse[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface ScanState {
  loading: boolean;
  error: string | null;
  results: Record<string, ScanResponse>;
  asyncScans: Record<string, AsyncScanResponse>;
}

// Primary volume state atoms
export const volumesAtom = atom<VolumeResponse[]>([]);
export const volumesLoadingAtom = atom<boolean>(false);
export const volumesErrorAtom = atom<string | null>(null);
export const volumesLastUpdatedAtom = atom<Date | null>(null);

// Volume filters and sorting
export const volumeFiltersAtom = atom<VolumeFilters>({});
export const volumeSortAtom = atom<VolumeSortConfig>({
  field: 'name',
  direction: 'asc',
});

// Scan state atoms
export const scanLoadingAtom = atom<Record<string, boolean>>({});
export const scanErrorAtom = atom<Record<string, string | null>>({});
export const scanResultsAtom = atom<Record<string, ScanResponse>>({});
export const asyncScansAtom = atom<Record<string, AsyncScanResponse>>({});

// Auto-refresh settings
export const autoRefreshEnabledAtom = atomWithStorage(
  'volumeviz-auto-refresh',
  true,
);
export const autoRefreshIntervalAtom = atomWithStorage(
  'volumeviz-refresh-interval',
  30000,
); // 30 seconds

// Computed filtered and sorted volumes
export const filteredVolumesAtom = atom<VolumeResponse[]>((get) => {
  const volumes = get(volumesAtom);
  const filters = get(volumeFiltersAtom);
  const sortConfig = get(volumeSortAtom);

  // Apply filters
  let filtered = volumes.filter((volume) => {
    // Driver filter
    if (filters.driver && volume.driver !== filters.driver) {
      return false;
    }

    // Name filter
    if (filters.name) {
      if (!volume.name?.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
    }

    // Status filter
    if (filters.status) {
      const isActive = volume.is_active ?? true;
      if (
        (filters.status === 'active' && !isActive) ||
        (filters.status === 'inactive' && isActive)
      ) {
        return false;
      }
    }

    // Label filters
    if (filters.label && volume.labels) {
      for (const [key, value] of Object.entries(filters.label)) {
        if (volume.labels[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortConfig.field) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'driver':
        aValue = a.driver || '';
        bValue = b.driver || '';
        break;
      case 'created_at':
        aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
        bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
        break;
      case 'size': {
        // Get size from scan results
        const scanResults = get(scanResultsAtom);
        aValue = scanResults[a.volume_id || a.id || '']?.result?.total_size || 0;
        bValue = scanResults[b.volume_id || b.id || '']?.result?.total_size || 0;
        break;
      }
      default:
        aValue = String(a[sortConfig.field] || '');
        bValue = String(b[sortConfig.field] || '');
    }

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

// Computed volume statistics
export const volumeStatsAtom = atom((get) => {
  const volumes = get(volumesAtom);
  const scanResults = get(scanResultsAtom);

  const stats = volumes.reduce(
    (acc, volume) => {
      acc.total += 1;

      if (volume.is_active) {
        acc.active += 1;
      } else {
        acc.inactive += 1;
      }

      // Driver counts
      if (volume.driver) {
        acc.drivers[volume.driver] = (acc.drivers[volume.driver] || 0) + 1;
      }

      // Size calculation
      const scanResult = scanResults[volume.volume_id || volume.id || ''];
      if (scanResult?.result?.total_size) {
        acc.totalSize += scanResult.result.total_size;
      }

      return acc;
    },
    {
      total: 0,
      active: 0,
      inactive: 0,
      drivers: {} as Record<string, number>,
      totalSize: 0,
    },
  );

  return stats;
});

// Combined volume state for easier consumption
export const volumeStateAtom = atom<VolumeState>((get) => ({
  volumes: get(volumesAtom),
  loading: get(volumesLoadingAtom),
  error: get(volumesErrorAtom),
  lastUpdated: get(volumesLastUpdatedAtom),
}));

// Combined scan state
export const scanStateAtom = atom<ScanState>((get) => ({
  loading: Object.values(get(scanLoadingAtom)).some(Boolean),
  error: Object.values(get(scanErrorAtom)).find((err) => err !== null) || null,
  results: get(scanResultsAtom),
  asyncScans: get(asyncScansAtom),
}));

// Derived atoms for specific volumes
export const volumeByIdAtom = (volumeId: string) =>
  atom((get) => {
    const volumes = get(volumesAtom);
    return volumes.find((volume) => volume.volume_id === volumeId);
  });

export const scanResultByIdAtom = (volumeId: string) =>
  atom((get) => {
    const scanResults = get(scanResultsAtom);
    return scanResults[volumeId];
  });

export const volumeLoadingByIdAtom = (volumeId: string) =>
  atom((get) => {
    const scanLoading = get(scanLoadingAtom);
    return scanLoading[volumeId] || false;
  });
