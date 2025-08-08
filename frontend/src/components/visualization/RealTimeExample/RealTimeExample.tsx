import React from 'react';
import { RealTimeDashboard } from '../RealTimeDashboard';
import type { RealTimeScanOptions } from '../../../hooks/useRealTimeScans/useRealTimeScans.types';

/**
 * Example component demonstrating real-time volume visualization.
 *
 * This component showcases:
 * - Complete real-time dashboard setup
 * - Proper configuration options
 * - Integration examples
 *
 * Use this as a reference for implementing real-time volume visualization
 * in your application.
 */
export const RealTimeExample: React.FC = () => {
  // Configuration for real-time scanning
  const scanOptions: RealTimeScanOptions = {
    // Enable automatic polling every 30 seconds
    enablePolling: true,
    pollingInterval: 30000,

    // WebSocket can be enabled if backend supports it
    enableWebSocket: false,
    // webSocketUrl: 'ws://localhost:8080/ws',

    // Limit concurrent scans to avoid overwhelming the system
    maxConcurrentScans: 3,

    // Event handlers for scan lifecycle
    onScanComplete: (volumeId, result) => {
      console.log(`Scan completed for volume ${volumeId}:`, result);
    },

    onScanError: (volumeId, error) => {
      console.error(`Scan failed for volume ${volumeId}:`, error);
    },

    onPollingUpdate: (volumes) => {
      console.log(`Polling update: ${volumes.length} volumes found`);
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            VolumeViz - Real-time Volume Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Live monitoring and analysis of Docker volume usage with automatic
            scanning
          </p>
        </div>
      </div>

      {/* Real-time Dashboard */}
      <RealTimeDashboard
        scanOptions={scanOptions}
        layout="grid"
        showSettings={true}
        className="py-6"
      />

      {/* Footer with usage instructions */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Real-time Features
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li>• Automatic volume discovery and scanning</li>
                <li>• Live size monitoring with configurable intervals</li>
                <li>• WebSocket support for instant updates</li>
                <li>• Concurrent scan management and queuing</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Visualization Types
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li>• Interactive pie and donut charts</li>
                <li>• Horizontal and vertical bar charts</li>
                <li>• System overview with driver breakdown</li>
                <li>• Top volumes ranking and comparison</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Controls & Settings
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li>• Start/stop real-time updates</li>
                <li>• Manual refresh and scan triggers</li>
                <li>• Chart type switching (pie/donut/bar)</li>
                <li>• Configurable refresh intervals</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeExample;
