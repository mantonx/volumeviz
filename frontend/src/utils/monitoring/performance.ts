/**
 * Performance monitoring and tracking utilities
 * Tracks API response times, component render performance, and user interactions
 */

import { config, isProduction } from '@/config/environment';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  category: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupObservers();
  }

  /**
   * Set up performance observers for various metrics
   */
  private setupObservers() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.recordMetric({
            name: 'LCP',
            value: lastEntry.renderTime || lastEntry.loadTime,
            unit: 'ms',
            category: 'web-vitals',
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              unit: 'ms',
              category: 'web-vitals',
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);

        // Cumulative Layout Shift (CLS)
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          let clsValue = 0;
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordMetric({
            name: 'CLS',
            value: clsValue,
            unit: 'score',
            category: 'web-vitals',
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('Failed to set up performance observers:', error);
      }
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing and record the metric
   */
  endTimer(
    name: string,
    category: string = 'custom',
    metadata?: Record<string, any>,
  ): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      category,
      metadata,
    });

    return duration;
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    // Log in development
    if (config.environment === 'development') {
      console.log(
        `📊 Performance: ${metric.name} = ${metric.value}${metric.unit}`,
        metric.metadata,
      );
    }

    // Send to analytics
    this.sendToAnalytics(metric);

    // Clean up old metrics (keep last 100)
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Send metrics to analytics service
   */
  private sendToAnalytics(metric: PerformanceMetric): void {
    // Google Analytics
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'performance', {
        event_category: metric.category,
        event_label: metric.name,
        value: Math.round(metric.value),
        custom_map: metric.metadata,
      });
    }

    // Custom analytics endpoint
    if (config.monitoring.enablePerformanceTracking && isProduction) {
      // Batch metrics and send periodically
      this.batchAndSendMetrics();
    }
  }

  /**
   * Batch and send metrics to server
   */
  private batchAndSendMetrics = debounce(() => {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    fetch(`${config.apiBaseUrl}/api/v1/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metrics: metricsToSend,
        session: getSessionId(),
        timestamp: Date.now(),
      }),
    }).catch((error) => {
      console.error('Failed to send metrics:', error);
      // Re-add metrics to queue on failure
      this.metrics.unshift(...metricsToSend);
    });
  }, 5000);

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.category]) {
        summary[metric.category] = {};
      }

      if (!summary[metric.category][metric.name]) {
        summary[metric.category][metric.name] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: -Infinity,
          avg: 0,
        };
      }

      const stat = summary[metric.category][metric.name];
      stat.count++;
      stat.total += metric.value;
      stat.min = Math.min(stat.min, metric.value);
      stat.max = Math.max(stat.max, metric.value);
      stat.avg = stat.total / stat.count;
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Cleanup observers
   */
  cleanup(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Track API call performance
 */
export const trackApiCall = (
  endpoint: string,
  duration: number,
  status: number,
) => {
  performanceMonitor.recordMetric({
    name: `api_${endpoint.replace(/\//g, '_')}`,
    value: duration,
    unit: 'ms',
    category: 'api',
    metadata: {
      endpoint,
      status,
      success: status >= 200 && status < 300,
    },
  });
};

/**
 * Track React Query performance
 */
export const trackQueryPerformance = (
  queryKey: string,
  duration: number,
  success: boolean,
) => {
  performanceMonitor.recordMetric({
    name: `query_${queryKey}`,
    value: duration,
    unit: 'ms',
    category: 'react-query',
    metadata: {
      queryKey,
      success,
    },
  });
};

/**
 * Track component render performance
 */
export const trackComponentRender = (
  componentName: string,
  duration: number,
) => {
  performanceMonitor.recordMetric({
    name: `render_${componentName}`,
    value: duration,
    unit: 'ms',
    category: 'component',
    metadata: {
      component: componentName,
    },
  });
};

/**
 * Track user interactions
 */
export const trackInteraction = (
  action: string,
  target: string,
  duration?: number,
) => {
  performanceMonitor.recordMetric({
    name: `interaction_${action}`,
    value: duration || 0,
    unit: 'ms',
    category: 'interaction',
    metadata: {
      action,
      target,
    },
  });
};

/**
 * React hook for performance tracking
 */
export const usePerformanceTracking = (componentName: string) => {
  const renderStart = React.useRef(performance.now());

  React.useEffect(() => {
    const renderDuration = performance.now() - renderStart.current;
    trackComponentRender(componentName, renderDuration);
  });

  const trackAction = React.useCallback(
    (action: string, metadata?: any) => {
      trackInteraction(action, componentName, 0);
      if (metadata) {
        performanceMonitor.recordMetric({
          name: `${componentName}_${action}`,
          value: 1,
          unit: 'count',
          category: 'component-action',
          metadata,
        });
      }
    },
    [componentName],
  );

  return { trackAction };
};

/**
 * HOC for automatic performance tracking
 */
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const renderStart = React.useRef(performance.now());

    React.useEffect(() => {
      const renderDuration = performance.now() - renderStart.current;
      trackComponentRender(componentName, renderDuration);
    });

    return React.createElement(Component, { ...props, ref });
  });
};

/**
 * Track route changes
 */
export const trackRouteChange = (
  from: string,
  to: string,
  duration: number,
) => {
  performanceMonitor.recordMetric({
    name: 'route_change',
    value: duration,
    unit: 'ms',
    category: 'navigation',
    metadata: {
      from,
      to,
    },
  });
};

/**
 * Track WebSocket performance
 */
export const trackWebSocketPerformance = (
  event: string,
  duration: number,
  success: boolean,
) => {
  performanceMonitor.recordMetric({
    name: `ws_${event}`,
    value: duration,
    unit: 'ms',
    category: 'websocket',
    metadata: {
      event,
      success,
    },
  });
};

/**
 * Utility functions
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

// Auto-track page load performance
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;

    if (perfData) {
      performanceMonitor.recordMetric({
        name: 'page_load_time',
        value: perfData.loadEventEnd - perfData.fetchStart,
        unit: 'ms',
        category: 'navigation',
        metadata: {
          dns: perfData.domainLookupEnd - perfData.domainLookupStart,
          tcp: perfData.connectEnd - perfData.connectStart,
          request: perfData.responseStart - perfData.requestStart,
          response: perfData.responseEnd - perfData.responseStart,
          dom: perfData.domComplete - perfData.domInteractive,
        },
      });
    }
  });
}

// Clean up on unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.cleanup();
  });
}

export default performanceMonitor;
