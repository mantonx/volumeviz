import { useEffect, useRef, useState, useCallback } from 'react';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

export interface PerformanceMetrics {
  /** Component render time in milliseconds */
  renderTime: number;
  /** API response time in milliseconds */
  apiResponseTime: number;
  /** Data processing time in milliseconds */
  processingTime: number;
  /** Memory usage estimation */
  memoryUsage: number;
  /** Number of items being processed */
  itemCount: number;
  /** Timestamp when metrics were collected */
  timestamp: number;
}

export interface PerformanceEntry {
  id: string;
  component: string;
  operation: string;
  metrics: PerformanceMetrics;
  metadata?: Record<string, any>;
}

// Global performance metrics atom
const performanceEntriesAtom = atom<PerformanceEntry[]>([]);
const performanceEnabledAtom = atom<boolean>(true);

export interface UsePerformanceMonitoringOptions {
  /** Component name for identification */
  component: string;
  /** Enable/disable monitoring */
  enabled?: boolean;
  /** Maximum number of entries to keep */
  maxEntries?: number;
}

/**
 * Hook for monitoring component performance
 */
export function usePerformanceMonitoring({
  component,
  enabled = true,
  maxEntries = 100,
}: UsePerformanceMonitoringOptions) {
  const [entries, setEntries] = useAtom(performanceEntriesAtom);
  const isGloballyEnabled = useAtomValue(performanceEnabledAtom);
  const renderStartTime = useRef<number>();
  const apiStartTimes = useRef<Map<string, number>>(new Map());
  const processingStartTimes = useRef<Map<string, number>>(new Map());

  const isEnabled = enabled && isGloballyEnabled;

  // Start render measurement
  useEffect(() => {
    if (!isEnabled) return;
    renderStartTime.current = performance.now();
  });

  // Record performance entry
  const recordEntry = useCallback(
    (operation: string, metrics: PerformanceMetrics, metadata?: Record<string, any>) => {
      if (!isEnabled) return;

      const entry: PerformanceEntry = {
        id: `${component}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        component,
        operation,
        metrics,
        metadata,
      };

      setEntries((prev) => {
        const newEntries = [...prev, entry];
        return newEntries.length > maxEntries
          ? newEntries.slice(-maxEntries)
          : newEntries;
      });
    },
    [component, isEnabled, maxEntries, setEntries]
  );

  // Render time measurement
  const measureRender = useCallback(() => {
    if (!isEnabled || !renderStartTime.current) return;

    const renderTime = performance.now() - renderStartTime.current;
    const memoryUsage = getMemoryUsage();

    recordEntry('render', {
      renderTime,
      apiResponseTime: 0,
      processingTime: 0,
      memoryUsage,
      itemCount: 0,
      timestamp: Date.now(),
    });
  }, [isEnabled, recordEntry]);

  // API call measurement
  const measureApiCall = useCallback(
    (operationId: string) => {
      if (!isEnabled) return { start: () => {}, end: () => {} };

      return {
        start: () => {
          apiStartTimes.current.set(operationId, performance.now());
        },
        end: (itemCount = 0, metadata?: Record<string, any>) => {
          const startTime = apiStartTimes.current.get(operationId);
          if (!startTime) return;

          const apiResponseTime = performance.now() - startTime;
          apiStartTimes.current.delete(operationId);

          recordEntry('api-call', {
            renderTime: 0,
            apiResponseTime,
            processingTime: 0,
            memoryUsage: getMemoryUsage(),
            itemCount,
            timestamp: Date.now(),
          }, metadata);
        },
      };
    },
    [isEnabled, recordEntry]
  );

  // Data processing measurement
  const measureProcessing = useCallback(
    (operationId: string) => {
      if (!isEnabled) return { start: () => {}, end: () => {} };

      return {
        start: () => {
          processingStartTimes.current.set(operationId, performance.now());
        },
        end: (itemCount = 0, metadata?: Record<string, any>) => {
          const startTime = processingStartTimes.current.get(operationId);
          if (!startTime) return;

          const processingTime = performance.now() - startTime;
          processingStartTimes.current.delete(operationId);

          recordEntry('data-processing', {
            renderTime: 0,
            apiResponseTime: 0,
            processingTime,
            memoryUsage: getMemoryUsage(),
            itemCount,
            timestamp: Date.now(),
          }, metadata);
        },
      };
    },
    [isEnabled, recordEntry]
  );

  // Get component-specific metrics
  const getMetrics = useCallback(() => {
    return entries.filter((entry) => entry.component === component);
  }, [entries, component]);

  // Get recent metrics
  const getRecentMetrics = useCallback((minutes = 5) => {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return entries.filter(
      (entry) => entry.component === component && entry.metrics.timestamp > cutoff
    );
  }, [entries, component]);

  return {
    measureRender,
    measureApiCall,
    measureProcessing,
    recordEntry,
    getMetrics,
    getRecentMetrics,
    isEnabled,
  };
}

/**
 * Hook for accessing global performance data
 */
export function usePerformanceData() {
  const [entries, setEntries] = useAtom(performanceEntriesAtom);
  const [isEnabled, setIsEnabled] = useAtom(performanceEnabledAtom);

  // Clear all entries
  const clearEntries = useCallback(() => {
    setEntries([]);
  }, [setEntries]);

  // Get aggregated metrics
  const getAggregatedMetrics = useCallback(() => {
    const recent = entries.filter(
      (entry) => entry.metrics.timestamp > Date.now() - 5 * 60 * 1000
    );

    const renderTimes = recent
      .filter((entry) => entry.operation === 'render')
      .map((entry) => entry.metrics.renderTime);

    const apiTimes = recent
      .filter((entry) => entry.operation === 'api-call')
      .map((entry) => entry.metrics.apiResponseTime);

    const processingTimes = recent
      .filter((entry) => entry.operation === 'data-processing')
      .map((entry) => entry.metrics.processingTime);

    return {
      render: {
        avg: average(renderTimes),
        min: Math.min(...renderTimes, Infinity),
        max: Math.max(...renderTimes, -Infinity),
        count: renderTimes.length,
      },
      api: {
        avg: average(apiTimes),
        min: Math.min(...apiTimes, Infinity),
        max: Math.max(...apiTimes, -Infinity),
        count: apiTimes.length,
      },
      processing: {
        avg: average(processingTimes),
        min: Math.min(...processingTimes, Infinity),
        max: Math.max(...processingTimes, -Infinity),
        count: processingTimes.length,
      },
      totalEntries: entries.length,
      recentEntries: recent.length,
    };
  }, [entries]);

  // Get component breakdown
  const getComponentBreakdown = useCallback(() => {
    const breakdown: Record<string, { count: number; avgRenderTime: number }> = {};

    entries
      .filter((entry) => entry.operation === 'render')
      .forEach((entry) => {
        if (!breakdown[entry.component]) {
          breakdown[entry.component] = { count: 0, avgRenderTime: 0 };
        }
        breakdown[entry.component].count++;
        breakdown[entry.component].avgRenderTime += entry.metrics.renderTime;
      });

    // Calculate averages
    Object.keys(breakdown).forEach((component) => {
      breakdown[component].avgRenderTime /= breakdown[component].count;
    });

    return breakdown;
  }, [entries]);

  return {
    entries,
    isEnabled,
    setIsEnabled,
    clearEntries,
    getAggregatedMetrics,
    getComponentBreakdown,
  };
}

/**
 * Hook for performance alerts and warnings
 */
export function usePerformanceAlerts() {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const entries = useAtomValue(performanceEntriesAtom);

  useEffect(() => {
    const newAlerts: PerformanceAlert[] = [];

    // Check for slow renders (> 16ms for 60fps)
    const recentRenders = entries
      .filter((entry) => entry.operation === 'render')
      .filter((entry) => entry.metrics.timestamp > Date.now() - 30 * 1000);

    const slowRenders = recentRenders.filter((entry) => entry.metrics.renderTime > 16);
    if (slowRenders.length > 0) {
      newAlerts.push({
        id: 'slow-renders',
        type: 'warning',
        message: `${slowRenders.length} slow renders detected in the last 30 seconds`,
        details: `Components: ${[...new Set(slowRenders.map(e => e.component))].join(', ')}`,
        timestamp: Date.now(),
      });
    }

    // Check for slow API calls (> 1000ms)
    const recentApiCalls = entries
      .filter((entry) => entry.operation === 'api-call')
      .filter((entry) => entry.metrics.timestamp > Date.now() - 60 * 1000);

    const slowApiCalls = recentApiCalls.filter((entry) => entry.metrics.apiResponseTime > 1000);
    if (slowApiCalls.length > 0) {
      newAlerts.push({
        id: 'slow-api-calls',
        type: 'error',
        message: `${slowApiCalls.length} slow API calls detected in the last minute`,
        details: `Avg time: ${average(slowApiCalls.map(e => e.metrics.apiResponseTime)).toFixed(0)}ms`,
        timestamp: Date.now(),
      });
    }

    // Check for high memory usage
    const recentMemoryUsage = entries
      .filter((entry) => entry.metrics.timestamp > Date.now() - 30 * 1000)
      .map((entry) => entry.metrics.memoryUsage)
      .filter((usage) => usage > 0);

    const avgMemoryUsage = average(recentMemoryUsage);
    if (avgMemoryUsage > 50) { // Arbitrary threshold for demo
      newAlerts.push({
        id: 'high-memory-usage',
        type: 'warning',
        message: 'High memory usage detected',
        details: `Average usage: ${avgMemoryUsage.toFixed(1)}MB`,
        timestamp: Date.now(),
      });
    }

    setAlerts(newAlerts);
  }, [entries]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  return {
    alerts,
    dismissAlert,
    hasAlerts: alerts.length > 0,
    errorCount: alerts.filter((alert) => alert.type === 'error').length,
    warningCount: alerts.filter((alert) => alert.type === 'warning').length,
  };
}

// Utility functions
function getMemoryUsage(): number {
  // Use Performance API or estimate based on browser support
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  return 0;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

// Types
export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  details?: string;
  timestamp: number;
}