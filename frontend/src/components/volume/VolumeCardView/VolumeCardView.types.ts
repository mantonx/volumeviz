import type React from 'react';
import type { DropdownItem } from '@/components/ui/Dropdown';
import type { VolumeMount } from '../VolumeTableView/VolumeTableView.types';

export interface VolumeCardViewProps {
  /** Volume data to display */
  data: VolumeMount[];
  /** Set of selected volume IDs */
  selectedIds: Set<string>;
  /** Handler for individual item selection */
  onSelectItem: (id: string) => void;
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
  /** Additional CSS classes */
  className?: string;
}
