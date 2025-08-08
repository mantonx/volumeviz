/**
 * Enhanced types for LiveVolumeChart with real-time capabilities
 * These extend the base chart types with optional real-time features
 */

import type { LiveVolumeChartProps as BaseProps } from './LiveVolumeChart.types';

// Real-time status interface that can be passed from application layer
export interface RealTimeStatus {
  isActive: boolean;
  isConnected: boolean;
  activeScans: number;
  lastUpdate: Date | null;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

// Enhanced props that include optional real-time features
export interface EnhancedLiveVolumeChartProps extends BaseProps {
  /**
   * Real-time status information (optional)
   * If provided, will show real-time status indicators
   */
  realTimeStatus?: RealTimeStatus;
  
  /**
   * Handler for toggling real-time updates (optional)
   */
  onToggleRealTime?: () => void;
  
  /**
   * Handler for scanning all volumes (optional)
   */
  onScanAll?: () => void;
  
  /**
   * Whether to show real-time controls (defaults to false)
   */
  showRealTimeControls?: boolean;
}