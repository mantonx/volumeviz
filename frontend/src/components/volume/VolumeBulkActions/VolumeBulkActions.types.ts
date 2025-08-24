import type React from 'react';

export interface BulkAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Action handler */
  action: (selectedIds: string[]) => Promise<void>;
  /** Visual variant */
  variant?: 'default' | 'destructive';
}

export interface VolumeBulkActionsProps {
  /** Number of selected items */
  selectedCount: number;
  /** Current selection mode */
  selectAllMode: 'none' | 'page' | 'all';
  /** Handler to clear selection */
  onClearSelection: () => void;
  /** Handler to select all items */
  onSelectAll: () => void;
  /** Handler to select current page */
  onSelectPage: () => void;
  /** Available bulk actions */
  bulkActions: BulkAction[];
  /** Whether an action is in progress */
  isProcessing?: boolean;
  /** Additional CSS classes */
  className?: string;
}
