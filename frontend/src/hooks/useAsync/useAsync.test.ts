/**
 * Tests for useAsync hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';

// Mock async functions for testing
const successfulAsyncFn = jest.fn(() => Promise.resolve('success'));
const failingAsyncFn = jest.fn(() => Promise.reject(new Error('Failed')));
const slowAsyncFn = jest.fn(
  () => new Promise((resolve) => setTimeout(() => resolve('slow'), 100)),
);

describe('useAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading false and no data/error', () => {
    const { result } = renderHook(() =>
      useAsync(successfulAsyncFn, { immediate: false }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should execute immediately by default', async () => {
    const { result } = renderHook(() => useAsync(successfulAsyncFn));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(successfulAsyncFn).toHaveBeenCalledTimes(1);
  });

  it('should not execute immediately when immediate is false', () => {
    renderHook(() => useAsync(successfulAsyncFn, { immediate: false }));

    expect(successfulAsyncFn).not.toHaveBeenCalled();
  });

  it('should handle successful execution', async () => {
    const { result } = renderHook(() =>
      useAsync(successfulAsyncFn, { immediate: false }),
    );

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('success');
    expect(result.current.error).toBe(null);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('should handle failed execution', async () => {
    const { result } = renderHook(() =>
      useAsync(failingAsyncFn, { immediate: false }),
    );

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toEqual(new Error('Failed'));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('should handle manual execution', async () => {
    const { result } = renderHook(() =>
      useAsync(successfulAsyncFn, { immediate: false }),
    );

    expect(result.current.data).toBe(null);

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('success');
    expect(successfulAsyncFn).toHaveBeenCalledTimes(1);
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useAsync(successfulAsyncFn));

    await waitFor(() => {
      expect(result.current.data).toBe('success');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should show loading state during execution', async () => {
    const { result } = renderHook(() =>
      useAsync(slowAsyncFn, { immediate: false }),
    );

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('slow');
    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle multiple executions', async () => {
    const { result } = renderHook(() =>
      useAsync(successfulAsyncFn, { immediate: false }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(successfulAsyncFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.execute();
    });

    expect(successfulAsyncFn).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe('success');
  });

  it('should handle non-Error rejections', async () => {
    const stringErrorFn = jest.fn(() => Promise.reject('String error'));

    const { result } = renderHook(() =>
      useAsync(stringErrorFn, { immediate: false }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toEqual(new Error('Unknown error'));
    expect(result.current.isError).toBe(true);
  });
});
