/**
 * Type definitions for visualization data management hook
 */

import type { VolumeResponse, ScanResponse } from '../../api/client';

// Chart-ready volume data interfaces
export interface VolumeChartData {
  id: string;
  name: string;
  size: number;
  percentage: number;
  color: string;
  driver: string;
  mountCount: number;
  lastScanned: string;
}

export interface TimelineDataPoint {
  timestamp: string;
  date: Date;
  totalSize: number;
  volumeCount: number;
  volumes: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

export interface SystemStorageData {
  totalSize: number;
  volumeCount: number;
  mountedCount: number;
  unmountedCount: number;
  byDriver: Array<{
    driver: string;
    volumeCount: number;
    totalSize: number;
    percentage: number;
    color: string;
    averageSize: number;
  }>;
  bySizeRange: Array<{
    label: string;
    count: number;
    totalSize: number;
    percentage: number;
    color: string;
  }>;
}

export interface TopVolumeData {
  id: string;
  name: string;
  size: number;
  mountCount: number;
  driver: string;
  createdAt: Date;
  percentage: number;
  rank: number;
  status: 'mounted' | 'unmounted';
  color: string;
}

export interface VisualizationDataOptions {
  /** Enable real-time updates */
  enableRealTime?: boolean;
  /** Auto-refresh interval for visualization data */
  refreshInterval?: number;
  /** Maximum number of historical data points to keep */
  maxHistoryPoints?: number;
  /** Enable automatic scanning of new volumes */
  autoScanNew?: boolean;
}

export interface VisualizationDataReturn {
  // Data for visualization components
  volumeChartData: VolumeChartData[];
  systemStorageData: SystemStorageData;
  topVolumesData: TopVolumeData[];
  timelineHistory: TimelineDataPoint[];

  // Data access methods
  getTimelineData: (timeRange?: string) => TimelineDataPoint[];

  // Actions
  triggerScan: (volumeId?: string) => void;
  refreshData: () => Promise<void>;

  // Real-time status
  realTimeStatus: {
    isActive: boolean;
    isWebSocketConnected: boolean;
    activeScans: number;
    lastUpdate: Date | null;
    status: 'idle' | 'connecting' | 'connected' | 'error';
    error: string | null;
  };

  // Raw data access
  rawData: {
    volumes: VolumeResponse[];
    scanResults: Record<string, ScanResponse>;
    volumeStats: any;
  };
}

// Color constants
export interface ColorPalettes {
  volumes: readonly string[];
  drivers: Record<string, string>;
  sizeRanges: readonly string[];
}
