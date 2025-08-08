/**
 * Tests for useDebounce hook
 */

import { renderHook, act } from '@testing-library/react';
import { useDebounce, useAdvancedDebounce } from './useDebounce';

jest.useFakeTimers();

describe('useDebounce', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('basic useDebounce', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500));
      expect(result.current).toBe('initial');
    });

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      expect(result.current).toBe('initial');

      // Change value
      rerender({ value: 'updated', delay: 500 });
      expect(result.current).toBe('initial'); // Should still be initial

      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'change1' });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      rerender({ value: 'change2' });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current).toBe('initial'); // Should still be initial

      act(() => {
        jest.advanceTimersByTime(200); // Total 500ms since last change
      });

      expect(result.current).toBe('change2');
    });
  });

  describe('useAdvancedDebounce', () => {
    it('should work with trailing edge by default', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdvancedDebounce(value, { delay: 500 }),
        { initialProps: { value: 'initial' } }
      );

      expect(result.current.debouncedValue).toBe('initial');
      expect(result.current.isPending).toBe(false);

      rerender({ value: 'updated' });
      expect(result.current.isPending).toBe(true);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.debouncedValue).toBe('updated');
      expect(result.current.isPending).toBe(false);
    });

    it('should work with leading edge', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdvancedDebounce(value, { delay: 500, leading: true, trailing: false }),
        { initialProps: { value: 'initial' } }
      );

      expect(result.current.debouncedValue).toBe('initial');

      rerender({ value: 'updated' });
      expect(result.current.debouncedValue).toBe('updated'); // Should update immediately
      expect(result.current.isPending).toBe(false);
    });

    it('should cancel pending debounced calls', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdvancedDebounce(value, { delay: 500 }),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });
      expect(result.current.isPending).toBe(true);

      act(() => {
        result.current.cancel();
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.debouncedValue).toBe('initial'); // Should not have updated
    });

    it('should flush pending debounced calls', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdvancedDebounce(value, { delay: 500 }),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });
      expect(result.current.isPending).toBe(true);

      act(() => {
        result.current.flush();
      });

      expect(result.current.debouncedValue).toBe('updated');
      expect(result.current.isPending).toBe(false);
    });

    it('should respect maxWait option', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdvancedDebounce(value, { delay: 1000, maxWait: 500 }),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      // Keep changing value to prevent normal debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });
      rerender({ value: 'updated2' });

      act(() => {
        jest.advanceTimersByTime(200); // Total 500ms, should trigger due to maxWait
      });

      expect(result.current.debouncedValue).toBe('updated2');
    });
  });
});