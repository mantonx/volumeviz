import React, { useMemo, useState, useCallback, useRef } from 'react';
import { cn } from '@/utils/class-names/cn';

export interface SunburstItem {
  id: string;
  name: string;
  size: number;
  path: string;
  type: 'file' | 'directory';
  children?: SunburstItem[];
  depth?: number;
  parent?: string;
  isDirectory: boolean;
  lastModified?: Date;
}

export interface SunburstSlice {
  id: string;
  name: string;
  size: number;
  path: string;
  type: 'file' | 'directory';
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  depth: number;
  color: string;
  children?: SunburstSlice[];
  parent?: string;
}

export interface SunburstProps {
  /** Hierarchical data to visualize */
  data: SunburstItem[];
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Inner radius (for creating a donut chart) */
  innerRadius?: number;
  /** Maximum depth to render */
  maxDepth?: number;
  /** Color scheme */
  colorScheme?: 'fileSize' | 'fileType' | 'depth';
  /** Currently selected item IDs */
  selectedIds?: Set<string>;
  /** Called when an item is clicked */
  onItemClick?: (item: SunburstItem) => void;
  /** Called when an item is hovered */
  onItemHover?: (item: SunburstItem | null) => void;
  /** Called when zooming into a directory */
  onZoomIn?: (item: SunburstItem) => void;
  /** Called when zooming out */
  onZoomOut?: () => void;
  /** Current zoom focus (item ID) */
  focusedItemId?: string;
  /** Enable smooth animations */
  enableAnimations?: boolean;
  /** Class name for the container */
  className?: string;
}

/**
 * Sunburst visualization component for hierarchical data
 * Renders a circular, multi-level pie chart showing file system hierarchy
 */
