/**
 * FilesPage - Global file exploration and search interface
 *
 * This is the primary interface for browsing and searching files across ALL volumes.
 * Users can filter to a specific volume using the volume dropdown.
 *
 * Architecture:
 * - /volumes = Volume management (scan, track, monitor volumes as entities)
 * - /files = File exploration (browse/search files across volumes)
 *
 * Features:
 * - Browse files across all volumes or filter to one
 * - Global search across all volumes
 * - Volume filter dropdown
 * - URL state: /files?volume=foo&tab=search&path=/data
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, Search, Filter } from 'lucide-react';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { SearchPage } from '@/pages/SearchPage';
import { useGetVolumes } from '@/api/orval-generated/api';

type ViewMode = 'browse' | 'search';

export const FilesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get state from URL
  const selectedVolume = searchParams.get('volume') || 'all';
  const initialTab = searchParams.get('tab') as ViewMode | null;
  const [viewMode, setViewMode] = useState<ViewMode>(initialTab || 'browse');

  // Load volumes for the dropdown filter
  const { data: volumesResponse, isLoading: volumesLoading } = useGetVolumes({
    system: false,
    page_size: 100,
  });

  // Parse volumes from response - response is { data: Volume[], page, total }
  const volumes = (volumesResponse?.data as any[]) || [];

  // Update URL when view mode changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', mode);
    setSearchParams(newParams, { replace: true });
  };

  // Update URL when volume filter changes
  const handleVolumeChange = (volumeId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (volumeId === 'all') {
      newParams.delete('volume');
    } else {
      newParams.set('volume', volumeId);
    }
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header with volume filter */}
      <div className="bg-surface border-b border-line">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">File Explorer</h1>
              <p className="text-sm text-secondary mt-1">
                Browse and search files across your volumes
              </p>
            </div>

            {/* Volume Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-secondary" />
              <select
                value={selectedVolume}
                onChange={(e) => handleVolumeChange(e.target.value)}
                className="px-4 py-2 border border-line rounded-lg bg-surface text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={volumesLoading}
              >
                <option value="all">All Volumes ({volumes.length})</option>
                <optgroup label="Volumes">
                  {volumes.map((volume) => (
                    <option key={volume.name} value={volume.name}>
                      {volume.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-8 -mb-px">
            <button
              onClick={() => handleViewModeChange('browse')}
              className={`
                flex items-center gap-2 px-1 py-3 border-b-2 font-medium text-sm transition-colors
                ${
                  viewMode === 'browse'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-tertiary hover:text-secondary hover:border-gray-300'
                }
              `}
            >
              <FolderOpen className="w-4 h-4" />
              Browse Files
            </button>

            <button
              onClick={() => handleViewModeChange('search')}
              className={`
                flex items-center gap-2 px-1 py-3 border-b-2 font-medium text-sm transition-colors
                ${
                  viewMode === 'search'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-tertiary hover:text-secondary hover:border-gray-300'
                }
              `}
            >
              <Search className="w-4 h-4" />
              Search Files
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {viewMode === 'browse' ? (
          <ExplorerPage selectedVolumeFilter={selectedVolume} />
        ) : (
          <SearchPage selectedVolumeFilter={selectedVolume} />
        )}
      </div>
    </div>
  );
};

export default FilesPage;
