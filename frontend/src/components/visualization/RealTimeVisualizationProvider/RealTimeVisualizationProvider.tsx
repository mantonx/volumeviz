import React, { createContext, useContext, useMemo } from 'react';
import { useRealTimeScans } from '../../../hooks/useRealTimeScans';
import { useVisualizationData } from '../../../hooks/useVisualizationData';
import type { RealTimeScanOptions } from '../../../hooks/useRealTimeScans/useRealTimeScans.types';

interface RealTimeVisualizationContextValue {
  // Real-time scan state
  isActive: boolean;
  isWebSocketConnected: boolean;
  activeScans: number;
  lastUpdate: Date | null;
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  error: string | null;

  // Actions
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  queueScan: (volumeId: string) => void;
  scanAllVolumes: () => void;
  forceRefresh: () => Promise<void>;

  // Visualization data
  chartData: any[];
  systemOverview: any;
  topVolumes: any[];
  timeSeriesData: any[];
  
  // Raw data
  volumes: any[];
  scanResults: Record<string, any>;
  scanErrors: Record<string, string | null>;
}

const RealTimeVisualizationContext = createContext<
  RealTimeVisualizationContextValue | undefined
>(undefined);

interface RealTimeVisualizationProviderProps {
  children: React.ReactNode;
  options?: RealTimeScanOptions;
}

/**
 * Provider component that integrates real-time scanning with visualization data.
 * 
 * This component:
 * - Manages real-time volume scanning and updates
 * - Provides transformed data for visualization components
 * - Handles WebSocket connections and polling
 * - Offers centralized state for all visualization components
 */
export const RealTimeVisualizationProvider: React.FC<
  RealTimeVisualizationProviderProps
> = ({ children, options = {} }) => {
  // Default options for real-time scanning
  const defaultOptions: RealTimeScanOptions = {
    enablePolling: true,
    pollingInterval: 30000, // 30 seconds
    enableWebSocket: false, // Disable WebSocket by default for now
    maxConcurrentScans: 3,
    ...options,
  };

  // Real-time scanning hook
  const realTimeScans = useRealTimeScans(defaultOptions);

  // Visualization data transformation hook
  const visualizationData = useVisualizationData({
    enableRealTime: realTimeScans.isActive,
    refreshInterval: defaultOptions.pollingInterval,
    maxHistoryPoints: 100,
    autoScanNew: true,
  });

  // Combine context value
  const contextValue = useMemo<RealTimeVisualizationContextValue>(
    () => ({
      // Real-time scan state
      isActive: realTimeScans.isActive,
      isWebSocketConnected: realTimeScans.isWebSocketConnected,
      activeScans: realTimeScans.activeScans,
      lastUpdate: realTimeScans.lastUpdate,
      status: realTimeScans.status,
      error: realTimeScans.error,

      // Actions
      startRealTimeUpdates: realTimeScans.startRealTimeUpdates,
      stopRealTimeUpdates: realTimeScans.stopRealTimeUpdates,
      queueScan: realTimeScans.queueScan,
      scanAllVolumes: realTimeScans.scanAllVolumes,
      forceRefresh: realTimeScans.forceRefresh,

      // Visualization data
      chartData: visualizationData.volumeChartData,
      systemOverview: visualizationData.systemStorageData,
      topVolumes: visualizationData.topVolumesData,
      timeSeriesData: visualizationData.timelineHistory,

      // Raw data
      volumes: realTimeScans.volumes,
      scanResults: realTimeScans.scanResults,
      scanErrors: realTimeScans.scanErrors,
    }),
    [realTimeScans, visualizationData],
  );

  return (
    <RealTimeVisualizationContext.Provider value={contextValue}>
      {children}
    </RealTimeVisualizationContext.Provider>
  );
};

/**
 * Hook to access real-time visualization context
 */
export const useRealTimeVisualization =
  (): RealTimeVisualizationContextValue => {
    const context = useContext(RealTimeVisualizationContext);

    if (context === undefined) {
      throw new Error(
        'useRealTimeVisualization must be used within a RealTimeVisualizationProvider',
      );
    }

    return context;
  };

export default RealTimeVisualizationProvider;