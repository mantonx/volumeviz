/**
 * Application-level Volume Dashboard
 * 
 * This component integrates business logic with pure UI components.
 * It should be in the application layer, not in the reusable UI library.
 */

import React, { useState } from 'react';
import { Activity, BarChart3, PieChart, Settings, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useRealTimeVisualization } from '../../providers/RealTimeVisualizationProvider';

// Import pure UI components from the component library
import { 
  LiveVolumeChart,
  SizeComparisonChart,
  VolumeUsageTimeline,
  SystemOverview,
  TopVolumesWidget,
  RealTimeStatusBar,
} from '../../../components/visualization';
import type { RealTimeStatus } from '../../../components/visualization/RealTimeStatusBar';

interface VolumeDashboardProps {
  /**
   * Dashboard layout configuration
   */
  layout?: 'grid' | 'stack' | 'custom';
  /**
   * Whether to show configuration panel
   */
  showSettings?: boolean;
  /**
   * Custom CSS classes
   */
  className?: string;
}

/**
 * Application-specific Volume Dashboard
 * 
 * This component:
 * - Uses the application-level RealTimeVisualizationProvider context
 * - Passes data as props to pure UI components
 * - Handles application-specific business logic
 * - Should NOT be part of a reusable UI component library
 */
export const VolumeDashboard: React.FC<VolumeDashboardProps> = ({
  layout = 'grid',
  showSettings = true,
  className,
}) => {
  const {
    // Data from context
    chartData,
    systemOverview,
    topVolumes,
    timeSeriesData,
    volumes,
    
    // Real-time state
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

  const [selectedChart, setSelectedChart] = useState<'pie' | 'bar' | 'donut'>('donut');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Transform application state to UI component props
  const realTimeStatus: RealTimeStatus = {
    isActive,
    isConnected: isWebSocketConnected,
    activeScans,
    lastUpdate,
    status,
    error,
  };

  // Transform volume data for UI components
  const transformedVolumes = chartData.map(item => ({
    id: item.id,
    name: item.name,
    size: item.size,
    driver: item.driver,
    mount_count: item.mountCount,
    created_at: item.lastScanned,
  }));

  // Event handlers that bridge UI events to business logic
  const handleToggleRealTime = () => {
    if (isActive) {
      stopRealTimeUpdates();
    } else {
      startRealTimeUpdates();
    }
  };

  const handleScanAll = () => {
    scanAllVolumes();
  };

  const handleRefresh = async () => {
    await forceRefresh();
  };

  // Grid layout
  if (layout === 'grid') {
    return (
      <div className={clsx('space-y-6', className)}>
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chartData.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Active Volumes
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activeScans}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Active Scans
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={clsx(
                'p-2 rounded-lg',
                isActive 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-gray-100 dark:bg-gray-700'
              )}>
                <Activity className={clsx(
                  'w-5 h-5',
                  isActive ? 'text-green-600' : 'text-gray-400'
                )} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isActive ? 'ON' : 'OFF'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Real-time Updates
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={clsx(
                'p-2 rounded-lg',
                error ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'
              )}>
                <AlertTriangle className={clsx(
                  'w-5 h-5',
                  error ? 'text-red-600' : 'text-gray-400'
                )} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {error ? '1' : '0'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Errors
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Status Bar - Pure UI Component */}
        <RealTimeStatusBar
          status={realTimeStatus}
          showControls={true}
          onToggleRealTime={handleToggleRealTime}
          onScanAll={handleScanAll}
          onRefresh={handleRefresh}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="xl:col-span-2 space-y-6">
            {/* Chart Controls */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Volume Visualization
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedChart('pie')}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    selectedChart === 'pie'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  )}
                >
                  <PieChart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedChart('donut')}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    selectedChart === 'donut'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  )}
                >
                  Donut
                </button>
                <button
                  onClick={() => setSelectedChart('bar')}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    selectedChart === 'bar'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Volume Chart - Pure UI Component */}
            <LiveVolumeChart 
              volumes={transformedVolumes}
              variant={selectedChart}
              size="lg"
              onRefresh={handleRefresh}
            />

            {/* Size Comparison Chart - Pure UI Component */}
            <SizeComparisonChart 
              volumes={transformedVolumes}
              variant="horizontal"
              maxItems={8}
              showPercentages={true}
            />

            {/* Timeline Chart - Pure UI Component */}
            {showAdvanced && (
              <VolumeUsageTimeline 
                data={timeSeriesData}
                timeRange="24h"
              />
            )}
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            {/* System Overview - Pure UI Component */}
            <SystemOverview 
              volumes={volumes}
              showBreakdown={true}
            />

            {/* Top Volumes - Pure UI Component */}
            <TopVolumesWidget 
              volumes={volumes}
              maxVolumes={5}
              showIndicators={true}
              showDetails={true}
              onVolumeScan={async (volumeId) => {
                // Handle scan action through business logic
                console.log(`Scanning volume ${volumeId}`);
              }}
            />

            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Settings
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Show Advanced Charts
                    </span>
                    <input
                      type="checkbox"
                      checked={showAdvanced}
                      onChange={(e) => setShowAdvanced(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Stack layout
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <RealTimeStatusBar
        status={realTimeStatus}
        showControls={true}
        onToggleRealTime={handleToggleRealTime}
        onScanAll={handleScanAll}
        onRefresh={handleRefresh}
      />
      
      <LiveVolumeChart 
        volumes={transformedVolumes}
        variant={selectedChart}
        size="lg"
        onRefresh={handleRefresh}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SystemOverview volumes={volumes} showBreakdown={true} />
        <TopVolumesWidget volumes={volumes} maxVolumes={5} showIndicators={true} showDetails={true} />
      </div>
      
      <SizeComparisonChart 
        volumes={transformedVolumes}
        variant="horizontal"
        maxItems={8}
        showPercentages={true}
      />
    </div>
  );
};

export default VolumeDashboard;