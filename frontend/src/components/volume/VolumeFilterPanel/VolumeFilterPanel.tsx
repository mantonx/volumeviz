import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils';
import type { VolumeFilterPanelProps } from './VolumeFilterPanel.types';

/**
 * Filter panel component for the VolumesList
 * Provides search, quick filters, and advanced filter controls
 */
export const VolumeFilterPanel: React.FC<VolumeFilterPanelProps> = ({
  showAdvancedFilters,
  filterChips,
  onRemoveFilterChip,
  availableFilters,
  onApplyFilter,
  className,
}) => {
  const handleFilterChange = (filterKey: string, value: string) => {
    if (value) {
      onApplyFilter(filterKey, value);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active Filter Chips */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
            Active filters:
          </span>
          {filterChips.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-xs text-gray-800 dark:text-gray-300"
            >
              {chip.label}
              {chip.removable && (
                <button
                  onClick={() => onRemoveFilterChip(chip.id)}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5 ml-1"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t">
          {availableFilters.map((filter) => (
            <div key={filter.key}>
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                {filter.label}
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                value=""
              >
                <option value="">{filter.placeholder}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VolumeFilterPanel;
