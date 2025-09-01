import { useAtomValue } from 'jotai';
import { Loader2, AlertCircle, RefreshCw, Play, Database, HardDrive } from 'lucide-react';
import React, { useEffect } from 'react';
import { 
  useGetVolumesIdSize,
  useGetVolumesIdScanStatus,
  useGetVolumesIdMediaStatus 
} from '@/api/orval-generated/api';
import { selectedVolumeAtom } from '@/atoms/volumes';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';

interface VolumeDetailsProps {
  volumeId?: string;
  className?: string;
}

export function VolumeDetails({ volumeId, className = '' }: VolumeDetailsProps) {
  const selectedVolume = useAtomValue(selectedVolumeAtom);
  const currentVolumeId = volumeId || selectedVolume;
  
  const { refreshVolumeSize, indexFilesystem } = useVolumeOperations();

  // Fetch volume size data
  const { 
    data: sizeData, 
    isLoading: sizeLoading, 
    error: sizeError,
    refetch: refetchSize 
  } = useGetVolumesIdSize(
    { id: currentVolumeId || '' },
    {
      query: {
        enabled: !!currentVolumeId,
        refetchInterval: 30000, // Refresh every 30 seconds
      },
    }
  );

  // Fetch scan status
  const { 
    data: scanStatus, 
    isLoading: scanLoading,
    refetch: refetchScanStatus 
  } = useGetVolumesIdScanStatus(
    { id: currentVolumeId || '' },
    {
      query: {
        enabled: !!currentVolumeId,
        refetchInterval: 5000, // More frequent for scan status
      },
    }
  );

  // Fetch media status
  const { 
    data: mediaStatus,
    isLoading: mediaLoading 
  } = useGetVolumesIdMediaStatus(
    { id: currentVolumeId || '' },
    {
      query: {
        enabled: !!currentVolumeId,
        refetchInterval: 60000, // Less frequent for media status
      },
    }
  );

  // Handle volume operations
  const handleRefreshSize = async () => {
    if (!currentVolumeId) return;
    try {
      await refreshVolumeSize.mutateAsync(currentVolumeId);
      // Refetch data after mutation
      setTimeout(() => {
        refetchSize();
        refetchScanStatus();
      }, 1000);
    } catch (error) {
      console.error('Failed to refresh volume size:', error);
    }
  };

  const handleIndexFilesystem = async () => {
    if (!currentVolumeId) return;
    try {
      await indexFilesystem.mutateAsync(currentVolumeId);
    } catch (error) {
      console.error('Failed to index filesystem:', error);
    }
  };

  if (!currentVolumeId) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="text-gray-400">
          <Database className="mx-auto h-12 w-12" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No volume selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select a volume from the list to view details.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = sizeLoading || scanLoading || mediaLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Volume Details</h2>
          <p className="text-sm text-gray-500">ID: {currentVolumeId}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRefreshSize}
            disabled={refreshVolumeSize.isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`-ml-0.5 mr-2 h-4 w-4 ${refreshVolumeSize.isLoading ? 'animate-spin' : ''}`} />
            Refresh Size
          </button>
          <button
            onClick={handleIndexFilesystem}
            disabled={indexFilesystem.isLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <HardDrive className={`-ml-0.5 mr-2 h-4 w-4 ${indexFilesystem.isLoading ? 'animate-spin' : ''}`} />
            Index Files
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Error States */}
      {sizeError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading volume size
              </h3>
              <p className="mt-2 text-sm text-red-700">
                {sizeError.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Volume Size Information */}
      {sizeData && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Size Information
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Size</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatBytes(sizeData.total_size || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">File Count</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {(sizeData.file_count || 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Directory Count</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {(sizeData.directory_count || 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {sizeData.updated_at ? 
                    new Date(sizeData.updated_at).toLocaleDateString() : 
                    'Never'
                  }
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Scan Status */}
      {scanStatus && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Scan Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className={`flex-shrink-0 w-3 h-3 rounded-full ${
                  scanStatus.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                  scanStatus.status === 'completed' ? 'bg-green-400' :
                  scanStatus.status === 'failed' ? 'bg-red-400' :
                  'bg-gray-400'
                }`} />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    Status: {scanStatus.status || 'Unknown'}
                  </p>
                  {scanStatus.message && (
                    <p className="text-sm text-gray-500">{scanStatus.message}</p>
                  )}
                </div>
              </div>
              
              {scanStatus.progress !== undefined && scanStatus.progress > 0 && (
                <div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{Math.round(scanStatus.progress)}%</span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {scanStatus.started_at && (
                <p className="text-sm text-gray-500">
                  Started: {new Date(scanStatus.started_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Media Status */}
      {mediaStatus && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Media Status
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Media Files</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {(mediaStatus.total_media_files || 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Processed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {(mediaStatus.processed_count || 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    mediaStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                    mediaStatus.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    mediaStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {mediaStatus.status || 'Unknown'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {mediaStatus.updated_at ? 
                    new Date(mediaStatus.updated_at).toLocaleDateString() : 
                    'Never'
                  }
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}