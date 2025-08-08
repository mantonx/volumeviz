/**
 * Dashboard Page - Application Entry Point
 *
 * This demonstrates the proper separation of concerns:
 * - Application logic in the app layer
 * - Pure UI components in the component library
 * - Business logic handled through providers and hooks
 */

import React from 'react';
import { RealTimeVisualizationProvider } from '../../providers/RealTimeVisualizationProvider';
import { VolumeDashboard } from '../../components/VolumeDashboard';
import { getDefaultScanOptions } from '../../../config/real-time';
import type { RealTimeScanOptions } from '../../../hooks/useRealTimeScans/useRealTimeScans.types';

export const DashboardPage: React.FC = () => {
  // Configuration for real-time scanning with environment defaults
  const scanOptions: RealTimeScanOptions = {
    ...getDefaultScanOptions(),

    // Event handlers for scan lifecycle
    onScanComplete: (volumeId, result) => {
      if (import.meta.env.DEV) {
        console.log(`Scan completed for volume ${volumeId}:`, result);
      }
    },

    onScanError: (volumeId, error) => {
      console.error(`Scan failed for volume ${volumeId}:`, error);
    },

    onPollingUpdate: (volumes) => {
      if (import.meta.env.DEV) {
        console.log(`Polling update: ${volumes.length} volumes found`);
      }
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            VolumeViz Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring and analysis of Docker volume usage
          </p>
        </div>
      </div>

      {/* Dashboard with Provider */}
      <div className="max-w-7xl mx-auto p-6">
        <RealTimeVisualizationProvider options={scanOptions}>
          <VolumeDashboard layout="grid" showSettings={true} />
        </RealTimeVisualizationProvider>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            VolumeViz - Docker Volume Visualization Tool
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
