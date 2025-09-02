# Frontend Visualization Components Specification

## Overview
Detailed technical specification for implementing Treemap and Sunburst visualization components in the VolumeViz Explorer Enhancement project.

## Component Architecture

### Core Visualization Components

```typescript
// Component hierarchy
src/components/domain/explorer/visualizations/
├── Treemap/
│   ├── Treemap.tsx
│   ├── Treemap.types.ts
│   ├── Treemap.utils.ts
│   ├── Treemap.stories.tsx
│   ├── Treemap.test.tsx
│   └── index.ts
├── Sunburst/
│   ├── Sunburst.tsx
│   ├── Sunburst.types.ts
│   ├── Sunburst.utils.ts
│   ├── Sunburst.stories.tsx
│   ├── Sunburst.test.tsx
│   └── index.ts
├── shared/
│   ├── ColorSchemes.ts
│   ├── Tooltip.tsx
│   ├── Legend.tsx
│   └── animations.ts
└── index.ts
```

## Treemap Component

### Component Interface
```typescript
// Treemap.types.ts
export interface TreemapProps {
  data: TreeNode[];
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  onNodeClick?: (node: TreeNode, event: React.MouseEvent) => void;
  onNodeHover?: (node: TreeNode | null) => void;
  selectedNodes?: Set<string>;
  highlightedNodes?: Set<string>;
  animationDuration?: number;
  showLabels?: boolean;
  labelThreshold?: number; // Minimum area to show label
  className?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  value: number; // size or count
  type: 'file' | 'directory';
  children?: TreeNode[];
  metadata?: {
    extension?: string;
    mimeType?: string;
    modified?: Date;
    created?: Date;
  };
}

export interface ColorScheme {
  type: 'categorical' | 'sequential' | 'diverging';
  domain: string[] | number[];
  range: string[];
  interpolate?: (t: number) => string;
}
```

### Implementation
```typescript
// Treemap.tsx
import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { TreemapProps, TreeNode } from './Treemap.types';
import { calculateTreemap, getNodeColor } from './Treemap.utils';
import { Tooltip } from '../shared/Tooltip';

export const Treemap: React.FC<TreemapProps> = ({
  data,
  width: propWidth,
  height: propHeight,
  colorScheme = defaultColorScheme,
  onNodeClick,
  onNodeHover,
  selectedNodes = new Set(),
  highlightedNodes = new Set(),
  animationDuration = 300,
  showLabels = true,
  labelThreshold = 0.02,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: propWidth || 800, height: propHeight || 600 });
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Responsive sizing
  useResizeObserver(containerRef, (entry) => {
    if (!propWidth || !propHeight) {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    }
  });

  // Calculate treemap layout
  const treemapData = useMemo(() => {
    const hierarchy = d3.hierarchy({ children: data } as any)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemapLayout = d3.treemap<TreeNode>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .round(true);

    return treemapLayout(hierarchy);
  }, [data, dimensions]);

  // Handle interactions
  const handleNodeMouseEnter = (node: TreeNode, event: React.MouseEvent) => {
    setHoveredNode(node);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    onNodeHover?.(node);
  };

  const handleNodeMouseLeave = () => {
    setHoveredNode(null);
    onNodeHover?.(null);
  };

  const handleNodeClick = (node: TreeNode, event: React.MouseEvent) => {
    event.stopPropagation();
    onNodeClick?.(node, event);
  };

  // Render nodes
  const renderNode = (node: d3.HierarchyRectangularNode<TreeNode>) => {
    const nodeData = node.data;
    const isSelected = selectedNodes.has(nodeData.id);
    const isHighlighted = highlightedNodes.has(nodeData.id);
    const area = (node.x1 - node.x0) * (node.y1 - node.y0);
    const totalArea = dimensions.width * dimensions.height;
    const areaRatio = area / totalArea;
    const showLabel = showLabels && areaRatio > labelThreshold;

    return (
      <motion.g
        key={nodeData.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: animationDuration / 1000 }}
      >
        <motion.rect
          x={node.x0}
          y={node.y0}
          width={node.x1 - node.x0}
          height={node.y1 - node.y0}
          fill={getNodeColor(nodeData, colorScheme)}
          stroke={isSelected ? '#3b82f6' : '#e5e7eb'}
          strokeWidth={isSelected ? 2 : 1}
          opacity={isHighlighted ? 1 : hoveredNode && hoveredNode.id !== nodeData.id ? 0.5 : 1}
          rx={2}
          ry={2}
          style={{ cursor: 'pointer' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onMouseEnter={(e) => handleNodeMouseEnter(nodeData, e as any)}
          onMouseLeave={handleNodeMouseLeave}
          onClick={(e) => handleNodeClick(nodeData, e as any)}
        />
        {showLabel && (
          <text
            x={node.x0 + 4}
            y={node.y0 + 16}
            fontSize="12"
            fill="white"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {nodeData.name}
          </text>
        )}
      </motion.g>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg width={dimensions.width} height={dimensions.height}>
        <AnimatePresence>
          {treemapData.leaves().map(renderNode)}
        </AnimatePresence>
      </svg>
      
      {hoveredNode && (
        <Tooltip
          position={tooltipPosition}
          content={
            <div className="p-2">
              <div className="font-semibold">{hoveredNode.name}</div>
              <div className="text-sm text-gray-600">
                Size: {formatBytes(hoveredNode.value)}
              </div>
              {hoveredNode.metadata?.modified && (
                <div className="text-sm text-gray-600">
                  Modified: {formatDate(hoveredNode.metadata.modified)}
                </div>
              )}
            </div>
          }
        />
      )}
    </div>
  );
};
```

