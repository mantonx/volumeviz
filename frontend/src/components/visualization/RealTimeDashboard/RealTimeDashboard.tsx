import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  PieChart,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  RealTimeVisualizationProvider,
  useRealTimeVisualization,
} from '../RealTimeVisualizationProvider';
import { RealTimeLiveVolumeChart } from '../RealTimeLiveVolumeChart';
import { SizeComparisonChart } from '../SizeComparisonChart';
import { VolumeUsageTimeline } from '../VolumeUsageTimeline';
import { SystemOverview } from '../SystemOverview';
import { TopVolumesWidget } from '../TopVolumesWidget';
import { VisualizationErrorBoundary } from '../VisualizationErrorBoundary';
import type { RealTimeScanOptions } from '../../../hooks/useRealTimeScans/useRealTimeScans.types';

interface RealTimeDashboardProps {
  /**
   * Real-time scanning configuration
   */
  scanOptions?: RealTimeScanOptions;
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

interface DashboardContentProps {
  layout: 'grid' | 'stack' | 'custom';
  showSettings: boolean;
}

/**
 * Dashboard content component (inside context)
 */
const DashboardContent: React.FC<DashboardContentProps> = ({
  layout,
  showSettings,
}) => {
  const {
    chartData,
    systemOverview,
    topVolumes,
    timeSeriesData,
    isActive,
    activeScans,
    error,
  } = useRealTimeVisualization();

  const [selectedChart, setSelectedChart] = useState<'pie' | 'bar' | 'donut'>(
    'donut',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Grid layout
  if (layout === 'grid') {
    return (
      <div className="space-y-6">
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
              <div
                className={clsx(
                  'p-2 rounded-lg',
                  isActive
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-700',
                )}
              >
                <Activity
                  className={clsx(
                    'w-5 h-5',
                    isActive ? 'text-green-600' : 'text-gray-400',
                  )}
                />
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
              <div
                className={clsx(
                  'p-2 rounded-lg',
                  error
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-gray-100 dark:bg-gray-700',
                )}
              >
                <AlertTriangle
                  className={clsx(
                    'w-5 h-5',
                    error ? 'text-red-600' : 'text-gray-400',
                  )}
                />
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
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500',
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
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500',
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
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500',
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Volume Chart */}
            <VisualizationErrorBoundary
              title="Real-time Chart Error"
              description="Unable to load live volume data"
            >
              <RealTimeLiveVolumeChart
                variant={selectedChart}
                size="lg"
                showStatus={true}
                showControls={true}
              />
            </VisualizationErrorBoundary>

            {/* Size Comparison Chart */}
            <VisualizationErrorBoundary
              title="Comparison Chart Error"
              description="Unable to load volume comparison data"
            >
              <SizeComparisonChart
                data={chartData}
                variant="horizontal"
                maxItems={8}
                showPercentages={true}
              />
            </VisualizationErrorBoundary>

            {/* Timeline Chart */}
            {showAdvanced && (
              <VisualizationErrorBoundary
                title="Timeline Chart Error"
                description="Unable to load timeline data"
              >
                <VolumeUsageTimeline
                  data={timeSeriesData}
                  timeRange="24h"
                  showControls={true}
                />
              </VisualizationErrorBoundary>
            )}
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            {/* System Overview */}
            <VisualizationErrorBoundary
              title="System Overview Error"
              description="Unable to load system metrics"
            >
              <SystemOverview data={systemOverview} showDetails={true} />
            </VisualizationErrorBoundary>

            {/* Top Volumes */}
            <VisualizationErrorBoundary
              title="Top Volumes Error"
              description="Unable to load volume rankings"
            >
              <TopVolumesWidget
                data={topVolumes}
                maxItems={5}
                showActions={true}
              />
            </VisualizationErrorBoundary>

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
  if (layout === 'stack') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <RealTimeLiveVolumeChart
          variant={selectedChart}
          size="lg"
          showStatus={true}
          showControls={true}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SystemOverview data={systemOverview} showDetails={true} />
          <TopVolumesWidget data={topVolumes} maxItems={5} showActions={true} />
        </div>

        <SizeComparisonChart
          data={chartData}
          variant="horizontal"
          maxItems={8}
          showPercentages={true}
        />
      </div>
    );
  }

  // Custom layout
  return (
    <div className="space-y-6">
      <RealTimeLiveVolumeChart
        variant="donut"
        size="md"
        showStatus={true}
        showControls={true}
      />
    </div>
  );
};

/**
 * Real-time Dashboard component for volume visualization.
 *
 * Provides a comprehensive real-time dashboard with:
 * - Multiple chart types and layouts
 * - Real-time data updates via WebSocket/polling
 * - System overview and statistics
 * - Interactive controls and settings
 * - Responsive grid and stack layouts
 */
export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  scanOptions = {},
  layout = 'grid',
  showSettings = true,
  className,
}) => {
  // Default scan options with reasonable defaults
  const defaultScanOptions: RealTimeScanOptions = {
    enablePolling: true,
    pollingInterval: 30000, // 30 seconds
    enableWebSocket: false, // Can be enabled based on backend support
    maxConcurrentScans: 3,
    ...scanOptions,
  };

  return (
    <div
      className={clsx('min-h-screen bg-gray-50 dark:bg-gray-900', className)}
    >
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Volume Visualization Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring and analysis of Docker volume usage
          </p>
        </div>

        <RealTimeVisualizationProvider options={defaultScanOptions}>
          <DashboardContent layout={layout} showSettings={showSettings} />
        </RealTimeVisualizationProvider>
      </div>
    </div>
  );
};

export default RealTimeDashboard;
