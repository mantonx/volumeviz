/**
 * DashboardPage - Admin overview dashboard
 *
 * Features:
 * - System statistics
 * - Recent activity
 * - Quick actions
 * - System health
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  Building2,
  Database,
  Activity,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getApiV1Volumes, getApiV1Organizations, getApiV1Users } from '@/api/client';
import { useGetApiV1Health, useGetApiV1ActivityRecent } from '@/api/orval-generated/api';
import { useVolumeWebSocket } from '@/hooks/useVolumeWebSocket';
import { formatDate } from '@/utils/formatters';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalVolumes: number;
  storageTrackedTB: number;
}

// Helper function to format bytes into human-readable format
function formatBytes(bytes: number): { value: string; unit: string } {
  if (bytes === 0) return { value: '0', unit: 'B' };

  const tb = bytes / (1024 * 1024 * 1024 * 1024);
  if (tb >= 1) {
    return { value: tb.toFixed(2), unit: 'TB' };
  }

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return { value: gb.toFixed(2), unit: 'GB' };
  }

  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return { value: mb.toFixed(2), unit: 'MB' };
  }

  const kb = bytes / 1024;
  if (kb >= 1) {
    return { value: kb.toFixed(2), unit: 'KB' };
  }

  return { value: bytes.toString(), unit: 'B' };
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrganizations: 0,
    totalVolumes: 0,
    storageTrackedTB: 0,
  });
  const [, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Real-time updates via WebSocket
  const { onSizeUpdate } = useVolumeWebSocket({
    enabled: true,
  });

  const { data: healthResponse } = useGetApiV1Health({
    query: { refetchInterval: 15000 },
  });
  const health =
    healthResponse?.status === 200 || healthResponse?.status === 206
      ? healthResponse.data
      : undefined;

  const { data: activityResponse, isLoading: activityLoading } = useGetApiV1ActivityRecent({
    limit: 5,
  });
  const recentEvents =
    activityResponse?.status === 200 ? activityResponse.data.events ?? [] : [];

  // Listen for volume size updates to refresh storage stats
  useEffect(() => {
    const cleanup = onSizeUpdate((event) => {
      // Optimistically update the storage total
      setStats(prev => ({
        ...prev,
        storageTrackedTB: prev.storageTrackedTB + (event.size_bytes || 0),
      }));
    });

    return cleanup;
  }, [onSizeUpdate]);

  useEffect(() => {
    // Prevent double-fetch from React StrictMode
    if (hasFetched) {
      return;
    }

    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel for better performance
        const [usersResult, orgsResult, volumesResult] = await Promise.allSettled([
          getApiV1Users({ page: 1, page_size: 100 }),
          getApiV1Organizations({ page: 1, page_size: 100 }),
          getApiV1Volumes({ page: 1, page_size: 1000 }),
        ]);

        // Extract users count
        let totalUsers = 0;
        if (usersResult.status === 'fulfilled') {
          const usersData = usersResult.value.data as any;
          if (Array.isArray(usersData)) {
            totalUsers = usersData.length;
          } else if (usersData?.total !== undefined) {
            totalUsers = usersData.total;
          }
        } else {
          console.error('Failed to fetch users:', usersResult.reason);
        }

        // Extract organizations count
        let totalOrganizations = 0;
        if (orgsResult.status === 'fulfilled') {
          const orgsData = orgsResult.value.data as any;
          if (Array.isArray(orgsData)) {
            totalOrganizations = orgsData.length;
          } else if (orgsData?.total !== undefined) {
            totalOrganizations = orgsData.total;
          }
        } else {
          console.error('Failed to fetch organizations:', orgsResult.reason);
        }

        // Extract volumes count and total size
        let totalVolumes = 0;
        let totalBytes = 0;
        if (volumesResult.status === 'fulfilled') {
          const volumesData = volumesResult.value.data as any;
          if (Array.isArray(volumesData)) {
            totalVolumes = volumesData.length;
            // Calculate total storage from volume sizes
            totalBytes = volumesData.reduce((sum: number, vol: any) => {
              return sum + (vol.size_bytes || 0);
            }, 0);
          } else if (volumesData?.total !== undefined) {
            totalVolumes = volumesData.total;
          }
        } else {
          console.error('Failed to fetch volumes:', volumesResult.reason);
        }

        setStats({
          totalUsers,
          totalOrganizations,
          totalVolumes,
          storageTrackedTB: totalBytes,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };

    fetchStats();
  }, [hasFetched]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-secondary">
          System overview and recent activity
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Total Users</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {stats.totalUsers}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
          </div>
        </Card>

        {/* Total Organizations */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Organizations</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {stats.totalOrganizations}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900">
              <Building2 className="h-6 w-6 text-green-600 dark:text-green-300" />
            </div>
          </div>
        </Card>

        {/* Total Volumes */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Tracked Volumes</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {stats.totalVolumes}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Database className="h-6 w-6 text-purple-600 dark:text-purple-300" />
            </div>
          </div>
        </Card>

        {/* Total Scans */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Total Scans</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {health?.checks?.scheduler?.total_completed ?? '—'}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900">
              <Activity className="h-6 w-6 text-orange-600 dark:text-orange-300" />
            </div>
          </div>
        </Card>

        {/* Active Scans */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Active Scans</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {health?.checks?.scheduler?.active_scans ?? '—'}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900">
              <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
            </div>
          </div>
        </Card>

        {/* Storage Tracked */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary">Storage Tracked</p>
              <p className="text-3xl font-bold text-primary mt-2">
                {(() => {
                  const formatted = formatBytes(stats.storageTrackedTB);
                  return `${formatted.value} ${formatted.unit}`;
                })()}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900">
              <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
            </div>
          </div>
        </Card>
      </div>

      {/* System Health */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">
          System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HealthCheckRow label="Docker" status={health?.checks?.docker?.status} />
          <HealthCheckRow label="Database" status={health?.checks?.database?.status} />
          <HealthCheckRow label="Scan Scheduler" status={health?.checks?.scheduler?.status} />
        </div>
        {health?.timestamp && (
          <p className="mt-4 text-xs text-tertiary">
            Last checked: {formatDate(new Date(health.timestamp * 1000).toISOString())}
          </p>
        )}
      </Card>

      {/* Recent Activity - real audit-log events */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary">
            Recent Activity
          </h2>
        </div>
        {activityLoading ? (
          <p className="text-sm text-secondary py-4">Loading...</p>
        ) : recentEvents.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="mx-auto h-12 w-12 text-tertiary" />
            <h3 className="mt-2 text-sm font-medium text-primary">
              No activity yet
            </h3>
            <p className="mt-1 text-sm text-tertiary">
              Actions like volume deletion or tracking changes will show up here
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recentEvents.map((event) => (
              <li key={event.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{event.action}</p>
                  {event.resource_id && (
                    <p className="text-xs text-tertiary">
                      {event.resource_type}: {event.resource_id}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={event.status === 'success' ? 'success' : 'error'}>
                    {event.status}
                  </Badge>
                  {event.timestamp && (
                    <span className="text-xs text-tertiary">
                      {formatDate(event.timestamp)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

function HealthCheckRow({ label, status }: { label: string; status?: string }) {
  const Icon = status === 'healthy' ? CheckCircle : status === 'unhealthy' ? XCircle : AlertCircle;
  const iconColor =
    status === 'healthy'
      ? 'text-green-600'
      : status === 'unhealthy'
        ? 'text-red-600'
        : 'text-yellow-600';

  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 ${iconColor}`} />
      <div>
        <p className="text-sm font-medium text-primary">{label}</p>
        <p className="text-xs text-tertiary capitalize">{status ?? 'unknown'}</p>
      </div>
    </div>
  );
}

export default DashboardPage;
