import { useAtomValue } from 'jotai';
import { Loader2, AlertCircle, Users, HardDrive, Building, TrendingUp } from 'lucide-react';
import React from 'react';
import { useGetApiV1OrganizationsMe } from '@/api/orval-generated/api';
import { organizationIdAtom } from '@/atoms/organization';

interface OrganizationDashboardProps {
  className?: string;
}

export function OrganizationDashboard({ className = '' }: OrganizationDashboardProps) {
  const orgId = useAtomValue(organizationIdAtom);

  const { 
    data: orgData, 
    isLoading, 
    error 
  } = useGetApiV1OrganizationsMe({
    query: {
      enabled: !!orgId,
      refetchInterval: 60000, // Refresh every minute
    },
  });

  const organization = orgData?.data?.organization;
  const stats = orgData?.data?.stats;
  const limits = orgData?.data?.limits;

  if (!orgId) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organization selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please select an organization to view the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-sm text-gray-500">Loading organization dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load organization</h3>
          <p className="mt-1 text-sm text-gray-500">
            {error?.message || 'An error occurred while loading organization data.'}
          </p>
        </div>
      </div>
    );
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const calculateUsagePercentage = (used?: number, limit?: number) => {
    if (!used || !limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Organization Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
            {organization.description && (
              <p className="mt-1 text-sm text-gray-500">{organization.description}</p>
            )}
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>Plan: <span className="font-medium capitalize">{organization.plan_type}</span></span>
              <span>Created: {new Date(organization.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              organization.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {organization.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Volumes"
          value={stats?.total_volumes || 0}
          limit={limits?.max_volumes}
          icon={HardDrive}
          color="blue"
          formatValue={(value) => value.toLocaleString()}
        />
        
        <StatCard
          title="Storage Used"
          value={stats?.total_size_bytes || 0}
          limit={limits?.max_storage_bytes}
          icon={HardDrive}
          color="green"
          formatValue={formatBytes}
        />
        
        <StatCard
          title="Active Users"
          value={stats?.active_users || 0}
          limit={limits?.max_users}
          icon={Users}
          color="purple"
          formatValue={(value) => value.toLocaleString()}
        />
        
        <StatCard
          title="Total Files"
          value={stats?.total_files || 0}
          icon={TrendingUp}
          color="indigo"
          formatValue={(value) => value.toLocaleString()}
        />
      </div>

      {/* Usage Progress Bars */}
      {limits && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h3>
          <div className="space-y-4">
            {/* Volume Usage */}
            {limits.max_volumes && (
              <UsageBar
                label="Volumes"
                used={stats?.total_volumes || 0}
                limit={limits.max_volumes}
                formatValue={(value) => value.toLocaleString()}
              />
            )}
            
            {/* Storage Usage */}
            {limits.max_storage_bytes && (
              <UsageBar
                label="Storage"
                used={stats?.total_size_bytes || 0}
                limit={limits.max_storage_bytes}
                formatValue={formatBytes}
              />
            )}
            
            {/* User Usage */}
            {limits.max_users && (
              <UsageBar
                label="Users"
                used={stats?.active_users || 0}
                limit={limits.max_users}
                formatValue={(value) => value.toLocaleString()}
              />
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Activity</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {stats?.last_scan_at ? 
                new Date(stats.last_scan_at).toLocaleString() : 
                'No recent activity'
              }
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Data Retention</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {limits?.retention_days || 'Unlimited'} days
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  title: string;
  value: number;
  limit?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'indigo';
  formatValue: (value: number) => string;
}

function StatCard({ title, value, limit, icon: Icon, color, formatValue }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500', 
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 ${colorClasses[color]} rounded-md flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {formatValue(value)}
                {limit && (
                  <span className="text-sm text-gray-500 ml-2">
                    / {formatValue(limit)}
                  </span>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  formatValue: (value: number) => string;
}

function UsageBar({ label, used, limit, formatValue }: UsageBarProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const colorClass = percentage >= 90 ? 'bg-red-500' : 
                     percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
        <span>{label}</span>
        <span>{formatValue(used)} / {formatValue(limit)} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}