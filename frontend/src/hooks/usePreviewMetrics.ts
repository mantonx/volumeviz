/**
 * usePreviewMetrics Hook
 *
 * Provides performance monitoring and metrics for preview image loading
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatBytes } from '@/utils';

export interface PreviewMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLoadTime: number;
  cacheHitRate: number;
  currentlyLoading: number;
  totalBytesLoaded: number;
}

interface LoadingRequest {
  url: string;
  startTime: number;
  size?: number;
}

export function usePreviewMetrics() {
  const [metrics, setMetrics] = useState<PreviewMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    currentlyLoading: 0,
    totalBytesLoaded: 0,
  });

  const loadingRequests = useRef<Map<string, LoadingRequest>>(new Map());
  const loadTimes = useRef<number[]>([]);
  const cacheChecks = useRef<{ total: number; hits: number }>({
    total: 0,
    hits: 0,
  });

  // Track image loading start
  const trackLoadStart = useCallback((url: string) => {
    const request: LoadingRequest = {
      url,
      startTime: performance.now(),
    };

    loadingRequests.current.set(url, request);

    setMetrics((prev) => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      currentlyLoading: prev.currentlyLoading + 1,
    }));
  }, []);

  // Track successful image load
  const trackLoadSuccess = useCallback(
    (url: string, fromCache: boolean = false) => {
      const request = loadingRequests.current.get(url);
      if (!request) return;

      const loadTime = performance.now() - request.startTime;
      loadTimes.current.push(loadTime);

      // Keep only last 100 load times for average calculation
      if (loadTimes.current.length > 100) {
        loadTimes.current = loadTimes.current.slice(-100);
      }

      // Track cache statistics
      cacheChecks.current.total++;
      if (fromCache) {
        cacheChecks.current.hits++;
      }

      loadingRequests.current.delete(url);

      setMetrics((prev) => {
        const averageLoadTime =
          loadTimes.current.reduce((sum, time) => sum + time, 0) /
          loadTimes.current.length;
        const cacheHitRate =
          cacheChecks.current.total > 0
            ? (cacheChecks.current.hits / cacheChecks.current.total) * 100
            : 0;

        return {
          ...prev,
          successfulRequests: prev.successfulRequests + 1,
          currentlyLoading: Math.max(0, prev.currentlyLoading - 1),
          averageLoadTime,
          cacheHitRate,
        };
      });
    },
    [],
  );

  // Track failed image load
  const trackLoadFailure = useCallback((url: string, error?: Error) => {
    const request = loadingRequests.current.get(url);
    if (request) {
      loadingRequests.current.delete(url);
    }

    setMetrics((prev) => ({
      ...prev,
      failedRequests: prev.failedRequests + 1,
      currentlyLoading: Math.max(0, prev.currentlyLoading - 1),
    }));

    // Log error for debugging
    console.warn('Preview image failed to load:', url, error);
  }, []);

  // Track bytes loaded (when available)
  const trackBytesLoaded = useCallback((bytes: number) => {
    setMetrics((prev) => ({
      ...prev,
      totalBytesLoaded: prev.totalBytesLoaded + bytes,
    }));
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    loadingRequests.current.clear();
    loadTimes.current = [];
    cacheChecks.current = { total: 0, hits: 0 };

    setMetrics({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLoadTime: 0,
      cacheHitRate: 0,
      currentlyLoading: 0,
      totalBytesLoaded: 0,
    });
  }, []);

  // Get success rate
  const getSuccessRate = useCallback(() => {
    if (metrics.totalRequests === 0) return 0;
    return (metrics.successfulRequests / metrics.totalRequests) * 100;
  }, [metrics.totalRequests, metrics.successfulRequests]);

  // Get failure rate
  const getFailureRate = useCallback(() => {
    if (metrics.totalRequests === 0) return 0;
    return (metrics.failedRequests / metrics.totalRequests) * 100;
  }, [metrics.totalRequests, metrics.failedRequests]);

  // formatBytes is now imported from @/utils

  // Get formatted metrics for display
  const getFormattedMetrics = useCallback(() => {
    return {
      ...metrics,
      successRate: getSuccessRate(),
      failureRate: getFailureRate(),
      formattedBytesLoaded: formatBytes(metrics.totalBytesLoaded),
      formattedAverageLoadTime: `${Math.round(metrics.averageLoadTime)}ms`,
    };
  }, [metrics, getSuccessRate, getFailureRate, formatBytes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loadingRequests.current.clear();
    };
  }, []);

  return {
    metrics,
    trackLoadStart,
    trackLoadSuccess,
    trackLoadFailure,
    trackBytesLoaded,
    resetMetrics,
    getSuccessRate,
    getFailureRate,
    getFormattedMetrics,
  };
}

// Global metrics instance for sharing across components
let globalMetrics: ReturnType<typeof usePreviewMetrics> | null = null;

export function useGlobalPreviewMetrics() {
  const localMetrics = usePreviewMetrics();

  // Initialize global metrics on first use
  useEffect(() => {
    if (!globalMetrics) {
      globalMetrics = localMetrics;
    }
  }, [localMetrics]);

  return globalMetrics || localMetrics;
}
