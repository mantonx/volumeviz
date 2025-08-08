import type { Volume } from '../../../types/api';

export interface SizeComparisonData {
  id: string;
  name: string;
  currentSize: number;
  previousSize?: number;
  change: number;
  changePercent: number;
  driver: string;
  color: string;
  status: 'increased' | 'decreased' | 'unchanged';
}

export interface SizeComparisonChartProps {
  volumes: Volume[];
  previousData?: Volume[];
  variant?: 'horizontal' | 'vertical' | 'grouped';
  sortBy?: 'size' | 'name' | 'change';
  sortOrder?: 'asc' | 'desc';
  showChange?: boolean;
  showPercentage?: boolean;
  maxItems?: number;
  height?: number;
  onVolumeClick?: (volumeId: string) => void;
  className?: string;
}

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const COMPARISON_COLORS = {
  increased: '#EF4444', // Red
  decreased: '#10B981', // Green
  unchanged: '#6B7280', // Gray
  primary: '#3B82F6', // Blue
};
