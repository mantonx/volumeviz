import React from 'react';
import { useAtomValue } from 'jotai';
import { Database, Play, Square, Pause, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { filteredContainersAtom, containerStatsAtom } from '@/store';

export const ContainersPage: React.FC = () => {
  const containers = useAtomValue(filteredContainersAtom);
  const containerStats = useAtomValue(containerStatsAtom);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'success';
      case 'stopped':
      case 'exited':
        return 'secondary';
      case 'paused':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'stopped':
      case 'exited':
        return <Square className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Docker Containers
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor and manage your Docker containers
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Containers
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {containerStats.total}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Play className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Running
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {containerStats.running}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Square className="h-8 w-8 text-gray-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Stopped
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {containerStats.stopped}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Pause className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Paused
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {containerStats.paused}
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* Container List */}
      {containers.length === 0 ? (
        <Card className="p-12 text-center">
          <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No containers found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            No Docker containers are currently available.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {containers.map((container) => (
            <Card key={container.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Database className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                      {container.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {container.image}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      ID: {container.id?.substring(0, 12)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusColor(container.status)}>
                    <span className="flex items-center">
                      {getStatusIcon(container.status)}
                      <span className="ml-1 capitalize">
                        {container.status}
                      </span>
                    </span>
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white capitalize">
                    {container.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Created
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {container.created
                      ? new Date(container.created).toLocaleDateString()
                      : 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Networks
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {container.networks?.length || 0} network(s)
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Volumes
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {container.mounts?.length || 0} mount(s)
                  </dd>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
