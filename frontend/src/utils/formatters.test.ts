/**
 * Tests for formatter utility functions
 */

import {
  formatBytes,
  formatDate,
  formatDuration,
  formatNumber,
  truncateString,
} from './formatters';

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
});

describe('formatDate', () => {
  beforeAll(() => {
    // Mock Date.now to return a fixed timestamp
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should format relative time for recent dates', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    expect(formatDate(fiveMinutesAgo)).toBe('5m ago');
    expect(formatDate(twoHoursAgo)).toBe('2h ago');
    expect(formatDate(threeDaysAgo)).toBe('3d ago');
  });

  it('should handle "just now" for very recent dates', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

    expect(formatDate(thirtySecondsAgo)).toBe('just now');
  });

  it('should format absolute dates for older dates', () => {
    const oneWeekAgo = new Date('2024-01-08T12:00:00Z');
    
    expect(formatDate(oneWeekAgo)).toBe('Jan 8, 2024');
  });

  it('should format absolute dates when relative is false', () => {
    const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
    
    expect(formatDate(fiveMinutesAgo, { relative: false })).toBe('Jan 15, 2024');
  });

  it('should handle different date formats', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    
    expect(formatDate(date, { relative: false, format: 'short' })).toBe('Jan 15');
    expect(formatDate(date, { relative: false, format: 'medium' })).toBe('Jan 15, 2024');
    expect(formatDate(date, { relative: false, format: 'long' })).toContain('January 15, 2024');
  });

  it('should handle string dates', () => {
    const dateString = '2024-01-15T11:55:00Z';
    
    expect(formatDate(dateString)).toBe('5m ago');
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(30000)).toBe('30s');
    expect(formatDuration(45000)).toBe('45s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(3600000)).toBe('1h 0m');
  });

  it('should format hours', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(5400000)).toBe('1h 30m');
    expect(formatDuration(86400000)).toBe('1d 0h');
  });

  it('should format days', () => {
    expect(formatDuration(86400000)).toBe('1d 0h');
    expect(formatDuration(90000000)).toBe('1d 1h');
  });

  it('should handle zero duration', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should handle complex durations', () => {
    const duration = 2 * 24 * 60 * 60 * 1000 + // 2 days
                    3 * 60 * 60 * 1000 +       // 3 hours
                    45 * 60 * 1000 +          // 45 minutes
                    30 * 1000;                // 30 seconds
    
    expect(formatDuration(duration)).toBe('2d 3h');
  });
});

describe('formatNumber', () => {
  it('should format numbers with thousands separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should handle small numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(999)).toBe('999');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-1000)).toBe('-1,000');
    expect(formatNumber(-1234567)).toBe('-1,234,567');
  });

  it('should handle decimal numbers', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
    expect(formatNumber(1000000.789)).toBe('1,000,000.789');
  });
});

describe('truncateString', () => {
  const longString = 'This is a very long string that needs to be truncated';

  it('should not truncate short strings', () => {
    const shortString = 'Short';
    expect(truncateString(shortString, 10)).toBe(shortString);
  });

  it('should truncate from the end by default', () => {
    expect(truncateString(longString, 20)).toBe('This is a very lo...');
  });

  it('should truncate from the end explicitly', () => {
    expect(truncateString(longString, 20, 'end')).toBe('This is a very lo...');
  });

  it('should truncate from the start', () => {
    expect(truncateString(longString, 20, 'start')).toBe('...eds to be truncated');
  });

  it('should truncate from the middle', () => {
    expect(truncateString(longString, 20, 'middle')).toBe('This is...truncated');
  });

  it('should handle edge cases', () => {
    expect(truncateString('test', 3)).toBe('test'); // String shorter than maxLength
    expect(truncateString('test', 4)).toBe('test'); // String equal to maxLength
    expect(truncateString('test', 10)).toBe('test'); // String much shorter
  });

  it('should handle minimum lengths', () => {
    expect(truncateString(longString, 5)).toBe('Th...');
    expect(truncateString(longString, 5, 'middle')).toBe('T...d');
    expect(truncateString(longString, 5, 'start')).toBe('...ed');
  });

  it('should handle very short max lengths', () => {
    expect(truncateString(longString, 3)).toBe('...');
    expect(truncateString(longString, 1)).toBe('...');
  });
});