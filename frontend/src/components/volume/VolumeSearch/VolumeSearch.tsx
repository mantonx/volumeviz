import React, { useState } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { VolumeDriver } from '../../../types/api';
import { Badge } from '../../ui/Badge';
import { clsx } from 'clsx';
import { useDebounce } from '../../../hooks/useDebounce';

export interface VolumeSearchFilters {
  query: string;
  drivers: VolumeDriver[];
  minSize?: number;
  maxSize?: number;
  mounted?: boolean;
  unmounted?: boolean;
}

export interface VolumeSearchProps {
  filters: VolumeSearchFilters;
  onFiltersChange: (filters: VolumeSearchFilters) => void;
  totalVolumes?: number;
  filteredVolumes?: number;
  showAdvanced?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Search and filter component for Docker volumes in VolumeViz.
 *
 * Features:
 * - Real-time search with debouncing
 * - Driver type filtering
 * - Size range filtering
 * - Mount status filtering
 * - Clear filters functionality
 * - Result count display
 * - Collapsible advanced filters
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useState<VolumeSearchFilters>({
 *   query: '',
 *   drivers: [],
 * });
 *
 * <VolumeSearch
 *   filters={filters}
 *   onFiltersChange={setFilters}
 *   totalVolumes={volumes.length}
 *   filteredVolumes={filteredVolumes.length}
 *   showAdvanced
 * />
 * ```
 */
export const VolumeSearch: React.FC<VolumeSearchProps> = ({
  filters,
  onFiltersChange,
  totalVolumes,
  filteredVolumes,
  showAdvanced = false,
  placeholder = 'Search volumes...',
  className,
}) => {
  const [localQuery, setLocalQuery] = useState(filters.query);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedQuery = useDebounce(localQuery, 300);

  React.useEffect(() => {
    if (debouncedQuery !== filters.query) {
      onFiltersChange({ ...filters, query: debouncedQuery });
    }
  }, [debouncedQuery, filters, onFiltersChange]);

  const handleQueryChange = (value: string) => {
    setLocalQuery(value);
  };

  const handleDriverToggle = (driver: VolumeDriver) => {
    const newDrivers = filters.drivers.includes(driver)
      ? filters.drivers.filter((d) => d !== driver)
      : [...filters.drivers, driver];
    onFiltersChange({ ...filters, drivers: newDrivers });
  };

  const handleClearFilters = () => {
    setLocalQuery('');
    onFiltersChange({
      query: '',
      drivers: [],
      minSize: undefined,
      maxSize: undefined,
      mounted: undefined,
      unmounted: undefined,
    });
  };

  const hasActiveFilters =
    filters.query ||
    filters.drivers.length > 0 ||
    filters.minSize !== undefined ||
    filters.maxSize !== undefined ||
    filters.mounted !== undefined ||
    filters.unmounted !== undefined;

  const availableDrivers: VolumeDriver[] = ['local', 'nfs', 'cifs', 'tmpfs'];

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className={clsx(
              'w-full pl-10 pr-10 py-2 rounded-lg border',
              'bg-white dark:bg-gray-800',
              'border-gray-300 dark:border-gray-600',
              'focus:border-blue-500 dark:focus:border-blue-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            )}
          />
          {localQuery && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showAdvanced && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg border',
              'bg-white dark:bg-gray-800',
              'border-gray-300 dark:border-gray-600',
              'hover:bg-gray-50 dark:hover:bg-gray-700',
              'transition-colors',
              hasActiveFilters && 'border-blue-500 dark:border-blue-400',
            )}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <Badge variant="primary" size="sm">
                {filters.drivers.length +
                  (filters.minSize !== undefined ? 1 : 0) +
                  (filters.maxSize !== undefined ? 1 : 0) +
                  (filters.mounted !== undefined ? 1 : 0) +
                  (filters.unmounted !== undefined ? 1 : 0)}
              </Badge>
            )}
            <ChevronDown
              className={clsx(
                'w-4 h-4 transition-transform',
                showFilters && 'rotate-180',
              )}
            />
          </button>
        )}

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        )}
      </div>

      {showAdvanced && showFilters && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
          {/* Driver filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Driver Type
            </label>
            <div className="flex flex-wrap gap-2">
              {availableDrivers.map((driver) => (
                <button
                  key={driver}
                  onClick={() => handleDriverToggle(driver)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md border transition-colors',
                    filters.drivers.includes(driver)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
                  )}
                >
                  {driver}
                </button>
              ))}
            </div>
          </div>

          {/* Size filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Size (MB)
              </label>
              <input
                type="number"
                value={filters.minSize ? filters.minSize / 1048576 : ''}
                onChange={(e) => {
                  const value = e.target.value
                    ? parseInt(e.target.value) * 1048576
                    : undefined;
                  onFiltersChange({ ...filters, minSize: value });
                }}
                placeholder="0"
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Size (MB)
              </label>
              <input
                type="number"
                value={filters.maxSize ? filters.maxSize / 1048576 : ''}
                onChange={(e) => {
                  const value = e.target.value
                    ? parseInt(e.target.value) * 1048576
                    : undefined;
                  onFiltersChange({ ...filters, maxSize: value });
                }}
                placeholder="∞"
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Mount status filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mount Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.mounted === true}
                  onChange={(e) => {
                    onFiltersChange({
                      ...filters,
                      mounted: e.target.checked ? true : undefined,
                      unmounted: e.target.checked
                        ? undefined
                        : filters.unmounted,
                    });
                  }}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Mounted only</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.unmounted === true}
                  onChange={(e) => {
                    onFiltersChange({
                      ...filters,
                      unmounted: e.target.checked ? true : undefined,
                      mounted: e.target.checked ? undefined : filters.mounted,
                    });
                  }}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Unmounted only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {totalVolumes !== undefined && filteredVolumes !== undefined && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredVolumes} of {totalVolumes} volumes
          {hasActiveFilters && ' (filtered)'}
        </div>
      )}
    </div>
  );
};
