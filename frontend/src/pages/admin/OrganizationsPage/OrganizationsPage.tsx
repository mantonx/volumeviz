/**
 * OrganizationsPage - Admin page for organization management
 *
 * Features:
 * - List all organizations
 * - View organization details and statistics
 * - Edit organization settings
 * - Create new organizations
 * - View organization members
 */

import React, { useState, useEffect } from 'react';
import { Building2, Search, Plus, Edit, Users, Database, TrendingUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getApiV1OrganizationsMe } from '@/api/client';

interface Organization {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  maxUsers?: number;
  maxVolumes?: number;
  maxStorageGb?: number;
  planType?: string;
  userCount: number;
  volumeCount: number;
  storageUsageBytes: number;
  createdAt: string;
}

export const OrganizationsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await getApiV1OrganizationsMe();
        const data = response.data as any;

        // Transform the API response to match our Organization interface
        const org: Organization = {
          id: data?.organization?.id || 0,
          name: data?.organization?.name || 'default',
          displayName: data?.organization?.display_name || 'My Organization',
          description: data?.organization?.description || '',
          isActive: true,
          maxUsers: data?.limits?.max_users,
          maxVolumes: data?.limits?.max_volumes,
          maxStorageGb: data?.limits?.max_storage_gb,
          planType: data?.organization?.plan_type || 'free',
          userCount: data?.stats?.user_count || 0,
          volumeCount: data?.stats?.volume_count || 0,
          storageUsageBytes: data?.stats?.storage_usage_bytes || 0,
          createdAt: data?.organization?.created_at || new Date().toISOString(),
        };

        setOrganizations([org]); // Currently only showing user's own org
      } catch (err) {
        console.error('Failed to fetch organization:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organizations</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage organizations and their resources
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </Card>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOrgs.map((org) => (
          <Card key={org.id} className="p-6">
            {/* Organization Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {org.displayName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {org.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Description */}
            {org.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {org.description}
              </p>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {org.userCount}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Users
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                  <Database className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {org.volumeCount}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Volumes
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatBytes(org.storageUsageBytes)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Storage
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Plan Type</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {org.planType}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Max Users</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {org.maxUsers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Max Volumes</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {org.maxVolumes.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className={`font-medium ${org.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {org.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredOrgs.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No organizations found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating a new organization'}
          </p>
        </div>
      )}
    </div>
  );
};

export default OrganizationsPage;
