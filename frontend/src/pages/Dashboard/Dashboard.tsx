import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HardDrive,
  Database,
  BarChart3,
  Search,
  Settings,
  AlertCircle,
  PackageX,
  CheckCircle,
  Clock,
  PlayCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FeatureTour, useShouldShowTour } from '@/components/ui/FeatureTour';
import { APP_TOUR_STEPS, APP_TOUR_ID } from '@/config/appTour';
import {
  useGetVolumes,
  useGetAlerts,
  useGetOrganizationsMe,
  type VolumeV1,
} from '@/api/orval-generated/api';
import { formatBytes, formatDate } from '@/utils/formatters';
import { SyncStatusBadge } from '@/components/shared/SyncStatusIndicator';

/**
 * Modern Dashboard page component providing an overview of VolumeViz system status.
 *
 * Uses Orval-generated API hooks with TanStack Query for optimal performance and caching.
 */
export function Dashboard() {
  const location = useLocation();
  const shouldShowTour = useShouldShowTour(APP_TOUR_ID);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const { data: volumesData, isFetching: volumesFetching } = useGetVolumes(
    {
      page: 1,
      page_size: 100,
    },
    {
      query: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  );

  const { data: alertsData, isFetching: alertsFetching } = useGetAlerts(
    {
      limit: 10,
      offset: 0,
      status: 'firing',
    },
    {
      query: {
        staleTime: 1000 * 60 * 5,
      },
    },
  );

  const { data: orgData } = useGetOrganizationsMe({
    query: {
      staleTime: 1000 * 60 * 10, // Org data rarely changes
    },
  });

  const volumes = (
    volumesData?.status === 200 ? (volumesData.data.data as VolumeV1[]) : []
  ) ?? [];
  const alerts = alertsData?.status === 200 ? alertsData.data.alerts ?? [] : [];
  const activeAlerts = alerts.filter((alert) => alert.status === 'firing');

  const organization =
    orgData?.status === 200 ? orgData.data.organization : undefined;

  const totalSize = volumes.reduce(
    (sum, vol) => sum + (vol.size_bytes || 0),
    0,
  );
  const totalVolumes = volumes.length;
  const trackedVolumes = volumes.filter((vol) => !vol.is_orphaned).length;
  const orphanedVolumes = volumes.filter((vol) => vol.is_orphaned).length;

  // Check if user just completed onboarding
  useEffect(() => {
    const state = location.state as any;
    if (state?.onboardingComplete && shouldShowTour) {
      // Delay tour start to allow page to render
      setTimeout(() => {
        setIsTourOpen(true);
      }, 1000);
    }
  }, [location, shouldShowTour]);

  // Determine if we should show empty state (no volumes at all, even during loading)
  const hasNoVolumes = totalVolumes === 0;

  return (
    <div className="min-h-screen bg-gray-50 bg-surface">
      <div className="p-6">
        {/* Empty state - no volumes */}
        {hasNoVolumes ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-primary">
                  Dashboard
                </h1>
                <p className="text-secondary">
                  Overview of your VolumeViz system
                </p>
              </div>
            </div>

            {/* Empty State */}
            <Card className="p-12 text-center">
              <HardDrive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-primary mb-2">
                Welcome to VolumeViz!
              </h2>
              <p className="text-secondary mb-6 max-w-md mx-auto">
                Get started by scanning your Docker volumes. VolumeViz will
                analyze your storage usage and help you optimize your
                infrastructure.
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/volumes">
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Scan First Volume
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/onboarding">
                    <Settings className="w-5 h-5 mr-2" />
                    Setup Tracking Rules
                  </Link>
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* Normal Dashboard Content */}
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-primary">
                  Dashboard
                </h1>
                <p className="text-secondary">
                  Overview of your VolumeViz system
                </p>
              </div>
              <div className="flex items-center gap-4">
                <SyncStatusBadge />
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </Button>
              </div>
            </div>

            {/* Organization Info */}
            {organization && organization.description && (
              <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <h2 className="text-xl font-semibold text-primary mb-2">
                  {organization.name}
                </h2>
                <p className="text-secondary">
                  {organization.description}
                </p>
              </Card>
            )}

            {/* Key Metrics */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              data-tour="dashboard-stats"
            >
              {volumesFetching ? (
                // Loading skeleton for metrics (only show when refetching existing data)
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-6 animate-pulse">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-surface-secondary rounded" />
                        <div className="ml-4 flex-1">
                          <div className="h-4 w-24 bg-surface-secondary rounded mb-2" />
                          <div className="h-8 w-16 bg-surface-secondary rounded" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </>
              ) : (
                <>
                  <Card className="p-6">
                    <div className="flex items-center">
                      <HardDrive className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-secondary">
                          Total Volumes
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {totalVolumes}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center">
                      <Database className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-secondary">
                          Tracked Volumes
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {trackedVolumes}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center">
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-secondary">
                          Total Size
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {formatBytes(totalSize)}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center">
                      <PackageX className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-secondary">
                          Orphaned Volumes
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {orphanedVolumes}
                        </p>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </div>

            {/* Active Alerts Banner */}
            {alertsFetching ? (
              <Card className="p-4 mb-6 bg-surface-secondary animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-surface-secondary rounded" />
                    <div>
                      <div className="h-5 w-32 bg-surface-secondary rounded mb-2" />
                      <div className="h-4 w-48 bg-surface-secondary rounded" />
                    </div>
                  </div>
                  <div className="w-24 h-8 bg-surface-secondary rounded" />
                </div>
              </Card>
            ) : activeAlerts.length > 0 ? (
              <Card className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-200">
                        {activeAlerts.length} Active Alert
                        {activeAlerts.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {activeAlerts[0].rule?.name ?? 'Unnamed rule'} and{' '}
                        {activeAlerts.length - 1} more
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/alerts">View Alerts</Link>
                  </Button>
                </div>
              </Card>
            ) : null}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Volume Management
                </h3>
                <p className="text-secondary mb-4">
                  Manage and monitor your Docker volumes
                </p>
                <Button asChild className="w-full">
                  <Link to="/volumes">
                    <HardDrive className="w-4 h-4 mr-2" />
                    View Volumes
                  </Link>
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Browse & Search Files
                </h3>
                <p className="text-secondary mb-4">
                  Explore files or search across all volumes
                </p>
                <Button asChild className="w-full">
                  <Link to="/files">
                    <Search className="w-4 h-4 mr-2" />
                    Browse Files
                  </Link>
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Storage Trends
                </h3>
                <p className="text-secondary mb-4">
                  Analyze usage patterns and capacity planning
                </p>
                <Button asChild className="w-full">
                  <Link to="/trends">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Trends
                  </Link>
                </Button>
              </Card>
            </div>

            {/* Recent Volumes */}
            <div data-tour="recent-scans">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    Recent Volumes
                  </h3>
                  {!volumesFetching && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/volumes">View All</Link>
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {volumesFetching ? (
                    // Loading skeleton for volumes list
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg animate-pulse"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-5 h-5 bg-surface-secondary rounded flex-shrink-0" />
                            <div className="flex-1">
                              <div className="h-5 w-48 bg-surface-secondary rounded mb-2" />
                              <div className="h-4 w-32 bg-surface-secondary rounded" />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="h-5 w-16 bg-surface-secondary rounded mb-2" />
                              <div className="h-4 w-20 bg-surface-secondary rounded" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    volumes.slice(0, 5).map((volume) => {
                      // Determine status
                      const isOrphaned = volume.is_orphaned;
                      const hasBeenScanned = !!volume.last_scan_at;

                      let statusIcon = (
                        <Clock className="w-4 h-4 text-gray-400" />
                      );
                      let statusText = 'Not scanned';
                      let statusColor = 'text-gray-500';

                      if (hasBeenScanned) {
                        statusIcon = (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        );
                        statusText = formatDate(volume.last_scan_at as string);
                        statusColor = 'text-gray-500';
                      }

                      if (isOrphaned) {
                        statusIcon = (
                          <PackageX className="w-4 h-4 text-orange-500" />
                        );
                        statusText = 'Orphaned';
                        statusColor = 'text-orange-600 dark:text-orange-400';
                      }

                      return (
                        <Link
                          key={volume.name}
                          to={`/volumes/${encodeURIComponent(volume.name ?? '')}`}
                          className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg hover:bg-surface-hover transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <HardDrive className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-primary truncate">
                                {volume.name}
                              </p>
                              <p className="text-sm text-tertiary truncate">
                                {volume.driver} • {volume.mountpoint}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-medium text-primary">
                                {formatBytes(volume.size_bytes || 0)}
                              </p>
                              <p
                                className={`text-sm flex items-center gap-1 ${statusColor}`}
                              >
                                {statusIcon}
                                {statusText}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Feature Tour */}
      <FeatureTour
        steps={APP_TOUR_STEPS}
        isOpen={isTourOpen}
        tourId={APP_TOUR_ID}
        onComplete={() => setIsTourOpen(false)}
        onSkip={() => setIsTourOpen(false)}
      />
    </div>
  );
}

export default Dashboard;
