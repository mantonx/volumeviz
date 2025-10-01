import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Loader2, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { useTreemapWorker } from '@/hooks/useWebWorker';
import { useAdaptiveTreemap } from '@/hooks/useAdaptiveLoading';
import { cn } from '@/utils/class-names/cn';

export interface TreemapNode {
  id: string;
  name: string;
  value: number;
  children?: TreemapNode[];
  parent?: string;
}

export interface TreemapRect {
  id: string;
  name: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  parent?: string;
  color?: string;
  opacity?: number;
}

export interface WebWorkerTreemapProps {
  className?: string;
  data: TreemapNode[];
  width?: number;
  height?: number;
  padding?: number;
  minSize?: number;
  onNodeClick?: (node: TreemapRect) => void;
  onNodeHover?: (node: TreemapRect | null) => void;
  showPerformanceMetrics?: boolean;
  fallbackToSync?: boolean;
}

export const WebWorkerTreemap: React.FC<WebWorkerTreemapProps> = ({
  className,
  data,
  width = 800,
  height = 600,
  padding = 2,
  minSize = 10,
  onNodeClick,
  onNodeHover,
  showPerformanceMetrics = false,
  fallbackToSync = true,
}) => {
  const [rects, setRects] = useState<TreemapRect[]>([]);
  const [hoveredNode, setHoveredNode] = useState<TreemapRect | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    computeTime: number;
    nodeCount: number;
    usingWorker: boolean;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const workerStartTime = useRef<number>(0);

  // Adaptive loading integration
  const { loadingParams, recordPerformance } = useAdaptiveTreemap();

  // Web Worker setup
  const treemapWorker = useTreemapWorker({
    onMessage: (response) => {
      if (response.type === 'TREEMAP_CALCULATED') {
        const computeTime = performance.now() - workerStartTime.current;
        setRects(response.payload.rects);
        setIsCalculating(false);
        setError(null);

        // Record performance for adaptive learning
        recordPerformance('treemap_calculation', computeTime, true);

        if (showPerformanceMetrics) {
          setPerformanceMetrics({
            computeTime: response.payload.computeTime,
            nodeCount: data.length,
            usingWorker: true,
          });
        }
      }
    },
    onError: (err) => {
      setError(`Worker error: ${err}`);
      setIsCalculating(false);

      // Record failure for adaptive learning
      recordPerformance('treemap_calculation', 0, false);

      // Fallback to synchronous calculation
      if (fallbackToSync) {
        calculateSynchronously();
      }
    },
    timeout: 10000,
  });

  // Synchronous fallback calculation
  const calculateSynchronously = useCallback(() => {
    const startTime = performance.now();
    setIsCalculating(true);
    setError(null);

    // Simple synchronous treemap calculation for fallback
    // This is a simplified version for demonstration
    const syncRects: TreemapRect[] = [];
    let currentY = 0;
    const totalValue = data.reduce((sum, node) => sum + node.value, 0);

    data.forEach((node, index) => {
      const rectHeight = (node.value / totalValue) * height;
      syncRects.push({
        id: node.id,
        name: node.name,
        value: node.value,
        x: padding,
        y: currentY + padding,
        width: width - padding * 2,
        height: rectHeight - padding,
        depth: 0,
        parent: node.parent,
        color: `hsl(${(index * 360) / data.length}, 70%, 50%)`,
        opacity: 0.8,
      });
      currentY += rectHeight;
    });

    const computeTime = performance.now() - startTime;

    setTimeout(() => {
      setRects(syncRects);
      setIsCalculating(false);

      // Record performance for adaptive learning
      recordPerformance('treemap_calculation_sync', computeTime, true);

      if (showPerformanceMetrics) {
        setPerformanceMetrics({
          computeTime,
          nodeCount: data.length,
          usingWorker: false,
        });
      }
    }, 10); // Small delay to show loading state
  }, [data, width, height, padding, showPerformanceMetrics, fallbackToSync]);

  // Calculate treemap layout with adaptive configuration
  const calculateTreemap = useCallback(() => {
    if (data.length === 0) {
      setRects([]);
      return;
    }

    setIsCalculating(true);
    setError(null);
    workerStartTime.current = performance.now();

    // Apply adaptive loading parameters
    const adaptiveMinSize =
      loadingParams.renderQuality === 'low'
        ? minSize * 2
        : loadingParams.renderQuality === 'high'
          ? Math.max(minSize / 2, 5)
          : minSize;
    const shouldUseWorker =
      loadingParams.workerThreads > 1 &&
      treemapWorker.isSupported &&
      !treemapWorker.error;

    if (shouldUseWorker) {
      // Use Web Worker for calculation
      treemapWorker.postMessage({
        type: 'CALCULATE_TREEMAP',
        payload: {
          nodes: data.slice(0, loadingParams.chunkSize || data.length),
          width,
          height,
          padding,
          minSize: adaptiveMinSize,
        },
      });
    } else {
      // Fallback to synchronous calculation
      calculateSynchronously();
    }
  }, [
    data,
    width,
    height,
    padding,
    minSize,
    treemapWorker,
    calculateSynchronously,
    loadingParams,
  ]);

  // Trigger calculation when data or dimensions change
  useEffect(() => {
    calculateTreemap();
  }, [calculateTreemap]);

  // Handle node interactions
  const handleMouseEnter = useCallback(
    (rect: TreemapRect, event: React.MouseEvent) => {
      setHoveredNode(rect);
      if (onNodeHover) {
        onNodeHover(rect);
      }
    },
    [onNodeHover],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    if (onNodeHover) {
      onNodeHover(null);
    }
  }, [onNodeHover]);

  const handleClick = useCallback(
    (rect: TreemapRect) => {
      if (onNodeClick) {
        onNodeClick(rect);
      }
    },
    [onNodeClick],
  );

  // Format file size for display
  const formatBytes = useCallback((bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }, []);

  // Memoize the SVG elements for performance
  const rectElements = useMemo(() => {
    return rects.map((rect) => (
      <g key={rect.id}>
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={rect.color}
          opacity={rect.opacity}
          stroke="white"
          strokeWidth="1"
          cursor="pointer"
          onMouseEnter={(e) => handleMouseEnter(rect, e)}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(rect)}
          className="transition-opacity duration-200 hover:opacity-90"
        />

        {/* Text label - only show if rect is large enough */}
        {rect.width > 50 && rect.height > 30 && (
          <text
            x={rect.x + rect.width / 2}
            y={rect.y + rect.height / 2 - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="12"
            fontWeight="600"
            pointerEvents="none"
            className="select-none"
          >
            {rect.name}
          </text>
        )}

        {/* Size label */}
        {rect.width > 80 && rect.height > 50 && (
          <text
            x={rect.x + rect.width / 2}
            y={rect.y + rect.height / 2 + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="10"
            opacity="0.9"
            pointerEvents="none"
            className="select-none"
          >
            {formatBytes(rect.value)}
          </text>
        )}
      </g>
    ));
  }, [rects, handleMouseEnter, handleMouseLeave, handleClick, formatBytes]);

  return (
    <div
      className={cn(
        'relative bg-gray-50 border rounded-lg overflow-hidden',
        className,
      )}
    >
      {/* Loading Overlay */}
      {isCalculating && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg shadow-sm border">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-sm text-gray-700">
              {treemapWorker.isSupported
                ? 'Calculating layout...'
                : 'Computing (fallback)...'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isCalculating && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
          <div className="text-center px-4 py-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-2">
              Calculation Failed
            </h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={calculateTreemap}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {showPerformanceMetrics && performanceMetrics && !isCalculating && (
        <div className="absolute top-4 left-4 bg-white/90 px-3 py-2 rounded-lg text-xs text-gray-600 border">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3" />
            <span>
              {performanceMetrics.computeTime.toFixed(1)}ms •
              {performanceMetrics.nodeCount} nodes •
              {performanceMetrics.usingWorker ? 'Worker' : 'Sync'}
            </span>
          </div>
        </div>
      )}

      {/* Main SVG */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        {rectElements}
      </svg>

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm pointer-events-none">
          <div className="font-medium">{hoveredNode.name}</div>
          <div className="text-xs opacity-90">
            Size: {formatBytes(hoveredNode.value)}
            {hoveredNode.parent && (
              <>
                <br />
                Parent: {hoveredNode.parent}
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isCalculating && !error && rects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">No Data</div>
            <div className="text-sm">No files to visualize</div>
          </div>
        </div>
      )}
    </div>
  );
};
