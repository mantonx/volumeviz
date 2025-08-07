import React from 'react';

/**
 * Volume data structure for VolumeCard display.
 * Contains all necessary information for volume representation
 * and management operations.
 */
export interface VolumeData {
  /** Unique volume identifier from Docker */
  id: string;
  /** Human-readable volume name (may be same as ID) */
  name?: string;
  /** Storage driver type (local, nfs, etc.) */
  driver?: string;
  /** Whether volume is currently in use by containers */
  isActive?: boolean;
  /** Number of containers currently using this volume */
  containerCount?: number;
  /** Filesystem path where volume is mounted */
  mountpoint?: string;
  /** Key-value metadata labels attached to volume */
  labels?: Record<string, string>;
  /** Volume creation timestamp */
  createdAt?: string;
}

/**
 * Visual variant options for VolumeCard display.
 *
 * - default: Standard card with all essential information
 * - compact: Minimal card for dense grid layouts
 * - detailed: Expanded card with full metadata and labels
 */
export type VolumeCardVariant = 'default' | 'compact' | 'detailed';

/**
 * Props for the VolumeCard component.
 *
 * Provides comprehensive volume display with configurable
 * actions and visual variants for different use cases.
 */
export interface VolumeCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Volume data to display */
  volume: VolumeData;

  /** Visual variant controlling card layout and information density */
  variant?: VolumeCardVariant;

  /** Whether to show quick action buttons at bottom of card */
  showQuickActions?: boolean;

  /** Callback fired when scan button is clicked */
  onScan?: () => void;

  /** Callback fired when manage/options button is clicked */
  onManage?: () => void;

  /** Callback fired when details button is clicked or card is clicked */
  onViewDetails?: () => void;
}
