/**
 * DashboardPage - Admin overview dashboard
 *
 * Features:
 * - System statistics
 * - Recent activity
 * - Quick actions
 * - System health
 */

import React from 'react';
import {
  Users,
  Building2,
  Database,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Mock data
const stats = {
  totalUsers: 4,
  totalOrganizations: 1,
  totalVolumes: 35,
  totalScans: 128,
  activeScans: 0,
  storageTrackedTB: 2.4,
};

const recentActivity = [
  {
    id: 1,
    type: 'user_created',
    message: 'New user "demouser" created',
    timestamp: '2025-10-09T14:30:00Z',
    user: 'admin',
  },
  {
    id: 2,
    type: 'scan_completed',
    message: 'Volume scan completed: volumeviz_movies_dev',
    timestamp: '2025-10-09T14:25:00Z',
    user: 'system',
  },
  {
    id: 3,
    type: 'login',
    message: 'User "demouser" logged in',
    timestamp: '2025-10-09T14:20:00Z',
    user: 'demouser',
  },
];

const systemHealth = {
  api: 'healthy',
  database: 'healthy',
  storage: 'healthy',
  lastCheck: '2025-10-09T14:35:00Z',
};

export const DashboardPage: React.FC = () => {
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_created':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'scan_completed':
        return <Database className="h-4 w-4 text-green-600" />;
      case 'login':
        return <Activity className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
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

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  {activity.message}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activity.user} • {formatTimestamp(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
