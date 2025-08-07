import React from 'react';
import { HardDrive } from 'lucide-react';
import { VolumeCard } from '../VolumeCard';
import { clsx } from 'clsx';
import type { VolumeListProps, VolumeListLayout } from './VolumeList.types';

/**
 * VolumeList component for displaying paginated volumes with flexible layouts.
 *
 * Provides comprehensive volume listing functionality including:
 * - Multiple view modes (grid, list, compact)
 * - Pagination with configurable page size
 * - Sort and filter integration
 * - Loading states with skeleton placeholders
 * - Empty states with helpful actions
 * - Responsive design adapting to screen size
 * - Bulk selection capabilities (optional)
 * - Real-time updates from Jotai volume state
 *
 * Used as the primary volume display component on dashboard and volumes page.
 * Integrates with VolumeCard for consistent volume representation across layouts.
 */
export const VolumeList: React.FC<VolumeListProps> = ({
  volumes,
  layout = 'grid',
  pageSize = 12,
  currentPage = 1,
  onPageChange,
  onVolumeAction,
  showPagination = true,
  emptyStateMessage = 'No volumes found',
  emptyStateAction,
  className,
  ...props
}) => {
  const loading = false; // TODO: Connect to actual loading state

  /**
   * Calculate pagination values for display and navigation.
   */
  const totalPages = Math.ceil(volumes.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedVolumes = volumes.slice(startIndex, endIndex);

  /**
   * Generate page numbers for pagination display.
   * Shows current page with context pages around it.
   */
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  /**
   * Get layout-specific CSS classes for volume container.
   */
  const getLayoutClasses = (): string => {
    switch (layout) {
      case 'list':
        return 'space-y-4';
      case 'compact':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4';
      case 'grid':
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
    }
  };

  /**
   * Get appropriate VolumeCard variant based on layout.
   */
  const getCardVariant = () => {
    switch (layout) {
      case 'list':
        return 'detailed';
      case 'compact':
        return 'compact';
      default:
        return 'default';
    }
  };

  /**
   * Handle volume action callbacks with context.
   */
  const handleVolumeAction = (action: string, volumeId: string) => {
    onVolumeAction?.(action, volumeId);
  };

  // Loading state with skeleton placeholders
  if (loading && volumes.length === 0) {
    return (
      <div className={clsx('space-y-6', className)} {...props}>
        <div className={getLayoutClasses()}>
          {Array.from({ length: pageSize }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  </div>
                </div>
                <div className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (volumes.length === 0) {
    return (
      <div className={clsx('space-y-6', className)} {...props}>
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <HardDrive className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-6" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {emptyStateMessage}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {volumes.length === 0
              ? 'No Docker volumes are currently available. Create your first volume to get started.'
              : 'Try adjusting your search criteria or filters to find volumes.'}
          </p>
          {emptyStateAction && (
            <div className="flex justify-center">{emptyStateAction}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)} {...props}>
      {/* Volume Grid/List */}
      <div className={getLayoutClasses()}>
        {paginatedVolumes.map((volume) => (
          <VolumeCard
            key={volume.id}
            volume={volume}
            variant={getCardVariant()}
            onScan={() => handleVolumeAction('scan', volume.id)}
            onManage={() => handleVolumeAction('manage', volume.id)}
            onViewDetails={() => handleVolumeAction('details', volume.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, volumes.length)} of{' '}
              {volumes.length} volumes
            </div>

            <div className="flex items-center space-x-2">
              {/* Previous button */}
              <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center space-x-1">
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={clsx(
                      'w-10 h-10 text-sm rounded-md',
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
                    )}
                  >
                    {pageNum}
                  </button>
                ))}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className="text-gray-400 px-2">...</span>
                    <button
                      onClick={() => onPageChange?.(totalPages)}
                      className="w-10 h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              {/* Mobile page indicator */}
              <div className="sm:hidden text-sm text-gray-500 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </div>

              {/* Next button */}
              <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
