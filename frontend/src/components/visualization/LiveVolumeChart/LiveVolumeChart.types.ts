import type { Volume } from '../../../types/api';

export interface VolumeChartData {
  id: string;
  name: string;
  size: number;
  percentage: number;
  color: string;
  driver: string;
  mountCount: number;
  lastScanned?: string;
}

export interface LiveVolumeChartProps {
  volumes: Volume[];
  variant?: 'donut' | 'pie' | 'bar';
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
  showTooltip?: boolean;
  enableAnimation?: boolean;
  refreshInterval?: number;
  maxVolumes?: number;
  onVolumeClick?: (volumeId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

export interface ChartTooltipData {
  volume: VolumeChartData;
  x: number;
  y: number;
}

export interface TimeRange {
  label: string;
  value: string;
  hours: number;
}

export const TIME_RANGES: TimeRange[] = [
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', hours: 168 },
  { label: '30D', value: '30d', hours: 720 },
];
