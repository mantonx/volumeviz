/**
 * Props for the VolumeTableRow component.
 */
export interface VolumeTableRowProps {
  /** Volume data to display */
  volume: any; // TODO: Replace with proper VolumeV1 type from API
  /** Whether this row is selected */
  isSelected: boolean;
  /** Whether this row is expanded to show details */
  isExpanded: boolean;
  /** Callback when row selection changes */
  onSelect: (volumeId: string) => void;
  /** Callback when row is clicked */
  onClick: (volume: any) => void;
  /** Callback when expand/collapse is toggled */
  onToggleExpand: (volumeId: string) => void;
  /** Callback to open volume details modal */
  onOpenModal: (volumeId: string) => void;
  /** Track volume action */
  onTrack: (volumeId: string) => Promise<void>;
  /** Untrack volume action */
  onUntrack: (volumeId: string) => Promise<void>;
  /** Scan volume action */
  onScan: (volumeId: string) => Promise<void>;
  /** Stage this volume for deletion (opens the confirm modal) */
  onDelete: (volumeId: string) => void;
}
