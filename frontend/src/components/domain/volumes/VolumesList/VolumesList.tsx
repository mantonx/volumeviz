import { organizationStatsAtom, volumeFiltersAtom } from '@/atoms';
import { useOrganization } from '@/hooks/api/useOrganization';
import { useVolumesList } from '@/hooks/api/useVolumesList';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';
import { formatBytes } from '@/utils/formatters';
import { useAtom, useAtomValue } from 'jotai';
import {
  Grid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  HardDrive,
  Database,
  Users,
  Download,
  ScanSearch,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const { volumes, pagination, isLoading, refetch, isFetching } =
    useVolumesList({
      page: currentPage,
      pageSize,
    });

  const { bulkScan } = useVolumeOperations();

  const handleScanAll = async () => {
    const volumeIds = volumes.map((v) => v.name).filter((name): name is string => !!name);
    console.log('Starting bulk scan for volumes:', volumeIds);
    if (volumeIds.length > 0) {
      try {
        const result = await bulkScan.mutateAsync(volumeIds, { async: true, method: 'du' });
        console.log('Bulk scan initiated:', result);

        // Poll for updates every 2 seconds for up to 30 seconds
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          console.log(`Refreshing data (poll ${pollCount}/15)...`);
          refetch();

          if (pollCount >= 15) {
            clearInterval(pollInterval);
            console.log('Stopped polling for scan updates');
          }
        }, 2000);
      } catch (error) {
        console.error('Bulk scan failed:', error);
      }
    }
  };

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

  return (
    <div className={`space-y-6 ${className}`}>
      {/* View controls */}
      <div className="flex items-center justify-end gap-3">
        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleScanAll}
          disabled={bulkScan.isLoading || volumes.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:disabled:bg-gray-600"
        >
          {bulkScan.isLoading ? (
            <Loader2 className="-ml-1 mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="-ml-1 mr-2 h-4 w-4" />
          )}
          {bulkScan.isLoading ? 'Scanning...' : 'Scan All'}
        </button>

        <button
          onClick={() => {
            // TODO: Implement export functionality
            console.log('Export volumes');
          }}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Download className="-ml-1 mr-2 h-4 w-4" />
          Export
        </button>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`-ml-1 mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
          />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Organization Stats */}
      {orgStats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatsCard
            title="Total Volumes"
            value={orgStats.total_volumes || 0}
            icon={<HardDrive className="w-5 h-5" />}
            color="blue"
          />
          <StatsCard
            title="Total Size"
            value={formatBytes(orgStats.total_size || 0)}
            icon={<Database className="w-5 h-5" />}
            color="green"
          />
          <StatsCard
            title="Active Users"
            value={orgStats.total_users || 0}
            icon={<Users className="w-5 h-5" />}
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search volumes..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
            <div className="col-span-full">
              <div className="text-center py-12 px-6">
                <HardDrive className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No volumes found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  {filters.searchTerm || filters.status !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Get started by adding your first Docker volume to track and analyze.'}
                </p>
                {!filters.searchTerm && filters.status === 'all' && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    <Plus className="-ml-1 mr-2 h-4 w-4" />
                    Add Your First Volume
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.pageSize && (
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevious}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
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
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevious}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {Array.from(
                  { length: Math.ceil(pagination.total / pagination.pageSize) },
                  (_, i) => i + 1,
                )
                  .filter((page) => {
                    const totalPages = Math.ceil(
                      pagination.total / pagination.pageSize,
                    );
                    // Show first, last, current, and surrounding pages
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - pagination.page) <= 1
                    );
                  })
                  .map((page, index, array) => {
                    // Add ellipsis for gaps
                    const previousPage = index > 0 ? array[index - 1] : 0;
                    const showEllipsis = page - previousPage > 1;

                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && (
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                            ...
                          </span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pagination.page
                              ? 'z-10 bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!pagination.hasNext}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
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
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500 dark:bg-blue-600',
    green: 'bg-green-500 dark:bg-green-600',
    purple: 'bg-purple-500 dark:bg-purple-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={`w-10 h-10 ${colorClasses[color]} rounded-md flex items-center justify-center text-white`}
            >
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900 dark:text-white">
                {value}
              </dd>
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
