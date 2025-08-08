/**
 * Auto-refresh hook for visualization components
 *
 * Provides intelligent auto-refresh functionality with adaptive intervals,
 * user activity detection, and efficient data fetching strategies.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
} from '../../store/atoms/volumes';
import type {
  AutoRefreshOptions,
  AutoRefreshState,
  AutoRefreshReturn,
} from './useAutoRefresh.types';

/**
 * Hook for intelligent auto-refresh functionality
 */
export const useAutoRefresh = (
  options: AutoRefreshOptions,
): AutoRefreshReturn => {
  const {
    refreshFn,
    interval,
    adaptive = true,
    minInterval = 5000, // 5 seconds
    maxInterval = 300000, // 5 minutes
    pauseOnHidden = true,
    pauseOnIdle = true,
    idleTimeout = 60000, // 1 minute
    refreshOnFocus = true,
    maxErrors = 3,
    onSuccess,
    onError,
  } = options;

  // Global settings
  const globalEnabled = useAtomValue(autoRefreshEnabledAtom);
  const globalInterval = useAtomValue(autoRefreshIntervalAtom);

  // State
  const [state, setState] = useState<AutoRefreshState>({
    isActive: false,
    isPaused: false,
    pauseReason: null,
    currentInterval: interval || globalInterval,
    lastRefresh: null,
    nextRefresh: null,
    isRefreshing: false,
    errorCount: 0,
    lastError: null,
    isUserActive: true,
    isPageVisible: true,
  });

  // Refs for timers and tracking
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (!state.isUserActive) {
      setState((prev) => ({ ...prev, isUserActive: true }));
    }

    // Reset idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    if (pauseOnIdle) {
      idleTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isUserActive: false }));
        }
      }, idleTimeout);
    }
  }, [state.isUserActive, pauseOnIdle, idleTimeout]);

  // Calculate adaptive interval based on activity and errors
  const calculateInterval = useCallback(() => {
    if (!adaptive) {
      return interval || globalInterval;
    }

    const baseInterval = interval || globalInterval;
    let calculatedInterval = baseInterval;

    // Increase interval if user is idle
    if (!state.isUserActive && pauseOnIdle) {
      calculatedInterval *= 2;
    }

    // Increase interval if there have been errors
    if (state.errorCount > 0) {
      calculatedInterval *= Math.min(Math.pow(2, state.errorCount), 8);
    }

    // Decrease interval if page just became visible (catch up)
    if (state.isPageVisible && refreshOnFocus) {
      calculatedInterval = Math.min(calculatedInterval, baseInterval);
    }

    // Apply bounds
    return Math.max(minInterval, Math.min(maxInterval, calculatedInterval));
  }, [
    adaptive,
    interval,
    globalInterval,
    state.isUserActive,
    state.errorCount,
    state.isPageVisible,
    pauseOnIdle,
    refreshOnFocus,
    minInterval,
    maxInterval,
  ]);

  // Perform refresh
  const performRefresh = useCallback(async () => {
    if (!mountedRef.current || state.isRefreshing) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isRefreshing: true,
      lastError: null,
    }));

    try {
      await refreshFn();

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          lastRefresh: new Date(),
          errorCount: 0,
          lastError: null,
        }));

        onSuccess?.();
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage =
          error instanceof Error ? error.message : 'Refresh failed';

        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          errorCount: prev.errorCount + 1,
          lastError: errorMessage,
        }));

        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [state.isRefreshing, refreshFn, onSuccess, onError]);

  // Schedule next refresh
  const scheduleRefresh = useCallback(() => {
    if (!mountedRef.current) return;

    clearTimers();

    const currentInterval = calculateInterval();
    const nextRefreshTime = new Date(Date.now() + currentInterval);

    setState((prev) => ({
      ...prev,
      currentInterval,
      nextRefresh: nextRefreshTime,
    }));

    refreshTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !state.isPaused) {
        performRefresh().then(() => {
          if (mountedRef.current && state.isActive) {
            scheduleRefresh();
          }
        });
      }
    }, currentInterval);
  }, [
    calculateInterval,
    performRefresh,
    state.isPaused,
    state.isActive,
    clearTimers,
  ]);

  // Check if refresh should be paused
  const shouldPause = useCallback(() => {
    if (!globalEnabled) return 'disabled';
    if (pauseOnHidden && !state.isPageVisible) return 'hidden';
    if (pauseOnIdle && !state.isUserActive) return 'idle';
    if (state.errorCount >= maxErrors) return 'errors';
    return null;
  }, [
    globalEnabled,
    pauseOnHidden,
    state.isPageVisible,
    pauseOnIdle,
    state.isUserActive,
    state.errorCount,
    maxErrors,
  ]);

  // Update pause state
  const updatePauseState = useCallback(() => {
    const pauseReason = shouldPause();
    const shouldBePaused = pauseReason !== null;

    if (shouldBePaused !== state.isPaused) {
      setState((prev) => ({
        ...prev,
        isPaused: shouldBePaused,
        pauseReason: pauseReason,
      }));

      if (shouldBePaused) {
        clearTimers();
      } else if (state.isActive) {
        scheduleRefresh();
      }
    }
  }, [
    shouldPause,
    state.isPaused,
    state.isActive,
    clearTimers,
    scheduleRefresh,
  ]);

  // Start auto-refresh
  const start = useCallback(() => {
    if (!state.isActive) {
      setState((prev) => ({ ...prev, isActive: true }));
      updatePauseState();
      if (!shouldPause()) {
        scheduleRefresh();
      }
    }
  }, [state.isActive, updatePauseState, shouldPause, scheduleRefresh]);

  // Stop auto-refresh
  const stop = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      pauseReason: null,
    }));
    clearTimers();
  }, [clearTimers]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await performRefresh();

    // Restart timer if active
    if (state.isActive && !shouldPause()) {
      scheduleRefresh();
    }
  }, [performRefresh, state.isActive, shouldPause, scheduleRefresh]);

  // Pause/resume manually
  const pause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPaused: true,
      pauseReason: 'manual',
    }));
    clearTimers();
  }, [clearTimers]);

  const resume = useCallback(() => {
    if (state.pauseReason === 'manual') {
      setState((prev) => ({
        ...prev,
        isPaused: false,
        pauseReason: null,
      }));

      if (state.isActive) {
        scheduleRefresh();
      }
    }
  }, [state.pauseReason, state.isActive, scheduleRefresh]);

  // Page visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setState((prev) => ({ ...prev, isPageVisible: isVisible }));

      if (isVisible && refreshOnFocus && state.isActive) {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshOnFocus, state.isActive, refresh]);

  // User activity listeners
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
    ];

    events.forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Initial idle timer
    updateActivity();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Update pause state when dependencies change
  useEffect(() => {
    updatePauseState();
  }, [updatePauseState]);

  // Auto-start if enabled
  useEffect(() => {
    if (globalEnabled && !state.isActive) {
      start();
    } else if (!globalEnabled && state.isActive) {
      stop();
    }
  }, [globalEnabled, state.isActive, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    // State
    ...state,

    // Controls
    start,
    stop,
    refresh,
    pause,
    resume,

    // Utilities
    timeUntilNextRefresh: state.nextRefresh
      ? Math.max(0, state.nextRefresh.getTime() - Date.now())
      : 0,

    timeSinceLastRefresh: state.lastRefresh
      ? Date.now() - state.lastRefresh.getTime()
      : null,
  };
};

export default useAutoRefresh;
