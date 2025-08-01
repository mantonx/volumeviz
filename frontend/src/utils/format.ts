import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format bytes to human-readable string with appropriate units.
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

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
 * Truncate text with ellipsis at specified length.
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};