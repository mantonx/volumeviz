/**
 * Volume-related constants and enums
 *
 * Centralized location for volume status values, filter options,
 * and other magic strings used throughout the volumes domain.
 */

/**
 * Volume status values
 */
export const VOLUME_STATUS = {
  ACTIVE: 'active',
  SCANNING: 'scanning',
  ERROR: 'error',
  PENDING: 'pending',
  INACTIVE: 'inactive',
} as const;

export type VolumeStatus = (typeof VOLUME_STATUS)[keyof typeof VOLUME_STATUS];

/**
 * Volume scan status values
 */
export const SCAN_STATUS = {
  RUNNING: 'running',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  IDLE: 'idle',
} as const;

export type ScanStatus = (typeof SCAN_STATUS)[keyof typeof SCAN_STATUS];

/**
 * Volume filter status options
 */
export const FILTER_STATUS = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type FilterStatus = (typeof FILTER_STATUS)[keyof typeof FILTER_STATUS];

/**
 * Volume sort options
 */
export const SORT_OPTIONS = {
  NAME: 'name',
  SIZE: 'size',
  CREATED: 'created',
} as const;

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

/**
 * Status badge color classes
 */
export const STATUS_BADGE_CLASSES = {
  [VOLUME_STATUS.ACTIVE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  [VOLUME_STATUS.SCANNING]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [VOLUME_STATUS.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  [VOLUME_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  [VOLUME_STATUS.INACTIVE]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
} as const;

/**
 * Status icon color classes
 */
export const STATUS_ICON_COLORS = {
  [VOLUME_STATUS.ACTIVE]: 'text-green-600',
  [VOLUME_STATUS.SCANNING]: 'text-blue-600',
  [VOLUME_STATUS.ERROR]: 'text-red-600',
  [VOLUME_STATUS.PENDING]: 'text-yellow-600',
  [VOLUME_STATUS.INACTIVE]: 'text-gray-600',
} as const;

/**
 * Default page size for volume lists
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Volume table column IDs
 */
export const VOLUME_COLUMNS = {
  SELECTION: 'selection',
  NAME: 'name',
  STATUS: 'status',
  SIZE: 'size',
  FILES: 'files',
  CONTAINERS: 'containers',
  LAST_SCANNED: 'last_scanned',
  ACTIONS: 'actions',
} as const;
