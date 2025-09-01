import React from 'react';
import { Link } from 'react-router-dom';
import { 
  HardDrive, 
  Database, 
  Activity, 
  BarChart3,
  Search,
  Settings 
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useGetVolumes } from '@/api/orval-generated/api';
import { useGetApiV1OrganizationsMe } from '@/api/orval-generated/api';
import { formatBytes } from '@/utils/formatters';
import { SyncStatusBadge } from '@/components/shared/SyncStatusIndicator';

/**
 * Modern Dashboard page component providing an overview of VolumeViz system status.
 * 
 * Uses Orval-generated API hooks with TanStack Query for optimal performance and caching.
 */
export function Dashboard() {
  const { data: volumesData, isLoading: volumesLoading } = useGetVolumes({
    page: 1,
    page_size: 100,
  });
  
  const { data: orgData, isLoading: orgLoading } = useGetApiV1OrganizationsMe();

  const volumes = volumesData?.data || [];
  const totalSize = volumes.reduce((sum, vol) => sum + (vol.size_bytes || 0), 0);
  const totalVolumes = volumes.length;
  const trackedVolumes = volumes.filter(vol => !vol.is_orphaned).length;

  if (volumesLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Overview of your VolumeViz system</p>
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
        {orgData && (
          <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{orgData.name}</h2>
            <p className="text-gray-600">{orgData.description}</p>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Volumes</p>
                <p className="text-2xl font-bold text-gray-900">{totalVolumes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tracked Volumes</p>
                <p className="text-2xl font-bold text-gray-900">{trackedVolumes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Size</p>
                <p className="text-2xl font-bold text-gray-900">{formatBytes(totalSize)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalVolumes > 0 ? formatBytes(totalSize / totalVolumes) : '0 B'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Volume Management</h3>
            <p className="text-gray-600 mb-4">Manage and monitor your Docker volumes</p>
            <Button asChild className="w-full">
              <Link to="/volumes">
                <HardDrive className="w-4 h-4 mr-2" />
                View Volumes
              </Link>
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">File Explorer</h3>
            <p className="text-gray-600 mb-4">Browse and search files in your volumes</p>
            <Button asChild className="w-full">
              <Link to="/explorer">
                <Search className="w-4 h-4 mr-2" />
                Explore Files
              </Link>
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Search</h3>
            <p className="text-gray-600 mb-4">Search across all your volumes and files</p>
            <Button asChild className="w-full">
              <Link to="/search">
                <Search className="w-4 h-4 mr-2" />
                Search Files
              </Link>
            </Button>
          </Card>
        </div>

        {/* Recent Volumes */}
        {volumes.length > 0 && (
          <div className="mt-8">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Volumes</h3>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/volumes">View All</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {volumes.slice(0, 5).map((volume) => (
                  <div key={volume.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <HardDrive className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium text-gray-900">{volume.name}</p>
                        <p className="text-sm text-gray-500">{volume.driver} • {volume.mountpoint}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatBytes(volume.size_bytes || 0)}</p>
                      <p className="text-sm text-gray-500">
                        {volume.last_scan_at ? new Date(volume.last_scan_at).toLocaleDateString() : 'Not scanned'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;