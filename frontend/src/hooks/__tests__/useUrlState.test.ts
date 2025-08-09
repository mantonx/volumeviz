import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { useUrlState, useMultipleUrlState, useVolumeListUrlState } from '../useUrlState';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockLocation = {
  pathname: '/volumes',
  search: '',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Create test wrapper with Router
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

describe('useUrlState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic URL State Management', () => {
    it('should return default value when no URL parameter exists', () => {
      const { result } = renderHook(() => useUrlState('test', { defaultValue: 'default' }), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toBe('default');
    });

    it('should parse value from URL search parameters', () => {
      mockLocation.search = '?test=hello';

      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toBe('hello');
    });

    it('should update URL when value changes', () => {
      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]('newvalue');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?test=newvalue', { replace: false });
      expect(result.current[0]).toBe('newvalue');
    });

    it('should remove parameter from URL when value is undefined', () => {
      mockLocation.search = '?test=hello&other=world';

      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toBe('hello');

      act(() => {
        result.current[1](undefined);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?other=world', { replace: false });
    });

    it('should remove parameter from URL when value is empty string', () => {
      mockLocation.search = '?test=hello';

      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]('');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes', { replace: false });
    });

    it('should handle custom serialization and deserialization', () => {
      const { result } = renderHook(
        () =>
          useUrlState<number>('number', {
            defaultValue: 0,
            serialize: (value) => String(value),
            deserialize: (value) => parseInt(value, 10),
          }),
        {
          wrapper: createWrapper(),
        }
      );

      act(() => {
        result.current[1](42);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?number=42', { replace: false });
    });

    it('should use replace mode when specified', () => {
      const { result } = renderHook(() => useUrlState('test', { replace: true }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]('test');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?test=test', { replace: true });
    });

    it('should handle deserialization errors gracefully', () => {
      mockLocation.search = '?number=invalid';

      const { result } = renderHook(
        () =>
          useUrlState<number>('number', {
            defaultValue: 0,
            deserialize: (value) => {
              const parsed = parseInt(value, 10);
              if (isNaN(parsed)) throw new Error('Invalid number');
              return parsed;
            },
          }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current[0]).toBe(0); // Should fall back to default
    });
  });

  describe('URL State Synchronization', () => {
    it('should update state when URL changes externally', () => {
      mockLocation.search = '?test=initial';

      const { result, rerender } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toBe('initial');

      // Simulate external URL change
      mockLocation.search = '?test=changed';
      rerender();

      expect(result.current[0]).toBe('changed');
    });

    it('should not navigate when URL already matches state', () => {
      mockLocation.search = '?test=hello';

      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]('hello');
      });

      // Should not navigate since value is already in URL
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should preserve other URL parameters', () => {
      mockLocation.search = '?existing=value&test=old';

      const { result } = renderHook(() => useUrlState('test'), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]('new');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?existing=value&test=new', { replace: false });
    });
  });
});

describe('useMultipleUrlState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
  });

  describe('Multiple Parameter Management', () => {
    it('should handle multiple parameters with defaults', () => {
      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number; size: number; sort: string }>(
            ['page', 'size', 'sort'],
            {
              page: { defaultValue: 1, deserialize: (v) => parseInt(v, 10) },
              size: { defaultValue: 25, deserialize: (v) => parseInt(v, 10) },
              sort: { defaultValue: 'name:asc' },
            }
          ),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current[0]).toEqual({
        page: 1,
        size: 25,
        sort: 'name:asc',
      });
    });

    it('should parse multiple parameters from URL', () => {
      mockLocation.search = '?page=2&size=50&sort=date:desc';

      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number; size: number; sort: string }>(
            ['page', 'size', 'sort'],
            {
              page: { deserialize: (v) => parseInt(v, 10) },
              size: { deserialize: (v) => parseInt(v, 10) },
            }
          ),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current[0]).toEqual({
        page: 2,
        size: 50,
        sort: 'date:desc',
      });
    });

    it('should update multiple parameters at once', () => {
      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number; size: number }>(
            ['page', 'size'],
            {
              page: { serialize: String },
              size: { serialize: String },
            }
          ),
        {
          wrapper: createWrapper(),
        }
      );

      act(() => {
        result.current[1]({ page: 3, size: 100 });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?page=3&size=100', { replace: true });
    });

    it('should handle partial updates', () => {
      mockLocation.search = '?page=1&size=25&sort=name:asc';

      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number; size: number; sort: string }>(
            ['page', 'size', 'sort'],
            {
              page: { serialize: String },
              size: { serialize: String },
            }
          ),
        {
          wrapper: createWrapper(),
        }
      );

      act(() => {
        result.current[1]({ page: 2 });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?page=2&size=25&sort=name%3Aasc', { replace: true });
    });

    it('should remove parameters when set to undefined', () => {
      mockLocation.search = '?page=2&size=50&sort=date:desc';

      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number; size: number; sort: string }>(
            ['page', 'size', 'sort'],
            {}
          ),
        {
          wrapper: createWrapper(),
        }
      );

      act(() => {
        result.current[1]({ sort: undefined });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes?page=2&size=50', { replace: true });
    });

    it('should handle serialization errors gracefully', () => {
      const { result } = renderHook(
        () =>
          useMultipleUrlState<{ page: number }>(
            ['page'],
            {
              page: {
                deserialize: (v) => {
                  const parsed = parseInt(v, 10);
                  if (isNaN(parsed)) throw new Error('Invalid');
                  return parsed;
                },
                defaultValue: 1,
              },
            }
          ),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not crash and use default value
      expect(result.current[0]).toEqual({ page: 1 });
    });
  });
});

