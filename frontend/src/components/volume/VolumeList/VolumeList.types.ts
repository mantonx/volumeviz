import React from 'react';
import { Volume } from '../../../types/api';

/**
 * Layout options for VolumeList display:
 * - grid: Card grid layout (default)
 * - list: Vertical list with detailed cards
 * - compact: Smaller cards in tighter grid
 */
export type VolumeListLayout = 'grid' | 'list' | 'compact';

/**
 * Props interface for VolumeList component.
 * Supports flexible pagination, layouts, and volume interactions.
 */
export interface VolumeListProps {
  /** Array of volumes to display */
  volumes: Volume[];

  /** Layout mode for volume display */
  layout?: VolumeListLayout;

  /** Number of volumes per page */
  pageSize?: number;

  /** Current page number (1-based) */
  currentPage?: number;

  /** Callback for page changes */
  onPageChange?: (page: number) => void;

  /** Callback for volume actions (scan, manage, details, etc.) */
  onVolumeAction?: (action: string, volumeId: string) => void;

  /** Whether to show pagination controls */
  showPagination?: boolean;

  /** Custom message for empty state */
  emptyStateMessage?: string;

  /** Optional action button/element for empty state */
  emptyStateAction?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}
