import React, { useRef, useMemo, useCallback, useState } from 'react';
import { cn } from '@/utils/class-names/cn';

export interface MiniMapItem {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'file' | 'directory';
  size: number;
  color: string;
  isVisible: boolean;
}

export interface MiniMapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface MiniMapProps {
  /** Items to display in the mini-map */
  items: MiniMapItem[];
  /** Current viewport bounds */
  viewport: MiniMapViewport;
  /** Total content bounds */
  contentBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Mini-map width */
  width?: number;
  /** Mini-map height */
  height?: number;
  /** Called when viewport is moved */
  onViewportChange?: (viewport: MiniMapViewport) => void;
  /** Called when an item is clicked */
  onItemClick?: (item: MiniMapItem) => void;
  /** Show item labels */
  showLabels?: boolean;
  /** Show viewport indicator */
  showViewport?: boolean;
  /** Enable pan interaction */
  enablePan?: boolean;
  /** Class name for the container */
  className?: string;
}

/**
 * Mini-map component for navigation in large visualizations
 * Shows an overview with current viewport and allows quick navigation
 */
export const MiniMap: React.FC<MiniMapProps> = ({
  items,
  viewport,
  contentBounds,
  width = 200,
  height = 150,
  onViewportChange,
  onItemClick,
  showLabels = false,
  showViewport = true,
  enablePan = true,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate scale to fit content in mini-map
  const mapScale = useMemo(() => {
    const scaleX = width / contentBounds.width;
    const scaleY = height / contentBounds.height;
    return Math.min(scaleX, scaleY) * 0.9; // Leave some padding
  }, [width, height, contentBounds]);

  // Transform coordinates from content space to mini-map space
  const transformToMiniMap = useCallback(
    (x: number, y: number) => {
      const offsetX = (width - contentBounds.width * mapScale) / 2;
      const offsetY = (height - contentBounds.height * mapScale) / 2;
      return {
        x: (x - contentBounds.x) * mapScale + offsetX,
        y: (y - contentBounds.y) * mapScale + offsetY,
      };
    },
    [mapScale, width, height, contentBounds],
  );

  // Transform coordinates from mini-map space to content space
  const transformToContent = useCallback(
    (x: number, y: number) => {
      const offsetX = (width - contentBounds.width * mapScale) / 2;
      const offsetY = (height - contentBounds.height * mapScale) / 2;
      return {
        x: (x - offsetX) / mapScale + contentBounds.x,
        y: (y - offsetY) / mapScale + contentBounds.y,
      };
    },
    [mapScale, width, height, contentBounds],
  );

  // Calculate viewport rectangle in mini-map coordinates
  const viewportRect = useMemo(() => {
    const topLeft = transformToMiniMap(viewport.x, viewport.y);
    const bottomRight = transformToMiniMap(
      viewport.x + viewport.width,
      viewport.y + viewport.height,
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [viewport, transformToMiniMap]);

  // Filter visible items and transform their coordinates
  const visibleItems = useMemo(() => {
    return items
      .filter((item) => item.isVisible)
      .map((item) => {
        const pos = transformToMiniMap(item.x, item.y);
        const size = {
          width: Math.max(item.width * mapScale, 2),
          height: Math.max(item.height * mapScale, 2),
        };

        return {
          ...item,
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
        };
      });
  }, [items, transformToMiniMap, mapScale]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!enablePan) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Check if clicking on viewport rectangle
      const isOnViewport =
        x >= viewportRect.x &&
        x <= viewportRect.x + viewportRect.width &&
        y >= viewportRect.y &&
        y <= viewportRect.y + viewportRect.height;

      if (isOnViewport) {
        setIsDragging(true);
        setDragStart({
          x: x - viewportRect.x - viewportRect.width / 2,
          y: y - viewportRect.y - viewportRect.height / 2,
        });
      } else {
        // Click to center viewport on this location
        const contentPos = transformToContent(x, y);
        if (onViewportChange) {
          onViewportChange({
            ...viewport,
            x: contentPos.x - viewport.width / 2,
            y: contentPos.y - viewport.height / 2,
          });
        }
      }

      event.preventDefault();
    },
    [enablePan, viewportRect, transformToContent, viewport, onViewportChange],
  );

  // Handle mouse move for panning
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isDragging || !enablePan) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Calculate center position of viewport
      const centerX = x - dragStart.x;
      const centerY = y - dragStart.y;

      const contentPos = transformToContent(centerX, centerY);

      if (onViewportChange) {
        onViewportChange({
          ...viewport,
          x: contentPos.x - viewport.width / 2,
          y: contentPos.y - viewport.height / 2,
        });
      }
    },
    [
      isDragging,
      enablePan,
      dragStart,
      transformToContent,
      viewport,
      onViewportChange,
    ],
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle item click
  const handleItemClick = useCallback(
    (item: MiniMapItem, event: React.MouseEvent) => {
      event.stopPropagation();
      onItemClick?.(item);
    },
    [onItemClick],
  );

  return (
    <div
      className={cn(
        'relative bg-muted/30 border border-border rounded-lg overflow-hidden',
        className,
      )}
      style={{ width, height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={cn(
          'w-full h-full',
          enablePan && 'cursor-pointer',
          isDragging && 'cursor-grabbing',
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background */}
        <rect width={width} height={height} fill="transparent" />

        {/* Content items */}
        {visibleItems.map((item) => (
          <g key={item.id}>
            <rect
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              fill={item.color}
              stroke="none"
              opacity={0.8}
              className={cn(
                'transition-opacity duration-200 hover:opacity-100',
                onItemClick && 'cursor-pointer',
              )}
              onClick={(e) => handleItemClick(item, e)}
            />
            
            {/* Item labels */}
            {showLabels && item.width > 20 && item.height > 10 && (
              <text
                x={item.x + item.width / 2}
                y={item.y + item.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-xs pointer-events-none select-none"
                opacity={0.8}
              >
                {item.name.length > 8
                  ? `${item.name.slice(0, 8)}...`
                  : item.name}
              </text>
            )}
          </g>
        ))}

        {/* Viewport indicator */}
        {showViewport && (
          <rect
            x={viewportRect.x}
            y={viewportRect.y}
            width={viewportRect.width}
            height={viewportRect.height}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="3,2"
            opacity={0.8}
            className={cn(
              'transition-opacity duration-200',
              isDragging && 'opacity-100',
              enablePan && 'cursor-grab',
              isDragging && 'cursor-grabbing',
            )}
          />
        )}

        {/* Viewport center indicator */}
        {showViewport && (
          <circle
            cx={viewportRect.x + viewportRect.width / 2}
            cy={viewportRect.y + viewportRect.height / 2}
            r={3}
            fill="hsl(var(--primary))"
            opacity={0.6}
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Mini-map overlay info */}
      <div className="absolute top-2 left-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
        {items.filter((item) => item.isVisible).length} items
      </div>

      {/* Zoom level indicator */}
      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
};

export default MiniMap;