/**
 * Props for the FilterChip component.
 *
 * FilterChip is used to display active filters with a remove button,
 * allowing users to see and clear applied filters quickly.
 */
export interface FilterChipProps {
  /** Display label for the filter */
  label: string;
  /** Callback fired when the remove button is clicked */
  onRemove: () => void;
}
