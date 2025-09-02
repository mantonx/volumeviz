// Treemap calculation Web Worker
// Handles heavy treemap layout computations off the main thread

export interface TreemapNode {
  id: string;
  name: string;
  value: number;
  children?: TreemapNode[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
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

export interface TreemapWorkerMessage {
  type: 'CALCULATE_TREEMAP';
  payload: {
    nodes: TreemapNode[];
    width: number;
    height: number;
    padding?: number;
    minSize?: number;
  };
}

export interface TreemapWorkerResponse {
  type: 'TREEMAP_CALCULATED';
  payload: {
    rects: TreemapRect[];
    totalValue: number;
    computeTime: number;
  };
}

// Squarified treemap algorithm implementation
class TreemapCalculator {
  public padding: number;
  public minSize: number;

  constructor(padding = 2, minSize = 10) {
    this.padding = padding;
    this.minSize = minSize;
  }

  calculate(nodes: TreemapNode[], width: number, height: number): TreemapRect[] {
    const rects: TreemapRect[] = [];

    // Calculate total value
    const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);

    if (totalValue === 0 || nodes.length === 0) {
      return rects;
    }

    // Sort nodes by value (descending)
    const sortedNodes = [...nodes].sort((a, b) => b.value - a.value);

    // Apply squarified treemap algorithm
    this.squarify(
      sortedNodes,
      [],
      0,
      0,
      width,
      height,
      totalValue,
      rects,
      0
    );

    return rects;
  }

  private squarify(
    children: TreemapNode[],
    row: TreemapNode[],
    x: number,
    y: number,
    width: number,
    height: number,
    totalValue: number,
    rects: TreemapRect[],
    depth: number
  ): void {
    if (children.length === 0) {
      this.layoutRow(row, x, y, width, height, totalValue, rects, depth);
      return;
    }

    const child = children[0];
    const newRow = [...row, child];
    
    const remainingChildren = children.slice(1);
    const rowValue = newRow.reduce((sum, node) => sum + node.value, 0);

    if (row.length === 0 || this.improveRatio(row, rowValue, width, height, totalValue)) {
      this.squarify(remainingChildren, newRow, x, y, width, height, totalValue, rects, depth);
    } else {
      this.layoutRow(row, x, y, width, height, totalValue, rects, depth);
      const isHorizontal = width >= height;
      
      if (isHorizontal) {
        const rowWidth = (rowValue / totalValue) * width;
        this.squarify(
          children,
          [],
          x + rowWidth,
          y,
          width - rowWidth,
          height,
          totalValue - rowValue,
          rects,
          depth
        );
      } else {
        const rowHeight = (rowValue / totalValue) * height;
        this.squarify(
          children,
          [],
          x,
          y + rowHeight,
          width,
          height - rowHeight,
          totalValue - rowValue,
          rects,
          depth
        );
      }
    }
  }

  private layoutRow(
    row: TreemapNode[],
    x: number,
    y: number,
    width: number,
    height: number,
    totalValue: number,
    rects: TreemapRect[],
    depth: number
  ): void {
    const rowValue = row.reduce((sum, node) => sum + node.value, 0);
    const isHorizontal = width >= height;
    
    let offset = 0;
    
    for (const node of row) {
      const ratio = node.value / rowValue;
      
      let rectX, rectY, rectWidth, rectHeight;
      
      if (isHorizontal) {
        rectWidth = (rowValue / totalValue) * width;
        rectHeight = ratio * height;
        rectX = x;
        rectY = y + offset;
        offset += rectHeight;
      } else {
        rectWidth = ratio * width;
        rectHeight = (rowValue / totalValue) * height;
        rectX = x + offset;
        rectY = y;
        offset += rectWidth;
      }

      // Apply padding
      const finalX = rectX + this.padding / 2;
      const finalY = rectY + this.padding / 2;
      const finalWidth = Math.max(rectWidth - this.padding, this.minSize);
      const finalHeight = Math.max(rectHeight - this.padding, this.minSize);

      rects.push({
        id: node.id,
        name: node.name,
        value: node.value,
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        depth,
        parent: node.parent,
        color: this.getColorForValue(node.value, totalValue),
        opacity: this.getOpacityForDepth(depth),
      });
    }
  }

  private improveRatio(
    row: TreemapNode[],
    rowValue: number,
    width: number,
    height: number,
    totalValue: number
  ): boolean {
    if (row.length === 0) return true;

    const isHorizontal = width >= height;
    const dimension = isHorizontal ? height : width;
    const rowDimension = (rowValue / totalValue) * (isHorizontal ? width : height);

    const currentRatio = this.calculateWorstRatio(row, rowDimension, dimension);
    
    // Calculate ratio if we add the new item
    const newRowValue = rowValue + row[row.length - 1].value;
    const newRowDimension = (newRowValue / totalValue) * (isHorizontal ? width : height);
    const newRatio = this.calculateWorstRatio(row, newRowDimension, dimension);

    return newRatio <= currentRatio;
  }

  private calculateWorstRatio(row: TreemapNode[], length: number, width: number): number {
    if (row.length === 0) return Infinity;

    const totalValue = row.reduce((sum, node) => sum + node.value, 0);
    const minValue = Math.min(...row.map(node => node.value));
    const maxValue = Math.max(...row.map(node => node.value));

    const area = length * width;
    const normalizedMin = (minValue / totalValue) * area;
    const normalizedMax = (maxValue / totalValue) * area;

    return Math.max(
      (width * width * maxValue) / (normalizedMax * normalizedMax),
      (normalizedMin * normalizedMin) / (width * width * minValue)
    );
  }

  private getColorForValue(value: number, totalValue: number): string {
    // Generate color based on value proportion
    const ratio = value / totalValue;
    const hue = (1 - ratio) * 240; // Blue to red scale
    const saturation = 70;
    const lightness = 50;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private getOpacityForDepth(depth: number): number {
    // Reduce opacity for deeper levels
    return Math.max(0.3, 1 - depth * 0.1);
  }
}

// Web Worker message handling
const calculator = new TreemapCalculator();

self.addEventListener('message', (event: MessageEvent<TreemapWorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'CALCULATE_TREEMAP') {
    const startTime = performance.now();
    const { nodes, width, height, padding = 2, minSize = 10 } = payload;

    calculator.padding = padding;
    calculator.minSize = minSize;

    const rects = calculator.calculate(nodes, width, height);
    const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);
    const computeTime = performance.now() - startTime;

    const response: TreemapWorkerResponse = {
      type: 'TREEMAP_CALCULATED',
      payload: {
        rects,
        totalValue,
        computeTime,
      },
    };

    self.postMessage(response);
  }
});

// Types are exported at interface declaration