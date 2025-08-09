import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
  ArrowLeft,
  HardDrive,
  Database,
  Activity,
  RefreshCw,
  Calendar,
  Tag,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useVolumes, useVolumeScanning } from '@/api/services';
import { volumesAtom } from '@/store';
import type { VolumeResponse } from '@/api/client';

const VolumeDetailsPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const volumes = useAtomValue(volumesAtom);
  const { fetchVolumes } = useVolumes();
  const { scanVolume, scanResults, scanLoading, scanError } = useVolumeScanning();


  const [volume, setVolume] = useState<VolumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find volume in current data or fetch if needed
  useEffect(() => {
    const findVolume = () => {
      const foundVolume = volumes.find(v => v.name === name);
      if (foundVolume) {
        setVolume(foundVolume);
        setLoading(false);
        setError(null);
      } else if (volumes.length === 0) {
        // No volumes loaded yet, fetch all volumes
        fetchVolumes({ q: name });
      } else {
        // Volume not found in current data
        setError('Volume not found');
        setLoading(false);
      }
    };

    if (name) {
      findVolume();
    }
  }, [name, volumes, fetchVolumes]);

  const handleScan = async () => {
    if (!volume) return;
    
    try {
      const volumeId = volume.volume_id || volume.name;
      await scanVolume(volumeId, { async: false });
    } catch (error) {
      console.error('Failed to scan volume:', error);
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

  const getStatusVariant = (isActive?: boolean) => {
    return isActive ? 'success' : 'outline';
  };

  const getStatusText = (isActive?: boolean): string => {
    return isActive ? 'Active' : 'Inactive';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading volume details...</p>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Volume Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The volume "{name}" could not be found.
          </p>
          <Button onClick={() => navigate('/volumes')}>
            Return to Volumes List
          </Button>
        </Card>
      </div>
    );
  }

  const volumeId = volume.volume_id || volume.name;
  const scanResult = scanResults[volumeId];
  const isScanning = scanLoading[volumeId];
  const scanErrorMessage = scanError[volumeId];

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {volume.name || 'Unnamed Volume'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Volume Details
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleScan}
            disabled={isScanning}
          >
            <Activity className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Size'}
          </Button>
          <Button onClick={() => fetchVolumes({ q: name })}>
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {volume.name || 'Unnamed Volume'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {volume.driver || 'local'} driver
              </p>
            </div>
            <div className="ml-auto flex space-x-2">
              <Badge variant={getStatusVariant(volume.is_active)}>
                {getStatusText(volume.is_active)}
              </Badge>
              {volume.is_orphaned && <Badge variant="destructive">Orphaned</Badge>}
              {volume.is_system && <Badge variant="secondary">System</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Volume ID:</span>
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {volume.volume_id || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Driver:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {volume.driver || 'local'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <Badge variant={getStatusVariant(volume.is_active)}>
                  {getStatusText(volume.is_active)}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Size:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {volume.size_bytes
                    ? formatSize(volume.size_bytes)
                    : scanResult
                      ? formatSize(scanResult.size_bytes)
                      : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Containers:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {volume.attachments_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                <span className="font-medium text-gray-900 dark:text-white">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Size</p>
                <p className="text-xl font-bold text-blue-600">
                  {volume.size_bytes
                    ? formatSize(volume.size_bytes)
                    : scanResult
                      ? formatSize(scanResult.size_bytes)
                      : 'Unknown'}
                </p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Containers</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Driver</p>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mount Point
          </h3>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <code className="text-sm text-gray-900 dark:text-white">
            {volume.mountpoint || 'Not available'}
          </code>
        </div>
      </Card>

      {/* Labels */}
      {volume.labels && Object.keys(volume.labels).length > 0 && (
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Tag className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Labels
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(volume.labels).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {key}
                </span>
                <span className="text-sm font-mono text-gray-900 dark:text-white">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Scan Information */}
      {(scanResult || scanErrorMessage) && (
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Activity className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Scan Information
            </h3>
          </div>
          {scanErrorMessage ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300">
                <strong>Scan Error:</strong> {scanErrorMessage}
              </p>
            </div>
          ) : scanResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Size:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatSize(scanResult.size_bytes)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Method:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {scanResult.method || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {scanResult.duration_ms ? `${scanResult.duration_ms}ms` : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Scanned At:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(scanResult.scanned_at)}
                </span>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
};

export default VolumeDetailsPage;