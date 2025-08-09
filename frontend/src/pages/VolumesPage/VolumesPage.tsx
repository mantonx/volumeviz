import type { Volume } from '@/api/generated/volumeviz-api';
import type { VolumeListParams } from '@/api/services';
import { useVolumes } from '@/api/services';
import { EmptyState, ErrorState } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useVolumeListUrlState } from '@/hooks';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import { volumesAtom, volumesErrorAtom, volumesLoadingAtom } from '@/store';
import { cn } from '@/utils';
import { useAtomValue } from 'jotai';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  RefreshCw,
  Search,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { VolumesPageProps } from './VolumesPage.types';
import VolumeCard from './components/VolumeCard';

export const VolumesPage: React.FC<VolumesPageProps> = () => {
  const { fetchVolumes, paginationMeta } = useVolumes();
  const volumes = useAtomValue(volumesAtom) as unknown as Volume[];
  const loading = useAtomValue(volumesLoadingAtom);
  const error = useAtomValue(volumesErrorAtom);

  const [urlState, setUrlState] = useVolumeListUrlState();
  const [qInput, setQInput] = useState(urlState.q || '');
  const debouncedQ = useDebounce(qInput, 300);

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

  const allowedSortFields = useMemo(
    () => new Set(['name', 'driver', 'created_at', 'size_bytes']),
    [],
  );

  // If current sort field is unsupported (e.g., legacy attachments_count), reset
  useEffect(() => {
    const sortField = sort.split(':')[0];
    if (!allowedSortFields.has(sortField)) {
      setUrlState({ sort: 'name:asc' });
    }
  }, [sort, allowedSortFields, setUrlState]);

  const currentParams: VolumeListParams = useMemo(
    () => ({
      page,
      page_size,
      sort,
      q: debouncedQ || undefined,
      driver: (driver as any) || undefined,
      orphaned: orphaned ? true : undefined,
      system: system ? true : undefined,
    }),
    [page, page_size, sort, debouncedQ, driver, orphaned, system],
  );

  // Debounce the fetch to prevent too many requests
  const debouncedFetchRef = useRef<number | null>(null);

  const debouncedFetch = useCallback(
    (params: VolumeListParams) => {
      if (debouncedFetchRef.current) {
        clearTimeout(debouncedFetchRef.current);
      }
      debouncedFetchRef.current = window.setTimeout(() => {
        fetchVolumes(params);
      }, 100);
    },
    [fetchVolumes],
  );

  useEffect(() => {
    debouncedFetch(currentParams);
    return () => {
      if (debouncedFetchRef.current) {
        clearTimeout(debouncedFetchRef.current);
      }
    };
  }, [debouncedFetch, currentParams]);

  const handleRefresh = useCallback(() => {
    fetchVolumes(currentParams);
  }, [fetchVolumes, currentParams]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQInput(event.target.value);
    },
    [],
  );

  // Sync debounced search to URL state (without forcing extra fetch) when it differs
  useEffect(() => {
    if (debouncedQ !== q) {
      setUrlState({ q: debouncedQ || '', page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setUrlState({ page: newPage });
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollIntoView({ behavior: 'smooth' });
          contentRef.current.focus({ preventScroll: true });
        }
      }, 100);
    },
    [setUrlState],
  );

  const handleSortChange = useCallback(
    (newSort: string) => {
      const sortField = newSort.split(':')[0];
      const nextSort = allowedSortFields.has(sortField) ? newSort : 'name:asc';
      setUrlState({ sort: nextSort, page: 1 });
    },
    [setUrlState, allowedSortFields],
  );

  const handleDriverChange = useCallback(
    (newDriver: string) => {
      setUrlState({ driver: newDriver, page: 1 });
    },
    [setUrlState],
  );

  const toggleOrphaned = useCallback(() => {
    setUrlState({ orphaned: !orphaned, page: 1 });
  }, [orphaned, setUrlState]);

  const toggleSystem = useCallback(() => {
    setUrlState({ system: !system, page: 1 });
  }, [system, setUrlState]);

  const handleShowAll = useCallback(() => {
    setUrlState({ orphaned: false, system: false, page: 1 });
  }, [setUrlState]);

  const handleBulkScan = async () => {
    // Placeholder for bulk scan implementation
    console.log('Bulk scan not yet implemented');
  };

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

  const getAnnouncementText = () => {
    if (loading) return 'Loading volumes...';
    if (error) return 'Error loading volumes';
    if (!volumes || volumes.length === 0) {
      return q || driver || orphaned || system
        ? 'No volumes match your search criteria'
        : 'No volumes found';
    }
    return `Showing ${volumes.length} volume${volumes.length !== 1 ? 's' : ''} on page ${page} of ${Math.ceil(paginationMeta.total / page_size)}`;
  };

  const FilterBar: React.FC = () => {
    return (
      <div
        className="flex flex-wrap gap-2 items-center"
        role="toolbar"
        aria-label="Volume filters"
      >
        <label className="sr-only" htmlFor="driver-filter">
          Driver
        </label>
        <select
          id="driver-filter"
          value={driver}
          onChange={(e) => handleDriverChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by driver type"
        >
          <option value="">All Drivers</option>
          <option value="local">Local</option>
          <option value="nfs">NFS</option>
          <option value="cifs">CIFS</option>
          <option value="overlay2">Overlay2</option>
        </select>
        <label className="sr-only" htmlFor="sort-select">
          Sort
        </label>
        <select
          id="sort-select"
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
        </select>
        <Button
          variant={!orphaned && !system ? 'secondary' : 'outline'}
          size="sm"
          onClick={handleShowAll}
          aria-pressed={!orphaned && !system}
        >
          Show All
        </Button>
        <Button
          variant={orphaned ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleOrphaned}
          aria-pressed={orphaned}
        >
          Orphaned Only
        </Button>
        <Button
          variant={system ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleSystem}
          aria-pressed={system}
        >
          Include System
        </Button>
        {(orphaned || system || driver || q) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setUrlState({
                driver: '',
                orphaned: false,
                system: false,
                page: 1,
              })
            }
            aria-label="Clear active filters"
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {getAnnouncementText()}
      </div>

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
          <Button variant="primary" onClick={handleBulkScan}>
            <Activity className="h-4 w-4 mr-2" />
            Scan All
          </Button>
        </div>
      </header>

      <section aria-label="Volume statistics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4" role="img" aria-labelledby="total-volumes">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="total-volumes"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Total Volumes
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {paginationMeta.total}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" aria-hidden="true" />
            </div>
          </Card>
          <Card className="p-4" role="img" aria-labelledby="current-page">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="current-page"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Current Page
                </p>
                <p className="text-2xl font-bold text-green-600">{page}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" aria-hidden="true" />
            </div>
          </Card>
          <Card className="p-4" role="img" aria-labelledby="page-size">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="page-size"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Page Size
                </p>
                <p className="text-2xl font-bold text-gray-600">{page_size}</p>
              </div>
              <Activity className="h-8 w-8 text-gray-500" aria-hidden="true" />
            </div>
          </Card>
          <Card className="p-4" role="img" aria-labelledby="showing-count">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="showing-count"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Showing
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {volumes.length}
                </p>
              </div>
              <Activity
                className="h-8 w-8 text-purple-500"
                aria-hidden="true"
              />
            </div>
          </Card>
        </div>
      </section>

      <section aria-label="Search and filter volumes">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="sr-only" htmlFor="volume-search">
                Search volumes by name
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="volume-search"
                  ref={searchInputRef}
                  type="text"
                  value={qInput}
                  onChange={handleSearchChange}
                  placeholder="Search volumes…"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterBar />
            </div>
          </div>
        </Card>
      </section>

      {loading && (!volumes || volumes.length === 0) ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading volumes...
            </p>
          </div>
        </div>
      ) : !volumes || volumes.length === 0 ? (
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
            q || driver || orphaned || system ? 'Clear Filters' : 'Refresh'
          }
          onAction={() => {
            if (q || driver || orphaned || system) {
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
            {volumes.map((v) => (
              <VolumeCard key={(v as any).volume_id || v.name} volume={v} />
            ))}
          </div>
          {paginationMeta.total > page_size && (
            <Card className="p-4">
              <nav aria-label="Volume pagination" role="navigation">
                <div className="flex items-center justify-between">
                  <div
                    className="text-sm text-gray-600 dark:text-gray-400"
                    role="status"
                  >
                    Showing {(page - 1) * page_size + 1}-
                    {Math.min(page * page_size, paginationMeta.total)} of{' '}
                    {paginationMeta.total} volumes
                  </div>
                  <div
                    className="flex items-center space-x-2"
                    role="group"
                    aria-label="Pagination navigation"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      aria-label={`Go to previous page, page ${page - 1}`}
                    >
                      <ChevronLeft
                        className="h-4 w-4 mr-1"
                        aria-hidden="true"
                      />
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            Math.ceil(paginationMeta.total / page_size),
                          ),
                        },
                        (_, i) => {
                          const pageNum = i + 1;
                          const isActive = pageNum === page;
                          return (
                            <Button
                              key={pageNum}
                              variant={isActive ? 'secondary' : 'outline'}
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
                      <ChevronRight
                        className="h-4 w-4 ml-1"
                        aria-hidden="true"
                      />
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
