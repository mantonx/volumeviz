import type React from 'react';

// Filter chip interface for active filters display
export interface FilterChip {
  id: string;
  label: string;
  value: string;
  type: 'type' | 'status' | 'project' | 'driver' | 'readonly';
  removable: boolean;
}

// Bulk action configuration for volume operations
export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (selectedIds: string[]) => Promise<void>;
  variant?: 'default' | 'destructive';
}

// Column configuration for table display
export interface ColumnConfig {
  key: string;
  label: string;
  sortable: boolean;
}

// Sort configuration
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// View mode for display switching
export type ViewMode = 'table' | 'cards';

// Selection mode for bulk operations
export type SelectionMode = 'none' | 'page' | 'all';

// Props for the VolumesList component
export interface VolumesListProps {
  className?: string;
}
