export interface FilterChip {
  /** Unique identifier for the filter */
  id: string;
  /** Display label for the filter */
  label: string;
  /** Filter value */
  value: string;
  /** Filter type */
  type: 'type' | 'status' | 'project' | 'driver' | 'readonly';
  /** Whether the filter can be removed */
  removable: boolean;
}

export interface FilterOption {
  /** Option value */
  value: string;
  /** Display label for the option */
  label: string;
}

export interface FilterConfig {
  /** Filter key identifier */
  key: string;
  /** Display label for the filter */
  label: string;
  /** Placeholder text */
  placeholder: string;
  /** Available filter options */
  options: FilterOption[];
}

export interface VolumeFilterPanelProps {
  /** Whether advanced filters are shown */
  showAdvancedFilters: boolean;
  /** Active filter chips */
  filterChips: FilterChip[];
  /** Handler to remove a filter chip */
  onRemoveFilterChip: (chipId: string) => void;
  /** Available filter configurations */
  availableFilters: FilterConfig[];
  /** Handler to apply a filter */
  onApplyFilter: (filterKey: string, value: string) => void;
  /** Additional CSS classes */
  className?: string;
}
