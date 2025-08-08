/**
 * Shared color palettes and utilities for visualization components
 */

// Color palette for consistent visualization
export const VOLUME_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
] as const;

export const DRIVER_COLORS: Record<string, string> = {
  local: '#3B82F6',
  nfs: '#10B981',
  cifs: '#F59E0B',
  overlay: '#EF4444',
  tmpfs: '#8B5CF6',
  bind: '#F97316',
  volume: '#06B6D4',
  default: '#6B7280',
};

export const SIZE_RANGE_COLORS = [
  '#22C55E', // < 100MB
  '#3B82F6', // 100MB - 1GB
  '#F59E0B', // 1GB - 10GB
  '#EF4444', // 10GB - 100GB
  '#8B5CF6', // > 100GB
] as const;

/**
 * Get a color from the volume color palette by index
 */
export const getVolumeColor = (index: number): string => {
  return VOLUME_COLORS[index % VOLUME_COLORS.length];
};

/**
 * Get a color for a specific driver type
 */
export const getDriverColor = (driver: string): string => {
  return DRIVER_COLORS[driver] || DRIVER_COLORS.default;
};

/**
 * Get a color for a size range by index
 */
export const getSizeRangeColor = (index: number): string => {
  return SIZE_RANGE_COLORS[index % SIZE_RANGE_COLORS.length];
};

/**
 * Generate a consistent color based on a string hash
 */
export const getHashColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return VOLUME_COLORS[Math.abs(hash) % VOLUME_COLORS.length];
};
