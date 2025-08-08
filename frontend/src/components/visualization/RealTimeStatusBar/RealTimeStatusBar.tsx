import React from 'react';
import { RefreshCw, Activity, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';

export interface RealTimeStatus {
  isActive: boolean;
  isConnected: boolean;
  activeScans: number;
  lastUpdate: Date | null;
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  error: string | null;
}

interface RealTimeStatusBarProps {
  /**
   * Real-time status information
   */
  status: RealTimeStatus;

  /**
   * Whether to show control buttons
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
    reconnecting?: string;
  };

  /**
   * Event handlers
   */
  onToggleRealTime?: () => void;
  onScanAll?: () => void;
  onRefresh?: () => void;

  /**
   * Custom CSS classes
   */
  className?: string;
}

/**
 * Real-time Status Bar Component
 *
 * Pure UI component that displays real-time status and controls.
 * Receives all data through props - no business logic or context dependencies.
 */
export const RealTimeStatusBar: React.FC<RealTimeStatusBarProps> = ({
  status,
  showControls = true,
  statusMessages = {},
  onToggleRealTime,
  onScanAll,
  onRefresh,
  className,
}) => {
  // Get status message
  const getStatusMessage = () => {
    const messages = {
      connecting: 'Connecting to real-time updates...',
      connected: `Real-time updates active${status.isConnected ? ' (WebSocket)' : ' (Polling)'}`,
      error: status.error || 'Connection error',
      idle: 'Real-time updates paused',
      reconnecting: 'Reconnecting...',
      ...statusMessages,
    };
    return messages[status.status] || messages.idle;
  };

  // Get status color
  const getStatusColor = () => {
    switch (status.status) {
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
    if (status.isConnected) {
      return <Wifi className="w-4 h-4" />;
    }
    if (status.isActive) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3',
        className,
      )}
    >
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

          {status.lastUpdate && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last update: {status.lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Active scans indicator */}
            {status.activeScans > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                <Activity className="w-3 h-3 animate-pulse" />
                {status.activeScans} scanning
              </div>
            )}

            {/* Scan all button */}
            {onScanAll && (
              <button
                onClick={onScanAll}
                disabled={status.activeScans >= 3} // Max concurrent scans
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors flex items-center gap-1"
                title="Scan all volumes"
              >
                <HardDrive className="w-3 h-3" />
                Scan All
              </button>
            )}

            {/* Real-time toggle */}
            {onToggleRealTime && (
              <button
                onClick={onToggleRealTime}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1',
                  status.isActive
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200',
                )}
              >
                {status.isActive ? (
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
            )}

            {/* Manual refresh */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Force refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeStatusBar;
