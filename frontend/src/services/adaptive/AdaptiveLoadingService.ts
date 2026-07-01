// Adaptive loading service for VolumeViz
// Adjusts loading behavior based on device capabilities, network conditions, and usage patterns

export interface LoadingStrategy {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: {
    networkSpeed?: 'slow' | 'fast' | 'auto';
    deviceMemory?: 'low' | 'medium' | 'high';
    cpuCores?: 'few' | 'many';
    batteryLevel?: 'low' | 'normal';
    userPreference?: 'performance' | 'quality' | 'balanced';
  };
  adaptations: {
    chunkSize?: number;
    prefetchDistance?: number;
    workerThreads?: number;
    renderQuality?: 'low' | 'medium' | 'high';
    cacheSize?: number;
  };
}

export interface DeviceCapabilities {
  memory: number; // GB
  cores: number;
  networkSpeed: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'wifi';
  batteryLevel: number; // 0-1
  isOnline: boolean;
  reducedMotion: boolean;
  isLowEndDevice: boolean;
}

export interface UserBehavior {
  averageSessionDuration: number; // milliseconds
  mostUsedVisualization: 'treemap' | 'sunburst' | 'list';
  navigationPatterns: Record<string, number>;
  preferredDetailLevel: 'overview' | 'detailed' | 'comprehensive';
  interactionFrequency: 'low' | 'medium' | 'high';
}

export interface AdaptiveLoadingConfig {
  enabled: boolean;
  strategies: LoadingStrategy[];
  learningEnabled: boolean;
  metricsCollection: boolean;
  fallbackStrategy: string;
}

export class AdaptiveLoadingService {
  private config: AdaptiveLoadingConfig;
  private deviceCapabilities: DeviceCapabilities;
  private userBehavior: UserBehavior;
  private currentStrategy: LoadingStrategy | null = null;
  private performanceMetrics: Map<string, number[]> = new Map();
  private observers: ((strategy: LoadingStrategy) => void)[] = [];

  constructor(config: Partial<AdaptiveLoadingConfig> = {}) {
    this.config = {
      enabled: true,
      strategies: this.getDefaultStrategies(),
      learningEnabled: true,
      metricsCollection: true,
      fallbackStrategy: 'balanced',
      ...config,
    };

    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.userBehavior = this.loadUserBehavior();

    this.setupEventListeners();
    this.selectOptimalStrategy();
  }

  // Get the current loading strategy
  getCurrentStrategy(): LoadingStrategy | null {
    return this.currentStrategy;
  }

  // Get adaptive loading parameters for a specific component
  getLoadingParams(
    component: 'treemap' | 'sunburst' | 'list' | 'explorer',
  ): Record<string, any> {
    if (!this.currentStrategy) {
      return this.getDefaultParams(component);
    }

    const baseParams = this.getDefaultParams(component);
    const adaptations = this.currentStrategy.adaptations;

    return {
      ...baseParams,
      chunkSize: adaptations.chunkSize || baseParams.chunkSize,
      prefetchDistance:
        adaptations.prefetchDistance || baseParams.prefetchDistance,
      workerThreads: adaptations.workerThreads || baseParams.workerThreads,
      renderQuality: adaptations.renderQuality || baseParams.renderQuality,
      cacheSize: adaptations.cacheSize || baseParams.cacheSize,
    };
  }

  // Record performance metrics for strategy evaluation
  recordPerformance(
    operation: string,
    duration: number,
    success: boolean,
  ): void {
    if (!this.config.metricsCollection) return;

    const key = `${operation}_${this.currentStrategy?.name || 'none'}`;
    const metrics = this.performanceMetrics.get(key) || [];

    metrics.push(success ? duration : -1); // -1 indicates failure

    // Keep only last 50 measurements
    if (metrics.length > 50) {
      metrics.shift();
    }

    this.performanceMetrics.set(key, metrics);

    // Re-evaluate strategy if we have enough data
    if (metrics.length >= 10 && this.config.learningEnabled) {
      setTimeout(() => this.evaluateAndAdapt(), 100);
    }
  }

  // Update user behavior based on actions
  updateUserBehavior(action: {
    type: 'navigation' | 'visualization' | 'interaction';
    data: any;
    duration?: number;
  }): void {
    switch (action.type) {
      case 'navigation':
        this.updateNavigationPatterns(action.data.path);
        break;
      case 'visualization':
        this.updateVisualizationPreference(action.data.type);
        break;
      case 'interaction':
        this.updateInteractionFrequency(action.duration || 0);
        break;
    }

    this.saveUserBehavior();
  }

