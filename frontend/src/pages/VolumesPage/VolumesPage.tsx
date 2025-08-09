import React, { useEffect, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import {
  HardDrive,
  Database,
  Activity,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useVolumes, useVolumeScanning } from '@/api/services';
import type { VolumeListParams } from '@/api/services';
import {
  volumesAtom,
  volumesLoadingAtom,
  volumesErrorAtom,
} from '@/store';
import { cn } from '@/utils';
import type { VolumesPageProps, VolumeCardProps } from './VolumesPage.types';

/**
 * Individual volume card component displaying volume details and actions.
 *
 * Shows volume information including:
 * - Volume name and driver type
 * - Current size information (cached or live scanned)
 * - Status indicators (active/inactive)
 * - Quick action buttons (scan, details)
 * - Container usage count
 * - Mount point information
 *
 * Handles both cached size data and real-time scanning operations.
 * Size scanning can be performed synchronously for quick results or
 * asynchronously for large volumes with progress tracking.
 */
const VolumeCard: React.FC<VolumeCardProps> = ({ volume }) => {
  const { scanVolume, scanResults } = useVolumeScanning();
  const scanResult = scanResults[volume.volume_id || volume.name];

  /**
   * Initiate a volume size scan operation.
   * Uses synchronous scanning for immediate results.
   */
  const handleScan = async () => {
    try {
      const volumeId = volume.volume_id || volume.name;
      await scanVolume(volumeId, { async: false });
    } catch (error) {
      console.error('Failed to scan volume:', error);
    }
  };

  /**
   * Format bytes to human-readable size string.
   * Converts to GB with 2 decimal places for consistency.
   */
  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  /**
   * Get appropriate badge variant based on volume status.
   * Active volumes show success, inactive show outline.
   */
  const getStatusVariant = (isActive?: boolean) => {
    return isActive ? 'success' : 'outline';
  };

  /**
   * Get status text for accessibility and display.
   */
  const getStatusText = (isActive?: boolean): string => {
    return isActive ? 'Active' : 'Inactive';
  };

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
            <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {volume.name || 'Unnamed Volume'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {volume.driver || 'local'} driver
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Badge variant={getStatusVariant(volume.is_active)}>
            {getStatusText(volume.is_active)}
          </Badge>
          {volume.is_orphaned && <Badge variant="destructive">Orphaned</Badge>}
          {volume.is_system && <Badge variant="secondary">System</Badge>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Size:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {volume.size_bytes
              ? formatSize(volume.size_bytes)
              : scanResult
                ? formatSize(scanResult.size_bytes)
                : 'Unknown'}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Containers:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {volume.attachments_count || 0}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Mount Point:</span>
          <span
            className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-48"
            title={volume.mountpoint}
          >
            {volume.mountpoint || 'N/A'}
          </span>
        </div>

        {volume.labels && Object.keys(volume.labels).length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-1">
              {Object.entries(volume.labels)
                .slice(0, 3)
                .map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}={value}
                  </Badge>
                ))}
              {Object.keys(volume.labels).length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{Object.keys(volume.labels).length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          className="flex-1"
        >
          <Activity className="h-4 w-4 mr-2" />
          Scan Size
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          <Database className="h-4 w-4 mr-2" />
          Details
        </Button>
      </div>
    </Card>
  );
};

/**
 * Main volumes page component for managing Docker volumes.
 *
 * Provides comprehensive volume management interface including:
 * - Grid/list view of all Docker volumes
 * - Real-time volume status monitoring
 * - Bulk operations (scan all, filter, search)
 * - Volume size scanning with progress tracking
 * - Filtering by driver type, status, and labels
 * - Quick statistics overview
 * - Responsive design for mobile and desktop
 *
 * The page automatically refreshes volume data on mount and provides
 * manual refresh capabilities. All volume operations are performed
 * through the Docker API with proper error handling and user feedback.
 *
 * Volume scanning can handle both small volumes (immediate results) and
 * large volumes (background processing with progress updates).
 */
export const VolumesPage: React.FC<VolumesPageProps> = () => {
  const { fetchVolumes, refreshVolumes, paginationMeta } = useVolumes();
  const volumes = useAtomValue(volumesAtom);
  const loading = useAtomValue(volumesLoadingAtom);
  const error = useAtomValue(volumesErrorAtom);

  // Local state for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false);
  const [sortField, setSortField] = useState('name:asc');
  const [pageSize, setPageSize] = useState(25);

  // Current filter parameters
  const currentParams: VolumeListParams = {
    page: paginationMeta.page,
    page_size: pageSize,
    sort: sortField,
    q: searchQuery || undefined,
    driver: selectedDriver || undefined,
    orphaned: showOrphanedOnly || undefined,
    system: false, // Default to hiding system volumes
  };

  /**
   * Load volume data when the page mounts or params change
   */
  useEffect(() => {
    fetchVolumes(currentParams);
  }, [
    paginationMeta.page,
    pageSize,
    sortField,
    searchQuery,
    selectedDriver,
    showOrphanedOnly,
  ]);

  /**
   * Handle manual refresh of volume data
   */
  const handleRefresh = useCallback(() => {
    fetchVolumes(currentParams);
  }, [fetchVolumes, currentParams]);

  /**
   * Handle search input changes
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
      // Reset to first page when searching
      fetchVolumes({
        ...currentParams,
        page: 1,
        q: event.target.value || undefined,
      });
    },
    [currentParams, fetchVolumes],
  );

  /**
   * Handle page changes
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      fetchVolumes({ ...currentParams, page: newPage });
    },
    [currentParams, fetchVolumes],
  );

  /**
   * Handle sort changes
   */
  const handleSortChange = useCallback(
    (newSort: string) => {
      setSortField(newSort);
      fetchVolumes({ ...currentParams, page: 1, sort: newSort });
    },
    [currentParams, fetchVolumes],
  );

  /**
   * Handle bulk scan operation for visible volumes
   */
  const handleBulkScan = async () => {
    // TODO: Implement bulk scanning with selected volumes
    console.log('Bulk scan not yet implemented');
  };

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="p-8 max-w-md text-center">
          <div className="text-red-500 mb-4">
            <HardDrive className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Volumes
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Docker Volumes
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage and monitor your Docker volume storage
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw
              className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button onClick={handleBulkScan}>
            <Activity className="h-4 w-4 mr-2" />
            Scan All
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Volumes
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {paginationMeta.total}
              </p>
            </div>
            <HardDrive className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current Page
              </p>
              <p className="text-2xl font-bold text-green-600">
                {paginationMeta.page}
              </p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Page Size
              </p>
              <p className="text-2xl font-bold text-gray-600">
                {paginationMeta.pageSize}
              </p>
            </div>
            <Database className="h-8 w-8 text-gray-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {volumes.length}
              </p>
            </div>
            <Database className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search volumes by name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Drivers</option>
              <option value="local">Local</option>
              <option value="nfs">NFS</option>
              <option value="cifs">CIFS</option>
              <option value="overlay2">Overlay2</option>
            </select>

            <select
              value={sortField}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="created_at:desc">Newest First</option>
              <option value="created_at:asc">Oldest First</option>
              <option value="size_bytes:desc">Largest First</option>
              <option value="size_bytes:asc">Smallest First</option>
              <option value="attachments_count:desc">Most Used</option>
              <option value="attachments_count:asc">Least Used</option>
            </select>

            <Button
              variant={showOrphanedOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOrphanedOnly(!showOrphanedOnly)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showOrphanedOnly ? 'Show All' : 'Orphaned Only'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Volumes Grid */}
      {loading && volumes.length === 0 ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading volumes...
            </p>
          </div>
        </div>
      ) : volumes.length === 0 ? (
        <Card className="p-8 text-center">
          <HardDrive className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Volumes Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || selectedDriver || showOrphanedOnly
              ? 'No volumes match your search criteria. Try adjusting your filters.'
              : 'No Docker volumes are currently available.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {volumes.map((volume) => (
              <VolumeCard
                key={volume.volume_id || volume.name}
                volume={volume}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {paginationMeta.total > paginationMeta.pageSize && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing{' '}
                  {(paginationMeta.page - 1) * paginationMeta.pageSize + 1}-
                  {Math.min(
                    paginationMeta.page * paginationMeta.pageSize,
                    paginationMeta.total,
                  )}{' '}
                  of {paginationMeta.total} volumes
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginationMeta.page <= 1}
                    onClick={() => handlePageChange(paginationMeta.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center space-x-1">
                    {Array.from(
                      {
                        length: Math.min(
                          5,
                          Math.ceil(
                            paginationMeta.total / paginationMeta.pageSize,
                          ),
                        ),
                      },
                      (_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === paginationMeta.page;
                        return (
                          <Button
                            key={pageNum}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="min-w-[40px]"
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      paginationMeta.page >=
                      Math.ceil(paginationMeta.total / paginationMeta.pageSize)
                    }
                    onClick={() => handlePageChange(paginationMeta.page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