export const Sunburst: React.FC<SunburstProps> = ({
  data,
  width = 500,
  height = 500,
  innerRadius = 50,
  maxDepth = 6,
  colorScheme = 'fileSize',
  selectedIds = new Set(),
  onItemClick,
  onItemHover,
  onZoomIn,
  onZoomOut,
  focusedItemId,
  enableAnimations = true,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredItem, setHoveredItem] = useState<SunburstSlice | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    item: SunburstSlice;
  } | null>(null);

  const radius = Math.min(width, height) / 2;
  const centerX = width / 2;
  const centerY = height / 2;

  // Calculate sunburst slices from hierarchical data
  const slices = useMemo(() => {
    if (!data.length) return [];

    // Find focused item or use root
    const focusedItem = focusedItemId
      ? findItemById(data, focusedItemId)
      : null;

    const rootData = focusedItem?.children ? focusedItem.children : data;

    const calculateSlices = (
      items: SunburstItem[],
      startAngle: number,
      endAngle: number,
      depth: number,
      parentRadius: number,
    ): SunburstSlice[] => {
      if (depth >= maxDepth) return [];

      const angleRange = endAngle - startAngle;
      const totalSize = items.reduce((sum, item) => sum + item.size, 0);
      const sliceInnerRadius = parentRadius;
      const sliceOuterRadius = parentRadius + (radius - innerRadius) / maxDepth;

      let currentAngle = startAngle;
      const slices: SunburstSlice[] = [];

      items.forEach((item) => {
        const proportion =
          totalSize > 0 ? item.size / totalSize : 1 / items.length;
        const sliceAngle = angleRange * proportion;
        const sliceEndAngle = currentAngle + sliceAngle;

        const slice: SunburstSlice = {
          id: item.id,
          name: item.name,
          size: item.size,
          path: item.path,
          type: item.type,
          startAngle: currentAngle,
          endAngle: sliceEndAngle,
          innerRadius: sliceInnerRadius,
          outerRadius: sliceOuterRadius,
          depth,
          color: getSliceColor(item, depth, colorScheme),
          parent: item.parent,
        };

        slices.push(slice);

        // Add children slices recursively
        if (item.children && item.children.length > 0 && depth < maxDepth - 1) {
          const childSlices = calculateSlices(
            item.children,
            currentAngle,
            sliceEndAngle,
            depth + 1,
            sliceOuterRadius,
          );
          slices.push(...childSlices);
        }

        currentAngle = sliceEndAngle;
      });

      return slices;
    };

    return calculateSlices(rootData, 0, Math.PI * 2, 0, innerRadius);
  }, [data, maxDepth, innerRadius, radius, colorScheme, focusedItemId]);

  // Handle mouse events
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find slice under cursor
      const relativeX = x - centerX;
      const relativeY = y - centerY;
      const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
      const angle = Math.atan2(relativeY, relativeX);
      const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;

      const hoveredSlice = slices.find(
        (slice) =>
          distance >= slice.innerRadius &&
          distance <= slice.outerRadius &&
          normalizedAngle >= slice.startAngle &&
          normalizedAngle <= slice.endAngle,
      );

      if (hoveredSlice !== hoveredItem) {
        setHoveredItem(hoveredSlice || null);
        onItemHover?.(hoveredSlice ? convertSliceToItem(hoveredSlice) : null);

        if (hoveredSlice) {
          setTooltip({
            x: event.clientX,
            y: event.clientY,
            item: hoveredSlice,
          });
        } else {
          setTooltip(null);
        }
      }
    },
    [slices, hoveredItem, centerX, centerY, onItemHover],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
    setTooltip(null);
    onItemHover?.(null);
  }, [onItemHover]);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (hoveredItem) {
        const item = convertSliceToItem(hoveredItem);

        if (event.detail === 2) {
          // Double click
          if (item.isDirectory && onZoomIn) {
            onZoomIn(item);
          }
        } else {
          onItemClick?.(item);
        }
      }
    },
    [hoveredItem, onItemClick, onZoomIn],
  );

  // Handle zoom out (click center)
  const handleCenterClick = useCallback(() => {
    if (focusedItemId && onZoomOut) {
      onZoomOut();
    }
  }, [focusedItemId, onZoomOut]);

  return (
    <>
      <div className={cn('relative', className)}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="cursor-pointer"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {/* Background */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="transparent"
            className="pointer-events-all"
          />

          {/* Sunburst slices */}
          {slices.map((slice) => (
            <SunburstSliceComponent
              key={slice.id}
              slice={slice}
              centerX={centerX}
              centerY={centerY}
              isHovered={hoveredItem?.id === slice.id}
              isSelected={selectedIds.has(slice.id)}
              enableAnimations={enableAnimations}
            />
          ))}

          {/* Center circle for zoom out */}
          {focusedItemId && (
            <circle
              cx={centerX}
              cy={centerY}
              r={innerRadius}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth={2}
              className="cursor-pointer hover:fill-hsl(var(--muted)/80)"
              onClick={handleCenterClick}
            />
          )}

          {/* Center text */}
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-sm font-medium pointer-events-none"
          >
            {focusedItemId ? '← Back' : 'Explorer'}
          </text>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <SunburstTooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} />
      )}
    </>
  );
};

interface SunburstSliceComponentProps {
  slice: SunburstSlice;
  centerX: number;
  centerY: number;
  isHovered: boolean;
  isSelected: boolean;
  enableAnimations: boolean;
}

const SunburstSliceComponent: React.FC<SunburstSliceComponentProps> = ({
  slice,
  centerX,
  centerY,
  isHovered,
  isSelected,
  enableAnimations,
}) => {
  const pathData = useMemo(() => {
    const { startAngle, endAngle, innerRadius, outerRadius } = slice;

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = centerX + innerRadius * Math.cos(startAngle);
    const y1 = centerY + innerRadius * Math.sin(startAngle);
    const x2 = centerX + outerRadius * Math.cos(startAngle);
    const y2 = centerY + outerRadius * Math.sin(startAngle);

    const x3 = centerX + outerRadius * Math.cos(endAngle);
    const y3 = centerY + outerRadius * Math.sin(endAngle);
    const x4 = centerX + innerRadius * Math.cos(endAngle);
    const y4 = centerY + innerRadius * Math.sin(endAngle);

    return [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
      'Z',
    ].join(' ');
  }, [slice, centerX, centerY]);

  return (
    <path
      d={pathData}
      fill={slice.color}
      stroke="hsl(var(--background))"
      strokeWidth={1}
      className={cn(
        enableAnimations && 'transition-all duration-200',
        isHovered && 'brightness-110 stroke-2',
        isSelected && 'stroke-primary stroke-2',
      )}
      style={{
        opacity: isHovered ? 0.9 : 0.8,
      }}
    />
  );
};

