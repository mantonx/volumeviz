import type { Volume } from '@/api/generated/volumeviz-api';
import { VolumesList } from '@/components/VolumesList';
import { useUrlState } from '@/hooks/useUrlState';
import type { VolumeFilters, VolumeSortConfig } from '@/store/atoms/volumes';
import { volumeFiltersAtom, volumeSortAtom } from '@/store/atoms/volumes';
import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

interface VolumesPageProps {
  onVolumeSelect?: (volume: Volume) => void;
}

export function VolumesPage({ onVolumeSelect }: VolumesPageProps) {
  const [volumeFilters, setVolumeFilters] = useAtom(volumeFiltersAtom);
  const [volumeSort, setVolumeSort] = useAtom(volumeSortAtom);

  // URL state for filters
  const [urlSearch, setUrlSearch] = useUrlState<string>('search', {
    defaultValue: '',
    serialize: (value) => value || '',
    deserialize: (value) => value || '',
  });

  const [urlStatus, setUrlStatus] = useUrlState<string>('status', {
    defaultValue: '',
    serialize: (value) => value || '',
    deserialize: (value) => value || '',
  });

  const [urlDriver, setUrlDriver] = useUrlState<string>('driver', {
    defaultValue: '',
    serialize: (value) => value || '',
    deserialize: (value) => value || '',
  });

  // URL state for sorting
  const [urlSortField, setUrlSortField] = useUrlState<string>('sortBy', {
    defaultValue: 'name',
    serialize: (value) => value || 'name',
    deserialize: (value) => value || 'name',
  });

  const [urlSortDirection, setUrlSortDirection] = useUrlState<string>(
    'sortDir',
    {
      defaultValue: 'asc',
      serialize: (value) => value || 'asc',
      deserialize: (value) => value || 'asc',
    },
  );

  // Sync URL state with Jotai atoms
  useEffect(() => {
    const newFilters: VolumeFilters = {};

    if (urlSearch) newFilters.name = urlSearch;
    if (urlStatus && urlStatus !== 'all')
      newFilters.status = urlStatus as 'active' | 'inactive';
    if (urlDriver && urlDriver !== 'all') newFilters.driver = urlDriver;

    // Only update if filters have changed
    if (JSON.stringify(newFilters) !== JSON.stringify(volumeFilters)) {
      setVolumeFilters(newFilters);
    }
  }, [urlSearch, urlStatus, urlDriver, volumeFilters, setVolumeFilters]);

  useEffect(() => {
    const newSort: VolumeSortConfig = {
      field: (urlSortField as VolumeSortConfig['field']) || 'name',
      direction: (urlSortDirection as 'asc' | 'desc') || 'asc',
    };

    if (JSON.stringify(newSort) !== JSON.stringify(volumeSort)) {
      setVolumeSort(newSort);
    }
  }, [urlSortField, urlSortDirection, volumeSort, setVolumeSort]);

  // Handle URL updates when filters/sort change
  const handleFiltersChange = useCallback(
    (filters: VolumeFilters) => {
      setUrlSearch(filters.name || '');
      setUrlStatus(filters.status || '');
      setUrlDriver(filters.driver || '');
    },
    [setUrlSearch, setUrlStatus, setUrlDriver],
  );

  const handleSortChange = useCallback(
    (sort: VolumeSortConfig) => {
      setUrlSortField(sort.field);
      setUrlSortDirection(sort.direction);
    },
    [setUrlSortField, setUrlSortDirection],
  );

  const handleScanComplete = useCallback((volume: Volume, scanResult: any) => {
    console.log('Scan completed for volume:', volume.name, scanResult);
    // Could show a toast notification here
  }, []);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Volume Management
        </h1>
        <p className="mt-2 text-gray-600">
          Manage Docker volumes, run scans, and monitor storage usage.
        </p>
      </div>

      <VolumesList
        onVolumeSelect={onVolumeSelect}
        onScanComplete={handleScanComplete}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
