export interface ColumnConfig {
  /** Column key identifier */
  key: string;
  /** Display label for the column */
  label: string;
  /** Optional description for accessibility */
  description?: string;
  /** Whether the column is always visible (cannot be hidden) */
  required?: boolean;
}

export interface ColumnConfigProps {
  /** Whether the config panel is shown */
  show: boolean;
  /** Handler to toggle config panel visibility */
  onToggle: () => void;
  /** Available columns that can be configured */
  availableColumns: ColumnConfig[];
  /** Set of currently visible column keys */
  visibleColumns: Set<string>;
  /** Handler to toggle column visibility */
  onToggleColumn: (columnKey: string) => void;
  /** Additional CSS classes */
  className?: string;
}
