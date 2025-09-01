import { useAtomValue, useSetAtom } from 'jotai';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import React from 'react';
import { selectedVolumeAtom } from '@/atoms/volumes';
import { useVolumesList } from '@/hooks/api/useVolumesList';
import { useOrganization } from '@/hooks/api/useOrganization';
import type { VolumeV1 } from '@/api/orval-generated/api';

interface VolumeListProps {
  className?: string;
}

export function VolumeList({ className = '' }: VolumeListProps) {
  const { currentOrgId } = useOrganization();
  const { volumes, isLoading, error, refetch } = useVolumesList({
    page: 1,
    pageSize: 50,
  });
  const setSelectedVolume = useSetAtom(selectedVolumeAtom);

  if (!currentOrgId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organization selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please select an organization to view volumes.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-sm text-gray-500">Loading volumes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load volumes</h3>
          <p className="mt-1 text-sm text-gray-500">
            {error.message || 'An error occurred while loading volumes.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!volumes || volumes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No volumes found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a volume to track.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {volumes.map((volume) => (
          <VolumeCard 
            key={volume.id} 
            volume={volume}
            onClick={() => setSelectedVolume(volume.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Simple VolumeCard component for the list
interface VolumeCardProps {
  volume: VolumeV1;
  onClick: () => void;
}

const VolumeCard = React.memo(({ volume, onClick }: VolumeCardProps) => {
  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {volume.name}
          </h3>
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            volume.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {volume.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 truncate">
          {volume.path}
        </p>
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <span>{formatBytes(volume.size_bytes || 0)}</span>
          <span>{(volume.file_count || 0).toLocaleString()} files</span>
        </div>
        {volume.last_scanned_at && (
          <p className="mt-2 text-xs text-gray-400">
            Last scanned: {new Date(volume.last_scanned_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
});

VolumeCard.displayName = 'VolumeCard';