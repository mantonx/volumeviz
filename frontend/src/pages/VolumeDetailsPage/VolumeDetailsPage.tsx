import {
  useGetVolumesName,
  useGetVolumesIdScanStatus,
  usePostVolumesIdSizeRefresh,
} from '@/api/orval-generated/api';
import { ExplorerView } from '@/components/domain/explorer';
import { FileMetadataView } from '@/components/domain/explorer/FileMetadataView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Activity,
  ArrowLeft,
  Database,
  HardDrive,
  MapPin,
  RefreshCw,
  Tag,
} from 'lucide-react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Explorer UI integration for tree and browse functionality implemented

// The scan-status endpoint returns a raw Go map (interfaces.ScanProgress
// marshaled as JSON), which orval types as {[key: string]: unknown}. This
// mirrors the real backend struct (internal/interfaces/scanner.go).
interface ScanProgress {
  status?: string;
  bytes_processed?: number;
  elapsed_seconds?: number;
  last_update?: string;
}

const VolumeDetailsPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const {
    data: volumeData,
    isLoading: volumeLoading,
    error: volumeError,
    refetch: refetchVolume,
  } = useGetVolumesName(name || '', {
    query: { enabled: !!name },
  });
  const {
    data: scanStatusData,
    isLoading: isScanning,
  } = useGetVolumesIdScanStatus(name || '', {
    query: { enabled: !!name, retry: false },
  });
  const sizeRefreshMutation = usePostVolumesIdSizeRefresh();

  const volume = volumeData?.status === 200 ? volumeData.data : undefined;
  const scanResult =
    scanStatusData?.status === 200
      ? (scanStatusData.data as ScanProgress)
      : undefined;
  const loading = volumeLoading;
  const error = volumeError ? 'Failed to load volume' : null;

  const handleScan = async () => {
    if (!volume || !name) return;

    try {
      await sizeRefreshMutation.mutateAsync({
        id: name,
        data: { method: 'du', async: false },
      });
    } catch (error) {
      console.error('Failed to refresh volume size:', error);
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const getStatusVariant = (status?: string) => {
    return status === 'active' ? 'success' : 'outline';
  };

  const getStatusText = (status?: string): string => {
    return status === 'active' ? 'Active' : (status ?? 'Inactive');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-secondary">
            Loading volume details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !volume) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/volumes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Volumes
          </Button>
        </div>
        <Card className="p-8 text-center">
          <div className="text-red-500 mb-4">
            <HardDrive className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">
            Volume Not Found
          </h3>
          <p className="text-secondary mb-4">
            The volume "{name}" could not be found.
          </p>
          <Button onClick={() => navigate('/volumes')}>
            Return to Volumes List
          </Button>
        </Card>
      </div>
    );
  }

  const volumeId = volume.name ?? name ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/volumes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Volumes
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">
              {volume.name || 'Unnamed Volume'}
            </h1>
            <p className="text-secondary">Volume Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleScan} disabled={isScanning}>
            <Activity
              className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`}
            />
            {isScanning ? 'Scanning...' : 'Scan Size'}
          </Button>
          <Button onClick={() => refetchVolume()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Volume Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary">
                {volume.name || 'Unnamed Volume'}
              </h2>
              <p className="text-secondary">
                {volume.driver || 'local'} driver
              </p>
            </div>
            <div className="ml-auto flex space-x-2">
              <Badge variant={getStatusVariant(volume.status)}>
                {getStatusText(volume.status)}
              </Badge>
              {volume.is_orphaned && (
                <Badge variant="error">Orphaned</Badge>
              )}
              {volume.is_system && <Badge variant="secondary">System</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Volume ID:
                </span>
                <span className="font-mono text-sm text-primary">
                  {volume.name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Driver:
                </span>
                <span className="font-medium text-primary">
                  {volume.driver || 'local'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Status:
                </span>
                <Badge variant={getStatusVariant(volume.status)}>
                  {getStatusText(volume.status)}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Size:
                </span>
                <span className="font-medium text-primary">
                  {volume.size_bytes
                    ? formatSize(volume.size_bytes)
                    : scanResult
                      ? formatSize(scanResult.bytes_processed)
                      : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Containers:
                </span>
                <span className="font-medium text-primary">
                  {volume.attachments_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  Created:
                </span>
                <span className="font-medium text-primary">
                  {formatDate(volume.created_at)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Size</p>
                <p className="text-xl font-bold text-blue-600">
                  {volume.size_bytes
                    ? formatSize(volume.size_bytes)
                    : scanResult
                      ? formatSize(scanResult.bytes_processed)
                      : 'Unknown'}
                </p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">
                  Containers
                </p>
                <p className="text-xl font-bold text-green-600">
                  {volume.attachments_count || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">
                  Driver
                </p>
                <p className="text-xl font-bold text-purple-600">
                  {volume.driver || 'local'}
                </p>
              </div>
              <HardDrive className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
        </div>
      </div>

      {/* Mount Point */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MapPin className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-primary">
            Mount Point
          </h3>
        </div>
        <div className="bg-surface-secondary rounded-lg p-4">
          <code className="text-sm text-primary">
            {volume.mountpoint || 'Not available'}
          </code>
        </div>
      </Card>

      {/* Labels */}
      {volume.labels && Object.keys(volume.labels).length > 0 && (
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Tag className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-primary">
              Labels
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(volume.labels).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-surface-secondary rounded-lg p-3"
              >
                <span className="text-sm font-medium text-secondary">
                  {key}
                </span>
                <span className="text-sm font-mono text-primary">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Scan Information */}
      {scanResult && (
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Activity className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-primary">
              Scan Information
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Status:</span>
              <span className="font-medium text-primary">
                {scanResult.status || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Processed:</span>
              <span className="font-medium text-primary">
                {formatSize(scanResult.bytes_processed)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Elapsed:</span>
              <span className="font-medium text-primary">
                {scanResult.elapsed_seconds != null
                  ? `${scanResult.elapsed_seconds}s`
                  : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Last Update:</span>
              <span className="font-medium text-primary">
                {formatDate(scanResult.last_update)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Explorer UI Integration */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            File Explorer - Tree and Browse Integration
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ExplorerView
                volumeId={volumeId}
                volumeName={volume.name || volumeId}
              />
            </div>
            <div>
              <FileMetadataView file={null} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VolumeDetailsPage;
