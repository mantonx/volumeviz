/**
 * Tests for cn utility function
 */

import { cn } from './cn';

// Mock clsx and twMerge to control their behavior in tests
jest.mock('clsx', () => ({
  clsx: jest.fn((...args) => args.filter(Boolean).join(' ')),
}));

jest.mock('tailwind-merge', () => ({
  twMerge: jest.fn((classes) => classes),
}));

describe('cn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should merge class strings', () => {
    const result = cn('bg-red-500', 'text-white', 'p-4');
    expect(result).toBe('bg-red-500 text-white p-4');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;

    const result = cn(
      'base-class',
      isActive && 'active-class',
      isDisabled && 'disabled-class',
    );

    expect(result).toBe('base-class active-class');
  });

  it('should handle object-based conditionals', () => {
    const result = cn({
      'bg-blue-500': true,
      'text-white': true,
      'opacity-50': false,
    });

    // clsx mock flattens objects to space-separated strings
    expect(result).toContain('bg-blue-500');
    expect(result).toContain('text-white');
    expect(result).not.toContain('opacity-50');
  });

  it('should handle arrays', () => {
    const result = cn(['bg-green-500', 'text-black'], 'p-2');
    expect(result).toContain('bg-green-500');
    expect(result).toContain('text-black');
    expect(result).toContain('p-2');
  });

  it('should handle mixed input types', () => {
    const result = cn(
      'base',
      ['array-class'],
      { 'object-class': true },
      null,
      undefined,
      false,
      'final-class',
    );

    expect(result).toContain('base');
    expect(result).toContain('array-class');
    expect(result).toContain('object-class');
    expect(result).toContain('final-class');
    expect(result).not.toContain('null');
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('false');
  });

  it('should call clsx with provided inputs', () => {
    const { clsx } = require('clsx');

    cn('class1', 'class2', { class3: true });

    expect(clsx).toHaveBeenCalledWith(['class1', 'class2', { class3: true }]);
  });

  it('should call twMerge with clsx result', () => {
    const { twMerge } = require('tailwind-merge');

    cn('class1', 'class2');

    expect(twMerge).toHaveBeenCalledWith('class1 class2');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle only falsy values', () => {
    const result = cn(null, undefined, false, '');
    expect(result).toBe('');
  });

  it('should handle whitespace in class names', () => {
    const result = cn(
      ' leading-space',
      'trailing-space ',
      '  multiple-spaces  ',
    );
    expect(result).toContain('leading-space');
    expect(result).toContain('trailing-space');
    expect(result).toContain('multiple-spaces');
  });

  // Integration-style tests that verify the function works as expected
  // even if the underlying libraries change their behavior
  describe('integration behavior', () => {
    beforeEach(() => {
      // Restore the actual implementations for these tests
      jest.unmock('clsx');
      jest.unmock('tailwind-merge');
    });

    it('should actually merge and deduplicate Tailwind classes', () => {
      const result = cn('px-2 py-1 px-3', 'bg-red-200 bg-red-500');

      // Should deduplicate conflicting classes, keeping the last one
      expect(result).toContain('px-3');
      expect(result).not.toContain('px-2');
      expect(result).toContain('bg-red-500');
      expect(result).not.toContain('bg-red-200');
      expect(result).toContain('py-1');
    });

    it('should handle complex conditional logic', () => {
      const variant = 'primary';
      const size = 'large';
      const disabled = false;

      const result = cn(
        'btn',
        {
          'btn-primary': variant === 'primary',
          'btn-secondary': variant === 'secondary',
          'btn-sm': size === 'small',
          'btn-lg': size === 'large',
          'opacity-50 cursor-not-allowed': disabled,
        },
        disabled && 'pointer-events-none',
      );

      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
      expect(result).toContain('btn-lg');
      expect(result).not.toContain('btn-secondary');
      expect(result).not.toContain('btn-sm');
      expect(result).not.toContain('opacity-50');
      expect(result).not.toContain('cursor-not-allowed');
      expect(result).not.toContain('pointer-events-none');
    });
  });
});