  // Force re-evaluation of loading strategy
  refresh(): void {
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.selectOptimalStrategy();
  }

  // Subscribe to strategy changes
  onStrategyChange(callback: (strategy: LoadingStrategy) => void): void {
    this.observers.push(callback);
  }

  // Get performance statistics
  getPerformanceStats(): Record<
    string,
    {
      avgDuration: number;
      successRate: number;
      sampleSize: number;
    }
  > {
    const stats: Record<string, any> = {};

    for (const [key, metrics] of this.performanceMetrics.entries()) {
      const successful = metrics.filter((m) => m >= 0);
      const avgDuration =
        successful.length > 0
          ? successful.reduce((sum, m) => sum + m, 0) / successful.length
          : 0;

      stats[key] = {
        avgDuration: Math.round(avgDuration),
        successRate: successful.length / metrics.length,
        sampleSize: metrics.length,
      };
    }

    return stats;
  }

  private getDefaultStrategies(): LoadingStrategy[] {
    return [
      {
        name: 'high-performance',
        description: 'Optimized for high-end devices with fast connections',
        enabled: true,
        priority: 100,
        conditions: {
          networkSpeed: 'fast',
          deviceMemory: 'high',
          cpuCores: 'many',
        },
        adaptations: {
          chunkSize: 10000,
          prefetchDistance: 5,
          workerThreads: 4,
          renderQuality: 'high',
          cacheSize: 100 * 1024 * 1024, // 100MB
        },
      },
      {
        name: 'balanced',
        description: 'Balanced approach for most devices',
        enabled: true,
        priority: 50,
        conditions: {
          networkSpeed: 'auto',
          deviceMemory: 'medium',
        },
        adaptations: {
          chunkSize: 5000,
          prefetchDistance: 3,
          workerThreads: 2,
          renderQuality: 'medium',
          cacheSize: 50 * 1024 * 1024, // 50MB
        },
      },
      {
        name: 'low-resource',
        description: 'Optimized for low-end devices and slow connections',
        enabled: true,
        priority: 10,
        conditions: {
          networkSpeed: 'slow',
          deviceMemory: 'low',
          cpuCores: 'few',
        },
        adaptations: {
          chunkSize: 1000,
          prefetchDistance: 1,
          workerThreads: 1,
          renderQuality: 'low',
          cacheSize: 10 * 1024 * 1024, // 10MB
        },
      },
      {
        name: 'battery-saver',
        description: 'Optimized for devices with low battery',
        enabled: true,
        priority: 20,
        conditions: {
          batteryLevel: 'low',
        },
        adaptations: {
          chunkSize: 2000,
          prefetchDistance: 1,
          workerThreads: 1,
          renderQuality: 'low',
          cacheSize: 25 * 1024 * 1024, // 25MB
        },
      },
      {
        name: 'accessibility',
        description: 'Optimized for users with reduced motion preferences',
        enabled: true,
        priority: 30,
        conditions: {
          userPreference: 'performance',
        },
        adaptations: {
          chunkSize: 3000,
          prefetchDistance: 2,
          workerThreads: 2,
          renderQuality: 'medium',
          cacheSize: 30 * 1024 * 1024, // 30MB
        },
      },
    ];
  }

  private detectDeviceCapabilities(): DeviceCapabilities {
    // Detect memory
    const nav = navigator as any;
    const memory = nav.deviceMemory || this.estimateMemory();

    // Detect CPU cores
    const cores = nav.hardwareConcurrency || 4;

    // Detect network speed
    const connection =
      nav.connection || nav.mozConnection || nav.webkitConnection;
    const networkSpeed = this.mapNetworkSpeed(
      connection?.effectiveType || '4g',
    );

    // Detect battery
    let batteryLevel = 1;
    if ('getBattery' in nav) {
      nav.getBattery().then((battery: any) => {
        batteryLevel = battery.level;
      });
    }

    // Check for reduced motion preference
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // Determine if low-end device
    const isLowEndDevice =
      memory < 4 ||
      cores < 4 ||
      networkSpeed === 'slow-2g' ||
      networkSpeed === '2g';

    return {
      memory,
      cores,
      networkSpeed,
      batteryLevel,
      isOnline: navigator.onLine,
      reducedMotion,
      isLowEndDevice,
    };
  }

  private estimateMemory(): number {
    // Fallback memory estimation based on user agent and performance
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('mobile') || userAgent.includes('android')) {
      return 2; // Assume 2GB for mobile devices
    }

    // Use performance timing as a rough indicator
    const perf = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    if (perf && perf.loadEventEnd - perf.startTime > 3000) {
      return 4; // Slower loading might indicate lower-end device
    }

