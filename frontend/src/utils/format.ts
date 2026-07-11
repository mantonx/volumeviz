import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format bytes to human-readable string with appropriate units.
 * Re-exported from formatters.ts for backward compatibility.
 */
export { formatBytes } from './formatters';

/**
 * Format percentage value with specified decimal places.
 */
export const formatPercentage = (value: number, decimals: number = 1): string =>
  `${value.toFixed(decimals)}%`;

/**
 * Format container uptime using date-fns for consistency.
 */
export const formatUptime = (createdAt: string): string =>
  formatDistanceToNow(new Date(createdAt), { addSuffix: false });

/**
 * Format date using date-fns with sensible defaults.
 */
export const formatDate = (date: Date | string): string =>
  format(new Date(date), 'MMM dd, yyyy HH:mm');

/**
 * Format relative time (e.g., "2 hours ago").
 */
export const formatRelativeTime = (date: Date | string): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

/**
 * Format duration from milliseconds to human-readable string.
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * Truncate text with ellipsis at specified length.
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return '...';
  return text.slice(0, maxLength - 3) + '...';
};
