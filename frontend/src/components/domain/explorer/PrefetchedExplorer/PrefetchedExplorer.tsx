import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  TrendingUp,
  Clock,
  HardDrive,
  Wifi,
  WifiOff,
  BarChart3,
  Eye,
} from 'lucide-react';
import { useNavigationPrefetch, useDataPrefetch } from '@/hooks/usePrefetch';
import { cn, formatBytes } from '@/utils';

export interface FileExplorerData {
  path: string;
  files: Array<{
    id: string;
    name: string;
    size: number;
    type: 'file' | 'directory';
    modified: string;
  }>;
  metadata: {
    totalSize: number;
    totalFiles: number;
    lastUpdated: string;
  };
}

export interface PrefetchedExplorerProps {
  className?: string;
  initialPath?: string;
  onPathChange?: (path: string) => void;
  showPrefetchStats?: boolean;
  showPredictions?: boolean;
  enableOptimizations?: boolean;
}

export const PrefetchedExplorer: React.FC<PrefetchedExplorerProps> = ({
  className,
  initialPath = '/home',
  onPathChange,
  showPrefetchStats = true,
  showPredictions = true,
  enableOptimizations = true,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [explorerData, setExplorerData] = useState<FileExplorerData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [navigationTime, setNavigationTime] = useState<number>(0);
  const [loadSource, setLoadSource] = useState<'api' | 'cache'>('api');

  const navigationStartTime = useRef<number>(0);
  const visitStartTime = useRef<number>(Date.now());

  // Prefetch hooks
  const navigationPrefetch = useNavigationPrefetch(currentPath);
  const dataPrefetch = useDataPrefetch();

  // Navigate to a new path
  const navigateToPath = useCallback(
    async (newPath: string) => {
      // Record time spent on current path
      const timeSpent = Date.now() - visitStartTime.current;
      navigationPrefetch.recordNavigation(currentPath, timeSpent);

      // Start navigation timing
      navigationStartTime.current = performance.now();
      setLoading(true);
      setLoadSource('api');

      try {
        // Check if data is already prefetched
        const cacheKey = `explorer_${btoa(newPath).replace(/[^a-zA-Z0-9]/g, '')}`;
        let data = navigationPrefetch.get(cacheKey);

        if (data) {
          setLoadSource('cache');
        } else {
          // Fetch from API
          data = await fetchExplorerData(newPath);

          // Cache the result
          await dataPrefetch.prefetch(`/api/v1/explorer${newPath}`, {
            id: cacheKey,
            data,
            priority: 'high',
            metadata: {
              ttl: 10 * 60 * 1000, // 10 minutes
            },
          });
        }

        setExplorerData(data);
        setCurrentPath(newPath);
        visitStartTime.current = Date.now();

        if (onPathChange) {
          onPathChange(newPath);
        }

        // Trigger predictive prefetching for next likely paths
        if (enableOptimizations) {
          setTimeout(() => {
            navigationPrefetch.prefetchPredictions(newPath);
          }, 100);
        }
      } catch (error) {
        console.error('Navigation failed:', error);
      } finally {
        const endTime = performance.now();
        setNavigationTime(endTime - navigationStartTime.current);
        setLoading(false);
      }
    },
    [
      currentPath,
      navigationPrefetch,
      dataPrefetch,
      onPathChange,
      enableOptimizations,
    ],
  );

  // Prefetch likely next paths when hovering
  const handleDirectoryHover = useCallback(
    (path: string) => {
      if (!enableOptimizations) return;

      const cacheKey = `explorer_${btoa(path).replace(/[^a-zA-Z0-9]/g, '')}`;

      if (!navigationPrefetch.has(cacheKey)) {
        // Prefetch with low priority on hover
        dataPrefetch
          .prefetch(`/api/v1/explorer${path}`, {
            id: cacheKey,
            priority: 'low',
            metadata: {
              source: 'hover',
              ttl: 5 * 60 * 1000, // 5 minutes
            },
          })
          .catch(() => {
            // Ignore hover prefetch errors
          });
      }
    },
    [enableOptimizations, navigationPrefetch, dataPrefetch],
  );

  // Initialize with initial path
  useEffect(() => {
    navigateToPath(initialPath);
  }, [initialPath]); // Only run on initial mount

  // Mock API call - replace with actual API integration
  const fetchExplorerData = async (path: string): Promise<FileExplorerData> => {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 200 + Math.random() * 300),
    );

    // Generate mock data based on path
    const pathSegments = path.split('/').filter(Boolean);
    const depth = pathSegments.length;

    const mockFiles = Array.from(
      { length: 5 + Math.floor(Math.random() * 10) },
      (_, i) => ({
        id: `${path}_file_${i}`,
        name: `${pathSegments[pathSegments.length - 1] || 'root'}_item_${i + 1}`,
        size: Math.floor(Math.random() * 10000000) + 1000,
        type: Math.random() > 0.7 ? ('directory' as const) : ('file' as const),
        modified: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      }),
    );

    return {
      path,
      files: mockFiles,
      metadata: {
        totalSize: mockFiles.reduce((sum, file) => sum + file.size, 0),
        totalFiles: mockFiles.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  };

  // formatBytes is now imported from @/utils

  const predictions = showPredictions
    ? navigationPrefetch.getPredictions(currentPath, 3)
    : [];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Prefetch Stats Header */}
      {showPrefetchStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              Load Time
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {navigationTime.toFixed(0)}ms
            </div>
            <div className="text-xs text-gray-500">
              {loadSource === 'cache' ? 'From cache' : 'From API'}
            </div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <HardDrive className="h-4 w-4" />
              Cache
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {navigationPrefetch.stats.items}
            </div>
            <div className="text-xs text-gray-500">
              {formatBytes(navigationPrefetch.stats.memory)}
            </div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BarChart3 className="h-4 w-4" />
              Hit Rate
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {(navigationPrefetch.stats.hitRate * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">Cache efficiency</div>
          </div>

          <div className="p-4 bg-white border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {loadSource === 'cache' ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              Status
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {loading ? 'Loading' : 'Ready'}
            </div>
            <div className="text-xs text-gray-500">
              {loadSource === 'cache' ? 'Prefetched' : 'Live data'}
            </div>
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

          {enableOptimizations && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="h-3 w-3" />
              Smart prefetch enabled
            </div>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['/home', '/documents', '/downloads', '/media', '/projects'].map(
            (path) => (
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
            ),
          )}
        </div>

        {/* Predictions */}
        {showPredictions && predictions.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-2">
              <TrendingUp className="h-4 w-4" />
              Predicted Next Paths
            </div>
            <div className="flex flex-wrap gap-2">
              {predictions.map((path) => {
                const isPrefetched = navigationPrefetch.has(
                  `explorer_${btoa(path).replace(/[^a-zA-Z0-9]/g, '')}`,
                );

                return (
                  <button
                    key={path}
                    onClick={() => navigateToPath(path)}
                    disabled={loading}
                    className={cn(
                      'px-2 py-1 rounded text-xs transition-colors flex items-center gap-1',
                      loading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isPrefetched
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                    )}
                  >
                    {isPrefetched && <Zap className="h-3 w-3" />}
                    {path}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-blue-600 mt-2">
              <Zap className="h-3 w-3 inline mr-1" />
              indicates prefetched data
            </div>
          </div>
        )}
      </div>

      {/* Explorer Content */}
      <div className="p-4 bg-white border rounded-lg">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              Loading {currentPath}...
            </div>
          </div>
        ) : explorerData ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">
                {explorerData.files.length} items
              </h3>
              <div className="text-sm text-gray-600">
                Total: {formatBytes(explorerData.metadata.totalSize)}
              </div>
            </div>

            <div className="space-y-2">
              {explorerData.files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg transition-colors',
                    file.type === 'directory'
                      ? 'hover:bg-blue-50 cursor-pointer'
                      : 'hover:bg-gray-50',
                  )}
                  onClick={() => {
                    if (file.type === 'directory') {
                      navigateToPath(`${currentPath}/${file.name}`);
                    }
                  }}
                  onMouseEnter={() => {
                    if (file.type === 'directory') {
                      handleDirectoryHover(`${currentPath}/${file.name}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        file.type === 'directory'
                          ? 'bg-blue-500'
                          : 'bg-gray-400',
                      )}
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {file.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(file.modified).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatBytes(file.size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Error Display */}
      {navigationPrefetch.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800">
            <strong>Prefetch Error:</strong> {navigationPrefetch.error}
          </div>
        </div>
      )}
    </div>
  );
};
