import type { Volume } from '../../../types/api';

export interface TimelineDataPoint {
  timestamp: string;
  date: Date;
  totalSize: number;
  volumeCount: number;
  volumes: {
    id: string;
    name: string;
    size: number;
    driver: string;
  }[];
}

export interface VolumeUsageTimelineProps {
  data: TimelineDataPoint[];
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
  selectedVolumes?: string[];
  showTotalOnly?: boolean;
  enableZoom?: boolean;
  enableBrush?: boolean;
  height?: number;
  onTimeRangeChange?: (range: string) => void;
  onDataPointClick?: (dataPoint: TimelineDataPoint) => void;
  onVolumeToggle?: (volumeId: string) => void;
  className?: string;
}

export interface TimeRangeOption {
  label: string;
  value: string;
  hours: number;
  interval: string; // e.g., '5m', '1h', '1d'
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: '1 Hour', value: '1h', hours: 1, interval: '5m' },
  { label: '6 Hours', value: '6h', hours: 6, interval: '15m' },
  { label: '24 Hours', value: '24h', hours: 24, interval: '1h' },
  { label: '7 Days', value: '7d', hours: 168, interval: '6h' },
  { label: '30 Days', value: '30d', hours: 720, interval: '1d' },
];

export interface ChartDomain {
  min: number;
  max: number;
}

export interface BrushSelection {
  startIndex?: number;
  endIndex?: number;
}
