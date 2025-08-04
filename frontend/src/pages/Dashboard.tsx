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

export const Dashboard: React.FC = () => {
  const { fetchVolumes } = useVolumes();
  const { checkHealth } = useApiHealth();
  const volumeStats = useAtomValue(volumeStatsAtom);
  const containerStats = useAtomValue(containerStatsAtom);
  const apiStatus = useAtomValue(apiStatusAtom);
  const lastUpdated = useAtomValue(volumesLastUpdatedAtom);

  useEffect(() => {
    fetchVolumes();
    checkHealth();
  }, [fetchVolumes, checkHealth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'error':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5" />;
      case 'offline':
        return <AlertTriangle className="h-5 w-5" />;
      case 'connecting':
        return <Clock className="h-5 w-5 animate-pulse" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your Docker environment
        </p>
      </div>

      {/* API Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={getStatusColor(apiStatus)}>
              {getStatusIcon(apiStatus)}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                API Status
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Backend connection:{' '}
                <span className="capitalize">{apiStatus}</span>
              </p>
            </div>
          </div>
          {lastUpdated && (
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last updated
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <HardDrive className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Volumes
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {volumeStats.total}
                  </div>
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {volumeStats.active} active
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Containers
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {containerStats.total}
                  </div>
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                    <Activity className="h-4 w-4 mr-1" />
                    {containerStats.running} running
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Storage Used
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {volumeStats.totalSize > 0
                      ? `${(volumeStats.totalSize / (1024 * 1024 * 1024)).toFixed(1)}`
                      : '0'}
                  </div>
                  <div className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    GB
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Health Score
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {apiStatus === 'online' ? '100' : '0'}%
                  </div>
                  <div className="ml-2">
                    <Badge
                      variant={
                        apiStatus === 'online' ? 'success' : 'destructive'
                      }
                    >
                      {apiStatus === 'online' ? 'Healthy' : 'Issues'}
                    </Badge>
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Volume Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Active volumes
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {volumeStats.active}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Inactive volumes
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {volumeStats.inactive}
              </span>
            </div>
            {Object.entries(volumeStats.drivers).map(([driver, count]) => (
              <div key={driver} className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {driver} driver
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Container Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Running containers
              </span>
              <span className="text-sm font-medium text-green-600">
                {containerStats.running}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Stopped containers
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {containerStats.stopped}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Paused containers
              </span>
              <span className="text-sm font-medium text-yellow-600">
                {containerStats.paused}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => fetchVolumes()}>
            <HardDrive className="h-4 w-4 mr-2" />
            Refresh Volumes
          </Button>
          <Button variant="outline" onClick={() => checkHealth()}>
            <Activity className="h-4 w-4 mr-2" />
            Check Health
          </Button>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Metrics
          </Button>
        </div>
      </Card>
    </div>
  );
};
