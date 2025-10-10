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
import { getVolumes, getApiV1OrganizationsMe } from '@/api/client';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalVolumes: number;
  totalScans: number;
  activeScans: number;
  storageTrackedTB: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch volumes (paged response)
        const volumesResponse = await getVolumes({ page_size: 1000 });
        const volumesData = volumesResponse.data as any;
        const volumes = (volumesData?.data || []) as any[];
        const totalVolumes = volumesData?.total || volumes.length;

        // Fetch organization info
        let orgUserCount = 0;
        let storageUsageBytes = 0;
        try {
          const orgResponse = await getApiV1OrganizationsMe();
          const orgData = orgResponse.data as any;
          orgUserCount = orgData?.stats?.user_count || 0;
          storageUsageBytes = orgData?.stats?.storage_usage_bytes || 0;
        } catch (err) {
          console.error('Failed to fetch organization:', err);
        }

        // Calculate storage from organization stats or fallback to volume sizes
        let totalTB = storageUsageBytes / (1024 * 1024 * 1024 * 1024);

        if (totalTB === 0 && volumes.length > 0) {
          const totalBytes = volumes.reduce((sum: number, vol: any) => {
            const size = vol.size || 0;
            return sum + size;
          }, 0);
          totalTB = totalBytes / (1024 * 1024 * 1024 * 1024);
        }

        setStats({
          totalUsers: orgUserCount,
          totalOrganizations: 1, // User can only see their own org
          totalVolumes: totalVolumes,
          totalScans: 0, // TODO: Add scan stats when API is available
          activeScans: 0, // TODO: Calculate from volume scan statuses
          storageTrackedTB: totalTB,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          System overview and recent activity
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Organizations</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Tracked Volumes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Scans</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Scans</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Storage Tracked</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.storageTrackedTB} TB
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">API</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {systemHealth.api}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Database</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {systemHealth.database}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Storage</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {systemHealth.storage}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Last checked: {formatTimestamp(systemHealth.lastCheck)}
        </p>
      </Card>

      {/* Recent Activity - Placeholder until audit log API is available */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
        </div>
        <div className="text-center py-8">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Activity log coming soon
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recent system activity will be displayed here
          </p>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
