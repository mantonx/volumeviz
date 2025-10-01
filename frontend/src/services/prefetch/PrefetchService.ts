// Intelligent prefetch service for VolumeViz
// Predicts and preloads data based on user behavior and navigation patterns

export interface PrefetchItem {
  id: string;
  url: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  expiresAt: number;
  size?: number;
  metadata?: Record<string, any>;
}

export interface PrefetchConfig {
  maxCacheSize: number; // bytes
  maxItems: number;
  defaultTTL: number; // milliseconds
  priorityWeights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  networkThrottling: boolean;
  adaptivePrefetch: boolean;
}

export interface NavigationPattern {
  path: string;
  frequency: number;
  lastVisited: number;
  avgTimeSpent: number;
  nextPaths: Record<string, number>; // path -> frequency
}

export interface PrefetchStrategy {
  name: string;
  predict: (currentPath: string, patterns: NavigationPattern[]) => string[];
  priority: (
    path: string,
    context: any,
  ) => 'low' | 'medium' | 'high' | 'critical';
}

export class PrefetchService {
  private cache = new Map<string, PrefetchItem>();
  private config: PrefetchConfig;
  private navigationPatterns = new Map<string, NavigationPattern>();
  private strategies: PrefetchStrategy[] = [];
  private requestQueue: PrefetchItem[] = [];
  private isProcessing = false;
  private networkInfo: any = null;
  private observers: ((event: string, data: any) => void)[] = [];

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = {
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxItems: 100,
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      priorityWeights: {
        critical: 1000,
        high: 100,
        medium: 10,
        low: 1,
      },
      networkThrottling: true,
      adaptivePrefetch: true,
      ...config,
    };

