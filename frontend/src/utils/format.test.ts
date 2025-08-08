/**
 * Tests for format utility functions
 */

import {
  formatBytes,
  formatPercentage,
  formatUptime,
  formatDate,
  formatRelativeTime,
  truncate,
} from './format';

// Mock date-fns functions
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn((date, options) => {
    const mockDate = new Date('2024-01-15T12:00:00Z');
    const inputDate = new Date(date);
    const diffMs = mockDate.getTime() - inputDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (options?.addSuffix) {
      return `${diffHours} hours ago`;
    }
    return `${diffHours} hours`;
  }),
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM dd, yyyy HH:mm') {
      return 'Jan 15, 2024 12:00';
    }
    return 'formatted date';
  }),
}));

describe('formatBytes', () => {
  it('should format zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes correctly', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('should format kilobytes correctly', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('should format megabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.50 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.50 GB');
  });

  it('should respect decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1536, 3)).toBe('1.500 KB');
  });

  it('should handle negative decimal places', () => {
    expect(formatBytes(1536, -1)).toBe('2 KB');
  });

  it('should format large numbers correctly', () => {
    const terabyte = 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(terabyte)).toBe('1 TB');
  });

  it('should handle petabyte scale', () => {
    const petabyte = Math.pow(1024, 5);
    expect(formatBytes(petabyte)).toBe('1 PB');
  });
});

describe('formatPercentage', () => {
  it('should format percentage with default decimal places', () => {
    expect(formatPercentage(75.678)).toBe('75.7%');
    expect(formatPercentage(100)).toBe('100.0%');
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('should format percentage with custom decimal places', () => {
    expect(formatPercentage(75.678, 0)).toBe('76%');
    expect(formatPercentage(75.678, 2)).toBe('75.68%');
    expect(formatPercentage(75.678, 3)).toBe('75.678%');
  });

  it('should handle edge cases', () => {
    expect(formatPercentage(0.123, 2)).toBe('0.12%');
    expect(formatPercentage(99.999, 1)).toBe('100.0%');
    expect(formatPercentage(50.5, 0)).toBe('50%'); // Note: rounds to 50, not 51
  });
});

describe('formatUptime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format uptime without suffix', () => {
    const createdAt = '2024-01-15T08:00:00Z';
    const result = formatUptime(createdAt);

    expect(result).toBe('4 hours');
  });

  it('should call formatDistanceToNow with correct options', () => {
    const { formatDistanceToNow } = require('date-fns');
    const createdAt = '2024-01-15T08:00:00Z';

    formatUptime(createdAt);

    expect(formatDistanceToNow).toHaveBeenCalledWith(new Date(createdAt), {
      addSuffix: false,
    });
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format date with default format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = formatDate(date);

    expect(result).toBe('Jan 15, 2024 12:00');
  });

  it('should format string dates', () => {
    const dateString = '2024-01-15T12:00:00Z';
    const result = formatDate(dateString);

    expect(result).toBe('Jan 15, 2024 12:00');
  });

  it('should call format with correct parameters', () => {
    const { format } = require('date-fns');
    const date = new Date('2024-01-15T12:00:00Z');

    formatDate(date);

    expect(format).toHaveBeenCalledWith(date, 'MMM dd, yyyy HH:mm');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format relative time with suffix', () => {
    const date = new Date('2024-01-15T08:00:00Z');
    const result = formatRelativeTime(date);

    expect(result).toBe('4 hours ago');
  });

  it('should format string dates', () => {
    const dateString = '2024-01-15T08:00:00Z';
    const result = formatRelativeTime(dateString);

    expect(result).toBe('4 hours ago');
  });

  it('should call formatDistanceToNow with suffix', () => {
    const { formatDistanceToNow } = require('date-fns');
    const date = new Date('2024-01-15T08:00:00Z');

    formatRelativeTime(date);

    expect(formatDistanceToNow).toHaveBeenCalledWith(date, { addSuffix: true });
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('Short text', 20)).toBe('Short text');
    expect(truncate('Exact length', 12)).toBe('Exact length');
  });

  it('should truncate long strings', () => {
    const longText = 'This is a very long string that needs truncation';
    expect(truncate(longText, 20)).toBe('This is a very lo...');
    expect(truncate(longText, 10)).toBe('This is...');
  });

  it('should handle edge cases', () => {
    expect(truncate('Test', 4)).toBe('Test'); // Exact length
    expect(truncate('Test', 3)).toBe('Test'); // Shorter than ellipsis
    expect(truncate('Testing', 6)).toBe('Tes...');
  });

  it('should handle empty strings', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('should handle very short max lengths', () => {
    expect(truncate('Testing', 3)).toBe('...');
    expect(truncate('Testing', 1)).toBe('...');
    expect(truncate('Testing', 0)).toBe('...');
  });
});
