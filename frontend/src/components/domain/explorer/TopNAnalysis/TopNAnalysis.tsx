import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  FileText,
  HardDrive,
  Calendar,
  Filter,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/utils/class-names/cn';

export interface TopNItem {
  id: string;
  name: string;
  path: string;
  value: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
  details?: {
    size?: number;
    count?: number;
    lastModified?: Date;
    fileType?: string;
  };
}

export interface TopNCategory {
  id: string;
  name: string;
  description: string;
  items: TopNItem[];
  totalValue: number;
  unit: string;
  icon: React.ReactNode;
}

export interface TopNAnalysisProps {
  /** Whether overlay is visible */
  isVisible: boolean;
  /** Called when overlay should be closed */
  onClose: () => void;
  /** Volume ID to analyze */
  volumeId: string;
  /** Path to analyze */
  path?: string;
  /** Number of top items to show per category */
  topN?: number;
  /** Called when item is clicked */
  onItemClick?: (item: TopNItem, category: TopNCategory) => void;
  /** Called when analysis is refreshed */
  onRefresh?: () => void;
}

type AnalysisView = 'overview' | 'detailed';
type SortOrder = 'desc' | 'asc';

/**
 * Top-N Analysis component for identifying largest files, folders, and trends
 */
export const TopNAnalysis: React.FC<TopNAnalysisProps> = ({
  isVisible,
  onClose,
  volumeId,
  path = '/',
  topN = 10,
  onItemClick,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<TopNCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentView, setCurrentView] = useState<AnalysisView>('overview');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data generation
  const generateMockAnalysis = useCallback((): TopNCategory[] => {
    // Generate mock file data
    const generateMockItems = (
      count: number,
      valueRange: [number, number],
      namePrefix: string,
    ): TopNItem[] => {
      const items: TopNItem[] = [];
      const totalValue = Math.random() * 100000000000; // Random total for percentage calculation

      for (let i = 0; i < count; i++) {
        const value =
          Math.random() * (valueRange[1] - valueRange[0]) + valueRange[0];
        const percentage = (value / totalValue) * 100;
        const trends: ('up' | 'down' | 'stable')[] = ['up', 'down', 'stable'];
        const fileTypes = [
          'mp4',
          'jpg',
          'pdf',
          'docx',
          'zip',
          'json',
          'txt',
          'exe',
        ];

        items.push({
          id: `item-${i}`,
          name: `${namePrefix}_${i + 1}.${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
          path: `${path}/${namePrefix}_${i + 1}`,
          value: Math.floor(value),
          percentage: Math.min(percentage, 100),
          trend: trends[Math.floor(Math.random() * trends.length)],
          details: {
            size: Math.floor(value),
            count: Math.floor(Math.random() * 1000) + 1,
            lastModified: new Date(
              Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
            ),
            fileType: fileTypes[Math.floor(Math.random() * fileTypes.length)],
          },
        });
      }

      return items.sort((a, b) => b.value - a.value);
    };

    return [
      {
        id: 'largest-files',
        name: 'Largest Files',
        description: 'Individual files taking up the most space',
        items: generateMockItems(topN, [1000000, 5000000000], 'large_file'),
        totalValue: 0,
        unit: 'bytes',
        icon: <FileText className="h-5 w-5" />,
      },
      {
        id: 'largest-folders',
        name: 'Largest Folders',
        description: 'Directories with the highest total size',
        items: generateMockItems(
          topN,
          [500000000, 50000000000],
          'large_folder',
        ),
        totalValue: 0,
        unit: 'bytes',
        icon: <HardDrive className="h-5 w-5" />,
      },
      {
        id: 'most-files',
        name: 'Most Files',
        description: 'Folders containing the highest number of files',
        items: generateMockItems(topN, [100, 50000], 'busy_folder'),
        totalValue: 0,
        unit: 'files',
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        id: 'recently-modified',
        name: 'Recently Modified',
        description: 'Files with the most recent activity',
        items: generateMockItems(topN, [1000, 100000000], 'recent_file'),
        totalValue: 0,
        unit: 'bytes',
        icon: <Calendar className="h-5 w-5" />,
      },
      {
        id: 'file-types',
        name: 'File Types by Size',
        description: 'File extensions consuming the most space',
        items: [
          {
            id: 'mp4',
            name: '.mp4',
            path: 'Video files',
            value: 45000000000,
            percentage: 45,
            trend: 'up',
          },
          {
            id: 'jpg',
            name: '.jpg',
            path: 'Image files',
            value: 25000000000,
            percentage: 25,
            trend: 'stable',
          },
          {
            id: 'pdf',
            name: '.pdf',
            path: 'Document files',
            value: 15000000000,
            percentage: 15,
            trend: 'down',
          },
          {
            id: 'zip',
            name: '.zip',
            path: 'Archive files',
            value: 10000000000,
            percentage: 10,
            trend: 'up',
          },
          {
            id: 'docx',
            name: '.docx',
            path: 'Word documents',
            value: 5000000000,
            percentage: 5,
            trend: 'stable',
          },
        ],
        totalValue: 100000000000,
        unit: 'bytes',
        icon: <TrendingUp className="h-5 w-5" />,
      },
    ];
  }, [topN, path]);

  // Load analysis data
  const loadAnalysisData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockCategories = generateMockAnalysis();

      // Calculate total values for each category
      mockCategories.forEach((category) => {
        if (category.id !== 'file-types') {
          category.totalValue = category.items.reduce(
            (sum, item) => sum + item.value,
            0,
          );

          // Recalculate percentages based on category total
          category.items.forEach((item) => {
            item.percentage =
              category.totalValue > 0
                ? (item.value / category.totalValue) * 100
                : 0;
          });
        }
      });

      setCategories(mockCategories);
      setSelectedCategory(mockCategories[0]?.id || '');
    } catch (error) {
      console.error('Failed to load analysis data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [generateMockAnalysis]);

  // Load data when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      loadAnalysisData();
    }
  }, [isVisible, loadAnalysisData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadAnalysisData();
    onRefresh?.();
  }, [loadAnalysisData, onRefresh]);

  // Filter and sort items
  const filteredCategories = useMemo(() => {
    return categories.map((category) => {
      let filteredItems = category.items;

      // Apply search filter
      if (searchQuery.trim()) {
        filteredItems = filteredItems.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.path.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }

      // Apply sort order
      filteredItems = [...filteredItems].sort((a, b) => {
        const comparison = b.value - a.value;
        return sortOrder === 'desc' ? comparison : -comparison;
      });

      return {
        ...category,
        items: filteredItems,
      };
    });
  }, [categories, searchQuery, sortOrder]);

  const formatValue = useCallback((value: number, unit: string): string => {
    if (unit === 'bytes') {
      return formatFileSize(value);
    } else if (unit === 'files') {
      return value.toLocaleString() + ' files';
    }
    return value.toLocaleString();
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <ArrowDown className="h-3 w-3 text-red-500" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-yellow-500" />;
    }
  };

  const selectedCategoryData = categories.find(
    (c) => c.id === selectedCategory,
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 bg-background border border-border rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Top-N Analysis</h2>
              <p className="text-sm text-muted-foreground">
                {volumeId} • {path} • Top {topN} items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-muted rounded-lg"
              title="Refresh analysis"
            >
              <TrendingUp
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(
                [
                  ['overview', 'Overview'],
                  ['detailed', 'Detailed'],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={cn(
                    'px-3 py-1 text-sm rounded',
                    currentView === view
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category Selector */}
            {currentView === 'detailed' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-border rounded text-sm"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 border border-border rounded text-sm w-48"
            />

            {/* Sort Order */}
            <button
              type="button"
              onClick={() =>
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
              }
              className="flex items-center gap-1 px-3 py-1 border border-border rounded text-sm hover:bg-muted"
              title={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
            >
              {sortOrder === 'desc' ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <ArrowUp className="h-3 w-3" />
              )}
              Sort
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p>Analyzing files...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a few moments
                </p>
              </div>
            </div>
          )}

          {!isLoading && (
            <>
              {currentView === 'overview' && (
                <OverviewGrid
                  categories={filteredCategories}
                  onCategoryClick={(categoryId) => {
                    setSelectedCategory(categoryId);
                    setCurrentView('detailed');
                  }}
                  onItemClick={onItemClick}
                  formatValue={formatValue}
                  getTrendIcon={getTrendIcon}
                />
              )}

              {currentView === 'detailed' && selectedCategoryData && (
                <DetailedView
                  category={selectedCategoryData}
                  items={
                    filteredCategories.find((c) => c.id === selectedCategory)
                      ?.items || []
                  }
                  onItemClick={(item) =>
                    onItemClick?.(item, selectedCategoryData)
                  }
                  formatValue={formatValue}
                  getTrendIcon={getTrendIcon}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface OverviewGridProps {
  categories: TopNCategory[];
  onCategoryClick: (categoryId: string) => void;
  onItemClick?: (item: TopNItem, category: TopNCategory) => void;
  formatValue: (value: number, unit: string) => string;
  getTrendIcon: (trend?: string) => React.ReactNode;
}

const OverviewGrid: React.FC<OverviewGridProps> = ({
  categories,
  onCategoryClick,
  onItemClick,
  formatValue,
  getTrendIcon,
}) => {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="border border-border rounded-lg">
            <div
              className="p-4 border-b border-border cursor-pointer hover:bg-muted/50"
              onClick={() => onCategoryClick(category.id)}
            >
              <div className="flex items-center gap-3">
                {category.icon}
                <div>
                  <h3 className="font-semibold">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {category.items.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-2 rounded"
                  onClick={() => onItemClick?.(item, category)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium truncate">{item.name}</span>
                      {getTrendIcon(item.trend)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {item.path}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-medium">
                      {formatValue(item.value, category.unit)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}

              {category.items.length > 5 && (
                <button
                  type="button"
                  onClick={() => onCategoryClick(category.id)}
                  className="w-full text-sm text-primary hover:underline py-2"
                >
                  View all {category.items.length} items
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DetailedViewProps {
  category: TopNCategory;
  items: TopNItem[];
  onItemClick?: (item: TopNItem) => void;
  formatValue: (value: number, unit: string) => string;
  getTrendIcon: (trend?: string) => React.ReactNode;
}

const DetailedView: React.FC<DetailedViewProps> = ({
  category,
  items,
  onItemClick,
  formatValue,
  getTrendIcon,
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {category.icon}
          <div>
            <h3 className="text-lg font-semibold">{category.name}</h3>
            <p className="text-sm text-muted-foreground">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer border-b border-border',
                onItemClick && 'hover:bg-muted/70',
              )}
              onClick={() => onItemClick?.(item)}
            >
              <div className="flex-shrink-0 w-8 text-center">
                <span className="text-sm font-medium text-muted-foreground">
                  #{index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{item.name}</span>
                  {getTrendIcon(item.trend)}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {item.path}
                </div>
                {item.details?.lastModified && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Modified: {item.details.lastModified.toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="font-medium">
                  {formatValue(item.value, category.unit)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.percentage.toFixed(1)}%
                </div>
                {item.details?.count && (
                  <div className="text-xs text-muted-foreground">
                    {item.details.count.toLocaleString()} items
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 w-24">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all duration-300"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p>No items match the current filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopNAnalysis;
