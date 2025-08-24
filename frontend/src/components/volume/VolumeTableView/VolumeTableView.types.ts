import type React from 'react';
import type { VolumeMount } from '@/hooks/useVolumesAndMounts';
import type { DropdownItem } from '@/components/ui/Dropdown';

import type { ColumnDefinition } from '@/components/ui';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface VolumeTableViewProps {
  /** Volume data to display */
  data: VolumeMount[];
  /** Whether data is loading */
  loading: boolean;
  /** Set of selected volume IDs */
  selectedIds: Set<string>;
  /** Current selection mode */
  selectAllMode: 'none' | 'page' | 'all';
  /** Pagination metadata */
  paginationMeta: PaginationMeta;
  /** Available columns configuration */
  availableColumns: ColumnDefinition[];
  /** Set of visible column keys */
  visibleColumns: Set<string>;
  /** Current sort configuration */
  sortConfig: SortConfig[];
  /** Handler for column sorting */
  onSort: (field: string) => void;
  /** Handler for select all */
  onSelectAll: () => void;
  /** Handler for individual item selection */
  onSelectItem: (id: string) => void;
  /** Handler for select all across pages */
  onSelectAllPages: () => void;
  /** Handler for clearing selection */
  onClearSelection: () => void;
  /** Function to get volume actions dropdown items */
  getVolumeActions: (item: VolumeMount) => DropdownItem[];
  /** Function to get status color classes */
  getStatusColor: (status: VolumeMount['status']) => string;
  /** Function to get type icon component */
  getTypeIcon: (
    type: VolumeMount['type'],
  ) => React.ComponentType<{ className?: string }>;
  /** Function to format bytes */
  formatBytes: (bytes: number) => string;
  /** Function to calculate volume percentage */
  calculateVolumePercentage: (
    sizeBytes: number,
    filesystemCapacity: any,
    maxSize: number,
  ) => any;
  /** Maximum size for relative calculations */
  maxSize: number;
  /** Set of volumes with detailed progress */
  volumesWithDetailedProgress: Set<string>;
  /** Function to update detailed progress volumes */
  setVolumesWithDetailedProgress: React.Dispatch<
    React.SetStateAction<Set<string>>
  >;
  /** Whether select dropdown is shown */
  showSelectDropdown: boolean;
  /** Success toast function */
  success: (message: string) => void;
  /** Error toast function */
  showError: (message: string) => void;
  /** Additional CSS classes */
  className?: string;
}