### Utility Functions
```typescript
// Treemap.utils.ts
import * as d3 from 'd3';
import { TreeNode, ColorScheme } from './Treemap.types';

export const defaultColorScheme: ColorScheme = {
  type: 'categorical',
  domain: ['directory', 'file'],
  range: ['#3b82f6', '#10b981'],
};

export const getNodeColor = (node: TreeNode, scheme: ColorScheme): string => {
  if (scheme.type === 'categorical') {
    const scale = d3.scaleOrdinal()
      .domain(scheme.domain as string[])
      .range(scheme.range);
    return scale(node.type) as string;
  }
  
  if (scheme.type === 'sequential') {
    const scale = d3.scaleSequential()
      .domain(scheme.domain as [number, number])
      .interpolator(scheme.interpolate || d3.interpolateViridis);
    return scale(node.value);
  }
  
  return '#e5e7eb';
};

export const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
```

## Sunburst Component

### Component Interface
```typescript
// Sunburst.types.ts
export interface SunburstProps {
  data: HierarchicalNode;
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  onArcClick?: (node: HierarchicalNode, event: React.MouseEvent) => void;
  onArcHover?: (node: HierarchicalNode | null) => void;
  focusedNode?: string;
  animationDuration?: number;
  showLabels?: boolean;
  labelFollowCurve?: boolean;
  miniMap?: boolean;
  className?: string;
}

export interface HierarchicalNode {
  id: string;
  name: string;
  value: number;
  children?: HierarchicalNode[];
  parent?: HierarchicalNode;
  depth?: number;
  metadata?: Record<string, any>;
}
```

