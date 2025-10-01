import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  Wifi,
  Battery,
  Monitor,
  Zap,
  Settings,
  TrendingUp,
  Activity,
  Eye,
  BarChart3,
} from 'lucide-react';
import {
  useAdaptiveExplorer,
  usePerformanceTracking,
} from '@/hooks/useAdaptiveLoading';
import { cn } from '@/utils/class-names/cn';

export interface FileSystemItem {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified: string;
  path: string;
}

export interface AdaptiveExplorerProps {
  className?: string;
  initialPath?: string;
  data?: FileSystemItem[];
  onPathChange?: (path: string) => void;
  showAdaptationStats?: boolean;
  showDeviceInfo?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export const AdaptiveExplorer: React.FC<AdaptiveExplorerProps> = ({
  className,
  initialPath = '/home',
  data = [],
  onPathChange,
  showAdaptationStats = true,
  showDeviceInfo = true,
  enablePerformanceMonitoring = true,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FileSystemItem[]>(data);

  // Adaptive loading hook
  const {
    loadingParams,
    currentStrategy,
    deviceCapabilities,
    recordPerformance,
    updateBehavior,
    getPerformanceStats,
  } = useAdaptiveExplorer();

  // Performance tracking
  const { measureAsync, measureSync } = usePerformanceTracking();

  // Adaptive rendering based on current strategy
  const renderingConfig = useMemo(() => {
    if (!currentStrategy) return { chunkSize: 100, renderQuality: 'medium' };

    return {
      chunkSize: loadingParams.chunkSize || 100,
      renderQuality: loadingParams.renderQuality || 'medium',
      prefetchDistance: loadingParams.prefetchDistance || 2,
      cacheSize: loadingParams.cacheSize || 50 * 1024 * 1024,
    };
  }, [loadingParams, currentStrategy]);

  // Adaptive navigation with performance tracking
  const navigateToPath = useCallback(
    async (newPath: string) => {
      if (loading || newPath === currentPath) return;

      setLoading(true);

      try {
        const result = await measureAsync(
          `navigate_${newPath}`,
          async () => {
            // Record navigation behavior
            updateBehavior({
              type: 'navigation',
              data: { path: newPath, previousPath: currentPath },
              duration: Date.now(),
            });

            // Simulate adaptive data loading
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                renderingConfig.renderQuality === 'high'
                  ? 300
                  : renderingConfig.renderQuality === 'medium'
                    ? 200
                    : 100,
              ),
            );

            // Generate mock data based on adaptive parameters
            const mockItems = generateAdaptiveData(newPath, renderingConfig);

            setItems(mockItems);
            setCurrentPath(newPath);

            if (onPathChange) {
              onPathChange(newPath);
            }

            return mockItems;
          },
          (duration, success) => {
            if (enablePerformanceMonitoring) {
              recordPerformance('navigation', duration, success);
            }
          },
        );

        console.log(
          `Adaptive navigation completed: ${result.length} items loaded`,
        );
      } catch (error) {
        console.error('Navigation failed:', error);
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      currentPath,
      measureAsync,
      updateBehavior,
      renderingConfig,
      onPathChange,
      enablePerformanceMonitoring,
      recordPerformance,
    ],
  );

  // Chunked rendering based on adaptive parameters
  const [visibleItems, setVisibleItems] = useState<FileSystemItem[]>([]);
  const [loadedChunks, setLoadedChunks] = useState(0);

  useEffect(() => {
    // Reset chunks when items change
    setLoadedChunks(0);
    setVisibleItems([]);

    // Load first chunk immediately
    if (items.length > 0) {
      const firstChunk = items.slice(0, renderingConfig.chunkSize);
      setVisibleItems(firstChunk);
      setLoadedChunks(1);
    }
  }, [items, renderingConfig.chunkSize]);

  const loadMoreChunks = useCallback(() => {
    if (loadedChunks * renderingConfig.chunkSize >= items.length) return;

    measureSync(
      `load_chunk_${loadedChunks}`,
      () => {
        const nextChunk = items.slice(
          loadedChunks * renderingConfig.chunkSize,
          (loadedChunks + 1) * renderingConfig.chunkSize,
        );

        setVisibleItems((prev) => [...prev, ...nextChunk]);
        setLoadedChunks((prev) => prev + 1);
      },
      (duration, success) => {
        if (enablePerformanceMonitoring) {
          recordPerformance('chunk_load', duration, success);
        }
      },
    );
  }, [
    loadedChunks,
    renderingConfig.chunkSize,
    items,
    measureSync,
    enablePerformanceMonitoring,
    recordPerformance,
  ]);

  // Auto-load more chunks when scrolling (simplified)
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollPosition > documentHeight * 0.8) {
        loadMoreChunks();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreChunks]);

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  const performanceStats = enablePerformanceMonitoring
    ? getPerformanceStats()
    : {};

  return (
    <div className={cn('space-y-4', className)}>
      {/* Device Capabilities Info */}
      {showDeviceInfo && deviceCapabilities && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Monitor className="h-4 w-4" />
              Memory
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {deviceCapabilities.memory}GB
            </div>
            <div className="text-xs text-gray-500">
              {deviceCapabilities.cores} cores
            </div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Wifi className="h-4 w-4" />
              Network
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {deviceCapabilities.networkSpeed.toUpperCase()}
            </div>
            <div className="text-xs text-gray-500">
              {deviceCapabilities.isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Battery className="h-4 w-4" />
              Battery
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(deviceCapabilities.batteryLevel * 100)}%
            </div>
            <div className="text-xs text-gray-500">
              {deviceCapabilities.batteryLevel < 0.2 ? 'Low' : 'Normal'}
            </div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Cpu className="h-4 w-4" />
              Device
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {deviceCapabilities.isLowEndDevice ? 'Low-end' : 'Standard'}
            </div>
            <div className="text-xs text-gray-500">
              {deviceCapabilities.reducedMotion
                ? 'Reduced motion'
                : 'Full motion'}
            </div>
          </div>
        </div>
      )}

      {/* Adaptation Strategy Info */}
      {showAdaptationStats && currentStrategy && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">
                Active Strategy: {currentStrategy.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Settings className="h-4 w-4" />
              Priority: {currentStrategy.priority}
            </div>
          </div>

          <p className="text-blue-800 text-sm mb-3">
            {currentStrategy.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-900">
                {renderingConfig.chunkSize}
              </div>
              <div className="text-xs text-blue-700">Chunk Size</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-900">
                {renderingConfig.prefetchDistance}
              </div>
              <div className="text-xs text-blue-700">Prefetch Distance</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-900">
                {renderingConfig.renderQuality}
              </div>
              <div className="text-xs text-blue-700">Quality</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-900">
                {formatBytes(renderingConfig.cacheSize)}
              </div>
              <div className="text-xs text-blue-700">Cache Size</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Statistics */}
      {enablePerformanceMonitoring &&
        Object.keys(performanceStats).length > 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-green-600" />
              <h3 className="font-medium text-green-900">
                Performance Metrics
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(performanceStats)
                .slice(0, 3)
                .map(([key, stats]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg font-semibold text-green-900">
                      {stats.avgDuration}ms
                    </div>
                    <div className="text-sm text-green-700">
                      {(stats.successRate * 100).toFixed(0)}% success
                    </div>
                    <div className="text-xs text-green-600">{key}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Navigation */}
      <div className="p-4 bg-white border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            <h2 className="font-medium text-gray-900">Current Path:</h2>
            <code className="px-2 py-1 bg-gray-100 rounded text-sm">
              {currentPath}
            </code>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Loading...
            </div>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            '/home',
            '/documents',
            '/downloads',
            '/media',
            '/projects',
            '/workspace',
          ].map((path) => (
            <button
              key={path}
              onClick={() => navigateToPath(path)}
              disabled={loading || path === currentPath}
              className={cn(
                'px-3 py-1 rounded-lg text-sm transition-colors',
                path === currentPath
                  ? 'bg-blue-100 text-blue-700 cursor-default'
                  : loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {path}
            </button>
          ))}
        </div>
      </div>

      {/* File List */}
      <div className="p-4 bg-white border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">
            {visibleItems.length} of {items.length} items
            {loadedChunks > 1 && (
              <span className="text-sm text-gray-600 ml-2">
                ({loadedChunks} chunks loaded)
              </span>
            )}
          </h3>

          {visibleItems.length < items.length && (
            <button
              onClick={loadMoreChunks}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
            >
              Load More
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visibleItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg transition-colors',
                item.type === 'directory'
                  ? 'hover:bg-blue-50 cursor-pointer'
                  : 'hover:bg-gray-50',
                renderingConfig.renderQuality === 'high'
                  ? 'border border-gray-200'
                  : '',
              )}
              onClick={() => {
                if (item.type === 'directory') {
                  navigateToPath(item.path);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    item.type === 'directory' ? 'bg-blue-500' : 'bg-gray-400',
                  )}
                />
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  {renderingConfig.renderQuality !== 'low' && (
                    <div className="text-sm text-gray-600">
                      {new Date(item.modified).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {formatBytes(item.size)}
              </div>
            </div>
          ))}
        </div>

        {loading && visibleItems.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              Adaptively loading {currentPath}...
            </div>
          </div>
        )}

        {!loading && visibleItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">No items found</div>
        )}
      </div>
    </div>
  );
};

// Helper function to generate mock data based on adaptive parameters
function generateAdaptiveData(
  path: string,
  config: { chunkSize: number; renderQuality: string },
): FileSystemItem[] {
  const pathSegments = path.split('/').filter(Boolean);
  const itemCount = Math.min(
    config.chunkSize * 2, // Base items on chunk size
    config.renderQuality === 'high'
      ? 50
      : config.renderQuality === 'medium'
        ? 30
        : 15,
  );

  return Array.from({ length: itemCount }, (_, i) => ({
    id: `${path}_item_${i}`,
    name: `${pathSegments[pathSegments.length - 1] || 'root'}_item_${i + 1}`,
    size: Math.floor(Math.random() * 10000000) + 1000,
    type: Math.random() > 0.7 ? ('directory' as const) : ('file' as const),
    modified: new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    path: `${path}/${pathSegments[pathSegments.length - 1] || 'root'}_item_${i + 1}`,
  }));
}
