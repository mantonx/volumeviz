import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Heart,
  Database,
  Container,
  Radio,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useGetApiV1Health } from '@/api/orval-generated/api';
import { formatDate, formatNumber } from '@/utils/formatters';
import type { HealthPageProps } from './HealthPage.types';

type CheckStatus = string | undefined;

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  healthy: 'success',
  ready: 'success',
  alive: 'success',
  degraded: 'warning',
  unknown: 'warning',
  unhealthy: 'error',
  stopped: 'error',
  not_configured: 'default',
};

function StatusBadge({ status }: { status: CheckStatus }) {
  if (!status) return <Badge variant="default">Unknown</Badge>;
  const variant = STATUS_BADGE_VARIANT[status] ?? 'default';
  const label = status.replace(/_/g, ' ');
  return <Badge variant={variant}>{label}</Badge>;
}

export const HealthPage: React.FC<HealthPageProps> = () => {
  const { data, isLoading, error, refetch, isFetching } = useGetApiV1Health({
    query: { refetchInterval: 15000 },
  });

  const health = data?.status === 200 || data?.status === 206 ? data.data : undefined;
  const checks = health?.checks;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">System Health</h1>
          <p className="mt-1 text-secondary">
            Monitor VolumeViz system health and diagnostics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && <StatusBadge status={health.status} />}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card className="p-8 text-center">
          <Heart className="h-12 w-12 mx-auto text-tertiary mb-4 animate-pulse" />
          <p className="text-secondary">Loading health status...</p>
        </Card>
      )}

      {!!error && !isLoading && (
        <Card className="p-8 text-center border-red-200">
          <Heart className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-primary mb-2">
            Couldn't Load Health Status
          </h3>
          <p className="text-secondary mb-4">
            The health check request itself failed - this is different from a
            reported "unhealthy" dependency below.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </Card>
      )}

      {checks && (
        <>
          {health?.timestamp && (
            <p className="text-xs text-tertiary">
              Last checked {formatDate(new Date(health.timestamp * 1000).toISOString())}
              {health.version?.version && ` · v${health.version.version}`}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Docker */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Container className="w-5 h-5 text-blue-500" />
                  Docker
                </h3>
                <StatusBadge status={checks.docker?.status} />
              </div>
              {checks.docker?.version && (
                <p className="text-sm text-secondary">
                  Engine {checks.docker.version} (API {checks.docker.api_version})
                </p>
              )}
              {checks.docker?.message && (
                <p className="text-sm text-red-500 mt-1">{checks.docker.message}</p>
              )}
            </Card>

            {/* Database */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  Database
                </h3>
                <StatusBadge status={checks.database?.status} />
              </div>
              <p className="text-sm text-secondary">
                {checks.database?.type ?? 'Connection status'}
              </p>
              {checks.database?.error && (
                <p className="text-sm text-red-500 mt-1">{checks.database.error}</p>
              )}
            </Card>

            {/* Docker Events */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Radio className="w-5 h-5 text-green-500" />
                  Docker Events
                </h3>
                <StatusBadge status={checks.events?.status} />
              </div>
              {checks.events ? (
                <div className="text-sm text-secondary space-y-1">
                  <p>Connected: {checks.events.connected ? 'Yes' : 'No'}</p>
                  {checks.events.last_event_age_seconds != null && (
                    <p>
                      Last event: {formatNumber(checks.events.last_event_age_seconds)}s ago
                    </p>
                  )}
                  <p>
                    Processed: {formatNumber(checks.events.processed_total ?? 0)} · Errors:{' '}
                    {formatNumber(checks.events.errors_total ?? 0)} · Dropped:{' '}
                    {formatNumber(checks.events.dropped_total ?? 0)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-secondary">Not configured</p>
              )}
            </Card>

            {/* Scan Scheduler */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Scan Scheduler
                </h3>
                <StatusBadge status={checks.scheduler?.status} />
              </div>
              {checks.scheduler ? (
                <div className="text-sm text-secondary space-y-1">
                  <p>
                    {formatNumber(checks.scheduler.active_scans ?? 0)} active,{' '}
                    {formatNumber(checks.scheduler.queue_depth ?? 0)} queued,{' '}
                    {formatNumber(checks.scheduler.worker_count ?? 0)} workers
                  </p>
                  <p>
                    Completed: {formatNumber(checks.scheduler.total_completed ?? 0)} · Failed:{' '}
                    {formatNumber(checks.scheduler.total_failed ?? 0)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-secondary">Not configured</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default HealthPage;
