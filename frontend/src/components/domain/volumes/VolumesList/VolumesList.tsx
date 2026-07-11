import { volumeFiltersAtom } from '@/atoms';
import { useOrganization } from '@/hooks/api/useOrganization';
import { useVolumesList } from '@/hooks/api/useVolumesList';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';
import { useVolumeExport } from '@/hooks/volumes/useVolumeExport';
import { useVolumeSelection } from '@/hooks/volumes/useVolumeSelection';
import { useAtom } from 'jotai';
import { HardDrive, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VolumeCard } from '../VolumeCard';
import { VolumeTable } from '../VolumeTable';
import { BulkScanModal } from '../modals';
import { VolumesListHeader } from './VolumesListHeader';
import { VolumesListFilters } from './VolumesListFilters';
import { VolumesListStats } from './VolumesListStats';

interface VolumesListProps {
  className?: string;
}

export function VolumesList({ className = '' }: VolumesListProps) {
  const navigate = useNavigate();
  const { currentOrgId } = useOrganization();
  const [filters, setFilters] = useAtom(volumeFiltersAtom);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [showScanAllConfirm, setShowScanAllConfirm] = useState(false);
  const pageSize = 25;

  const { volumes, pagination, isLoading, refetch } = useVolumesList({
    page: currentPage,
    pageSize,
  });

  // Use selection hook for multi-select logic
  const {
    selectedIds: selectedVolumeIds,
    setSelectedIds: setSelectedVolumeIds,
    isSelected,
    toggleSelection,
  } = useVolumeSelection();

  const { bulkScan } = useVolumeOperations();
  const { exportVolumes, isExporting } = useVolumeExport(filters);

  const handleScanAllClick = () => {
    setShowScanAllConfirm(true);
  };

  const handleConfirmScanAll = async () => {
    setShowScanAllConfirm(false);

    const volumeIds = volumes.map((v) => v.name).filter((name): name is string => !!name);

    if (volumeIds.length > 0) {
      try {
        await bulkScan.mutateAsync(volumeIds, { async: true, method: 'du' });

        // Poll for updates every 2 seconds for up to 30 seconds
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          refetch();

          if (pollCount >= 15) {
            clearInterval(pollInterval);
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
      {/* Header with view controls, scan all, and export */}
      <VolumesListHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onScanAll={handleScanAllClick}
        isScanLoading={bulkScan.isLoading}
        hasVolumes={volumes.length > 0}
        onExportCSV={() => exportVolumes('csv')}
        onExportJSON={() => exportVolumes('json')}
        isExportLoading={isExporting}
      />

      {/* Statistics */}
      <VolumesListStats
        volumes={volumes}
        totalVolumes={pagination.total || 0}
      />

      {/* Filters */}
      <VolumesListFilters
        filters={filters}
        onSearchChange={handleSearchChange}
        onFilterChange={handleFilterChange}
      />

      {/* Volume List */}
      {viewMode === 'table' ? (
        <VolumeTable
          volumes={volumes}
          isLoading={isLoading}
          selectedVolumeIds={selectedVolumeIds}
          onSelectionChange={setSelectedVolumeIds}
          showBulkActions={true}
          onRefetch={refetch}
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
                isSelected={isSelected(volume.id)}
                onSelect={toggleSelection}
                showActions={true}
              />
            ))
          ) : (
            <div className="col-span-full">
              <div className="text-center py-12 px-6">
                <HardDrive className="w-16 h-16 text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-primary mb-2">
                  No volumes found
                </h3>
                <p className="text-secondary mb-6 max-w-md mx-auto">
                  {filters.searchTerm || filters.status !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Get started by adding your first Docker volume to track and analyze.'}
                </p>
                {!filters.searchTerm && filters.status === 'all' && (
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 "
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
      {pagination.total > 0 && pagination.total > pagination.pageSize && (
        <div className="bg-surface px-4 py-3 flex items-center justify-between border-t border-line sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevious}
              className="relative inline-flex items-center px-4 py-2 border border-line text-sm font-medium rounded-md text-secondary bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-line text-sm font-medium rounded-md text-secondary bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-secondary">
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
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-line bg-surface text-sm font-medium text-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <span className="relative inline-flex items-center px-4 py-2 border border-line bg-surface text-sm font-medium text-secondary">
                            ...
                          </span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pagination.page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-surface border-line text-tertiary hover:bg-surface-hover'
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
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-line bg-surface text-sm font-medium text-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Scan All Confirmation Modal */}
      <BulkScanModal
        isOpen={showScanAllConfirm}
        onClose={() => setShowScanAllConfirm(false)}
        onConfirm={handleConfirmScanAll}
        volumes={volumes}
        isScanning={bulkScan.isLoading}
      />
    </div>
  );
}
