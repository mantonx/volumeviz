import React, { useEffect, useState, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useLocation } from 'react-router-dom';
import {
  HardDrive,
  Database,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ScanManagerDashboard } from '@/components/domain/ScanManagerDashboard';
import { ScanNotificationCenter } from '@/components/domain/ScanNotificationCenter';
import { ScanHistoryPanel } from '@/components/domain/ScanHistoryPanel';
import { ScanPerformanceMetrics } from '@/components/domain/ScanPerformanceMetrics';
import { formatBytes } from '@/utils/formatters';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import {
  useVolumes,
  useApiHealth,
  useVolumeScanning,
  useContainers,
} from '@/api/services';
import {
  volumesAtom,
  volumeStatsAtom,
  containerStatsAtom,
  apiStatusAtom,
  volumesLastUpdatedAtom,
  scanResultsAtom,
} from '@/store';
import type { DashboardProps } from './Dashboard.types';
import type { ScanOperation } from '@/components/domain/ScanManagerDashboard';
import type { ScanNotification } from '@/components/domain/ScanNotificationCenter';
// import { useScanHistory } from '@/hooks/useScanHistory'; // Disabled until backend implements endpoints
import { useScanMonitoring } from '@/hooks/useScanMonitoring';

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
  const location = useLocation();
  const [showOnboardingSuccess, setShowOnboardingSuccess] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState<{
    trackedCount: number;
    rulesCreated: number;
    presetUsed: string;
  } | null>(null);

  const { fetchVolumes } = useVolumes();
  const { checkHealth } = useApiHealth();
  const { getVolumeSize } = useVolumeScanning();
  const { containers } = useContainers(); // This will auto-fetch containers
  const volumes = useAtomValue(volumesAtom);
  const volumeStats = useAtomValue(volumeStatsAtom);
  const scanResults = useAtomValue(scanResultsAtom);
  const containerStats = useAtomValue(containerStatsAtom);
  const apiStatus = useAtomValue(apiStatusAtom);
  const lastUpdated = useAtomValue(volumesLastUpdatedAtom);
  
  // Real-time scan monitoring via WebSocket
  const {
    scanOperations,
    notifications: scanNotifications,
    startScan,
    pauseScan,
    resumeScan,
    cancelScan,
    retryScan,
    clearCompleted,
    clearNotification,
    clearAllNotifications,
    markNotificationAsRead,
    isConnected: wsConnected,
  } = useScanMonitoring({
    autoSubscribe: true,
    enableNotifications: true,
  });
  
  // Scan history integration (disabled until backend implements endpoints)
  // const { history: scanHistory, loading: historyLoading, fetchHistory, exportHistory } = useScanHistory({
  //   autoFetch: true,
  //   pageSize: 10,
  // });
  const scanHistory: any[] = [];
  const historyLoading = false;
  const exportHistory = (format: 'csv' | 'json') => {
    console.warn(`Scan history export (${format}) not implemented in backend yet`);
  };
  const fetchHistory = () => {
    console.warn('Scan history fetch not implemented in backend yet');
  };

  // Check for onboarding completion state
  useEffect(() => {
    if (location.state?.onboardingComplete) {
      setShowOnboardingSuccess(true);
      setOnboardingMessage({
        trackedCount: location.state.trackedCount || 0,
        rulesCreated: location.state.rulesCreated || 0,
        presetUsed: location.state.presetUsed || 'Unknown'
      });
      
      // Clear the location state to prevent showing the message on page refresh
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Volume stats:', volumeStats);
    console.log(
      '[Dashboard] Scan results count:',
      Object.keys(scanResults).length,
    );
    console.log('[Dashboard] Scan results:', scanResults);
    console.log('[Dashboard] Containers:', containers);
    console.log('[Dashboard] Container stats:', containerStats);
  }, [volumeStats, scanResults, containers, containerStats]);

  /**
   * Load initial data when dashboard mounts
   */
  useEffect(() => {
    fetchVolumes();
    checkHealth();
  }, [fetchVolumes, checkHealth]);

  /**
   * Auto-scan volumes when they change to populate size data for dashboard
   */
  useEffect(() => {
    if (volumes.length > 0) {
      console.log('[Dashboard] Auto-scanning volumes:', volumes.length);
      // Add a small delay to ensure volumes are properly loaded
      const scanTimer = setTimeout(() => {
        // Scan first few volumes to get size data for dashboard display
        const volumesToScan = volumes.slice(0, 8); // Limit to avoid overwhelming system
        volumesToScan.forEach((volume, index) => {
          if (volume.id) {
            // Stagger the scans to avoid overwhelming the backend
            setTimeout(() => {
              console.log('[Dashboard] Scanning volume:', volume.id);
              // Trigger scan in background, don't wait for results
              getVolumeSize(volume.id)
                .then((result) => {
                  console.log(
                    '[Dashboard] Scan result for',
                    volume.id,
                    ':',
                    result,
                  );
                })
                .catch((error) => {
                  console.error(
                    '[Dashboard] Scan failed for',
                    volume.id,
                    ':',
                    error,
                  );
                });
            }, index * 500); // 500ms delay between each scan
          }
        });
      }, 1000); // Initial 1 second delay

      return () => clearTimeout(scanTimer);
    }
  }, [volumes, getVolumeSize]);

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

  // Show loading skeleton if essential data is not yet available
  const isLoading = !volumes || volumes.length === 0 && apiStatus !== 'online';

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Onboarding Success Banner */}
      {showOnboardingSuccess && onboardingMessage && (
        <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100">
                  🎉 Setup Complete!
                </h3>
                <p className="mt-1 text-green-700 dark:text-green-200">
                  VolumeViz has been configured successfully using the <strong>{onboardingMessage.presetUsed}</strong> preset.
                </p>
                <div className="mt-3 space-y-1 text-sm text-green-600 dark:text-green-300">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">✓ {onboardingMessage.rulesCreated} tracking rules created</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">✓ {onboardingMessage.trackedCount} mounts will be tracked</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">✓ Real-time monitoring active</span>
                  </div>
                </div>
                <div className="mt-4 flex space-x-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-800"
                    onClick={() => window.location.href = '/rules'}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    View Rules
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-800"
                    onClick={() => window.location.href = '/mounts'}
                  >
                    <HardDrive className="h-4 w-4 mr-1" />
                    View Mounts
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnboardingSuccess(false)}
              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Overview of your Docker volumes and storage usage
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
              <FreshnessIndicator
                lastSeen={lastUpdated.toISOString()}
                compact={true}
                showIcon={true}
                showLabel={false}
              />
            )}
            {wsConnected && (
              <div className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live Updates</span>
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
                {volumeStats.totalSize > 0
                  ? formatBytes(volumeStats.totalSize)
                  : Object.keys(scanResults).length > 0
                    ? '—'
                    : 'Scan volumes to see usage'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {Object.keys(scanResults).length} of {volumeStats.total} volumes scanned
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Active Scans */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Scans
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {scanOperations.filter(s => s.status === 'running').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {scanOperations.filter(s => s.status === 'pending').length} queued
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
          <Button 
            className="justify-start h-auto p-4" 
            variant="outline"
            onClick={async () => {
              // Start scan for first 3 volumes as a quick action
              const volumesToScan = volumes.slice(0, 3);
              console.log('[Dashboard] Starting scans for volumes:', volumesToScan.map(v => ({ id: v.id, name: v.name })));
              for (const volume of volumesToScan) {
                const volumeIdentifier = volume.name || volume.id;
                if (volumeIdentifier) {
                  console.log('[Dashboard] Triggering scan for:', volumeIdentifier);
                  try {
                    await startScan(volumeIdentifier);
                    console.log('[Dashboard] Scan started successfully for:', volumeIdentifier);
                  } catch (error) {
                    console.error('[Dashboard] Scan failed for:', volumeIdentifier, error);
                  }
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
            }}
          >
            <div className="flex flex-col items-start space-y-1">
              <HardDrive className="h-5 w-5" />
              <span className="font-medium">Scan All Volumes</span>
              <span className="text-xs text-gray-500">
                Update size information
              </span>
            </div>
          </Button>
          <Button 
            className="justify-start h-auto p-4" 
            variant="outline"
            onClick={() => window.location.href = '/volumes'}
          >
            <div className="flex flex-col items-start space-y-1">
              <Database className="h-5 w-5" />
              <span className="font-medium">View Volumes</span>
              <span className="text-xs text-gray-500">
                Manage volume details
              </span>
            </div>
          </Button>
          <Button 
            className="justify-start h-auto p-4" 
            variant="outline"
            onClick={() => window.location.href = '/explorer'}
          >
            <div className="flex flex-col items-start space-y-1">
              <Search className="h-5 w-5" />
              <span className="font-medium">Explore Files</span>
              <span className="text-xs text-gray-500">
                Browse volume contents
              </span>
            </div>
          </Button>
          <Button 
            className="justify-start h-auto p-4" 
            variant="outline"
            onClick={() => window.location.href = '/search'}
          >
            <div className="flex flex-col items-start space-y-1">
              <TrendingUp className="h-5 w-5" />
              <span className="font-medium">Search Files</span>
              <span className="text-xs text-gray-500">
                Find specific content
              </span>
            </div>
          </Button>
        </div>
      </Card>

      {/* Scan Manager Dashboard */}
      {scanOperations.length > 0 && (
        <ScanManagerDashboard
          scans={scanOperations}
          systemMetrics={{
            totalVolumes: volumeStats.total,
            activeScans: scanOperations.filter(s => s.status === 'running').length,
            queuedScans: scanOperations.filter(s => s.status === 'pending').length,
            completedScans: scanOperations.filter(s => s.status === 'completed').length,
            failedScans: scanOperations.filter(s => s.status === 'failed').length,
            totalFilesScanned: scanOperations.reduce((sum, s) => sum + (s.filesScanned || 0), 0),
            totalFoldersScanned: scanOperations.reduce((sum, s) => sum + (s.foldersScanned || 0), 0),
            averageScanSpeed: scanOperations
              .filter(s => s.filesPerSecond)
              .reduce((sum, s, _, arr) => sum + (s.filesPerSecond || 0) / arr.length, 0),
          }}
          onScanPause={pauseScan}
          onScanResume={resumeScan}
          onScanStop={cancelScan}
          onScanRetry={retryScan}
          onViewScanDetails={(scanId) => window.location.href = `/scans/${scanId}`}
          onClearCompleted={clearCompleted}
        />
      )}

      {/* Scan Notifications */}
      {scanNotifications.length > 0 && (
        <ScanNotificationCenter
          notifications={scanNotifications}
          onMarkAsRead={markNotificationAsRead}
          onMarkAllAsRead={() => {
            scanNotifications.forEach(n => markNotificationAsRead(n.id));
          }}
          onDismiss={clearNotification}
          onClearAll={clearAllNotifications}
        />
      )}

      {/* Performance Metrics */}
      {scanOperations.some(s => s.status === 'running') && (
        <ScanPerformanceMetrics
          realTime={true}
          timeRange="15m"
          showComparison={true}
          showCharts={true}
          className="mb-6"
          onExportMetrics={(format) => console.log('Export metrics:', format)}
        />
      )}

      {/* Scan History - Placeholder until backend implements endpoints */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scan History
          </h2>
          <Button variant="ghost" size="sm" disabled>
            Export
          </Button>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium">Scan History Coming Soon</p>
          <p className="text-sm mt-1">
            Backend endpoints for scan history are being implemented
          </p>
        </div>
      </Card>

      {/* Recent Activity Placeholder */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Events
        </h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p>Event monitoring coming soon</p>
          <p className="text-sm">
            Volume mounts, unmounts, and system events will appear here
          </p>
        </div>
      </Card>
    </div>
  );
};
