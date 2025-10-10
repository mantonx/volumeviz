import { useAtomValue, useSetAtom } from 'jotai';
import {
  Loader2,
  AlertCircle,
  FolderIcon,
  FileIcon,
  ArrowUpIcon,
  MoreVertical,
  Download,
  Eye,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  useGetApiV1ExplorerBrowse,
  GetApiV1ExplorerBrowseParams,
} from '@/api/orval-generated/api';
import { selectedVolumeAtom } from '@/atoms/volumes';
import { useFileOperations } from '@/hooks/api/useFileOperations';
import { formatBytes } from '@/utils';

interface FileBrowserProps {
  volumeId?: string;
  initialPath?: string;
  className?: string;
  onFileSelect?: (file: any) => void;
  onFileDoubleClick?: (file: any) => void;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  modified?: string;
  extension?: string;
  media_type?: string;
}

export function FileBrowser({
  volumeId,
  initialPath = '/',
  className = '',
  onFileSelect,
  onFileDoubleClick,
}: FileBrowserProps) {
  const selectedVolume = useAtomValue(selectedVolumeAtom);
  const currentVolumeId = volumeId || selectedVolume;
  const [currentPath, setCurrentPath] = useState(initialPath);

  // File operations
  const { downloadFile, generatePreview } = useFileOperations();

  // Fetch files for the current path
  const {
    data: filesData,
    isLoading,
    error,
    refetch,
  } = useGetApiV1ExplorerBrowse(
    {
      volume_id: currentVolumeId || '',
      path: currentPath,
      limit: 100,
      include_parent: true,
      include_children: false,
    },
    {
      query: {
        enabled: !!currentVolumeId,
        refetchOnWindowFocus: false,
        staleTime: 30000, // 30 seconds
      },
    },
  );

  const files: FileItem[] = useMemo(() => {
    if (!filesData?.files) return [];
    return filesData.files.map((file: any) => ({
      id: file.id || `${file.path}-${file.name}`,
      name: file.name,
      type: file.type === 'directory' ? 'folder' : 'file',
      path: file.path,
      size: file.size_bytes || file.size,
      modified: file.modified_at || file.last_modified,
      extension: file.extension,
      media_type: file.media_type,
    }));
  }, [filesData]);

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root', path: '/' }];

    let currentPathBuild = '';
    parts.forEach((part) => {
      currentPathBuild += `/${part}`;
      crumbs.push({
        name: part,
        path: currentPathBuild,
      });
    });

    return crumbs;
  }, [currentPath]);

  const handleNavigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const handleFileClick = (file: FileItem) => {
    onFileSelect?.(file);
  };

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.type === 'folder') {
      setCurrentPath(file.path);
    }
    onFileDoubleClick?.(file);
  };

  // formatBytes is now imported from @/utils

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      await downloadFile.mutateAsync({
        fileId: file.id,
        filename: file.name,
        path: file.path,
      });
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handlePreviewFile = async (file: FileItem) => {
    try {
      await generatePreview.mutateAsync({
        fileId: file.id,
        type: 'thumbnail',
        size: 'medium',
      });
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  if (!currentVolumeId) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No volume selected
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select a volume to browse its files.
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
          <p className="mt-2 text-sm text-gray-500">Loading files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Failed to load files
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {error.message || 'An error occurred while loading files.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <span>/</span>}
            <button
              onClick={() => handleNavigateToPath(crumb.path)}
              className={`hover:text-gray-700 ${
                index === breadcrumbs.length - 1
                  ? 'text-gray-900 font-medium'
                  : 'hover:underline'
              }`}
              disabled={index === breadcrumbs.length - 1}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* File List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              {files.length} items
            </h3>
            {currentPath !== '/' && (
              <button
                onClick={() =>
                  handleNavigateToPath(
                    breadcrumbs[breadcrumbs.length - 2]?.path || '/',
                  )
                }
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <ArrowUpIcon className="w-3 h-3 mr-1" />
                Up
              </button>
            )}
          </div>
        </div>

        {/* Files Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modified
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-line">
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {file.type === 'folder' ? (
                        <FolderIcon className="w-5 h-5 text-blue-500 mr-3" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-gray-400 mr-3" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {file.name}
                        </div>
                        {file.extension && (
                          <div className="text-xs text-gray-500">
                            {file.extension.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {file.type === 'folder' ? '-' : formatBytes(file.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.modified)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {file.type === 'file' && (
                        <>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewFile(file);
                            }}
                            disabled={generatePreview.isLoading}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(file);
                            }}
                            disabled={downloadFile.isLoading}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {files.length === 0 && (
          <div className="text-center py-12">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No files found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This directory appears to be empty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
