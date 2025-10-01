// Data aggregation Web Worker
// Handles heavy data processing and aggregation off the main thread

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: string;
  extension?: string;
  mimeType?: string;
  parent?: string;
  children?: FileItem[];
}

export interface AggregationResult {
  totalSize: number;
  totalCount: number;
  fileCount: number;
  dirCount: number;
  largestFile: FileItem | null;
  extensionStats: Record<string, { count: number; totalSize: number }>;
  sizeDistribution: { range: string; count: number; size: number }[];
  depthStats: Record<number, number>;
  duplicates: FileItem[][];
  timeline: { date: string; added: number; modified: number }[];
}

export interface TopNItem {
  item: FileItem;
  rank: number;
  percentage: number;
  category: string;
}

export interface TopNResult {
  bySize: TopNItem[];
  byCount: TopNItem[];
  byExtension: TopNItem[];
  byMimeType: TopNItem[];
  byDepth: TopNItem[];
}

export interface AggregationWorkerMessage {
  type:
    | 'AGGREGATE_DATA'
    | 'FIND_DUPLICATES'
    | 'CALCULATE_TOP_N'
    | 'FILTER_DATA';
  payload: any;
}

export interface AggregationWorkerResponse {
  type:
    | 'DATA_AGGREGATED'
    | 'DUPLICATES_FOUND'
    | 'TOP_N_CALCULATED'
    | 'DATA_FILTERED';
  payload: any;
}

class DataAggregator {
  // Main aggregation function
  aggregateData(files: FileItem[]): AggregationResult {
    const result: AggregationResult = {
      totalSize: 0,
      totalCount: 0,
      fileCount: 0,
      dirCount: 0,
      largestFile: null,
      extensionStats: {},
      sizeDistribution: [],
      depthStats: {},
      duplicates: [],
      timeline: [],
    };

    let largestSize = 0;
    const sizeRanges = [
      { min: 0, max: 1024, label: '< 1 KB' },
      { min: 1024, max: 1024 * 1024, label: '1 KB - 1 MB' },
      { min: 1024 * 1024, max: 1024 * 1024 * 100, label: '1 MB - 100 MB' },
      {
        min: 1024 * 1024 * 100,
        max: 1024 * 1024 * 1024,
        label: '100 MB - 1 GB',
      },
      { min: 1024 * 1024 * 1024, max: Infinity, label: '> 1 GB' },
    ];

    const sizeDistMap = new Map();
    const timelineMap = new Map<string, { added: number; modified: number }>();

    // Process each file
    this.processFileRecursively(
      files,
      result,
      largestSize,
      sizeRanges,
      sizeDistMap,
      timelineMap,
      0,
    );

    // Convert maps to arrays
    result.sizeDistribution = sizeRanges.map((range) => ({
      range: range.label,
      count: sizeDistMap.get(range.label)?.count || 0,
      size: sizeDistMap.get(range.label)?.size || 0,
    }));

    result.timeline = Array.from(timelineMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Find duplicates
    result.duplicates = this.findDuplicates(files);

    return result;
  }

  private processFileRecursively(
    files: FileItem[],
    result: AggregationResult,
    largestSize: number,
    sizeRanges: any[],
    sizeDistMap: Map<string, any>,
    timelineMap: Map<string, any>,
    depth: number,
  ): void {
    for (const file of files) {
      result.totalCount++;
      result.totalSize += file.size;

      // Track depth
      result.depthStats[depth] = (result.depthStats[depth] || 0) + 1;

      // Timeline processing
      const dateKey = file.modified.split('T')[0];
      const timelineEntry = timelineMap.get(dateKey) || {
        added: 0,
        modified: 0,
      };
      timelineEntry.modified++;
      timelineMap.set(dateKey, timelineEntry);

      if (file.type === 'file') {
        result.fileCount++;

        // Track largest file
        if (file.size > largestSize) {
          largestSize = file.size;
          result.largestFile = file;
        }

        // Extension statistics
        if (file.extension) {
          const ext = file.extension.toLowerCase();
          if (!result.extensionStats[ext]) {
            result.extensionStats[ext] = { count: 0, totalSize: 0 };
          }
          result.extensionStats[ext].count++;
          result.extensionStats[ext].totalSize += file.size;
        }

        // Size distribution
        const range = sizeRanges.find(
          (r) => file.size >= r.min && file.size < r.max,
        );
        if (range) {
          const existing = sizeDistMap.get(range.label) || {
            count: 0,
            size: 0,
          };
          existing.count++;
          existing.size += file.size;
          sizeDistMap.set(range.label, existing);
        }
      } else {
        result.dirCount++;
      }

      // Process children recursively
      if (file.children && file.children.length > 0) {
        this.processFileRecursively(
          file.children,
          result,
          largestSize,
          sizeRanges,
          sizeDistMap,
          timelineMap,
          depth + 1,
        );
      }
    }
  }

  // Find duplicate files based on name and size
  findDuplicates(files: FileItem[]): FileItem[][] {
    const duplicateMap = new Map<string, FileItem[]>();

    const processFiles = (items: FileItem[]) => {
      for (const file of items) {
        if (file.type === 'file') {
          const key = `${file.name}_${file.size}`;
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, []);
          }
          duplicateMap.get(key)!.push(file);
        }

        if (file.children) {
          processFiles(file.children);
        }
      }
    };

