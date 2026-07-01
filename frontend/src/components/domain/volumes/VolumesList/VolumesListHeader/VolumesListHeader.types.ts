/**
 * VolumesListHeader Component Types
 */

export type ViewMode = 'grid' | 'table';

export interface VolumesListHeaderProps {
  /**
   * Current view mode
   */
  viewMode: ViewMode;

  /**
   * Callback when view mode changes
   */
  onViewModeChange: (mode: ViewMode) => void;

  /**
   * Callback when scan all is clicked
   */
  onScanAll: () => void;

  /**
   * Whether scan operation is loading
   */
  isScanLoading: boolean;

  /**
   * Whether volumes are available to scan
   */
  hasVolumes: boolean;

  /**
   * Callback to export volumes as CSV
   */
  onExportCSV: () => void;

  /**
   * Callback to export volumes as JSON
   */
  onExportJSON: () => void;

  /**
   * Whether export operation is loading
   */
  isExportLoading: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}
