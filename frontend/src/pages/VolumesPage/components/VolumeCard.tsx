import type { ScanResponse, Volume } from '@/api/generated/volumeviz-api';
import { useVolumeScanning } from '@/api/services';
import { Badge, Button, Card, useToast } from '@/components/ui';
import { formatBytes } from '@/utils/formatters';
import { Activity, Database, HardDrive } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface VolumeCardProps {
  volume: Volume;
}

export const VolumeCard: React.FC<VolumeCardProps> = ({ volume }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { scanVolume, scanResults, scanLoading } = useVolumeScanning();
  const volumeId = volume.volume_id || volume.name || '';
  const scanResult = volumeId
    ? (scanResults[volumeId] as ScanResponse)
    : undefined;
  const isScanning = volumeId ? Boolean(scanLoading[volumeId]) : false;

  const handleScan = async () => {
    if (isScanning) return;
    try {
      showToast(
        `Starting scan for ${volume.name || 'volume'}...`,
        'info',
        3000,
      );
      await scanVolume(volumeId, { async: false });
      showToast(`Successfully scanned ${volume.name || 'volume'}`, 'success');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      showToast(
        `Failed to scan ${volume.name || 'volume'}: ${errorMessage}`,
        'error',
      );
      console.error('Failed to scan volume:', error);
    }
  };

  const handleViewDetails = () => {
    if (volume.name) navigate(`/volumes/${encodeURIComponent(volume.name)}`);
  };

  const formatSize = (bytes?: number | null): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return 'Unknown';
    return formatBytes(bytes);
  };

  const getStatusVariant = (isActive?: boolean | null) =>
    isActive ? 'success' : 'outline';
  const getStatusText = (isActive?: boolean | null) =>
    isActive ? 'Active' : 'Inactive';

  // Check multiple size sources: scan result, volume size_bytes, or usage data
  const getVolumeSize = () => {
    if (scanResult?.result?.total_size) {
      return formatSize(scanResult.result.total_size);
    }
    if (volume.size_bytes) {
      return formatSize(volume.size_bytes);
    }
    return 'Unknown';
  };

  const isOrphaned =
    volume.is_orphaned ||
    ((volume.attachments_count === 0 || !volume.attachments_count) &&
      volume.status !== 'active');

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
          {isOrphaned && <Badge variant="error">Orphaned</Badge>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Size:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {getVolumeSize()}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Mount Point:</span>
          <span
            className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-48"
            title={volume.mountpoint}
          >
            {volume.mountpoint || '/var/lib/docker/volumes'}
          </span>
        </div>
      </div>

      <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          disabled={isScanning}
          className="flex-1"
        >
          <Activity
            className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`}
          />
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

export default VolumeCard;
