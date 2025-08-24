import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import React from 'react';
import type { VolumeQuickFiltersProps } from './VolumeQuickFilters.types';

/**
 * Quick filter buttons for common volume queries
 * Provides one-click access to predefined filters
 */
export const VolumeQuickFilters: React.FC<VolumeQuickFiltersProps> = ({
  filters,
  activeFilters,
  onApplyFilter,
  onClearFilter,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilters.has(filter.id);

        return (
          <Button
            key={filter.id}
            variant={isActive ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              if (isActive) {
                onClearFilter(filter.id);
              } else {
                onApplyFilter(filter);
              }
            }}
            className={cn('transition-all', isActive && 'shadow-md')}
            title={filter.description}
          >
            <Icon className="h-4 w-4 mr-2" />
            {filter.label}
          </Button>
        );
      })}
    </div>
  );
};

export default VolumeQuickFilters;
