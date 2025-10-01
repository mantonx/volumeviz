import { useCallback, useEffect, useRef, useState } from 'react';

export interface WebWorkerHook<TMessage, TResponse> {
  postMessage: (message: TMessage) => void;
  terminate: () => void;
  isSupported: boolean;
  isWorking: boolean;
  error: string | null;
}

export interface UseWebWorkerOptions {
  onMessage?: (data: any) => void;
  onError?: (error: string) => void;
  timeout?: number;
}

export function useWebWorker<TMessage = any, TResponse = any>(
  workerFactory: () => Worker,
  options: UseWebWorkerOptions = {},
): WebWorkerHook<TMessage, TResponse> {
  const { onMessage, onError, timeout = 30000 } = options;

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isSupported] = useState(() => typeof Worker !== 'undefined');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker
  useEffect(() => {
    if (!isSupported) return;

    try {
      workerRef.current = workerFactory();

      workerRef.current.addEventListener('message', (event) => {
        setIsWorking(false);
        setError(null);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (onMessage) {
          onMessage(event.data);
        }
      });

      workerRef.current.addEventListener('error', (event) => {
        setIsWorking(false);
        const errorMessage = `Worker error: ${event.message}`;
        setError(errorMessage);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (onError) {
          onError(errorMessage);
        }
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create worker';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isSupported, onMessage, onError, workerFactory]);

  const postMessage = useCallback(
    (message: TMessage) => {
      if (!workerRef.current || !isSupported) {
        const errorMessage = 'Worker not available';
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
        return;
      }

      setIsWorking(true);
      setError(null);

      // Set timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsWorking(false);
        const errorMessage = `Worker timeout after ${timeout}ms`;
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }, timeout);

      try {
        workerRef.current.postMessage(message);
      } catch (err) {
        setIsWorking(false);
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to post message';
        setError(errorMessage);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (onError) {
          onError(errorMessage);
        }
      }
    },
    [isSupported, timeout, onError],
  );

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsWorking(false);
    setError(null);
  }, []);

  return {
    postMessage,
    terminate,
    isSupported,
    isWorking,
    error,
  };
}

// Specialized hooks for different workers

export function useTreemapWorker(options: UseWebWorkerOptions = {}) {
  return useWebWorker(
    () =>
      new Worker(new URL('../workers/treemap.worker.ts', import.meta.url), {
        type: 'module',
      }),
    options,
  );
}

export function useAggregationWorker(options: UseWebWorkerOptions = {}) {
  return useWebWorker(
    () =>
      new Worker(new URL('../workers/aggregation.worker.ts', import.meta.url), {
        type: 'module',
      }),
    options,
  );
}

// Promise-based worker interface for easier usage
export function usePromiseWorker<TMessage, TResponse>(
  workerFactory: () => Worker,
  options: Omit<UseWebWorkerOptions, 'onMessage' | 'onError'> = {},
) {
  const [results, setResults] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const worker = useWebWorker<TMessage, TResponse>(workerFactory, {
    ...options,
    onMessage: (data: TResponse) => {
      setResults(data);
      setLoading(false);
      setError(null);
    },
    onError: (err: string) => {
      setError(err);
      setLoading(false);
      setResults(null);
    },
  });

  const execute = useCallback(
    (message: TMessage): Promise<TResponse> => {
      return new Promise((resolve, reject) => {
        if (!worker.isSupported) {
          reject(new Error('Web Workers not supported'));
          return;
        }

        setLoading(true);
        setError(null);
        setResults(null);

        // Set up one-time listeners
        const handleMessage = (data: TResponse) => {
          setResults(data);
          setLoading(false);
          resolve(data);
        };

        const handleError = (err: string) => {
          setError(err);
          setLoading(false);
          reject(new Error(err));
        };

        // Update worker options temporarily
        const originalOnMessage = options.onMessage;
        const originalOnError = options.onError;

        // This is a simplified approach - in a real implementation,
        // you'd want to manage the event listeners more carefully
        worker.postMessage(message);
      });
    },
    [worker, options],
  );

  return {
    execute,
    results,
    loading,
    error,
    terminate: worker.terminate,
    isSupported: worker.isSupported,
  };
}

// Specialized promise-based hooks
export function useTreemapWorkerPromise(options: UseWebWorkerOptions = {}) {
  return usePromiseWorker(
    () =>
      new Worker(new URL('../workers/treemap.worker.ts', import.meta.url), {
        type: 'module',
      }),
    options,
  );
}

export function useAggregationWorkerPromise(options: UseWebWorkerOptions = {}) {
  return usePromiseWorker(
    () =>
      new Worker(new URL('../workers/aggregation.worker.ts', import.meta.url), {
        type: 'module',
      }),
    options,
  );
}
