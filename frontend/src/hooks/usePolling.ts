import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pollingEnabledAtom,
  pollingIntervalAtom,
  shouldUsePollingAtom,
} from '../store/atoms/shell';

export interface PollingOptions {
  pollFn: () => Promise<void> | void;
  interval?: number;
  enabled?: boolean;
  pauseOnHidden?: boolean;
  startOnMount?: boolean;
  onError?: (error: Error) => void;
}

export interface PollingState {
  isPolling: boolean;
  isPaused: boolean;
  errorCount: number;
}

export interface PollingReturn {
  state: PollingState;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export const usePolling = (options: PollingOptions): PollingReturn => {
  const {
    pollFn,
    interval: customInterval,
    enabled: customEnabled,
    pauseOnHidden = true,
    startOnMount = true,
    onError,
  } = options;

  // Get global polling configuration
  const globalInterval = useAtomValue(pollingIntervalAtom);
  const globalEnabled = useAtomValue(pollingEnabledAtom);
  const shouldUsePolling = useAtomValue(shouldUsePollingAtom);

  // Determine effective settings
  const effectiveInterval = customInterval ?? globalInterval;
  const effectiveEnabled = (customEnabled ?? globalEnabled) && shouldUsePolling;

  // State
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    isPaused: false,
    errorCount: 0,
  });

  const intervalRef = useRef<number | null>(null);
  const errorCountRef = useRef(0);

  // Execute polling function with error handling
  const executePoll = useCallback(async () => {
    try {
      await pollFn();
      errorCountRef.current = 0;
      setState((prev) => ({ ...prev, errorCount: 0 }));
    } catch (error) {
      errorCountRef.current += 1;
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      setState((prev) => ({ ...prev, errorCount: errorCountRef.current }));
      onError?.(errorObj);
    }
  }, [pollFn, onError]);

  // Start polling
  const start = useCallback(() => {
    if (!effectiveEnabled || intervalRef.current) return;

    setState((prev) => ({ ...prev, isPolling: true, isPaused: false }));
    executePoll(); // Execute first poll immediately
    intervalRef.current = window.setInterval(executePoll, effectiveInterval);
  }, [effectiveEnabled, executePoll, effectiveInterval]);

  // Stop polling
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false, isPaused: false }));
  }, []);

  // Pause polling
  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  // Resume polling
  const resume = useCallback(() => {
    if (!state.isPolling || !state.isPaused) return;

    setState((prev) => ({ ...prev, isPaused: false }));
    intervalRef.current = window.setInterval(executePoll, effectiveInterval);
  }, [state.isPolling, state.isPaused, executePoll, effectiveInterval]);

  // Handle page visibility changes
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pause();
      } else if (!document.hidden && state.isPaused) {
        resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseOnHidden, pause, resume, state.isPaused]);

  // Auto-start on mount
  useEffect(() => {
    if (startOnMount && effectiveEnabled) {
      start();
    }
    return stop;
  }, [startOnMount, effectiveEnabled, start, stop]);

  return {
    state,
    start,
    stop,
    pause,
    resume,
  };
};
