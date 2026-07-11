/**
 * TrendsPage Types
 * Type definitions for trends analysis and visualization
 */

export interface TrendsPageProps {
  className?: string;
}

export interface StorageGrowthDataPoint {
  timestamp: Date;
  totalSize: number;
  volumeCount: number;
  fileCount: number;
}

export interface FileTypeDistribution {
  type: string;
  count: number;
  totalSize: number;
  percentage: number;
  color?: string;
}

export interface VolumeGrowthTrend {
  volumeId: string;
  volumeName: string;
  dataPoints: StorageGrowthDataPoint[];
  growthRate: number; // percentage
  predictedSize: number;
}

export interface CapacityForecast {
  date: Date;
  predictedSize: number;
}

export interface CapacityForecastSummary {
  dailyGrowthBytes: number;
  currentSizeBytes: number;
  diskAvailableBytes?: number;
  daysUntilCapacity?: number;
  series: CapacityForecast[];
}

export interface TrendFilters {
  timeRange: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  dateFrom?: Date;
  dateTo?: Date;
  volumeIds?: string[];
  aggregation: 'hour' | 'day' | 'week' | 'month';
}

export interface TrendStats {
  totalGrowth: number;
  growthRate: number;
  averageSize: number;
  projectedFullDate?: Date;
  topGrowingVolumes: Array<{
    id: string;
    name: string;
    growthRate: number;
  }>;
}

export interface AccessPatternData {
  hour: number;
  reads: number;
  writes: number;
  scans: number;
}

export interface ComparativeAnalysis {
  volumeId: string;
  volumeName: string;
  currentSize: number;
  previousSize: number;
  change: number;
  changePercentage: number;
}
