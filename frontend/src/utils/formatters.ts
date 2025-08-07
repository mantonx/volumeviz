/**
 * Formats bytes into human-readable format.
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.50 GB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats a date into a relative time string or absolute date.
 * @param date - Date string or Date object
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options: {
    relative?: boolean;
    format?: 'short' | 'medium' | 'long';
  } = {},
): string {
  const { relative = true, format = 'medium' } = options;
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (relative) {
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
  }

  // Fall back to absolute date
  const formatOptions: Intl.DateTimeFormatOptions = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  }[format];

  return dateObj.toLocaleDateString(undefined, formatOptions);
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Formats a number with thousands separators.
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Truncates a string to a maximum length with ellipsis.
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param position - Where to truncate ('end', 'middle', 'start')
 * @returns Truncated string
 */
export function truncateString(
  str: string,
  maxLength: number,
  position: 'end' | 'middle' | 'start' = 'end',
): string {
  if (str.length <= maxLength) return str;

  const ellipsis = '...';
  const truncatedLength = maxLength - ellipsis.length;

  switch (position) {
    case 'start':
      return ellipsis + str.slice(-truncatedLength);
    case 'middle': {
      const startLength = Math.ceil(truncatedLength / 2);
      const endLength = Math.floor(truncatedLength / 2);
      return str.slice(0, startLength) + ellipsis + str.slice(-endLength);
    }
    case 'end':
    default:
      return str.slice(0, truncatedLength) + ellipsis;
  }
}
