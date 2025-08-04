import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
  HardDrive,
  Database,
  Activity,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useVolumes, useVolumeScanning } from '@/api/services';
import {
  filteredVolumesAtom,
  volumeStatsAtom,
  volumesLoadingAtom,
  volumesErrorAtom,
} from '@/store';
import { cn } from '@/utils';

const VolumeCard: React.FC<{ volume: any }> = ({ volume }) => {
  const { scanVolume, scanResults } = useVolumeScanning();
  const scanResult = scanResults[volume.volume_id];

  const handleScan = async () => {
    try {
      await scanVolume(volume.volume_id, { async: false });
    } catch (error) {
      console.error('Failed to scan volume:', error);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <HardDrive className="h-6 w-6 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {volume.name || volume.volume_id}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {volume.volume_id}
            </p>
            {volume.mountpoint && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {volume.mountpoint}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={volume.is_active ? 'success' : 'secondary'}>
            {volume.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleScan}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Driver
          </dt>
          <dd className="text-sm text-gray-900 dark:text-white">
            {volume.driver || 'local'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Size
          </dt>
          <dd className="text-sm text-gray-900 dark:text-white">
            {formatSize(scanResult?.total_size)}
          </dd>
        </div>
      </div>

      {volume.labels && Object.keys(volume.labels).length > 0 && (
        <div className="mt-4">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Labels
          </dt>
          <div className="flex flex-wrap gap-1">
            {Object.entries(volume.labels).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {key}: {value}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export const VolumesPage: React.FC = () => {
  const { fetchVolumes, refreshVolumes } = useVolumes();
  const volumes = useAtomValue(filteredVolumesAtom);
  const volumeStats = useAtomValue(volumeStatsAtom);
  const loading = useAtomValue(volumesLoadingAtom);
  const error = useAtomValue(volumesErrorAtom);

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  const handleRefresh = () => {
    refreshVolumes();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="p-8 text-center">
          <div className="text-red-500 mb-4">
            <Database className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Failed to load volumes
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Docker Volumes
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage and monitor your Docker volumes
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={handleRefresh} disabled={loading}>
              <RefreshCw
                className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <HardDrive className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Volumes
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {volumeStats.total}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Active
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {volumeStats.active}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-purple-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Size
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {volumeStats.totalSize > 0
                    ? `${(volumeStats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
                    : 'Calculating...'}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <HardDrive className="h-8 w-8 text-gray-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Inactive
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {volumeStats.inactive}
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* Volume List */}
      {loading && volumes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Loading volumes...
            </p>
          </div>
        </div>
      ) : volumes.length === 0 ? (
        <Card className="p-12 text-center">
          <HardDrive className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No volumes found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            No Docker volumes are currently available.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {volumes.map((volume) => (
            <VolumeCard key={volume.volume_id} volume={volume} />
          ))}
        </div>
      )}
    </div>
  );
};
