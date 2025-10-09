/**
 * FilterChips - Visual display of active search filters
 *
 * Shows active filters as chips/tags with remove buttons
 */

import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { FilterState, MediaTypeCategory } from './AdvancedFilters.types';

export interface FilterChipsProps {
  filters: FilterState;
  onRemoveFilter: (key: keyof FilterState, value?: string) => void;
  onClearAll: () => void;
  className?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
  className = '',
}) => {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  // Helper to convert size to bytes for display
  const convertToBytes = (value: number, unit: 'B' | 'KB' | 'MB' | 'GB' = 'MB'): number => {
    const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    return value * multipliers[unit];
  };

  // Helper to format size
  const formatSize = (value: number, unit: 'B' | 'KB' | 'MB' | 'GB' = 'MB'): string => {
    return `${value} ${unit}`;
  };

  // Add size range chips
  if (filters.sizeRange) {
    if (filters.sizeRange.min !== undefined) {
      chips.push({
        key: 'size-min',
        label: `Size ≥ ${formatSize(filters.sizeRange.min, filters.sizeRange.minUnit)}`,
        onRemove: () => {
          const newRange = { ...filters.sizeRange };
          delete newRange.min;
          delete newRange.minUnit;
          if (!newRange.max) {
            onRemoveFilter('sizeRange');
          } else {
            onRemoveFilter('sizeRange');
          }
        },
      });
    }
    if (filters.sizeRange.max !== undefined) {
      chips.push({
        key: 'size-max',
        label: `Size ≤ ${formatSize(filters.sizeRange.max, filters.sizeRange.maxUnit)}`,
        onRemove: () => {
          const newRange = { ...filters.sizeRange };
          delete newRange.max;
          delete newRange.maxUnit;
          if (!newRange.min) {
            onRemoveFilter('sizeRange');
          } else {
            onRemoveFilter('sizeRange');
          }
        },
      });
    }
  }

  // Add date range chips
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      chips.push({
        key: 'date-start',
        label: `From ${new Date(filters.dateRange.start).toLocaleDateString()}`,
        onRemove: () => {
          const newRange = { ...filters.dateRange };
          delete newRange.start;
          if (!newRange.end) {
            onRemoveFilter('dateRange');
          } else {
            onRemoveFilter('dateRange');
          }
        },
      });
    }
    if (filters.dateRange.end) {
      chips.push({
        key: 'date-end',
        label: `To ${new Date(filters.dateRange.end).toLocaleDateString()}`,
        onRemove: () => {
          const newRange = { ...filters.dateRange };
          delete newRange.end;
          if (!newRange.start) {
            onRemoveFilter('dateRange');
          } else {
            onRemoveFilter('dateRange');
          }
        },
      });
    }
  }

  // Add media type chips
  if (filters.mediaTypes && filters.mediaTypes.length > 0) {
    filters.mediaTypes.forEach((type) => {
      chips.push({
        key: `media-${type}`,
        label: `Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        onRemove: () => {
          const newTypes = filters.mediaTypes?.filter((t) => t !== type);
          if (newTypes && newTypes.length === 0) {
            onRemoveFilter('mediaTypes');
          } else {
            onRemoveFilter('mediaTypes', type);
          }
        },
      });
    });
  }

  // Add file type chips
  if (filters.fileTypes && filters.fileTypes.length > 0) {
    filters.fileTypes.forEach((ext) => {
      chips.push({
        key: `ext-${ext}`,
        label: `.${ext}`,
        onRemove: () => {
          const newExts = filters.fileTypes?.filter((e) => e !== ext);
          if (newExts && newExts.length === 0) {
            onRemoveFilter('fileTypes');
          } else {
            onRemoveFilter('fileTypes', ext);
          }
        },
      });
    });
  }

  // Add volume chips
  if (filters.volumes && filters.volumes.length > 0) {
    filters.volumes.forEach((vol) => {
      chips.push({
        key: `vol-${vol}`,
        label: `Volume: ${vol}`,
        onRemove: () => {
          const newVols = filters.volumes?.filter((v) => v !== vol);
          if (newVols && newVols.length === 0) {
            onRemoveFilter('volumes');
          } else {
            onRemoveFilter('volumes', vol);
          }
        },
      });
    });
  }

  // Add path filter chip
  if (filters.pathFilter) {
    chips.push({
      key: 'path',
      label: `Path: ${filters.pathFilter}`,
      onRemove: () => onRemoveFilter('pathFilter'),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Filters:</span>
      {chips.map((chip) => (
        <div
          key={chip.key}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
        >
          <span>{chip.label}</span>
          <button
            onClick={chip.onRemove}
            className="hover:text-blue-900 dark:hover:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
};
