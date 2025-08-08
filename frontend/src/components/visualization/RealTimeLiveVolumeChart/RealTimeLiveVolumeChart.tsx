import React, { useCallback } from 'react';
import { RefreshCw, Activity, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useRealTimeVisualization } from '../RealTimeVisualizationProvider';
import { LiveVolumeChart } from '../LiveVolumeChart';
import type { LiveVolumeChartProps } from '../LiveVolumeChart/LiveVolumeChart.types';

interface RealTimeLiveVolumeChartProps
  extends Omit<LiveVolumeChartProps, 'volumes' | 'onRefresh'> {
  /**
   * Whether to show real-time status indicators
   */
  showStatus?: boolean;
  /**
   * Whether to show scan controls
   */
  showControls?: boolean;
  /**
   * Custom status messages
   */
  statusMessages?: {
    connecting?: string;
    connected?: string;
    error?: string;
    idle?: string;
  };
}

/**
 * Real-time integrated Live Volume Chart component.
 *
 * This component extends the basic LiveVolumeChart with:
 * - Real-time data integration through context
 * - WebSocket connection status indicators
 * - Scan management controls
 * - Automatic refresh capabilities
 * - Error handling and status display
 */
export const RealTimeLiveVolumeChart: React.FC<
  RealTimeLiveVolumeChartProps
> = ({
  showStatus = true,
  showControls = true,
  statusMessages = {},
  className,
  ...chartProps
}) => {
  const {
    // Data
    chartData,
    volumes,

    // Status
    isActive,
    isWebSocketConnected,
    activeScans,
    lastUpdate,
    status,
    error,

    // Actions
    startRealTimeUpdates,
    stopRealTimeUpdates,
    scanAllVolumes,
    forceRefresh,
  } = useRealTimeVisualization();

  // Transform chart data to expected format
  const transformedVolumes = chartData.map((item) => ({
    id: item.id,
    name: item.name,
    size: item.size,
    driver: item.driver,
    mount_count: item.mountCount,
    created_at: item.lastScanned,
  }));

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    await forceRefresh();
  }, [forceRefresh]);

  // Handle start/stop real-time updates
  const handleToggleRealTime = useCallback(() => {
    if (isActive) {
      stopRealTimeUpdates();
    } else {
      startRealTimeUpdates();
    }
  }, [isActive, startRealTimeUpdates, stopRealTimeUpdates]);

  // Handle scan all volumes
  const handleScanAll = useCallback(() => {
    scanAllVolumes();
  }, [scanAllVolumes]);

  // Get status message
  const getStatusMessage = () => {
    const messages = {
      connecting: 'Connecting to real-time updates...',
      connected: `Real-time updates active${isWebSocketConnected ? ' (WebSocket)' : ' (Polling)'}`,
      error: error || 'Connection error',
      idle: 'Real-time updates paused',
      reconnecting: 'Reconnecting...',
      ...statusMessages,
    };
    return messages[status] || messages.idle;
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  // Get connection icon
  const getConnectionIcon = () => {
    if (isWebSocketConnected) {
      return <Wifi className="w-4 h-4" />;
    }
    if (isActive) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Real-time Status Bar */}
      {showStatus && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={clsx('transition-colors', getStatusColor())}>
                  {getConnectionIcon()}
                </div>
                <span className={clsx('text-sm font-medium', getStatusColor())}>
                  {getStatusMessage()}
                </span>
              </div>

              {lastUpdate && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>

            {showControls && (
              <div className="flex items-center gap-2">
                {/* Active scans indicator */}
                {activeScans > 0 && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                    <Activity className="w-3 h-3 animate-pulse" />
                    {activeScans} scanning
                  </div>
                )}

                {/* Scan all button */}
                <button
                  onClick={handleScanAll}
                  disabled={activeScans >= 3} // Max concurrent scans
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Scan all volumes"
                >
                  <HardDrive className="w-3 h-3" />
                  Scan All
                </button>

                {/* Real-time toggle */}
                <button
                  onClick={handleToggleRealTime}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1',
                    isActive
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200',
                  )}
                >
                  {isActive ? (
                    <>
                      <WifiOff className="w-3 h-3" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3 h-3" />
                      Start
                    </>
                  )}
                </button>

                {/* Manual refresh */}
                <button
                  onClick={handleRefresh}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Force refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Component */}
      <LiveVolumeChart
        {...chartProps}
        volumes={transformedVolumes}
        onRefresh={handleRefresh}
        className="ring-0" // Remove any additional styling
      />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              Connection Error
            </span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
};

export default RealTimeLiveVolumeChart;
