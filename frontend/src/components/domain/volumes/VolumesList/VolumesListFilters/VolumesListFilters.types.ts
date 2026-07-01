/**
 * VolumesListFilters Component Types
 */

// Re-export VolumeFilters from atoms to ensure consistency
import type { VolumeFilters } from '@/atoms/volumes/volumes.types';
export type { VolumeFilters };

export interface VolumesListFiltersProps {
  /**
   * Current filter values
   */
  filters: VolumeFilters;

  /**
   * Callback when search term changes
   */
  onSearchChange: (searchTerm: string) => void;

  /**
   * Callback when filters change
   */
  onFilterChange: (filters: Partial<VolumeFilters>) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}
