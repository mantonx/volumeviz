import type { QuickFilterConfig } from '@/utils/quickFilters';

export interface VolumeQuickFiltersProps {
  /** List of available quick filters */
  filters: QuickFilterConfig[];
  /** Set of currently active filter IDs */
  activeFilters: Set<string>;
  /** Handler for applying a filter */
  onApplyFilter: (filter: QuickFilterConfig) => void;
  /** Handler for clearing a filter */
  onClearFilter: (filterId: string) => void;
  /** Additional CSS classes */
  className?: string;
}