    processFiles(files);

    // Return only groups with multiple files
    return Array.from(duplicateMap.values()).filter(
      (group) => group.length > 1,
    );
  }

  // Calculate Top-N analysis
  calculateTopN(files: FileItem[], n: number = 10): TopNResult {
    const allFiles: FileItem[] = [];
    const extensionMap = new Map<string, FileItem[]>();
    const mimeTypeMap = new Map<string, FileItem[]>();
    const depthMap = new Map<number, FileItem[]>();

    const collectFiles = (items: FileItem[], depth: number = 0) => {
      for (const file of items) {
        allFiles.push({ ...file, depth } as any);

        if (file.type === 'file') {
          // Group by extension
          if (file.extension) {
            const ext = file.extension.toLowerCase();
            if (!extensionMap.has(ext)) extensionMap.set(ext, []);
            extensionMap.get(ext)!.push(file);
          }

          // Group by MIME type
          if (file.mimeType) {
            if (!mimeTypeMap.has(file.mimeType))
              mimeTypeMap.set(file.mimeType, []);
            mimeTypeMap.get(file.mimeType)!.push(file);
          }
        }

        // Group by depth
        if (!depthMap.has(depth)) depthMap.set(depth, []);
        depthMap.get(depth)!.push(file);

        if (file.children) {
          collectFiles(file.children, depth + 1);
        }
      }
    };

    collectFiles(files);

    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
    const totalCount = allFiles.length;

    return {
      bySize: this.getTopNItems(
        allFiles
          .filter((f) => f.type === 'file')
          .sort((a, b) => b.size - a.size),
        n,
        totalSize,
        'size',
      ),
      byCount: this.getTopNItems(
        Array.from(depthMap.entries())
          .map(([depth, items]) => ({
            ...items[0],
            name: `Depth ${depth}`,
            size: items.length,
            count: items.length,
          }))
          .sort((a, b) => b.size - a.size),
        n,
        totalCount,
        'count',
      ),
      byExtension: this.getTopNItems(
        Array.from(extensionMap.entries())
          .map(([ext, items]) => ({
            id: `ext_${ext}`,
            name: ext.toUpperCase(),
            path: '',
            type: 'extension' as const,
            size: items.reduce((sum, item) => sum + item.size, 0),
            count: items.length,
            modified: '',
            extension: ext,
          }))
          .sort((a, b) => b.size - a.size),
        n,
        totalSize,
        'extension',
      ),
      byMimeType: this.getTopNItems(
        Array.from(mimeTypeMap.entries())
          .map(([mimeType, items]) => ({
            id: `mime_${mimeType}`,
            name: mimeType,
            path: '',
            type: 'mimetype' as const,
            size: items.reduce((sum, item) => sum + item.size, 0),
            count: items.length,
            modified: '',
            mimeType,
          }))
          .sort((a, b) => b.size - a.size),
        n,
        totalSize,
        'mimeType',
      ),
      byDepth: this.getTopNItems(
        Array.from(depthMap.entries())
          .map(([depth, items]) => ({
            id: `depth_${depth}`,
            name: `Level ${depth}`,
            path: '',
            type: 'depth' as const,
            size: items.reduce((sum, item) => sum + item.size, 0),
            count: items.length,
            modified: '',
            depth,
          }))
          .sort((a, b) => b.size - a.size),
        n,
        totalSize,
        'depth',
      ),
    };
  }

  private getTopNItems(
    items: any[],
    n: number,
    total: number,
    category: string,
  ): TopNItem[] {
    return items.slice(0, n).map((item, index) => ({
      item,
      rank: index + 1,
      percentage: (item.size / total) * 100,
      category,
    }));
  }

  // Advanced filtering with multiple criteria
  filterData(
    files: FileItem[],
    filters: {
      minSize?: number;
      maxSize?: number;
      extensions?: string[];
      mimeTypes?: string[];
      modifiedAfter?: string;
      modifiedBefore?: string;
      maxDepth?: number;
      searchTerm?: string;
    },
  ): FileItem[] {
    const result: FileItem[] = [];

    const matchesFilters = (file: FileItem, depth: number): boolean => {
      // Size filters
      if (filters.minSize !== undefined && file.size < filters.minSize)
        return false;
      if (filters.maxSize !== undefined && file.size > filters.maxSize)
        return false;

      // Extension filter
      if (filters.extensions && filters.extensions.length > 0) {
        if (
          !file.extension ||
          !filters.extensions.includes(file.extension.toLowerCase())
        ) {
          return false;
        }
      }

      // MIME type filter
      if (filters.mimeTypes && filters.mimeTypes.length > 0) {
        if (!file.mimeType || !filters.mimeTypes.includes(file.mimeType)) {
          return false;
        }
      }

      // Date filters
      if (filters.modifiedAfter && file.modified < filters.modifiedAfter)
        return false;
      if (filters.modifiedBefore && file.modified > filters.modifiedBefore)
        return false;

      // Depth filter
      if (filters.maxDepth !== undefined && depth > filters.maxDepth)
        return false;

      // Search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (
          !file.name.toLowerCase().includes(searchLower) &&
          !file.path.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    };

    const processFiles = (items: FileItem[], depth: number = 0) => {
      for (const file of items) {
        if (matchesFilters(file, depth)) {
          const filteredFile = { ...file };
          if (file.children) {
            filteredFile.children = [];
            processFiles(file.children, depth + 1);
          }
          result.push(filteredFile);
        } else if (file.children) {
          // Still process children even if parent doesn't match
          processFiles(file.children, depth + 1);
        }
      }
    };

    processFiles(files);
    return result;
  }
}

