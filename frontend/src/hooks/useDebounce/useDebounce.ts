/**
 * Custom hook that debounces a value with advanced options
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UseDebounceOptions, UseDebounceReturn } from './useDebounce.types';

/**
 * Simple debounce hook - returns debounced value
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Advanced debounce hook with additional controls
 */
export const useAdvancedDebounce = <T>(
  value: T,
  options: UseDebounceOptions,
): UseDebounceReturn<T> => {
  const {
    delay,
    leading = false,
    trailing = true,
    maxWait,
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTimeRef = useRef<number>(0);
  const lastInvokeTimeRef = useRef<number>(0);

  const invokeFunc = useCallback((newValue: T) => {
    setDebouncedValue(newValue);
    setIsPending(false);
    lastInvokeTimeRef.current = Date.now();
  }, []);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - lastCallTimeRef.current;
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    // Either this is the first call, activity has stopped, or max wait has elapsed
    return (
      lastCallTimeRef.current === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }, [delay, maxWait]);

  const trailingEdge = useCallback((time: number, newValue: T) => {
    timeoutRef.current = null;
    if (trailing) {
      invokeFunc(newValue);
    }
    setIsPending(false);
  }, [trailing, invokeFunc]);

  const timerExpired = useCallback(() => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time, value);
    } else {
      // Restart the timer for the remaining wait time
      const remainingWait = delay - (time - lastCallTimeRef.current);
      timeoutRef.current = setTimeout(timerExpired, remainingWait);
    }
  }, [shouldInvoke, trailingEdge, value, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    setIsPending(false);
    lastCallTimeRef.current = 0;
    lastInvokeTimeRef.current = 0;
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      invokeFunc(value);
      cancel();
    }
  }, [invokeFunc, value, cancel]);

  useEffect(() => {
    const time = Date.now();
    lastCallTimeRef.current = time;

    if (shouldInvoke(time)) {
      if (leading) {
        invokeFunc(value);
      }
      if (!trailing) {
        setIsPending(false);
        return;
      }
    }

    setIsPending(true);

    // Cancel previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(timerExpired, delay);

    // Set up max wait timeout
    if (maxWait !== undefined && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        invokeFunc(value);
        cancel();
      }, maxWait);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
    };
  }, [value, delay, shouldInvoke, leading, trailing, invokeFunc, timerExpired, maxWait, cancel]);

  return {
    debouncedValue,
    cancel,
    flush,
    isPending,
  };
};

export default useDebounce;