import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
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
import { useToast, ErrorState, EmptyState } from '@/components/ui';
import { useVolumes, useVolumeScanning } from '@/api/services';
import type { VolumeListParams } from '@/api/services';
import {
  volumesAtom,
  volumesLoadingAtom,
  volumesErrorAtom,
} from '@/store';
import { cn } from '@/utils';
import { useVolumeListUrlState } from '@/hooks';
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { scanVolume, scanResults, scanLoading } = useVolumeScanning();
  const volumeId = volume.volume_id || volume.name;
  const scanResult = scanResults[volumeId];
  const isScanning = scanLoading[volumeId];

  /**
   * Initiate a volume size scan operation.
   * Uses synchronous scanning for immediate results.
   */
  const handleScan = async () => {
    if (isScanning) return;
    
    try {
      showToast(`Starting scan for ${volume.name || 'volume'}...`, 'info', 3000);
      await scanVolume(volumeId, { async: false });
      showToast(`Successfully scanned ${volume.name || 'volume'}`, 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to scan ${volume.name || 'volume'}: ${errorMessage}`, 'error');
      console.error('Failed to scan volume:', error);
    }
  };

  /**
   * Navigate to volume details page
   */
  const handleViewDetails = () => {
    if (volume.name) {
      navigate(`/volumes/${encodeURIComponent(volume.name)}`);
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
          disabled={isScanning}
          className="flex-1"
        >
          <Activity className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Rescan Size'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleViewDetails}
          disabled={!volume.name}
          className="flex-1"
        >
          <Database className="h-4 w-4 mr-2" />
          View Details
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

  // URL state for search and filters
  const [urlState, setUrlState] = useVolumeListUrlState();
  
  // Refs for focus management
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const {
    page = 1,
    page_size = 25,
    sort = 'name:asc',
    q = '',
    driver = '',
    orphaned = false,
    system = false,
  } = urlState;



  // Current filter parameters - memoized to prevent unnecessary re-renders
  const currentParams: VolumeListParams = useMemo(() => ({
    page,
    page_size,
    sort,
    q: q || undefined,
    driver: driver || undefined,
    orphaned: orphaned || undefined,
    system: system || undefined,
  }), [page, page_size, sort, q, driver, orphaned, system]);

  /**
   * Load volume data when the page mounts or params change
   */
  useEffect(() => {
    fetchVolumes(currentParams);
  }, [page, page_size, sort, q, driver, orphaned, system]); // Track individual params, not currentParams

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
      setUrlState({
        q: event.target.value,
        page: 1,
      });
    },
    [setUrlState],
  );

  /**
   * Handle page changes
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setUrlState({ page: newPage });
      
      // Focus management: scroll to top and focus content for screen readers
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollIntoView({ behavior: 'smooth' });
          contentRef.current.focus({ preventScroll: true });
        }
      }, 100);
    },
    [setUrlState],
  );

  /**
   * Handle sort changes
   */
  const handleSortChange = useCallback(
    (newSort: string) => {
      setUrlState({ sort: newSort, page: 1 });
    },
    [setUrlState],
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
        <ErrorState
          error={error}
          onRetry={handleRefresh}
          title="Failed to Load Volumes"
          description="Unable to fetch volume data. Please check your connection and try again."
          showErrorDetails={true}
        />
      </div>
    );
  }

  // Screen reader announcement text
  const getAnnouncementText = () => {
    if (loading) return 'Loading volumes...';
    if (error) return 'Error loading volumes';
    if (volumes.length === 0) {
      return q || driver || orphaned || system
        ? 'No volumes match your search criteria'
        : 'No volumes found';
    }
    return `Showing ${volumes.length} volume${volumes.length !== 1 ? 's' : ''} on page ${page} of ${Math.ceil(paginationMeta.total / page_size)}`;
  };

  return (
    <div className="space-y-6">
      {/* Screen reader live region for announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
        role="status"
      >
        {getAnnouncementText()}
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      </header>

      {/* Statistics Overview */}
      <section aria-label="Volume statistics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4" role="img" aria-labelledby="total-volumes">
            <div className="flex items-center justify-between">
              <div>
                <p id="total-volumes" className="text-sm text-gray-600 dark:text-gray-400">
                  Total Volumes
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {paginationMeta.total}
                </p>
              </div>
              <HardDrive className="h-8 w-8 text-blue-500" aria-hidden="true" />
            </div>
          </Card>

          <Card className="p-4" role="img" aria-labelledby="current-page">
            <div className="flex items-center justify-between">
              <div>
                <p id="current-page" className="text-sm text-gray-600 dark:text-gray-400">
                  Current Page
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {page}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" aria-hidden="true" />
            </div>
          </Card>

          <Card className="p-4" role="img" aria-labelledby="page-size">
            <div className="flex items-center justify-between">
              <div>
                <p id="page-size" className="text-sm text-gray-600 dark:text-gray-400">
                  Page Size
                </p>
                <p className="text-2xl font-bold text-gray-600">
                  {page_size}
                </p>
              </div>
              <Database className="h-8 w-8 text-gray-500" aria-hidden="true" />
            </div>
          </Card>

          <Card className="p-4" role="img" aria-labelledby="showing-count">
            <div className="flex items-center justify-between">
              <div>
                <p id="showing-count" className="text-sm text-gray-600 dark:text-gray-400">
                  Showing
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {volumes.length}
                </p>
              </div>
              <Database className="h-8 w-8 text-purple-500" aria-hidden="true" />
            </div>
          </Card>
        </div>
      </section>

      {/* Filters and Search */}
      <section aria-label="Search and filter volumes">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="sr-only" htmlFor="volume-search">
                Search volumes by name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="volume-search"
                  ref={searchInputRef}
                  type="text"
                  value={q || ''}
                  onChange={handleSearchChange}
                  placeholder="Search volumes by name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
            <select
              value={driver}
              onChange={(e) => setUrlState({ driver: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by driver type"
            >
              <option value="">All Drivers</option>
              <option value="local">Local</option>
              <option value="nfs">NFS</option>
              <option value="cifs">CIFS</option>
              <option value="overlay2">Overlay2</option>
            </select>

            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              aria-label="Sort volumes by"
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
              variant={orphaned ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUrlState({ orphaned: !orphaned, page: 1 })}
            >
              <Filter className="h-4 w-4 mr-2" />
              {orphaned ? 'Show All' : 'Orphaned Only'}
            </Button>

            <Button
              variant={system ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUrlState({ system: !system, page: 1 })}
            >
              <Filter className="h-4 w-4 mr-2" />
              {system ? 'Hide System' : 'Include System'}
            </Button>
            </div>
          </div>
        </Card>
      </section>

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
        <EmptyState
          icon={HardDrive}
          title={
            q || driver || orphaned || system
              ? 'No Matching Volumes'
              : 'No Volumes Found'
          }
          description={
            q || driver || orphaned || system
              ? 'No volumes match your current search criteria. Try adjusting your filters or search terms.'
              : 'No Docker volumes are currently available. Create some volumes to get started.'
          }
          actionLabel={
            q || driver || orphaned || system
              ? 'Clear Filters'
              : 'Refresh'
          }
          onAction={() => {
            if (q || driver || orphaned || system) {
              // Clear all filters
              setUrlState({
                q: '',
                driver: '',
                orphaned: false,
                system: false,
                sort: 'name:asc',
                page: 1,
              });
            } else {
              handleRefresh();
            }
          }}
        />
      ) : (
        <main>
          <div 
            ref={contentRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            role="grid"
            aria-label={`Volume list showing ${volumes.length} volume${volumes.length !== 1 ? 's' : ''}`}
            tabIndex={-1}
          >
            {volumes.map((volume) => (
              <VolumeCard
                key={volume.volume_id || volume.name}
                volume={volume}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {paginationMeta.total > page_size && (
            <Card className="p-4">
              <nav aria-label="Volume pagination" role="navigation">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400" role="status">
                    Showing{' '}
                    {(page - 1) * page_size + 1}-
                    {Math.min(
                      page * page_size,
                      paginationMeta.total,
                    )}{' '}
                    of {paginationMeta.total} volumes
                  </div>

                  <div className="flex items-center space-x-2" role="group" aria-label="Pagination navigation">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      aria-label={`Go to previous page, page ${page - 1}`}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1">
                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            Math.ceil(
                              paginationMeta.total / page_size,
                            ),
                          ),
                        },
                        (_, i) => {
                          const pageNum = i + 1;
                          const isActive = pageNum === page;
                          return (
                            <Button
                              key={pageNum}
                              variant={isActive ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="min-w-[40px]"
                              aria-label={`${isActive ? 'Current page, ' : 'Go to '}page ${pageNum}`}
                              aria-current={isActive ? 'page' : undefined}
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
                        page >= Math.ceil(paginationMeta.total / page_size)
                      }
                      onClick={() => handlePageChange(page + 1)}
                      aria-label={`Go to next page, page ${page + 1}`}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </nav>
            </Card>
          )}
        </main>
      )}
    </div>
  );
};