    return 8; // Default assumption for desktop
  }

  private mapNetworkSpeed(
    effectiveType: string,
  ): DeviceCapabilities['networkSpeed'] {
    const speedMap: Record<string, DeviceCapabilities['networkSpeed']> = {
      'slow-2g': 'slow-2g',
      '2g': '2g',
      '3g': '3g',
      '4g': '4g',
      '5g': '5g',
    };

    return speedMap[effectiveType] || '4g';
  }

  private loadUserBehavior(): UserBehavior {
    try {
      const stored = localStorage.getItem('volumeviz_user_behavior');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load user behavior:', error);
    }

    return {
      averageSessionDuration: 0,
      mostUsedVisualization: 'treemap',
      navigationPatterns: {},
      preferredDetailLevel: 'detailed',
      interactionFrequency: 'medium',
    };
  }

  private saveUserBehavior(): void {
    try {
      localStorage.setItem(
        'volumeviz_user_behavior',
        JSON.stringify(this.userBehavior),
      );
    } catch (error) {
      console.warn('Failed to save user behavior:', error);
    }
  }

  private selectOptimalStrategy(): void {
    if (!this.config.enabled) return;

    const compatibleStrategies = this.config.strategies.filter((strategy) =>
      this.isStrategyCompatible(strategy),
    );

    if (compatibleStrategies.length === 0) {
      // Fallback to default strategy
      const fallback = this.config.strategies.find(
        (s) => s.name === this.config.fallbackStrategy,
      );
      this.setCurrentStrategy(fallback || this.config.strategies[0]);
      return;
    }

    // Score strategies based on compatibility and performance history
    const scoredStrategies = compatibleStrategies.map((strategy) => ({
      strategy,
      score: this.calculateStrategyScore(strategy),
    }));

    // Select highest scoring strategy
    scoredStrategies.sort((a, b) => b.score - a.score);
    this.setCurrentStrategy(scoredStrategies[0].strategy);
  }

  private isStrategyCompatible(strategy: LoadingStrategy): boolean {
    const { conditions } = strategy;
    const { deviceCapabilities } = this;

    // Check network speed
    if (conditions.networkSpeed && conditions.networkSpeed !== 'auto') {
      if (conditions.networkSpeed === 'fast' && !this.isFastNetwork())
        return false;
      if (conditions.networkSpeed === 'slow' && this.isFastNetwork())
        return false;
    }

    // Check device memory
    if (conditions.deviceMemory) {
      if (conditions.deviceMemory === 'high' && deviceCapabilities.memory < 8)
        return false;
      if (
        conditions.deviceMemory === 'medium' &&
        (deviceCapabilities.memory < 4 || deviceCapabilities.memory >= 8)
      )
        return false;
      if (conditions.deviceMemory === 'low' && deviceCapabilities.memory >= 4)
        return false;
    }

    // Check CPU cores
    if (conditions.cpuCores) {
      if (conditions.cpuCores === 'many' && deviceCapabilities.cores < 8)
        return false;
      if (conditions.cpuCores === 'few' && deviceCapabilities.cores >= 4)
        return false;
    }

    // Check battery level
    if (
      conditions.batteryLevel === 'low' &&
      deviceCapabilities.batteryLevel > 0.2
    )
      return false;

    return true;
  }

  private isFastNetwork(): boolean {
    return ['4g', '5g', 'wifi'].includes(this.deviceCapabilities.networkSpeed);
  }

  private calculateStrategyScore(strategy: LoadingStrategy): number {
    let score = strategy.priority;

    // Bonus for performance history
    const perfKey = `overall_${strategy.name}`;
    const metrics = this.performanceMetrics.get(perfKey);

    if (metrics && metrics.length >= 5) {
      const successful = metrics.filter((m) => m >= 0);
      const successRate = successful.length / metrics.length;
      const avgDuration =
        successful.reduce((sum, m) => sum + m, 0) / successful.length;

      // Bonus for high success rate and low duration
      score += successRate * 50 - avgDuration / 100;
    }

    // Bonus for user behavior alignment
    if (strategy.name.includes(this.userBehavior.mostUsedVisualization)) {
      score += 10;
    }

    return score;
  }

  private setCurrentStrategy(strategy: LoadingStrategy): void {
    if (this.currentStrategy?.name === strategy.name) return;

    this.currentStrategy = strategy;
    console.log(`Adaptive loading: Switched to ${strategy.name} strategy`);

    // Notify observers
    this.observers.forEach((callback) => {
      try {
        callback(strategy);
      } catch (error) {
        console.error('Strategy change observer error:', error);
      }
    });
  }

  private evaluateAndAdapt(): void {
    if (!this.config.learningEnabled) return;

    const currentPerf = this.getStrategyPerformance(
      this.currentStrategy?.name || '',
    );

    // If current strategy is underperforming, try to find a better one
    if (currentPerf.successRate < 0.8 || currentPerf.avgDuration > 2000) {
      this.selectOptimalStrategy();
    }
  }

  private getStrategyPerformance(strategyName: string): {
    successRate: number;
    avgDuration: number;
  } {
    const perfKey = `overall_${strategyName}`;
    const metrics = this.performanceMetrics.get(perfKey) || [];

    if (metrics.length === 0) {
      return { successRate: 1, avgDuration: 1000 };
    }

    const successful = metrics.filter((m) => m >= 0);
    return {
      successRate: successful.length / metrics.length,
      avgDuration:
        successful.reduce((sum, m) => sum + m, 0) / successful.length,
    };
  }

  private getDefaultParams(
    component: 'treemap' | 'sunburst' | 'list' | 'explorer',
  ): Record<string, any> {
    const defaults = {
      treemap: {
        chunkSize: 5000,
        prefetchDistance: 3,
        workerThreads: 2,
        renderQuality: 'medium',
        cacheSize: 50 * 1024 * 1024,
      },
      sunburst: {
        chunkSize: 3000,
        prefetchDistance: 2,
        workerThreads: 2,
        renderQuality: 'medium',
        cacheSize: 30 * 1024 * 1024,
      },
      list: {
        chunkSize: 1000,
        prefetchDistance: 5,
        workerThreads: 1,
        renderQuality: 'high',
        cacheSize: 20 * 1024 * 1024,
      },
      explorer: {
        chunkSize: 2000,
        prefetchDistance: 3,
        workerThreads: 1,
        renderQuality: 'medium',
        cacheSize: 40 * 1024 * 1024,
      },
    };

    return defaults[component] || defaults.treemap;
  }

  private updateNavigationPatterns(path: string): void {
    this.userBehavior.navigationPatterns[path] =
      (this.userBehavior.navigationPatterns[path] || 0) + 1;
  }

  private updateVisualizationPreference(
    type: 'treemap' | 'sunburst' | 'list',
  ): void {
    // Simple frequency-based preference
    const current = this.userBehavior.navigationPatterns[`viz_${type}`] || 0;
    this.userBehavior.navigationPatterns[`viz_${type}`] = current + 1;

    // Update most used visualization
    const vizCounts = {
      treemap: this.userBehavior.navigationPatterns['viz_treemap'] || 0,
      sunburst: this.userBehavior.navigationPatterns['viz_sunburst'] || 0,
      list: this.userBehavior.navigationPatterns['viz_list'] || 0,
    };

    this.userBehavior.mostUsedVisualization = Object.entries(vizCounts).reduce(
      (a, b) => (a[1] > b[1] ? a : b),
    )[0] as any;
  }

  private updateInteractionFrequency(duration: number): void {
    // Update average session duration
    this.userBehavior.averageSessionDuration =
      (this.userBehavior.averageSessionDuration + duration) / 2;

    // Determine interaction frequency based on session duration
    if (this.userBehavior.averageSessionDuration < 60000) {
      // < 1 minute
      this.userBehavior.interactionFrequency = 'low';
    } else if (this.userBehavior.averageSessionDuration < 300000) {
      // < 5 minutes
      this.userBehavior.interactionFrequency = 'medium';
    } else {
      this.userBehavior.interactionFrequency = 'high';
    }
  }

  private setupEventListeners(): void {
    // Listen for network changes
    window.addEventListener('online', () => {
      this.deviceCapabilities.isOnline = true;
      this.refresh();
    });

    window.addEventListener('offline', () => {
      this.deviceCapabilities.isOnline = false;
      this.refresh();
    });

    // Listen for battery changes (if supported)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('levelchange', () => {
          this.deviceCapabilities.batteryLevel = battery.level;
          this.refresh();
        });
      });
    }

    // Listen for memory pressure (if supported)
    if ('memory' in performance) {
      const checkMemory = () => {
        const memInfo = (performance as any).memory;
        if (memInfo.usedJSHeapSize / memInfo.totalJSHeapSize > 0.9) {
          console.warn(
            'High memory usage detected, switching to low-resource strategy',
          );
          const lowResourceStrategy = this.config.strategies.find(
            (s) => s.name === 'low-resource',
          );
          if (lowResourceStrategy) {
            this.setCurrentStrategy(lowResourceStrategy);
          }
        }
      };

      setInterval(checkMemory, 30000); // Check every 30 seconds
    }
  }
}
