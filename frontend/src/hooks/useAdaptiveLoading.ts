import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdaptiveLoadingService,
  LoadingStrategy,
} from '@/services/adaptive/AdaptiveLoadingService';

export interface UseAdaptiveLoadingOptions {
  component: 'treemap' | 'sunburst' | 'list' | 'explorer';
  enableLearning?: boolean;
  metricsCallback?: (metrics: Record<string, any>) => void;
}

export interface UseAdaptiveLoadingReturn {
  loadingParams: Record<string, any>;
  currentStrategy: LoadingStrategy | null;
  deviceCapabilities: any;
  recordPerformance: (
    operation: string,
    duration: number,
    success: boolean,
  ) => void;
  updateBehavior: (action: any) => void;
  refresh: () => void;
  getPerformanceStats: () => Record<string, any>;
}

export function useAdaptiveLoading(
  options: UseAdaptiveLoadingOptions,
): UseAdaptiveLoadingReturn {
  const { component, enableLearning = true, metricsCallback } = options;

  const serviceRef = useRef<AdaptiveLoadingService | null>(null);
  const [currentStrategy, setCurrentStrategy] =
    useState<LoadingStrategy | null>(null);
  const [loadingParams, setLoadingParams] = useState<Record<string, any>>({});

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new AdaptiveLoadingService({
        learningEnabled: enableLearning,
        metricsCollection: true,
      });

      // Subscribe to strategy changes
      serviceRef.current.onStrategyChange((strategy) => {
        setCurrentStrategy(strategy);
        setLoadingParams(serviceRef.current!.getLoadingParams(component));

        console.log(
          `Adaptive loading updated for ${component}:`,
          strategy.name,
        );
      });

      // Set initial values
      setCurrentStrategy(serviceRef.current.getCurrentStrategy());
      setLoadingParams(serviceRef.current.getLoadingParams(component));
    }
  }, [component, enableLearning]);

  // Update loading params when component changes
  useEffect(() => {
    if (serviceRef.current) {
      setLoadingParams(serviceRef.current.getLoadingParams(component));
    }
  }, [component]);

  const recordPerformance = useCallback(
    (operation: string, duration: number, success: boolean) => {
      if (serviceRef.current) {
        serviceRef.current.recordPerformance(operation, duration, success);

        // Trigger metrics callback if provided
        if (metricsCallback) {
          const stats = serviceRef.current.getPerformanceStats();
          metricsCallback(stats);
        }
      }
    },
    [metricsCallback],
  );

  const updateBehavior = useCallback((action: any) => {
    if (serviceRef.current) {
      serviceRef.current.updateUserBehavior(action);
    }
  }, []);

  const refresh = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.refresh();
      setCurrentStrategy(serviceRef.current.getCurrentStrategy());
      setLoadingParams(serviceRef.current.getLoadingParams(component));
    }
  }, [component]);

  const getPerformanceStats = useCallback(() => {
    return serviceRef.current ? serviceRef.current.getPerformanceStats() : {};
  }, []);

  return {
    loadingParams,
    currentStrategy,
    deviceCapabilities: serviceRef.current?.['deviceCapabilities'] || null,
    recordPerformance,
    updateBehavior,
    refresh,
    getPerformanceStats,
  };
}

// Specialized hook for treemap components
export function useAdaptiveTreemap() {
  return useAdaptiveLoading({
    component: 'treemap',
    enableLearning: true,
  });
}

// Specialized hook for sunburst components
export function useAdaptiveSunburst() {
  return useAdaptiveLoading({
    component: 'sunburst',
    enableLearning: true,
  });
}

// Specialized hook for list components
export function useAdaptiveList() {
  return useAdaptiveLoading({
    component: 'list',
    enableLearning: true,
  });
}

// Specialized hook for explorer components
export function useAdaptiveExplorer() {
  return useAdaptiveLoading({
    component: 'explorer',
    enableLearning: true,
  });
}

// Hook that provides performance tracking utilities
export function usePerformanceTracking() {
  const startTimes = useRef<Map<string, number>>(new Map());

  const startOperation = useCallback((operationId: string) => {
    startTimes.current.set(operationId, performance.now());
  }, []);

  const endOperation = useCallback(
    (operationId: string, success: boolean = true) => {
      const startTime = startTimes.current.get(operationId);
      if (startTime) {
        const duration = performance.now() - startTime;
        startTimes.current.delete(operationId);
        return { duration, success };
      }
      return null;
    },
    [],
  );

  const measureAsync = useCallback(
    async <T>(
      operationId: string,
      operation: () => Promise<T>,
      onComplete?: (duration: number, success: boolean) => void,
    ): Promise<T> => {
      startOperation(operationId);

      try {
        const result = await operation();
        const timing = endOperation(operationId, true);

        if (timing && onComplete) {
          onComplete(timing.duration, timing.success);
        }

        return result;
      } catch (error) {
        const timing = endOperation(operationId, false);

        if (timing && onComplete) {
          onComplete(timing.duration, timing.success);
        }

        throw error;
      }
    },
    [startOperation, endOperation],
  );

  const measureSync = useCallback(
    <T>(
      operationId: string,
      operation: () => T,
      onComplete?: (duration: number, success: boolean) => void,
    ): T => {
      startOperation(operationId);

      try {
        const result = operation();
        const timing = endOperation(operationId, true);

        if (timing && onComplete) {
          onComplete(timing.duration, timing.success);
        }

        return result;
      } catch (error) {
        const timing = endOperation(operationId, false);

        if (timing && onComplete) {
          onComplete(timing.duration, timing.success);
        }

        throw error;
      }
    },
    [startOperation, endOperation],
  );

  return {
    startOperation,
    endOperation,
    measureAsync,
    measureSync,
  };
}
