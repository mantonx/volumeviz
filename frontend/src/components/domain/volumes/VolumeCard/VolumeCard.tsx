import { selectedVolumeAtom } from '@/atoms/volumes';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';
import { formatBytes } from '@/utils/formatters';
import { cn } from '@/utils/ui';
import { useSetAtom } from 'jotai';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  Play,
  RefreshCw,
} from 'lucide-react';
import React from 'react';
import { VolumeCardProps } from './VolumeCard.types';

export const VolumeCard: React.FC<VolumeCardProps> = ({
  volume,
  isSelected = false,
  onSelect,
  showActions = true,
  className,
}) => {
  const setSelectedVolume = useSetAtom(selectedVolumeAtom);
  const { scanVolume, refreshVolumeSize } = useVolumeOperations();

  const handleCardClick = () => {
    setSelectedVolume(volume.id);
    onSelect?.(volume.id);
  };

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await scanVolume.mutateAsync(volume.id);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await refreshVolumeSize.mutateAsync(volume.id);
  };

  // Status indicators
  const getStatusColor = () => {
    switch (volume.status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'scanning':
        return 'text-blue-600 bg-blue-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'inactive':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (volume.status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'scanning':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const sizePercentage = volume.quota_bytes
    ? Math.min((volume.size_bytes / volume.quota_bytes) * 100, 100)
    : 0;

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer',
        isSelected && 'ring-2 ring-blue-500 border-blue-300',
        volume.status === 'error' && 'border-red-200 bg-red-50',
        className,
      )}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <HardDrive className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {volume.name}
            </h3>
            <p className="text-sm text-gray-500 truncate" title={volume.path}>
              {volume.path}
            </p>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              disabled={refreshVolumeSize.isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Refresh size"
            >
              <RefreshCw
                className={cn(
                  'w-4 h-4',
                  refreshVolumeSize.isLoading && 'animate-spin',
                )}
              />
            </button>
            <button
              onClick={handleScan}
              disabled={scanVolume.isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Start scan"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between mb-4">
        <div
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
            getStatusColor(),
          )}
        >
          {getStatusIcon()}
          <span className="ml-1.5 capitalize">{volume.status}</span>
        </div>

        {volume.container_count > 0 && (
          <span className="text-xs text-gray-500">
            {volume.container_count} container
            {volume.container_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Size Information */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Storage Used
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {formatBytes(volume.size_bytes)}
            {volume.quota_bytes && (
              <span className="text-gray-500 font-normal">
                {' '}
                of {formatBytes(volume.quota_bytes)}
              </span>
            )}
          </span>
        </div>

        {/* Progress Bar */}
        {volume.quota_bytes && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                sizePercentage > 90
                  ? 'bg-red-500'
                  : sizePercentage > 75
                    ? 'bg-yellow-500'
                    : 'bg-blue-500',
              )}
              style={{ width: `${Math.min(sizePercentage, 100)}%` }}
            />
          </div>
        )}

        {/* File Count */}
        {volume.file_count !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Files</span>
            <span className="text-sm text-gray-700">
              {volume.file_count.toLocaleString()}
            </span>
          </div>
        )}

        {/* Last Scan */}
        {volume.last_scanned_at && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Last Scanned</span>
            <span className="text-sm text-gray-700">
              {new Date(volume.last_scanned_at).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {volume.status === 'error' && volume.error_message && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            {volume.error_message}
          </p>
        </div>
      )}
    </div>
  );
};
