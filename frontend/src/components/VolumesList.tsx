import type { Volume } from '@/api/generated/volumeviz-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useScanStatus } from '@/hooks/useScanStatus';
import {
  filteredVolumesAtom,
  volumeFiltersAtom,
  volumesAtom,
  volumesErrorAtom,
  volumesLoadingAtom,
  volumeSortAtom,
  volumeStatsAtom,
  type VolumeFilters,
  type VolumeSortConfig,
} from '@/store/atoms/volumes';
import { useAtom, useAtomValue } from 'jotai';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderOpenIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  StopCircleIcon,
  XIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface VolumesListProps {
  className?: string;
  onVolumeSelect?: (volume: Volume) => void;
  onScanComplete?: (volume: Volume, scanResult: any) => void;
  onFiltersChange?: (filters: VolumeFilters) => void;
  onSortChange?: (sort: VolumeSortConfig) => void;
}

export function VolumesList({
  className = '',
  onVolumeSelect,
  onScanComplete,
  onFiltersChange,
  onSortChange,
}: VolumesListProps) {
  const volumes = useAtomValue(volumesAtom);
  const filteredVolumes = useAtomValue(filteredVolumesAtom);
  const isLoading = useAtomValue(volumesLoadingAtom);
  const error = useAtomValue(volumesErrorAtom);
  const stats = useAtomValue(volumeStatsAtom);

  const [filters, setFilters] = useAtom(volumeFiltersAtom);
  const [sortConfig, setSortConfig] = useAtom(volumeSortAtom);

  const [searchTerm, setSearchTerm] = useState(filters.name || '');
  const [activeScans, setActiveScans] = useState<Set<string>>(new Set());

  // Handle filter changes
  const updateFilter = useCallback(
    (key: keyof VolumeFilters, value: any) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [setFilters, onFiltersChange, filters],
  );

  // Handle sort changes
  const handleSort = useCallback(
    (field: VolumeSortConfig['field']) => {
      const newSortConfig = {
        field,
        direction:
          sortConfig.field === field && sortConfig.direction === 'asc'
            ? 'desc'
            : 'asc',
      } as VolumeSortConfig;

      setSortConfig(newSortConfig);
      onSortChange?.(newSortConfig);
    },
    [setSortConfig, onSortChange, sortConfig],
  );

  // Handle search input
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      updateFilter('name', value || undefined);
    },
    [updateFilter],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    const emptyFilters = {};
    setFilters(emptyFilters);
    setSearchTerm('');
    onFiltersChange?.(emptyFilters);
  }, [setFilters, onFiltersChange]);

  // Format date
  const formatDate = useCallback((dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  }, []);

  // Get status badge variant
  const getStatusBadgeVariant = useCallback((isActive?: boolean) => {
    return isActive ? 'success' : 'secondary';
  }, []);

  // Get driver badge variant
  const getDriverBadgeVariant = useCallback((driver?: string) => {
    switch (driver) {
      case 'local':
        return 'primary';
      case 'nfs':
        return 'secondary';
      case 'cifs':
        return 'warning';
      default:
        return 'secondary';
    }
  }, []);

  // Sort icon component
  const SortIcon = useMemo(() => {
    return ({ field }: { field: string }) => {
      if (sortConfig.field !== field) return null;
      return sortConfig.direction === 'asc' ? (
        <ChevronUpIcon className="ml-1 h-4 w-4" />
      ) : (
        <ChevronDownIcon className="ml-1 h-4 w-4" />
      );
    };
  }, [sortConfig]);

  // Progress bar component
  const ProgressBar = React.memo(({ value }: { value: number }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  ));

  ProgressBar.displayName = 'ProgressBar';

  // Volume row component with scan integration
  const VolumeRow = React.memo(({ volume }: { volume: Volume }) => {
    const volumeId = String(volume.volume_id || volume.id || '');
    const scanId = `scan-${volumeId}-${Date.now()}`;

    const {
      isLoading: isScanLoading,
      error: scanError,
      isRunning,
      isPending,
      isCompleted,
      progress,
      startScan,
      cancelScan,
    } = useScanStatus({
      scanId,
      volumeId,
      enabled: activeScans.has(volumeId),
      onComplete: (result) => {
        setActiveScans((prev) => {
          const next = new Set(prev);
          next.delete(volumeId);
          return next;
        });
        if (onScanComplete) {
          onScanComplete(volume, result);
        }
      },
      onError: (error) => {
        console.error('Scan error:', { volumeId, error });
        setActiveScans((prev) => {
          const next = new Set(prev);
          next.delete(volumeId);
          return next;
        });
      },
    });

    const handleStartScan = useCallback(async () => {
      try {
        setActiveScans((prev) => new Set(prev).add(volumeId));
        await startScan(volumeId);
      } catch (error) {
        console.error('Failed to start scan:', error);
        setActiveScans((prev) => {
          const next = new Set(prev);
          next.delete(volumeId);
          return next;
        });
      }
    }, [volumeId, startScan]);

    const handleCancelScan = useCallback(async () => {
      try {
        await cancelScan();
        setActiveScans((prev) => {
          const next = new Set(prev);
          next.delete(volumeId);
          return next;
        });
      } catch (error) {
        console.error('Failed to cancel scan:', error);
      }
    }, [cancelScan, volumeId]);

    const handleOpenVolume = useCallback(() => {
      if (onVolumeSelect) {
        onVolumeSelect(volume);
      }
    }, [volume]);

    // Render scan status
    const renderScanStatus = () => {
      if (scanError) {
        return (
          <div className="flex items-center text-red-600">
            <AlertTriangleIcon className="mr-1 h-4 w-4" />
            <span className="text-sm">Error</span>
          </div>
        );
      }

      if (isCompleted) {
        return (
          <div className="flex items-center text-green-600">
            <CheckCircleIcon className="mr-1 h-4 w-4" />
            <span className="text-sm">Complete</span>
          </div>
        );
      }

      if (isRunning || isPending) {
        return (
          <div className="flex items-center space-x-2">
            <RefreshCwIcon className="h-4 w-4 animate-spin text-blue-600" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{isRunning ? 'Scanning...' : 'Pending...'}</span>
                {typeof progress === 'number' && (
                  <span>{Math.round(progress)}%</span>
                )}
              </div>
              {typeof progress === 'number' && <ProgressBar value={progress} />}
            </div>
          </div>
        );
      }

      return null;
    };

    return (
      <tr key={volumeId} className="hover:bg-gray-50 border-b">
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{volume.name}</span>
            <span className="text-sm text-gray-500">{volume.volume_id}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <Badge variant={getDriverBadgeVariant(volume.driver)}>
            {volume.driver || 'Unknown'}
          </Badge>
        </td>
        <td className="px-6 py-4">
          <Badge variant={getStatusBadgeVariant(volume.is_active)}>
            {volume.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </td>
        <td className="px-6 py-4 text-right text-gray-900">
          {volume.mountpoint || 'Not mounted'}
        </td>
        <td className="px-6 py-4 text-right text-gray-500">
          {formatDate(volume.created_at)}
        </td>
        <td className="px-6 py-4 min-w-[200px]">{renderScanStatus()}</td>
        <td className="px-6 py-4">
          <div className="flex items-center space-x-2">
            {isRunning || isPending ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelScan}
                disabled={isScanLoading}
              >
                <StopCircleIcon className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartScan}
                disabled={isScanLoading}
              >
                <PlayIcon className="mr-1 h-4 w-4" />
                Scan
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleOpenVolume}>
              <FolderOpenIcon className="mr-1 h-4 w-4" />
              Open
            </Button>
          </div>
        </td>
      </tr>
    );
  });

  VolumeRow.displayName = 'VolumeRow';

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6">
          <ErrorState
            error={error}
            title="Failed to load volumes"
            description={error}
            onRetry={() => window.location.reload()}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Volumes</h2>
            <p className="text-gray-600">
              {stats.total} volumes ({stats.active} active, {stats.inactive}{' '}
              inactive)
            </p>
          </div>
          <Button variant="outline" disabled={isLoading}>
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search volumes..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filters.status || 'all'}
            onChange={(e) =>
              updateFilter(
                'status',
                e.target.value === 'all' ? undefined : e.target.value,
              )
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.driver || 'all'}
            onChange={(e) =>
              updateFilter(
                'driver',
                e.target.value === 'all' ? undefined : e.target.value,
              )
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Drivers</option>
            <option value="local">Local</option>
            <option value="nfs">NFS</option>
            <option value="cifs">CIFS</option>
            <option value="overlay2">Overlay2</option>
          </select>

          {(filters.name || filters.status || filters.driver) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Table content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCwIcon className="mr-2 h-6 w-6 animate-spin" />
            <span>Loading volumes...</span>
          </div>
        ) : filteredVolumes.length === 0 ? (
          <EmptyState
            icon={FolderOpenIcon}
            title="No volumes found"
            description={
              volumes.length === 0
                ? 'No volumes are available'
                : 'Try adjusting your filters'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      className="flex items-center text-sm font-medium text-gray-900 hover:text-gray-600"
                      onClick={() => handleSort('name')}
                    >
                      Name
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      className="flex items-center text-sm font-medium text-gray-900 hover:text-gray-600"
                      onClick={() => handleSort('driver')}
                    >
                      Driver
                      <SortIcon field="driver" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    Mount Point
                  </th>
                  <th className="px-6 py-3 text-right">
                    <button
                      className="flex items-center text-sm font-medium text-gray-900 hover:text-gray-600"
                      onClick={() => handleSort('created_at')}
                    >
                      Created
                      <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Scan Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVolumes.map((volume) => (
                  <VolumeRow
                    key={volume.volume_id || volume.id}
                    volume={volume}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