### Implementation
```typescript
// Sunburst.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { SunburstProps, HierarchicalNode } from './Sunburst.types';
import { createPartition, arcTween, computeTextRotation } from './Sunburst.utils';

export const Sunburst: React.FC<SunburstProps> = ({
  data,
  width = 800,
  height = 800,
  colorScheme,
  onArcClick,
  onArcHover,
  focusedNode,
  animationDuration = 750,
  showLabels = true,
  labelFollowCurve = true,
  miniMap = false,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentRoot, setCurrentRoot] = useState<d3.HierarchyNode<HierarchicalNode>>();
  const radius = Math.min(width, height) / 2;

  // Create D3 hierarchy and partition
  const root = useMemo(() => {
    const hierarchy = d3.hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<HierarchicalNode>()
      .size([2 * Math.PI, radius]);

    return partition(hierarchy);
  }, [data, radius]);

  // Arc generator
  const arc = d3.arc<d3.HierarchyRectangularNode<HierarchicalNode>>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1);

  // Color scale
  const color = useMemo(() => {
    return d3.scaleOrdinal(d3.schemeCategory10);
  }, []);

  // Handle zoom to node
  const zoomToNode = (node: d3.HierarchyNode<HierarchicalNode>) => {
    const svg = d3.select(svgRef.current);
    const g = svg.select('g.sunburst-container');

    const transition = g.transition()
      .duration(animationDuration);

    // Calculate new domain
    const xDomain = [node.x0, node.x1];
    const yDomain = [node.y0, 1];
    const yRange = [node.y0 ? 20 : 0, radius];

    // Update scales
    const xScale = d3.scaleLinear()
      .domain(xDomain)
      .range([0, 2 * Math.PI]);

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range(yRange);

    // Update arcs
    transition.selectAll('path.arc')
      .attrTween('d', (d: any) => {
        const interpolate = d3.interpolate(
          { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 },
          {
            x0: Math.max(0, Math.min(2 * Math.PI, xScale(d.x0))),
            x1: Math.max(0, Math.min(2 * Math.PI, xScale(d.x1))),
            y0: Math.max(0, yScale(d.y0)),
            y1: Math.max(0, yScale(d.y1)),
          }
        );
        return (t: number) => {
          const interpolated = interpolate(t);
          return arc(interpolated as any) || '';
        };
      })
      .style('opacity', (d: any) => {
        return xScale(d.x1) - xScale(d.x0) > 0.001 ? 1 : 0;
      });

    // Update labels
    if (showLabels) {
      transition.selectAll('text.label')
        .attrTween('transform', (d: any) => {
          const interpolate = d3.interpolate(
            { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 },
            {
              x0: xScale(d.x0),
              x1: xScale(d.x1),
              y0: yScale(d.y0),
              y1: yScale(d.y1),
            }
          );
          return (t: number) => {
            const interpolated = interpolate(t);
            const angle = ((interpolated.x0 + interpolated.x1) / 2) * 180 / Math.PI - 90;
            const radius = (interpolated.y0 + interpolated.y1) / 2;
            return `rotate(${angle}) translate(${radius}, 0) rotate(${angle > 90 ? 180 : 0})`;
          };
        })
        .style('opacity', (d: any) => {
          const arcLength = (xScale(d.x1) - xScale(d.x0)) * ((d.y0 + d.y1) / 2);
          return arcLength > 10 ? 1 : 0;
        });
    }

    setCurrentRoot(node);
  };

  // Render sunburst
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('class', 'sunburst-container')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Create arcs
    const arcs = g.selectAll('path.arc')
      .data(root.descendants())
      .enter().append('path')
      .attr('class', 'arc')
      .attr('d', arc as any)
      .style('fill', (d) => color((d.data as any).name))
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        zoomToNode(d);
        onArcClick?.(d.data, event as any);
      })
      .on('mouseenter', (event, d) => {
        onArcHover?.(d.data);
      })
      .on('mouseleave', () => {
        onArcHover?.(null);
      });

    // Add labels
    if (showLabels) {
      const labels = g.selectAll('text.label')
        .data(root.descendants())
        .enter().append('text')
        .attr('class', 'label')
        .attr('transform', (d) => {
          const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI - 90;
          const radius = (d.y0 + d.y1) / 2;
          return `rotate(${angle}) translate(${radius}, 0) rotate(${angle > 90 ? 180 : 0})`;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '11px')
        .style('fill', '#333')
        .style('pointer-events', 'none')
        .text((d) => d.data.name)
        .style('opacity', (d) => {
          const arcLength = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2);
          return arcLength > 10 ? 1 : 0;
        });
    }

    // Focus on specified node
    if (focusedNode) {
      const nodeToFocus = root.descendants().find((d) => d.data.id === focusedNode);
      if (nodeToFocus) {
        zoomToNode(nodeToFocus);
      }
    }
  }, [root, width, height, showLabels, focusedNode]);

  return (
    <div className={`relative ${className}`}>
      <svg ref={svgRef} width={width} height={height} />
      
      {miniMap && (
        <MiniMap
          data={root}
          currentRoot={currentRoot}
          onNavigate={(node) => zoomToNode(node)}
        />
      )}
    </div>
  );
};
```

