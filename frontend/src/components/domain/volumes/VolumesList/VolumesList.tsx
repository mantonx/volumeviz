import { organizationStatsAtom, volumeFiltersAtom } from '@/atoms';
import { useOrganization } from '@/hooks/api/useOrganization';
import { useVolumesList } from '@/hooks/api/useVolumesList';
import { useAtom, useAtomValue } from 'jotai';
import { Grid, List, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VolumeCard } from '../VolumeCard';
import { VolumeTable } from '../VolumeTable';

interface VolumesListProps {
  className?: string;
}

export function VolumesList({ className = '' }: VolumesListProps) {
  const {
    currentOrgId,
    organization,
    isLoading: orgLoading,
  } = useOrganization();
  const [filters, setFilters] = useAtom(volumeFiltersAtom);
  const { data: orgStats } = useAtomValue(organizationStatsAtom);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<string[]>([]);

  const { volumes, pagination, isLoading, refetch, isFetching } =
    useVolumesList({
      page: 1,
      pageSize: 25,
    });

  const handleSearchChange = (searchTerm: string) => {
    setFilters((prev) => ({ ...prev, searchTerm }));
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Auto-sync organization filter
  useEffect(() => {
    if (currentOrgId && filters.organizationId !== currentOrgId) {
      setFilters((prev) => ({ ...prev, organizationId: currentOrgId }));
    }
  }, [currentOrgId, filters.organizationId, setFilters]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with organization info */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Volumes
          </h1>
          {organization && (
            <p className="mt-1 text-sm text-gray-500">
              Organization: {organization.name}
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center space-x-3 md:mt-0 md:ml-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`-ml-1 mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Add Volume
          </button>
        </div>
      </div>

      {/* Organization Stats */}
      {orgStats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatsCard
            title="Total Volumes"
            value={orgStats.total_volumes || 0}
            icon="V"
            color="blue"
          />
          <StatsCard
            title="Total Size"
            value={formatBytes(orgStats.total_size || 0)}
            icon="S"
            color="green"
          />
          <StatsCard
            title="Active Users"
            value={orgStats.total_users || 0}
            icon="U"
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search volumes..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filters.status}
              onChange={(e) =>
                handleFilterChange({
                  status: e.target.value as 'all' | 'active' | 'inactive',
                })
              }
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filters.sortBy}
              onChange={(e) =>
                handleFilterChange({
                  sortBy: e.target.value as 'name' | 'size' | 'created',
                })
              }
            >
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="created">Sort by Created</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(filters.searchTerm || filters.status !== 'all') && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.searchTerm && (
              <FilterChip
                label={`Search: "${filters.searchTerm}"`}
                onRemove={() => handleSearchChange('')}
              />
            )}
            {filters.status !== 'all' && (
              <FilterChip
                label={`Status: ${filters.status}`}
                onRemove={() => handleFilterChange({ status: 'all' })}
              />
            )}
          </div>
        )}
      </div>

      {/* Volume List */}
      {viewMode === 'table' ? (
        <VolumeTable
          volumes={volumes}
          isLoading={isLoading}
          selectedVolumeIds={selectedVolumeIds}
          onSelectionChange={setSelectedVolumeIds}
          onVolumeSelect={(volume) => {
            // Handle volume selection for detailed view
            console.log('Selected volume:', volume);
          }}
          showBulkActions={true}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            // Loading skeleton for grid view
            [...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="animate-pulse">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-2 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))
          ) : volumes.length > 0 ? (
            volumes.map((volume) => (
              <VolumeCard
                key={volume.id}
                volume={volume}
                isSelected={selectedVolumeIds.includes(volume.id)}
                onSelect={(volumeId) => {
                  setSelectedVolumeIds((prev) =>
                    prev.includes(volumeId)
                      ? prev.filter((id) => id !== volumeId)
                      : [...prev, volumeId],
                  );
                }}
                showActions={true}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-500">
                <p>No volumes found</p>
                <p className="text-sm mt-2">
                  Try adjusting your filters or add a new volume.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.pageSize && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              disabled={!pagination.hasPrevious}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={!pagination.hasNext}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  )}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span>{' '}
                results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                {/* Pagination buttons would go here */}
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'purple';
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={`w-8 h-8 ${colorClasses[color]} rounded-md flex items-center justify-center`}
            >
              <span className="text-white text-sm font-medium">{icon}</span>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {label}
      <button
        type="button"
        className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white"
        onClick={onRemove}
      >
        <span className="sr-only">Remove filter</span>
        <svg
          className="h-2 w-2"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 8 8"
        >
          <path strokeLinecap="round" strokeWidth="1.5" d="m1 1 6 6m0-6-6 6" />
        </svg>
      </button>
    </span>
  );
}

// Utility function
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
