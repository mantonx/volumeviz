import React, { useState, useEffect } from 'react';
import type {
  InternalApiV1MountsMountCatalogResponse as MountCatalogEntry,
  InternalApiV1MountsMountCatalogSummaryResponse as MountCatalogSummary,
  InternalApiV1MountsDiscoverMountsRequest,
  InternalApiV1MountsDiscoverMountsResponse,
} from '../../api/generated/Api';

export const MountsPage: React.FC = () => {
  const [mounts, setMounts] = useState<MountCatalogEntry[]>([]);
  const [summary, setSummary] = useState<MountCatalogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [mountTypeFilter, setMountTypeFilter] = useState('');
  const [composeProjectFilter, setComposeProjectFilter] = useState('');
  const [composeServiceFilter, setComposeServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMount, setSelectedMount] = useState<MountCatalogEntry | null>(null);

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/v1/mounts/summary');
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchMounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '10',
      });
      if (searchQuery) params.set('q', searchQuery);
      if (mountTypeFilter) params.set('type', mountTypeFilter);
      if (composeProjectFilter) params.set('compose_project', composeProjectFilter);
      if (composeServiceFilter) params.set('compose_service', composeServiceFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/v1/mounts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch mounts');
      const data = await response.json();
      setMounts(data.mounts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch mounts');
    } finally {
      setLoading(false);
    }
  };

  const triggerDiscovery = async () => {
    try {
      const response = await fetch('/api/v1/mounts/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!response.ok) throw new Error('Failed to trigger discovery');
      await fetchSummary();
      await fetchMounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger discovery');
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchMounts();
  }, [page, searchQuery, mountTypeFilter, composeProjectFilter, composeServiceFilter, statusFilter]);

  const getMountTypeColor = (type: string) => {
    switch (type) {
      case 'volume': return 'bg-blue-100 text-blue-800';
      case 'bind': return 'bg-green-100 text-green-800';
      case 'tmpfs': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Docker Mount Catalog</h1>
          <p className="text-gray-600 mt-1">Comprehensive view of all Docker mounts and their metadata</p>
        </div>
        <button
          onClick={triggerDiscovery}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
        >
          Discover Mounts
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Total Mounts</h3>
            <p className="text-2xl font-bold text-blue-600">{summary.total_mounts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Volumes</h3>
            <p className="text-2xl font-bold text-blue-500">{summary.volume_mounts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Bind Mounts</h3>
            <p className="text-2xl font-bold text-green-500">{summary.bind_mounts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Tmpfs</h3>
            <p className="text-2xl font-bold text-purple-500">{summary.tmpfs_mounts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Orphaned</h3>
            <p className="text-2xl font-bold text-yellow-500">{summary.orphaned_mounts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-sm font-semibold text-gray-600">Projects</h3>
            <p className="text-2xl font-bold text-indigo-500">{summary.compose_projects || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mounts..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={mountTypeFilter}
              onChange={(e) => setMountTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="volume">Volume</option>
              <option value="bind">Bind</option>
              <option value="tmpfs">Tmpfs</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="orphaned">Orphaned</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <input
              type="text"
              value={composeProjectFilter}
              onChange={(e) => setComposeProjectFilter(e.target.value)}
              placeholder="Project..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
            <input
              type="text"
              value={composeServiceFilter}
              onChange={(e) => setComposeServiceFilter(e.target.value)}
              placeholder="Service..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Mounts Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading mounts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p>Error: {error}</p>
            <button
              onClick={fetchMounts}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mount ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Path
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Containers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compose Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mounts.map((mount) => (
                  <tr key={mount.id!} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {mount.volume_name || mount.mount_id?.substring(0, 12)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {mount.mount_id?.substring(0, 16)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMountTypeColor(mount.mount_type || '')}`}>
                        {mount.mount_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={mount.source_path}>
                        {mount.source_path}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mount.container_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mount.compose_project || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {mount.compose_services && mount.compose_services.length > 0 ? (
                          mount.compose_services.map((service, idx) => (
                            <span key={idx} className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                              {service}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {mount.is_orphaned && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Orphaned
                          </span>
                        )}
                        {mount.is_tracked && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Tracked
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Showing page {page} of mount catalog
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={mounts.length < 10}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default MountsPage;