describe('useVolumeListUrlState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
  });

  describe('Volume-Specific URL State', () => {
    it('should return default values for volume list parameters', () => {
      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toEqual({
        page: 1,
        page_size: 25,
        sort: 'name:asc',
        q: '',
        driver: '',
        orphaned: undefined,
        system: undefined,
      });
    });

    it('should parse volume list parameters from URL', () => {
      mockLocation.search = '?page=2&page_size=50&sort=size%3Adesc&q=test&driver=local&orphaned=true&system=false';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toEqual({
        page: 2,
        page_size: 50,
        sort: 'size:desc',
        q: 'test',
        driver: 'local',
        orphaned: true,
        system: false,
      });
    });

    it('should handle boolean parameters correctly', () => {
      mockLocation.search = '?orphaned=true&system=false';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      expect(result.current[0].orphaned).toBe(true);
      expect(result.current[0].system).toBe(false);
    });

    it('should serialize boolean parameters correctly', () => {
      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({ orphaned: true, system: false });
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/volumes?orphaned=true&system=false',
        { replace: true }
      );
    });

    it('should handle numeric parameters correctly', () => {
      mockLocation.search = '?page=invalid&page_size=abc';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      // Should fall back to defaults for invalid numbers
      expect(result.current[0].page).toBe(1);
      expect(result.current[0].page_size).toBe(25);
    });

    it('should update volume list parameters', () => {
      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({
          page: 3,
          page_size: 100,
          sort: 'created_at:desc',
          q: 'web',
          driver: 'nfs',
          orphaned: true,
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/volumes?page=3&page_size=100&sort=created_at%3Adesc&q=web&driver=nfs&orphaned=true',
        { replace: true }
      );
    });

    it('should remove empty string parameters', () => {
      mockLocation.search = '?q=test&driver=local';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({ q: '', driver: '' });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/volumes', { replace: true });
    });

    it('should handle partial updates correctly', () => {
      mockLocation.search = '?page=1&page_size=25&sort=name%3Aasc&q=test';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({ page: 2 });
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/volumes?page=2&page_size=25&sort=name%3Aasc&q=test',
        { replace: true }
      );
    });

    it('should preserve existing URL parameters', () => {
      mockLocation.search = '?page=1&sort=name%3Aasc&other=value';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({ page: 2 });
      });

      // Should preserve the 'other' parameter
      expect(mockNavigate).toHaveBeenCalledWith(
        '/volumes?page=2&sort=name%3Aasc&other=value',
        { replace: true }
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed URL parameters', () => {
      // Simulate malformed URL
      mockLocation.search = '?page=&page_size=&orphaned=invalid&system=';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      expect(result.current[0]).toEqual({
        page: 1, // Default for invalid number
        page_size: 25, // Default for invalid number
        sort: 'name:asc',
        q: '',
        driver: '',
        orphaned: false, // Default for invalid boolean
        system: false, // Default for invalid boolean
      });
    });

    it('should handle URL encoding correctly', () => {
      mockLocation.search = '?q=test%20volume&sort=created_at%3Adesc';

      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      expect(result.current[0].q).toBe('test volume');
      expect(result.current[0].sort).toBe('created_at:desc');
    });

    it('should handle special characters in search query', () => {
      const { result } = renderHook(() => useVolumeListUrlState(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current[1]({ q: 'test & query with spaces' });
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/volumes?q=test%20%26%20query%20with%20spaces',
        { replace: true }
      );
    });
  });
});