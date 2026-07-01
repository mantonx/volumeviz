/**
 * AdvancedFilters - Advanced search filtering component
 *
 * Provides comprehensive filtering UI for search:
 * - File size (min/max with unit selector)
 * - Date range (modified dates)
 * - File type (extensions)
 * - Media type (categories)
 * - Volume selection
 * - Path filtering
 */

import React, { useState, useEffect } from 'react';
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  HardDrive,
  FileType,
  Folder,
  Image,
  Video,
  Music,
  FileArchive,
  Code,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getVolumes } from '@/api/orval-generated/api';
import type { AdvancedFiltersProps, FilterState, MediaTypeCategory } from './AdvancedFilters.types';

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [volumes, setVolumes] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVolumes, setLoadingVolumes] = useState(false);

  // Media type icons
  const mediaTypeIcons: Record<MediaTypeCategory, React.ReactNode> = {
    image: <Image className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    audio: <Music className="w-4 h-4" />,
    document: <FileText className="w-4 h-4" />,
    archive: <FileArchive className="w-4 h-4" />,
    code: <Code className="w-4 h-4" />,
  };

  // Load volumes on mount
  useEffect(() => {
    const loadVolumes = async () => {
      setLoadingVolumes(true);
      try {
        const response = await getVolumes({ page_size: 100 });
        if (response.status === 200) {
          const volumeList =
            (response.data.data as Array<{ name: string }> | undefined) ?? [];
          setVolumes(
            volumeList.map((v) => ({
              id: v.name,
              name: v.name,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to load volumes:', error);
      } finally {
        setLoadingVolumes(false);
      }
    };
    loadVolumes();
  }, []);

  // Helper to update filters
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Helper to clear a specific filter
  const clearFilter = (key: keyof FilterState) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  // Count active filters
  const activeFilterCount = Object.keys(filters).filter((key) => {
    const value = filters[key as keyof FilterState];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((v) => v !== undefined && v !== null && v !== '');
    }
    return value !== undefined && value !== null && value !== '';
  }).length;

  return (
    <div className={clsx('bg-surface border border-line rounded-lg overflow-hidden', className)}>
      {/* Filter Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 bg-surface hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-secondary" />
          <span className="font-medium text-primary">Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-tertiary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-tertiary" />
        )}
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* File Size Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              File Size
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Min Size */}
              <div>
                <label className="block text-xs text-secondary mb-1">Minimum</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.sizeRange?.min || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        min: value,
                        minUnit: filters.sizeRange?.minUnit || 'MB',
                      });
                    }}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                  <select
                    value={filters.sizeRange?.minUnit || 'MB'}
                    onChange={(e) => {
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        minUnit: e.target.value as 'B' | 'KB' | 'MB' | 'GB',
                      });
                    }}
                    className="px-2 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>

              {/* Max Size */}
              <div>
                <label className="block text-xs text-secondary mb-1">Maximum</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.sizeRange?.max || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        max: value,
                        maxUnit: filters.sizeRange?.maxUnit || 'MB',
                      });
                    }}
                    placeholder="∞"
                    className="flex-1 px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                  <select
                    value={filters.sizeRange?.maxUnit || 'MB'}
                    onChange={(e) => {
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        maxUnit: e.target.value as 'B' | 'KB' | 'MB' | 'GB',
                      });
                    }}
                    className="px-2 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>
            </div>
            {filters.sizeRange && (
              <button
                onClick={() => clearFilter('sizeRange')}
                className="mt-2 text-xs text-tertiary hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear size filter
              </button>
            )}
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Modified
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-xs text-secondary mb-1">From</label>
                <input
                  type="date"
                  value={
                    filters.dateRange?.start
                      ? new Date(filters.dateRange.start).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      start: e.target.value ? new Date(e.target.value) : undefined,
                    });
                  }}
                  className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs text-secondary mb-1">To</label>
                <input
                  type="date"
                  value={
                    filters.dateRange?.end
                      ? new Date(filters.dateRange.end).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      end: e.target.value ? new Date(e.target.value) : undefined,
                    });
                  }}
                  className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            {filters.dateRange && (
              <button
                onClick={() => clearFilter('dateRange')}
                className="mt-2 text-xs text-tertiary hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear date filter
              </button>
            )}
          </div>

          {/* Media Type Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Media Types
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                ['image', 'video', 'audio', 'document', 'archive', 'code'] as MediaTypeCategory[]
              ).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 px-3 py-2 border border-line rounded-md bg-surface-secondary hover:bg-surface-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.mediaTypes?.includes(type) || false}
                    onChange={(e) => {
                      const current = filters.mediaTypes || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter((t) => t !== type);
                      updateFilter('mediaTypes', updated.length > 0 ? updated : undefined);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center gap-1.5 text-sm text-primary">
                    {mediaTypeIcons[type]}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* File Type Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2 flex items-center gap-2">
              <FileType className="w-4 h-4" />
              File Extensions
            </label>
            <input
              type="text"
              value={filters.fileTypes?.join(', ') || ''}
              onChange={(e) => {
                const value = e.target.value
                  .split(',')
                  .map((ext) => ext.trim())
                  .filter(Boolean);
                updateFilter('fileTypes', value.length > 0 ? value : undefined);
              }}
              placeholder="e.g., jpg, mp4, pdf (comma-separated)"
              className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-tertiary">
              Enter file extensions separated by commas
            </p>
          </div>

          {/* Volume Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Volumes
            </label>
            {loadingVolumes ? (
              <div className="text-sm text-tertiary">Loading volumes...</div>
            ) : (
              <select
                multiple
                value={filters.volumes || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                  updateFilter('volumes', selected.length > 0 ? selected : undefined);
                }}
                className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size={Math.min(volumes.length, 4)}
              >
                {volumes.map((volume) => (
                  <option key={volume.id} value={volume.id}>
                    {volume.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-tertiary">
              Hold Ctrl/Cmd to select multiple volumes
            </p>
          </div>

          {/* Path Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Path Filter
            </label>
            <input
              type="text"
              value={filters.pathFilter || ''}
              onChange={(e) => {
                updateFilter('pathFilter', e.target.value || undefined);
              }}
              placeholder="e.g., /data/images"
              className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface-secondary text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-tertiary">
              Search within a specific directory path
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
