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
    <div className="min-h-screen bg-gray-50 bg-surface">
      {/* Header */}
      <div className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-primary">
            VolumeViz Dashboard
          </h1>
          <p className="text-secondary mt-1">
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
      <div className="bg-surface border-t border-line mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-sm text-secondary text-center">
            VolumeViz - Docker Volume Visualization Tool
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
