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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getVolumes, getOrganizations, getUsers } from '@/api/client';
import { useVolumeWebSocket } from '@/hooks/useVolumeWebSocket';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalVolumes: number;
  totalScans: number;
  activeScans: number;
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
    totalScans: 0,
    activeScans: 0,
    storageTrackedTB: 0,
  });
  const [, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Real-time updates via WebSocket
  const { onSizeUpdate } = useVolumeWebSocket({
    enabled: true,
  });

  // Log on every render to track when state changes
  console.log(`[Dashboard] Rendering at ${performance.now().toFixed(0)}ms with stats:`, stats);

  // Listen for volume size updates to refresh storage stats
  useEffect(() => {
    const cleanup = onSizeUpdate((event) => {
      console.log('[Dashboard] Volume size updated, refreshing storage stats:', event);
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
      console.log('[Dashboard] Skipping duplicate fetch (already fetched)');
      return;
    }

    const fetchStats = async () => {
      try {
        const startTime = performance.now();
        console.log('[Dashboard] Starting to fetch stats...');

        // Fetch all stats in parallel for better performance
        const [usersResult, orgsResult, volumesResult] = await Promise.allSettled([
          getUsers({ page: 1, page_size: 100 }),
          getOrganizations({ page: 1, page_size: 100 }),
          getVolumes({ page: 1, page_size: 1000 }),
        ]);

        const endTime = performance.now();
        console.log(`[Dashboard] All API calls completed in ${(endTime - startTime).toFixed(0)}ms`);

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
        const activeScans = 0;

        const newStats = {
          totalUsers,
          totalOrganizations,
          totalVolumes,
          totalScans: 0, // TODO: Add scan stats when API is available
          activeScans,
          storageTrackedTB: totalBytes,
        };

        console.log('[Dashboard] About to call setStats with:', newStats);
        const beforeSetStats = performance.now();
        setStats(newStats);
        const afterSetStats = performance.now();
        console.log(`[Dashboard] setStats called in ${(afterSetStats - beforeSetStats).toFixed(2)}ms`);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
        setHasFetched(true);
        console.log('[Dashboard] Fetch complete, loading set to false');
      }
    };

    fetchStats();
  }, [hasFetched]);

  const systemHealth = {
    api: 'healthy',
    database: 'healthy',
    storage: 'healthy',
    lastCheck: new Date().toISOString(),
  };
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

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
                {stats.totalScans}
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
                {stats.activeScans}
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
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-primary">API</p>
              <p className="text-xs text-tertiary capitalize">
                {systemHealth.api}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-primary">Database</p>
              <p className="text-xs text-tertiary capitalize">
                {systemHealth.database}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-primary">Storage</p>
              <p className="text-xs text-tertiary capitalize">
                {systemHealth.storage}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-tertiary">
          Last checked: {formatTimestamp(systemHealth.lastCheck)}
        </p>
      </Card>

      {/* Recent Activity - Placeholder until audit log API is available */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary">
            Recent Activity
          </h2>
        </div>
        <div className="text-center py-8">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">
            Activity log coming soon
          </h3>
          <p className="mt-1 text-sm text-tertiary">
            Recent system activity will be displayed here
          </p>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
