/**
 * VolumesListFilters Component
 *
 * Displays search input and filter dropdowns for volumes list.
 * Shows active filters as removable chips.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import { Search } from 'lucide-react';
import { FilterChip, FILTER_STATUS } from '../../shared';
import type { VolumesListFiltersProps } from './VolumesListFilters.types';

/**
 * VolumesListFilters displays search and filter controls
 */
export const VolumesListFilters: React.FC<VolumesListFiltersProps> = ({
  filters,
  onSearchChange,
  onFilterChange,
  className,
}) => {
  const hasActiveFilters = filters.searchTerm || filters.status !== 'all' || filters.orphaned;

  return (
    <div className={cn('bg-surface-elevated shadow-md rounded-lg p-6 border border-line', className)}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-tertiary" />
            </div>
            <input
              type="text"
              className={cn(
                'block w-full pl-10 pr-3 py-2 border border-line rounded-md leading-5',
                'bg-surface placeholder-tertiary text-primary',
                'focus:outline-none focus:placeholder-gray-400',
                'focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
                'sm:text-sm'
              )}
              placeholder="Search volumes..."
              value={filters.searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search volumes"
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <select
            className={cn(
              'block w-full px-3 py-2 border border-line bg-surface text-primary rounded-md shadow-sm',
              'focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
            )}
            value={filters.status}
            onChange={(e) =>
              onFilterChange({
                status: e.target.value as 'all' | 'active' | 'inactive',
              })
            }
            aria-label="Filter by status"
          >
            <option value={FILTER_STATUS.ALL}>All Status</option>
            <option value={FILTER_STATUS.ACTIVE}>Active</option>
            <option value={FILTER_STATUS.INACTIVE}>Inactive</option>
          </select>

          {/* Orphaned Filter */}
          <select
            className={cn(
              'block w-full px-3 py-2 border border-line bg-surface text-primary rounded-md shadow-sm',
              'focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
            )}
            value={filters.orphaned ? 'orphaned' : 'all'}
            onChange={(e) =>
              onFilterChange({
                orphaned: e.target.value === 'orphaned',
              })
            }
            aria-label="Filter by orphaned status"
          >
            <option value="all">All Volumes</option>
            <option value="orphaned">Orphaned Only</option>
          </select>

          {/* Sort By */}
          <select
            className={cn(
              'block w-full px-3 py-2 border border-line bg-surface text-primary rounded-md shadow-sm',
              'focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
            )}
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as 'name' | 'size' | 'created',
              })
            }
            aria-label="Sort volumes by"
          >
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            <option value="created">Sort by Created</option>
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.searchTerm && (
            <FilterChip
              label={`Search: "${filters.searchTerm}"`}
              onRemove={() => onSearchChange('')}
            />
          )}
          {filters.status !== 'all' && (
            <FilterChip
              label={`Status: ${filters.status}`}
              onRemove={() => onFilterChange({ status: 'all' })}
            />
          )}
          {filters.orphaned && (
            <FilterChip
              label="Orphaned Only"
              onRemove={() => onFilterChange({ orphaned: false })}
            />
          )}
        </div>
      )}
    </div>
  );
};
