/**
 * FileTable Component
 *
 * Virtualized file table component for displaying large numbers of files.
 * Supports sorting, searching, and selection with high performance.
 */

import { useFileList } from '@/api/explorer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PreviewImage } from '@/components/preview';
import type { FileItem } from '@/atoms/explorer';
import { cn } from '@/utils';
import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  MoreHorizontalIcon,
  MusicIcon,
  VideoIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface FileTableProps {
  onFileSelect?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  className?: string;
}

const getFileIcon = (file: FileItem) => {
  if (file.type === 'folder') {
    return <FolderIcon className="w-4 h-4 text-blue-500" />;
  }

  // Use preview image for media files
  if (
    file.mediaType &&
    (file.mediaType.startsWith('image/') ||
      file.mediaType.startsWith('video/') ||
      file.mediaType.startsWith('audio/'))
  ) {
    return (
      <PreviewImage
        fileId={file.id}
        fileName={file.name}
        mediaType={file.mediaType}
        size="small"
        className="w-4 h-4 rounded"
        lazy={true}
        showBlurUp={false}
      />
    );
  }

  // Fallback icons for non-media files
  if (file.mediaType?.startsWith('text/') || file.extension === 'txt') {
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
  onFileSelect,
  onFileDoubleClick,
  className = '',
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FileItem;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  const { files, isLoading, error } = useFileList();

  const sortedFiles = useMemo(() => {
    if (!files) return [];

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

    // Always show folders first
    return sorted.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
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
      setSelectedFile(file.id);
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
          <p className="text-red-500">Error loading files: {error}</p>
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
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
          <tr>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('modified')}
            >
              Modified
              {sortConfig.key === 'modified' && (
                <span className="ml-1">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedFiles.map((file) => (
            <tr
              key={file.id}
              className={cn(
                'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer',
                selectedFile === file.id && 'bg-blue-50 dark:bg-blue-900/20',
              )}
              onClick={() => handleFileClick(file)}
              onDoubleClick={() => handleFileDoubleClick(file)}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {getFileIcon(file)}
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {file.type === 'folder' ? '—' : formatFileSize(file.size)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {formatDate(file.modified)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {file.type === 'folder' ? (
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
                  {file.type === 'file' && (
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
