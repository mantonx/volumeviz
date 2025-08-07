import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
  HardDrive,
  Database,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useVolumes, useApiHealth } from '@/api/services';
import {
  volumeStatsAtom,
  containerStatsAtom,
  apiStatusAtom,
  volumesLastUpdatedAtom,
} from '@/store';
import type { DashboardProps } from './Dashboard.types';

/**
 * Dashboard page component providing an overview of VolumeViz system status.
 *
 * Displays key metrics and status information including:
 * - Volume statistics (total count, active/inactive, storage usage)
 * - Container statistics (running, stopped, health status)
 * - System health indicators (API connectivity, Docker daemon status)
 * - Recent activity and last update timestamps
 * - Quick action buttons for common operations
 *
 * The dashboard automatically refreshes data on mount and provides
 * real-time status updates through Jotai atoms. All metrics are
 * calculated from live Docker API data.
 *
 * Responsive design adapts the grid layout for mobile and desktop views.
 */
export const Dashboard: React.FC<DashboardProps> = () => {
  const { fetchVolumes } = useVolumes();
  const { checkHealth } = useApiHealth();
  const volumeStats = useAtomValue(volumeStatsAtom);
  const containerStats = useAtomValue(containerStatsAtom);
  const apiStatus = useAtomValue(apiStatusAtom);
  const lastUpdated = useAtomValue(volumesLastUpdatedAtom);

  /**
   * Load initial data when dashboard mounts
   */
  useEffect(() => {
    fetchVolumes();
    checkHealth();
  }, [fetchVolumes, checkHealth]);

  /**
   * Get appropriate status color class based on API connection state
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  /**
   * Get human-readable status text for display
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  /**
   * Format timestamp for display with relative time
   */
  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Overview of your Docker volumes and container infrastructure
        </p>
      </div>

      {/* System Status Banner */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  apiStatus === 'online'
                    ? 'bg-green-500'
                    : apiStatus === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                API Status:{' '}
                <span className={getStatusColor(apiStatus)}>
                  {getStatusText(apiStatus)}
                </span>
              </span>
            </div>
            {lastUpdated && (
              <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Last updated {formatLastUpdated(lastUpdated)}</span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchVolumes();
                checkHealth();
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Volumes */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Volumes
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {volumeStats.total}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {volumeStats.active} active, {volumeStats.inactive} inactive
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Storage Usage */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Storage Used
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {volumeStats.totalSize || '0 B'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Across {volumeStats.total} volumes
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Active Containers */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Containers
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {containerStats.running || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {containerStats.total || 0} total containers
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        {/* Health Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Health Status
              </p>
              <div className="flex items-center space-x-2 mt-1">
                {apiStatus === 'online' ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-lg font-bold text-green-600">
                      Healthy
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-lg font-bold text-red-600">
                      Issues
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                System status
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button className="justify-start h-auto p-4" variant="outline">
            <div className="flex flex-col items-start space-y-1">
              <HardDrive className="h-5 w-5" />
              <span className="font-medium">Scan All Volumes</span>
              <span className="text-xs text-gray-500">
                Update size information
              </span>
            </div>
          </Button>
          <Button className="justify-start h-auto p-4" variant="outline">
            <div className="flex flex-col items-start space-y-1">
              <Database className="h-5 w-5" />
              <span className="font-medium">View Volumes</span>
              <span className="text-xs text-gray-500">
                Manage volume details
              </span>
            </div>
          </Button>
          <Button className="justify-start h-auto p-4" variant="outline">
            <div className="flex flex-col items-start space-y-1">
              <Activity className="h-5 w-5" />
              <span className="font-medium">Container Status</span>
              <span className="text-xs text-gray-500">
                Check container health
              </span>
            </div>
          </Button>
          <Button className="justify-start h-auto p-4" variant="outline">
            <div className="flex flex-col items-start space-y-1">
              <TrendingUp className="h-5 w-5" />
              <span className="font-medium">View Metrics</span>
              <span className="text-xs text-gray-500">
                Performance analytics
              </span>
            </div>
          </Button>
        </div>
      </Card>

      {/* Recent Activity Placeholder */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p>Activity monitoring coming soon</p>
          <p className="text-sm">
            Volume scans, container events, and system changes will appear here
          </p>
        </div>
      </Card>
    </div>
  );
};
