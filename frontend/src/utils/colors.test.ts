/**
 * Tests for color utilities
 */

import {
  VOLUME_COLORS,
  DRIVER_COLORS,
  SIZE_RANGE_COLORS,
  getVolumeColor,
  getDriverColor,
  getSizeRangeColor,
  getHashColor,
} from './colors';

describe('colors', () => {
  describe('color constants', () => {
    it('should have defined volume colors', () => {
      expect(VOLUME_COLORS).toHaveLength(10);
      expect(VOLUME_COLORS[0]).toBe('#3B82F6'); // Blue
      expect(VOLUME_COLORS[9]).toBe('#6B7280'); // Gray
    });

    it('should have defined driver colors', () => {
      expect(DRIVER_COLORS.local).toBe('#3B82F6');
      expect(DRIVER_COLORS.nfs).toBe('#10B981');
      expect(DRIVER_COLORS.default).toBe('#6B7280');
    });

    it('should have defined size range colors', () => {
      expect(SIZE_RANGE_COLORS).toHaveLength(5);
      expect(SIZE_RANGE_COLORS[0]).toBe('#22C55E'); // Green
      expect(SIZE_RANGE_COLORS[4]).toBe('#8B5CF6'); // Purple
    });
  });

  describe('getVolumeColor', () => {
    it('should return colors from the palette by index', () => {
      expect(getVolumeColor(0)).toBe(VOLUME_COLORS[0]);
      expect(getVolumeColor(5)).toBe(VOLUME_COLORS[5]);
    });

    it('should wrap around when index exceeds palette length', () => {
      expect(getVolumeColor(10)).toBe(VOLUME_COLORS[0]);
      expect(getVolumeColor(15)).toBe(VOLUME_COLORS[5]);
      expect(getVolumeColor(23)).toBe(VOLUME_COLORS[3]);
    });

    it('should handle negative indices', () => {
      expect(getVolumeColor(-1)).toBe(VOLUME_COLORS[9]); // Last color
    });
  });

  describe('getDriverColor', () => {
    it('should return specific colors for known drivers', () => {
      expect(getDriverColor('local')).toBe('#3B82F6');
      expect(getDriverColor('nfs')).toBe('#10B981');
      expect(getDriverColor('cifs')).toBe('#F59E0B');
      expect(getDriverColor('overlay')).toBe('#EF4444');
    });

    it('should return default color for unknown drivers', () => {
      expect(getDriverColor('unknown')).toBe('#6B7280');
      expect(getDriverColor('custom-driver')).toBe('#6B7280');
      expect(getDriverColor('')).toBe('#6B7280');
    });
  });

  describe('getSizeRangeColor', () => {
    it('should return colors from the size range palette by index', () => {
      expect(getSizeRangeColor(0)).toBe(SIZE_RANGE_COLORS[0]);
      expect(getSizeRangeColor(2)).toBe(SIZE_RANGE_COLORS[2]);
    });

    it('should wrap around when index exceeds palette length', () => {
      expect(getSizeRangeColor(5)).toBe(SIZE_RANGE_COLORS[0]);
      expect(getSizeRangeColor(7)).toBe(SIZE_RANGE_COLORS[2]);
    });
  });

  describe('getHashColor', () => {
    it('should return consistent colors for the same string', () => {
      const color1 = getHashColor('test-string');
      const color2 = getHashColor('test-string');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different strings', () => {
      const color1 = getHashColor('string1');
      const color2 = getHashColor('string2');
      // Note: This test might occasionally fail due to hash collisions, but it's very unlikely
      expect(color1).not.toBe(color2);
    });

    it('should return colors from the volume color palette', () => {
      const color = getHashColor('any-string');
      expect(VOLUME_COLORS).toContain(color);
    });

    it('should handle empty strings', () => {
      const color = getHashColor('');
      expect(VOLUME_COLORS).toContain(color);
    });

    it('should handle special characters', () => {
      const color1 = getHashColor('test!@#$%^&*()');
      const color2 = getHashColor('éñüøß');
      
      expect(VOLUME_COLORS).toContain(color1);
      expect(VOLUME_COLORS).toContain(color2);
    });

    it('should produce consistent hash colors for common volume names', () => {
      // Test common Docker volume patterns
      const webColor = getHashColor('web-data');
      const dbColor = getHashColor('database-volume');
      const logsColor = getHashColor('application-logs');

      expect(VOLUME_COLORS).toContain(webColor);
      expect(VOLUME_COLORS).toContain(dbColor);
      expect(VOLUME_COLORS).toContain(logsColor);

      // Same strings should produce same colors
      expect(getHashColor('web-data')).toBe(webColor);
      expect(getHashColor('database-volume')).toBe(dbColor);
    });
  });
});