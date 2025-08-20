import type { ScanHistoryEntry, ScanHistoryFilter } from '../../../types/scanHistory';

export interface ScanHistoryPanelProps {
  /** History entries to display */
  entries?: ScanHistoryEntry[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Current filter */
  filter?: ScanHistoryFilter;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Whether to show export options */
  showExport?: boolean;
  /** Maximum entries to display */
  maxEntries?: number;
  /** Event handlers */
  onFilterChange?: (filter: ScanHistoryFilter) => void;
  onEntryClick?: (entry: ScanHistoryEntry) => void;
  onEntryDelete?: (scanId: string) => void;
  onExport?: (format: 'csv' | 'json') => void;
  onRefresh?: () => void;
  onClearHistory?: () => void;
  /** Custom CSS classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

export interface ScanHistoryEntryCardProps {
  entry: ScanHistoryEntry;
  onClick?: (entry: ScanHistoryEntry) => void;
  onDelete?: (scanId: string) => void;
  showDetails?: boolean;
  className?: string;
}

export interface ScanHistoryFiltersProps {
  filter: ScanHistoryFilter;
  onChange: (filter: ScanHistoryFilter) => void;
  className?: string;
}