    this.setupDefaultStrategies();
    this.setupNetworkMonitoring();
    this.startCleanupTimer();
  }

  // Add data to prefetch queue
  prefetch(url: string, options: Partial<PrefetchItem> = {}): Promise<any> {
    const item: PrefetchItem = {
      id: options.id || this.generateId(url),
      url,
      priority: options.priority || 'medium',
      timestamp: Date.now(),
      expiresAt: Date.now() + (options.metadata?.ttl || this.config.defaultTTL),
      metadata: options.metadata,
      ...options,
    };

    // Check if already cached
    if (this.cache.has(item.id)) {
      const cached = this.cache.get(item.id)!;
      if (cached.expiresAt > Date.now()) {
        this.emit('cache-hit', { item: cached });
        return Promise.resolve(cached.data);
      }
    }

    // Add to queue
    this.requestQueue.push(item);
    this.sortQueue();

    if (!this.isProcessing) {
      this.processQueue();
    }

    return new Promise((resolve, reject) => {
      item.metadata = {
        ...item.metadata,
        resolve,
        reject,
      };
    });
  }

  // Get cached data
  get(id: string): PrefetchItem | null {
    const item = this.cache.get(id);
    if (!item) return null;

    if (item.expiresAt < Date.now()) {
      this.cache.delete(id);
      return null;
    }

    return item;
  }

  // Check if data is cached
  has(id: string): boolean {
    return this.get(id) !== null;
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.requestQueue = [];
    this.emit('cache-cleared', {});
  }

  // Record navigation for pattern learning
  recordNavigation(path: string, timeSpent: number = 0): void {
    const pattern = this.navigationPatterns.get(path) || {
      path,
      frequency: 0,
      lastVisited: 0,
      avgTimeSpent: 0,
      nextPaths: {},
    };

    pattern.frequency++;
    pattern.lastVisited = Date.now();
    pattern.avgTimeSpent = (pattern.avgTimeSpent + timeSpent) / 2;

    this.navigationPatterns.set(path, pattern);

    // Update next path predictions
    const previousPath = this.getPreviousPath();
    if (previousPath && previousPath !== path) {
      const prevPattern = this.navigationPatterns.get(previousPath);
      if (prevPattern) {
        prevPattern.nextPaths[path] = (prevPattern.nextPaths[path] || 0) + 1;
        this.navigationPatterns.set(previousPath, prevPattern);
      }
    }

    this.setPreviousPath(path);
  }

  // Get predictions for next likely paths
  getPredictions(currentPath: string, limit: number = 5): string[] {
    const allPredictions = new Set<string>();

    // Run all strategies
    for (const strategy of this.strategies) {
      const predictions = strategy.predict(
        currentPath,
        Array.from(this.navigationPatterns.values()),
      );
      predictions.forEach((path) => allPredictions.add(path));
    }

    // Sort by combined priority and frequency
    return Array.from(allPredictions)
      .map((path) => ({
        path,
        score: this.calculatePredictionScore(path, currentPath),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p) => p.path);
  }

  // Prefetch predictions automatically
  async prefetchPredictions(currentPath: string): Promise<void> {
    if (!this.config.adaptivePrefetch) return;

    const predictions = this.getPredictions(currentPath);
    const promises: Promise<any>[] = [];

    for (const path of predictions) {
      const url = this.pathToUrl(path);
      const priority = this.calculatePriorityForPath(path, currentPath);

      promises.push(
        this.prefetch(url, {
          id: this.generateId(path),
          priority,
          metadata: {
            source: 'prediction',
            currentPath,
            predictedPath: path,
          },
        }).catch((err) => {
          console.warn('Prefetch prediction failed:', path, err);
        }),
      );
    }

    await Promise.allSettled(promises);
  }

  // Add custom prefetch strategy
  addStrategy(strategy: PrefetchStrategy): void {
    this.strategies.push(strategy);
  }

  // Subscribe to events
  on(event: string, callback: (data: any) => void): void {
    this.observers.push(callback);
  }

  // Get cache statistics
  getStats(): {
    size: number;
    items: number;
    hitRate: number;
    memory: number;
  } {
    const items = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      items: items.length,
      hitRate: this.calculateHitRate(),
      memory: items.reduce((sum, item) => sum + (item.size || 0), 0),
    };
  }

  private setupDefaultStrategies(): void {
    // Frequency-based strategy
    this.addStrategy({
      name: 'frequency',
      predict: (currentPath, patterns) => {
        return patterns
          .filter((p) => p.frequency > 1)
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3)
          .map((p) => p.path);
      },
      priority: (path, context) => {
        const pattern = this.navigationPatterns.get(path);
        if (!pattern) return 'low';
        return pattern.frequency > 5 ? 'high' : 'medium';
      },
    });

    // Navigation chain strategy
    this.addStrategy({
      name: 'navigation-chain',
      predict: (currentPath, patterns) => {
        const currentPattern = patterns.find((p) => p.path === currentPath);
        if (!currentPattern) return [];

        return Object.entries(currentPattern.nextPaths)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([path]) => path);
      },
      priority: (path, context) => {
        const currentPattern = this.navigationPatterns.get(context.currentPath);
        if (!currentPattern) return 'low';

        const nextFreq = currentPattern.nextPaths[path] || 0;
        return nextFreq > 2 ? 'high' : 'medium';
      },
    });

    // Sibling paths strategy (for file explorer)
    this.addStrategy({
      name: 'sibling-paths',
      predict: (currentPath, patterns) => {
        const pathSegments = currentPath.split('/');
        const parentPath = pathSegments.slice(0, -1).join('/');

        return patterns
          .filter(
            (p) => p.path.startsWith(parentPath) && p.path !== currentPath,
          )
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 2)
          .map((p) => p.path);
      },
      priority: () => 'medium',
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.requestQueue.length > 0) {
        // Check network conditions
        if (this.shouldThrottleRequests()) {
          await this.delay(1000);
          continue;
        }

        const item = this.requestQueue.shift()!;
        await this.fetchItem(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async fetchItem(item: PrefetchItem): Promise<void> {
    try {
      this.emit('fetch-start', { item });

      const response = await fetch(item.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const size = new Blob([JSON.stringify(data)]).size;

      // Check cache limits before storing
      if (this.canCache(size)) {
        item.data = data;
        item.size = size;
        this.cache.set(item.id, item);
        this.enforceMemoryLimits();
      }

      this.emit('fetch-success', { item, data });

      // Resolve promise if exists
      if (item.metadata?.resolve) {
        item.metadata.resolve(data);
      }
    } catch (error) {
      this.emit('fetch-error', { item, error });

      if (item.metadata?.reject) {
        item.metadata.reject(error);
      }
    }
  }

  private sortQueue(): void {
    this.requestQueue.sort((a, b) => {
      const priorityA = this.config.priorityWeights[a.priority];
      const priorityB = this.config.priorityWeights[b.priority];
      return priorityB - priorityA;
    });
  }

  private canCache(size: number): boolean {
    const currentMemory = this.getStats().memory;
    return (
      this.cache.size < this.config.maxItems &&
      currentMemory + size <= this.config.maxCacheSize
    );
  }

  private enforceMemoryLimits(): void {
    const items = Array.from(this.cache.entries())
      .map(([id, item]) => ({ id, item }))
      .sort((a, b) => {
        // Sort by priority first, then by timestamp
        const priorityDiff =
          this.config.priorityWeights[b.item.priority] -
          this.config.priorityWeights[a.item.priority];
        return priorityDiff !== 0
          ? priorityDiff
          : b.item.timestamp - a.item.timestamp;
      });

    let currentMemory = items.reduce(
      (sum, { item }) => sum + (item.size || 0),
      0,
    );

    // Remove least important items until within limits
    while (
      (this.cache.size > this.config.maxItems ||
        currentMemory > this.config.maxCacheSize) &&
      items.length > 0
    ) {
      const toRemove = items.pop()!;
      this.cache.delete(toRemove.id);
      currentMemory -= toRemove.item.size || 0;
    }
  }

  private shouldThrottleRequests(): boolean {
    if (!this.config.networkThrottling || !this.networkInfo) return false;

    // Throttle on slow connections
    return (
      this.networkInfo.effectiveType === 'slow-2g' ||
      this.networkInfo.effectiveType === '2g'
    );
  }

  private setupNetworkMonitoring(): void {
    if ('connection' in navigator) {
      this.networkInfo = (navigator as any).connection;
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

      for (const [id, item] of this.cache.entries()) {
        if (item.expiresAt < now) {
          expired.push(id);
        }
      }

      expired.forEach((id) => this.cache.delete(id));

      if (expired.length > 0) {
        this.emit('cache-cleanup', { expired: expired.length });
      }
    }, 60000); // Clean up every minute
  }

  private calculatePredictionScore(path: string, currentPath: string): number {
    const pattern = this.navigationPatterns.get(path);
    if (!pattern) return 0;

    let score = pattern.frequency * 10;

    // Boost recent paths
    const timeSinceVisit = Date.now() - pattern.lastVisited;
    if (timeSinceVisit < 60000)
      score += 50; // Last minute
    else if (timeSinceVisit < 300000) score += 25; // Last 5 minutes

    // Boost paths that are often visited after current path
    const currentPattern = this.navigationPatterns.get(currentPath);
    if (currentPattern && currentPattern.nextPaths[path]) {
      score += currentPattern.nextPaths[path] * 20;
    }

    return score;
  }

  private calculatePriorityForPath(
    path: string,
    currentPath: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.calculatePredictionScore(path, currentPath);

    if (score > 100) return 'high';
    if (score > 50) return 'medium';
    return 'low';
  }

  private calculateHitRate(): number {
    // This would track hit/miss ratios in a real implementation
    return 0.75; // Placeholder
  }

  private pathToUrl(path: string): string {
    // Convert file explorer path to API URL
    return `/api/v1/explorer${path}`;
  }

  private generateId(input: string): string {
    return btoa(input)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
  }

  private getPreviousPath(): string | null {
    return sessionStorage.getItem('prefetch_previous_path');
  }

  private setPreviousPath(path: string): void {
    sessionStorage.setItem('prefetch_previous_path', path);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emit(event: string, data: any): void {
    this.observers.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Prefetch observer error:', error);
      }
    });
  }
}
