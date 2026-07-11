/**
 * FileTable Component
 *
 * Virtualized file table component for displaying large numbers of files.
 * Supports sorting, searching, and selection with high performance.
 */

import { useGetApiV1ExplorerFiles } from '@/api/orval-generated/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PreviewImage } from '@/components/preview';
import type { FileItem } from '../VirtualizedFileTable/VirtualizedFileTable.types';
import { cn } from '@/utils';
import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface FileTableProps {
  volumeId: string;
  currentPath: string;
  onFileSelect?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  className?: string;
}

const getFileIcon = (file: FileItem) => {
  if (file.is_directory) {
    return <FolderIcon className="w-4 h-4 text-blue-500" />;
  }

  // Use preview image for media files
  if (
    file.media_type &&
    (file.media_type.startsWith('image/') ||
      file.media_type.startsWith('video/') ||
      file.media_type.startsWith('audio/'))
  ) {
    return (
      <PreviewImage
        fileId={String(file.id ?? file.path)}
        fileName={file.name}
        mediaType={file.media_type}
        size="small"
        className="w-4 h-4 rounded"
        lazy={true}
        showBlurUp={false}
      />
    );
  }

  // Fallback icons for non-media files
  if (file.media_type?.startsWith('text/') || file.extension === 'txt') {
    return <FileTextIcon className="w-4 h-4 text-gray-500" />;
  }

  return <FileIcon className="w-4 h-4 text-gray-500" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const FileTable: React.FC<FileTableProps> = ({
  volumeId,
  currentPath,
  onFileSelect,
  onFileDoubleClick,
  className = '',
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FileItem;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  const {
    data: filesData,
    isLoading,
    error,
  } = useGetApiV1ExplorerFiles(
    { volume_id: volumeId, path: currentPath, limit: 1000 },
    { query: { enabled: !!volumeId } },
  );

  // customFetchClient wraps the raw body as { data, status, headers }; the
  // actual API response body (with its `files` field) is under `.data`.
  const files = ((filesData?.data as { files?: FileItem[] } | undefined)
    ?.files ?? []) as FileItem[];

  const sortedFiles = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue == null || bValue == null) return 0;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    // Always show directories first
    return sorted.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return 0;
    });
  }, [files, sortConfig]);

  const handleSort = useCallback((key: keyof FileItem) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleFileClick = useCallback(
    (file: FileItem) => {
      setSelectedFile(file.path);
      onFileSelect?.(file);
    },
    [onFileSelect],
  );

  const handleFileDoubleClick = useCallback(
    (file: FileItem) => {
      onFileDoubleClick?.(file);
    },
    [onFileDoubleClick],
  );

  if (error) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <p className="text-red-500">Error loading files: {String(error)}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading files...</p>
        </div>
      </div>
    );
  }

  if (sortedFiles.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No files found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto', className)}>
      <table className="min-w-full divide-y divide-line">
        <thead className="bg-surface-secondary sticky top-0">
          <tr>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:bg-surface-hover"
              onClick={() => handleSort('name')}
            >
              Name
              {sortConfig.key === 'name' && (
                <span className="ml-1">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:bg-surface-hover"
              onClick={() => handleSort('size')}
            >
              Size
              {sortConfig.key === 'size' && (
                <span className="ml-1">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:bg-surface-hover"
              onClick={() => handleSort('modified_time')}
            >
              Modified
              {sortConfig.key === 'modified_time' && (
                <span className="ml-1">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-line">
          {sortedFiles.map((file) => (
            <tr
              key={file.path}
              className={cn(
                'hover:bg-surface-hover cursor-pointer',
                selectedFile === file.path && 'bg-blue-50 dark:bg-blue-900/20',
              )}
              onClick={() => handleFileClick(file)}
              onDoubleClick={() => handleFileDoubleClick(file)}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {getFileIcon(file)}
                  <span className="ml-2 text-sm font-medium text-primary truncate">
                    {file.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-tertiary">
                {file.is_directory
                  ? '—'
                  : formatFileSize(file.size ?? 0)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-tertiary">
                {file.modified_time ? formatDate(file.modified_time) : '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {file.is_directory ? (
                  <Badge variant="secondary">Folder</Badge>
                ) : file.extension ? (
                  <Badge variant="outline">
                    {file.extension.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="outline">File</Badge>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                  {!file.is_directory && (
                    <Button variant="ghost" size="sm">
                      <DownloadIcon className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm">
                    <MoreHorizontalIcon className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