## View Synchronization

### State Management
```typescript
// atoms/explorer/visualization.atoms.ts
import { atom } from 'jotai';

export interface VisualizationState {
  activeView: 'list' | 'grid' | 'treemap' | 'sunburst';
  selectedNodes: Set<string>;
  highlightedNodes: Set<string>;
  focusedPath: string;
  colorScheme: 'type' | 'size' | 'recency';
  overlays: {
    duplicates: boolean;
    timeline: boolean;
    topN: boolean;
  };
}

export const visualizationAtom = atom<VisualizationState>({
  activeView: 'list',
  selectedNodes: new Set(),
  highlightedNodes: new Set(),
  focusedPath: '/',
  colorScheme: 'type',
  overlays: {
    duplicates: false,
    timeline: false,
    topN: false,
  },
});

// Derived atoms for specific views
export const treemapDataAtom = atom(async (get) => {
  const state = get(visualizationAtom);
  const data = await fetchAggregateData(state.focusedPath);
  return transformToTreemapData(data);
});

export const sunburstDataAtom = atom(async (get) => {
  const state = get(visualizationAtom);
  const data = await fetchAggregateData(state.focusedPath);
  return transformToSunburstData(data);
});
```

### Synchronization Hook
```typescript
// hooks/useVisualizationSync.ts
import { useAtom } from 'jotai';
import { visualizationAtom } from '@/atoms/explorer/visualization.atoms';
import { useEffect } from 'react';

export const useVisualizationSync = () => {
  const [state, setState] = useAtom(visualizationAtom);

  // Sync selection across views
  const syncSelection = (selectedNodes: Set<string>) => {
    setState((prev) => ({
      ...prev,
      selectedNodes,
    }));
  };

  // Sync navigation
  const syncNavigation = (path: string) => {
    setState((prev) => ({
      ...prev,
      focusedPath: path,
    }));
    
    // Update URL
    window.history.pushState(null, '', `?path=${encodeURIComponent(path)}`);
  };

  // Sync view change
  const changeView = (view: VisualizationState['activeView']) => {
    setState((prev) => ({
      ...prev,
      activeView: view,
    }));
  };

  return {
    state,
    syncSelection,
    syncNavigation,
    changeView,
  };
};
```

## Performance Optimizations

### Virtualization for Large Datasets
```typescript
// utils/visualization/virtualization.ts
export const useVirtualizedTreemap = (
  nodes: TreeNode[],
  viewport: { width: number; height: number }
) => {
  return useMemo(() => {
    // Only render nodes that are visible
    const visibleNodes = nodes.filter((node) => {
      const { x, y, width, height } = node.bounds;
      return (
        x < viewport.width &&
        x + width > 0 &&
        y < viewport.height &&
        y + height > 0
      );
    });
    
    return visibleNodes;
  }, [nodes, viewport]);
};
```

### Web Worker for Heavy Computations
```typescript
// workers/visualization.worker.ts
import * as d3 from 'd3';

self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'COMPUTE_TREEMAP':
      const treemap = computeTreemapLayout(data);
      self.postMessage({ type: 'TREEMAP_COMPUTED', data: treemap });
      break;
      
    case 'COMPUTE_SUNBURST':
      const sunburst = computeSunburstLayout(data);
      self.postMessage({ type: 'SUNBURST_COMPUTED', data: sunburst });
      break;
  }
});

function computeTreemapLayout(data: any) {
  const hierarchy = d3.hierarchy(data)
    .sum((d) => d.value)
    .sort((a, b) => b.value - a.value);
    
  const treemap = d3.treemap()
    .size([1000, 600])
    .padding(2);
    
  return treemap(hierarchy);
}
```