// Web Worker message handling
const aggregator = new DataAggregator();

self.addEventListener(
  'message',
  (event: MessageEvent<AggregationWorkerMessage>) => {
    const { type, payload } = event.data;

    try {
      switch (type) {
        case 'AGGREGATE_DATA': {
          const result = aggregator.aggregateData(payload.files);
          const response: AggregationWorkerResponse = {
            type: 'DATA_AGGREGATED',
            payload: result,
          };
          self.postMessage(response);
          break;
        }

        case 'FIND_DUPLICATES': {
          const duplicates = aggregator.findDuplicates(payload.files);
          const response: AggregationWorkerResponse = {
            type: 'DUPLICATES_FOUND',
            payload: { duplicates },
          };
          self.postMessage(response);
          break;
        }

        case 'CALCULATE_TOP_N': {
          const result = aggregator.calculateTopN(payload.files, payload.n);
          const response: AggregationWorkerResponse = {
            type: 'TOP_N_CALCULATED',
            payload: result,
          };
          self.postMessage(response);
          break;
        }

        case 'FILTER_DATA': {
          const filtered = aggregator.filterData(
            payload.files,
            payload.filters,
          );
          const response: AggregationWorkerResponse = {
            type: 'DATA_FILTERED',
            payload: { files: filtered },
          };
          self.postMessage(response);
          break;
        }

        default:
          console.warn('Unknown message type:', type);
      }
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  },
);

// Types are exported at interface declaration
