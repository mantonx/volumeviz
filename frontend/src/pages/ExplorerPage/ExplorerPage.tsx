/**
 * Explorer Page - Simple file browser for Docker volumes
 *
 * Features:
 * - Volume selection
 * - File list with breadcrumb navigation
 * - Basic file information (name, size, modified time)
 * - Folder navigation
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  useGetVolumes,
  useGetApiV1ExplorerFiles,
} from '@/api/orval-generated/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRealtime } from '@/providers/realtime';
import {
  FileIcon,
  FolderIcon,
  SearchIcon,
  Database,
  HardDrive,
  ChevronRight,
  Home,
  ArrowLeft,
} from 'lucide-react';
import type { ExplorerPageProps } from './ExplorerPage.types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

export function ExplorerPage({ className = '' }: ExplorerPageProps) {
  const { volumeId } = useParams<{ volumeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // API hooks
  const { data: volumesResponse, isLoading: loading, refetch: fetchVolumes } = useGetVolumes();
  const volumes = (volumesResponse?.data && 'data' in volumesResponse.data
    ? (volumesResponse.data.data as any[])
    : []) || [];

  // State management
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket connection for real-time updates
  const { isConnected } = useRealtime();

  // Load files for current volume and path
  const {
    data: filesData,
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useGetApiV1ExplorerFiles(
    {
      volume_id: volumeId || '',
      path: currentPath,
      limit: 1000,
    },
    {
      query: {
        enabled: !!volumeId,
      },
    },
  );

  const files = filesData?.data?.files || [];

  // Load volumes when component mounts
  useEffect(() => {
    if (!volumeId && volumes.length === 0) {
      fetchVolumes();
    }
  }, [volumeId, volumes.length, fetchVolumes]);

  // URL synchronization
  React.useEffect(() => {
    const path = searchParams.get('path') || '/';
    const search = searchParams.get('search') || '';

    setCurrentPath(path);
    setSearchQuery(search);
  }, [searchParams]);

  // Handle search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (query === '') {
          params.delete('search');
        } else {
          params.set('search', query);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  // Handle folder navigation
  const handleFolderClick = useCallback(
    (folderPath: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('path', folderPath);
        return params;
      });
    },
    [setSearchParams],
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback(
    (path: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('path', path);
        return params;
      });
    },
    [setSearchParams],
  );

  // Parse breadcrumb path
  const breadcrumbs = React.useMemo(() => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }];

    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root', path: '/' }];

    let accumulatedPath = '';
    parts.forEach((part) => {
      accumulatedPath += `/${part}`;
      crumbs.push({ name: part, path: accumulatedPath });
    });

    return crumbs;
  }, [currentPath]);

  // Filter files by search query
  const filteredFiles = React.useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter((file) => file.name?.toLowerCase().includes(query));
  }, [files, searchQuery]);

  if (!volumeId) {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Volume Explorer
          </h1>
          <p className="mt-2 text-gray-600">
            Choose a volume to explore its files and directories
          </p>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading volumes...</span>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {volumes.map((volume) => (
              <Card
                key={volume.name}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/explorer/${volume.name}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <HardDrive className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {volume.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {volume.driver} volume
                      </p>
                    </div>
                  </div>
                  {!volume.is_orphaned && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full mr-1" />
                      <span className="text-xs">Active</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Containers:</span>
                    <span className="text-gray-900">
                      {volume.attachments_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span
                      className={`${volume.is_orphaned ? 'text-yellow-600' : 'text-green-600'}`}
                    >
                      {volume.is_orphaned ? 'Orphaned' : 'In Use'}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/explorer/${volume.name}`);
                  }}
                >
                  Explore Volume
                </Button>
              </Card>
            ))}
          </div>
        )}

        {!loading && volumes.length === 0 && (
          <Card className="p-8 text-center">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No volumes found
            </h3>
            <p className="text-gray-600 mb-4">
              There are no Docker volumes available to explore.
            </p>
            <Button onClick={() => fetchVolumes()} variant="outline">
              Refresh Volumes
            </Button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className={`container mx-auto py-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/explorer')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              Volume Explorer
            </h1>
            <p className="mt-2 text-gray-600 ml-12">
              Browsing:{' '}
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {volumeId}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected && (
              <div className="flex items-center text-green-600 text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                Live Updates
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-gray-400" />
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                <button
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className={`hover:text-blue-600 transition-colors ${
                    index === breadcrumbs.length - 1
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-600'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* File List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileIcon className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">
              {filteredFiles.length} items
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchFiles()}
            disabled={filesLoading}
          >
            {filesLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {filesLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchQuery
                ? 'No files match your search'
                : 'This folder is empty'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Modified
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Parent directory link */}
                {currentPath !== '/' && (
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      const parentPath = currentPath
                        .split('/')
                        .slice(0, -1)
                        .join('/') || '/';
                      handleFolderClick(parentPath);
                    }}
                  >
                    <td className="px-4 py-3 flex items-center gap-2">
                      <FolderIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">..</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">-</td>
                    <td className="px-4 py-3 text-sm text-gray-500">-</td>
                    <td className="px-4 py-3 text-sm text-gray-500">Parent folder</td>
                  </tr>
                )}

                {/* Files and folders */}
                {filteredFiles.map((file) => (
                  <tr
                    key={file.path}
                    className={`hover:bg-gray-50 ${file.is_directory ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (file.is_directory) {
                        handleFolderClick(file.path || '');
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {file.is_directory ? (
                          <FolderIcon className="h-4 w-4 text-blue-600" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-gray-600" />
                        )}
                        <span className="text-sm text-gray-900">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {file.is_directory ? '-' : formatBytes(file.size || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(file.modified_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {file.is_directory
                        ? 'Folder'
                        : file.extension || 'File'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Status Bar */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>{filteredFiles.length} items in current folder</span>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && <span>🔄 Live updates active</span>}
        </div>
      </div>
    </div>
  );
}
