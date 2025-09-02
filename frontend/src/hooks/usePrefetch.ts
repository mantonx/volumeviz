import { useCallback, useEffect, useRef, useState } from 'react';
import { PrefetchService, PrefetchItem, PrefetchConfig } from '@/services/prefetch/PrefetchService';

export interface UsePrefetchOptions {
  config?: Partial<PrefetchConfig>;
  autoStart?: boolean;
  enablePredictions?: boolean;
  trackNavigation?: boolean;
}

export interface UsePrefetchReturn {
  prefetch: (url: string, options?: Partial<PrefetchItem>) => Promise<any>;
  get: (id: string) => any;
  has: (id: string) => boolean;
  clear: () => void;
  recordNavigation: (path: string, timeSpent?: number) => void;
  getPredictions: (currentPath: string, limit?: number) => string[];
  prefetchPredictions: (currentPath: string) => Promise<void>;
  stats: {
    size: number;
    items: number;
    hitRate: number;
    memory: number;
  };
  isLoading: boolean;
  error: string | null;
}

export function usePrefetch(options: UsePrefetchOptions = {}): UsePrefetchReturn {
  const {
    config = {},
    autoStart = true,
    enablePredictions = true,
    trackNavigation = true,
  } = options;

  const serviceRef = useRef<PrefetchService | null>(null);
  const [stats, setStats] = useState({
    size: 0,
    items: 0,
    hitRate: 0,
    memory: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize prefetch service
  useEffect(() => {
    if (!serviceRef.current && autoStart) {
      serviceRef.current = new PrefetchService(config);
      
      // Set up event listeners
      serviceRef.current.on('fetch-start', () => setIsLoading(true));
      
      serviceRef.current.on('fetch-success', () => {
        setIsLoading(false);
        setError(null);
        updateStats();
      });
      
      serviceRef.current.on('fetch-error', ({ error: fetchError }) => {
        setIsLoading(false);
        setError(fetchError.message || 'Prefetch failed');
      });
      
      serviceRef.current.on('cache-cleanup', () => {
        updateStats();
      });
      
      updateStats();
    }
  }, [config, autoStart]);

  const updateStats = useCallback(() => {
    if (serviceRef.current) {
      setStats(serviceRef.current.getStats());
    }
  }, []);

  const prefetch = useCallback(async (url: string, options: Partial<PrefetchItem> = {}) => {
    if (!serviceRef.current) {
      throw new Error('Prefetch service not initialized');
    }
    
    try {
      const result = await serviceRef.current.prefetch(url, options);
      updateStats();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prefetch failed');
      throw err;
    }
  }, [updateStats]);

  const get = useCallback((id: string) => {
    if (!serviceRef.current) return null;
    
    const item = serviceRef.current.get(id);
    return item?.data || null;
  }, []);

  const has = useCallback((id: string) => {
    if (!serviceRef.current) return false;
    return serviceRef.current.has(id);
  }, []);

  const clear = useCallback(() => {
    if (!serviceRef.current) return;
    
    serviceRef.current.clear();
    updateStats();
    setError(null);
  }, [updateStats]);

  const recordNavigation = useCallback((path: string, timeSpent?: number) => {
    if (!serviceRef.current || !trackNavigation) return;
    
    serviceRef.current.recordNavigation(path, timeSpent);
  }, [trackNavigation]);

  const getPredictions = useCallback((currentPath: string, limit?: number) => {
    if (!serviceRef.current) return [];
    return serviceRef.current.getPredictions(currentPath, limit);
  }, []);

  const prefetchPredictions = useCallback(async (currentPath: string) => {
    if (!serviceRef.current || !enablePredictions) return;
    
    try {
      await serviceRef.current.prefetchPredictions(currentPath);
      updateStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction prefetch failed');
    }
  }, [enablePredictions, updateStats]);

  return {
    prefetch,
    get,
    has,
    clear,
    recordNavigation,
    getPredictions,
    prefetchPredictions,
    stats,
    isLoading,
    error,
  };
}

// Specialized hooks for common use cases

export function useNavigationPrefetch(currentPath: string) {
  const prefetch = usePrefetch({
    config: {
      maxItems: 50,
      adaptivePrefetch: true,
    },
    enablePredictions: true,
    trackNavigation: true,
  });

  // Auto-prefetch predictions when path changes
  useEffect(() => {
    if (currentPath) {
      prefetch.recordNavigation(currentPath);
      prefetch.prefetchPredictions(currentPath);
    }
  }, [currentPath, prefetch]);

  return prefetch;
}

export function useDataPrefetch() {
  return usePrefetch({
    config: {
      maxCacheSize: 100 * 1024 * 1024, // 100MB for data
      maxItems: 200,
      defaultTTL: 60 * 60 * 1000, // 1 hour
    },
    enablePredictions: false,
  });
}

export function useImagePrefetch() {
  return usePrefetch({
    config: {
      maxCacheSize: 50 * 1024 * 1024, // 50MB for images
      maxItems: 100,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      priorityWeights: {
        critical: 1000,
        high: 100,
        medium: 10,
        low: 1,
      },
    },
    enablePredictions: false,
  });
}