### Memoization and Caching
```typescript
// hooks/useAggregateData.ts
import { useQuery } from '@tanstack/react-query';
import { fetchAggregateData } from '@/api/aggregate';

export const useAggregateData = (volumeId: string, path: string) => {
  return useQuery({
    queryKey: ['aggregate', volumeId, path],
    queryFn: () => fetchAggregateData(volumeId, path),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};
```

## Testing Strategy

### Unit Tests
```typescript
// Treemap.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { Treemap } from './Treemap';
import { mockTreeData } from '@/test/mocks/treeData';

describe('Treemap Component', () => {
  it('renders nodes correctly', () => {
    const { container } = render(
      <Treemap data={mockTreeData} width={800} height={600} />
    );
    
    const nodes = container.querySelectorAll('rect');
    expect(nodes.length).toBeGreaterThan(0);
  });
  
  it('handles node selection', async () => {
    const onNodeClick = jest.fn();
    const { container } = render(
      <Treemap 
        data={mockTreeData} 
        onNodeClick={onNodeClick}
      />
    );
    
    const firstNode = container.querySelector('rect');
    fireEvent.click(firstNode!);
    
    await waitFor(() => {
      expect(onNodeClick).toHaveBeenCalled();
    });
  });
  
  it('updates on data change', () => {
    const { rerender, container } = render(
      <Treemap data={mockTreeData} />
    );
    
    const initialNodes = container.querySelectorAll('rect').length;
    
    rerender(<Treemap data={[...mockTreeData, newNode]} />);
    
    const updatedNodes = container.querySelectorAll('rect').length;
    expect(updatedNodes).toBeGreaterThan(initialNodes);
  });
});
```

### Performance Tests
```typescript
// Treemap.perf.test.tsx
import { measurePerformance } from '@/test/utils/performance';
import { Treemap } from './Treemap';
import { generateLargeDataset } from '@/test/utils/dataGenerators';

describe('Treemap Performance', () => {
  it('renders 10k nodes within 500ms', async () => {
    const data = generateLargeDataset(10000);
    
    const { renderTime } = await measurePerformance(() => (
      <Treemap data={data} />
    ));
    
    expect(renderTime).toBeLessThan(500);
  });
  
  it('handles interaction smoothly', async () => {
    const data = generateLargeDataset(5000);
    
    const { interactionTime } = await measurePerformance(() => (
      <Treemap data={data} />
    ), 'click');
    
    expect(interactionTime).toBeLessThan(16); // 60fps
  });
});
```

## Storybook Stories
```typescript
// Treemap.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Treemap } from './Treemap';
import { mockFileSystem } from '@/mocks/fileSystem';

const meta: Meta<typeof Treemap> = {
  title: 'Explorer/Visualizations/Treemap',
  component: Treemap,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: mockFileSystem,
    width: 800,
    height: 600,
  },
};

export const WithSelection: Story = {
  args: {
    ...Default.args,
    selectedNodes: new Set(['node-1', 'node-2']),
  },
};

export const CustomColorScheme: Story = {
  args: {
    ...Default.args,
    colorScheme: {
      type: 'sequential',
      domain: [0, 1000000],
      range: ['#f0f0f0', '#0066cc'],
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [selected, setSelected] = useState(new Set());
    
    return (
      <Treemap
        data={mockFileSystem}
        selectedNodes={selected}
        onNodeClick={(node) => {
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) {
              next.delete(node.id);
            } else {
              next.add(node.id);
            }
            return next;
          });
        }}
      />
    );
  },
};
```

---

*This specification provides the technical foundation for implementing advanced visualization components in the VolumeViz Explorer Enhancement project.*