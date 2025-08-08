/**
 * Custom hook for handling async operations with loading states and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AsyncState, UseAsyncOptions, UseAsyncReturn } from './useAsync.types';

/**
 * Custom hook for handling async operations
 */
export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions = {},
): UseAsyncReturn<T> => {
  const { immediate = true, resetOnChange = true } = options;
  
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState((prevState) => ({ ...prevState, loading: true, error: null }));

    try {
      const data = await asyncFunction();
      if (mountedRef.current) {
        setState({ data, error: null, loading: false });
      }
    } catch (error) {
      if (mountedRef.current) {
        setState({
          data: null,
          error: error instanceof Error ? error : new Error('Unknown error'),
          loading: false,
        });
      }
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      loading: false,
    });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  useEffect(() => {
    if (resetOnChange) {
      reset();
    }
  }, [asyncFunction, resetOnChange, reset]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    isSuccess: !state.loading && !state.error && state.data !== null,
    isError: !state.loading && state.error !== null,
  };
};

export default useAsync;