interface SunburstTooltipProps {
  item: SunburstSlice;
  x: number;
  y: number;
}

const SunburstTooltip: React.FC<SunburstTooltipProps> = ({ item, x, y }) => {
  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-md shadow-md p-2 text-sm pointer-events-none"
      style={{
        left: x + 10,
        top: y - 10,
        transform: 'translate(0, -100%)',
      }}
    >
      <div className="font-medium truncate max-w-48">{item.name}</div>
      <div className="text-muted-foreground">
        {item.type === 'directory' ? 'Directory' : 'File'} •{' '}
        {formatFileSize(item.size)}
      </div>
      <div className="text-xs text-muted-foreground">
        {item.type === 'directory'
          ? 'Double-click to zoom in'
          : 'Click to select'}
      </div>
    </div>
  );
};

// Utility functions
function getSliceColor(
  item: SunburstItem,
  depth: number,
  colorScheme: string,
): string {
  const colors = {
    directory: [
      'hsl(220, 70%, 60%)',
      'hsl(220, 60%, 65%)',
      'hsl(220, 50%, 70%)',
      'hsl(220, 40%, 75%)',
      'hsl(220, 30%, 80%)',
      'hsl(220, 20%, 85%)',
    ],
    file: {
      image: 'hsl(290, 70%, 60%)',
      video: 'hsl(10, 70%, 60%)',
      audio: 'hsl(50, 70%, 60%)',
      document: 'hsl(210, 70%, 60%)',
      code: 'hsl(130, 70%, 60%)',
      archive: 'hsl(30, 70%, 60%)',
      data: 'hsl(270, 70%, 60%)',
      default: 'hsl(0, 0%, 60%)',
    },
  };

  switch (colorScheme) {
    case 'fileType': {
      if (item.type === 'directory') {
        return colors.directory[depth % colors.directory.length];
      }
      // Simple file type detection based on name
      const ext = item.name.split('.').pop()?.toLowerCase() || '';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
      const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv'];
      const audioExts = ['mp3', 'wav', 'flac', 'ogg'];
      const docExts = ['pdf', 'doc', 'docx', 'txt', 'md'];
      const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'go'];
      const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z'];
      const dataExts = ['json', 'xml', 'csv', 'sql', 'db'];

      if (imageExts.includes(ext)) return colors.file.image;
      if (videoExts.includes(ext)) return colors.file.video;
      if (audioExts.includes(ext)) return colors.file.audio;
      if (docExts.includes(ext)) return colors.file.document;
      if (codeExts.includes(ext)) return colors.file.code;
      if (archiveExts.includes(ext)) return colors.file.archive;
      if (dataExts.includes(ext)) return colors.file.data;
      return colors.file.default;
    }

    case 'depth': {
      const depthColors = [
        'hsl(200, 70%, 50%)',
        'hsl(220, 70%, 55%)',
        'hsl(240, 70%, 60%)',
        'hsl(260, 70%, 65%)',
        'hsl(280, 70%, 70%)',
        'hsl(300, 70%, 75%)',
      ];
      return depthColors[depth % depthColors.length];
    }

    case 'fileSize':
    default: {
      // Size-based color (blue scale)
      const intensity = Math.min(Math.log10(item.size + 1) / 8, 1);
      const hue = item.type === 'directory' ? 220 : 200;
      const saturation = 60 + intensity * 30;
      const lightness = 70 - intensity * 20;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
  }
}

function findItemById(items: SunburstItem[], id: string): SunburstItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function convertSliceToItem(slice: SunburstSlice): SunburstItem {
  return {
    id: slice.id,
    name: slice.name,
    size: slice.size,
    path: slice.path,
    type: slice.type,
    isDirectory: slice.type === 'directory',
    depth: slice.depth,
    parent: slice.parent,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default Sunburst;
