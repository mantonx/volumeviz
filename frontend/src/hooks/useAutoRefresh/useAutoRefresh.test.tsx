/**
 * Tests for useAutoRefresh hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { useAutoRefresh } from './useAutoRefresh';
import type { AutoRefreshOptions } from './useAutoRefresh.types';

// Mock Jotai atoms
jest.mock('../../store/atoms/volumes', () => ({
  autoRefreshEnabledAtom: { init: true },
  autoRefreshIntervalAtom: { init: 30000 },
}));

// Mock timers
jest.useFakeTimers();

const mockRefreshFn = jest.fn(() => Promise.resolve());
const mockSuccessCallback = jest.fn();
const mockErrorCallback = jest.fn();

const renderUseAutoRefresh = (options: AutoRefreshOptions) => {
  return renderHook(() => useAutoRefresh(options), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    ),
  });
};

describe('useAutoRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
    });

    expect(result.current.isActive).toBe(true); // Auto-starts when global enabled
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.isUserActive).toBe(true);
    expect(result.current.isPageVisible).toBe(true);
  });

  it('should start and stop auto-refresh', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isActive).toBe(false);

    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);
  });

  it('should call refreshFn at specified intervals', async () => {
    renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      interval: 5000,
    });

    // Fast-forward time
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockRefreshFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockRefreshFn).toHaveBeenCalledTimes(2);
  });

  it('should pause and resume auto-refresh', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.pauseReason).toBe('manual');

    act(() => {
      result.current.resume();
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.pauseReason).toBe(null);
  });

  it('should handle manual refresh', async () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefreshFn).toHaveBeenCalled();
    expect(result.current.lastRefresh).toBeInstanceOf(Date);
  });

  it('should track user activity', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      pauseOnIdle: true,
      idleTimeout: 1000,
    });

    expect(result.current.isUserActive).toBe(true);

    // Simulate user going idle
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.isUserActive).toBe(false);
  });

  it('should pause when page is hidden', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      pauseOnHidden: true,
    });

    // Simulate page becoming hidden
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isPageVisible).toBe(false);
  });

  it('should handle refresh errors', async () => {
    const errorRefreshFn = jest.fn(() => Promise.reject(new Error('Refresh failed')));
    
    const { result } = renderUseAutoRefresh({
      refreshFn: errorRefreshFn,
      onError: mockErrorCallback,
      maxErrors: 2,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.errorCount).toBe(1);
    expect(result.current.lastError).toBe('Refresh failed');
    expect(mockErrorCallback).toHaveBeenCalledWith(new Error('Refresh failed'));
  });

  it('should pause after max errors', async () => {
    const errorRefreshFn = jest.fn(() => Promise.reject(new Error('Refresh failed')));
    
    const { result } = renderUseAutoRefresh({
      refreshFn: errorRefreshFn,
      maxErrors: 2,
    });

    // Trigger multiple errors
    await act(async () => {
      await result.current.refresh();
    });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.errorCount).toBe(2);
    expect(result.current.isPaused).toBe(true);
    expect(result.current.pauseReason).toBe('errors');
  });

  it('should use adaptive intervals', () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      adaptive: true,
      interval: 1000,
      minInterval: 500,
      maxInterval: 5000,
    });

    expect(result.current.currentInterval).toBe(1000);

    // Simulate errors to increase interval
    act(() => {
      result.current.refresh().catch(() => {});
    });

    // Interval should adapt based on errors and activity
    expect(result.current.currentInterval).toBeGreaterThanOrEqual(500);
    expect(result.current.currentInterval).toBeLessThanOrEqual(5000);
  });

  it('should call success callback', async () => {
    renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      onSuccess: mockSuccessCallback,
    });

    await act(async () => {
      jest.advanceTimersByTime(30000); // Default interval
    });

    expect(mockSuccessCallback).toHaveBeenCalled();
  });

  it('should provide time utilities', async () => {
    const { result } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      interval: 5000,
    });

    expect(result.current.timeUntilNextRefresh).toBeGreaterThan(0);
    expect(result.current.timeSinceLastRefresh).toBe(null); // No refresh yet

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.timeSinceLastRefresh).toBeGreaterThanOrEqual(0);
  });

  it('should refresh on focus when enabled', () => {
    renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
      refreshOnFocus: true,
    });

    // Simulate page becoming visible
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockRefreshFn).toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderUseAutoRefresh({
      refreshFn: mockRefreshFn,
    });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});