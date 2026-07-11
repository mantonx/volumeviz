/**
 * FileGrid Component
 *
 * Grid view component for displaying files with large previews.
 * Optimized for media files with thumbnail previews.
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
  FolderIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface FileGridProps {
  volumeId: string;
  currentPath: string;
  onFileSelect?: (file: FileItem) => void;
  onFileDoubleClick?: (file: FileItem) => void;
  className?: string;
  itemSize?: 'small' | 'medium' | 'large';
}

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
  });
};

export const FileGrid: React.FC<FileGridProps> = ({
  volumeId,
  currentPath,
  onFileSelect,
  onFileDoubleClick,
  className = '',
  itemSize = 'medium',
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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
    if (!files) return [];

    // Sort files with folders first, then by name
    return [...files].sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);

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

  const gridCols = useMemo(() => {
    switch (itemSize) {
      case 'small':
        return 'grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';
      case 'medium':
        return 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
      case 'large':
        return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      default:
        return 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
    }
  }, [itemSize]);

  const previewSize = useMemo(() => {
    switch (itemSize) {
      case 'small':
        return 'small';
      case 'medium':
        return 'medium';
      case 'large':
        return 'large';
      default:
        return 'medium';
    }
  }, [itemSize]);

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
    <div className={cn('p-4 overflow-auto', className)}>
      <div className={cn('grid gap-4', gridCols)}>
        {sortedFiles.map((file) => (
          <div
            key={file.path}
            className={cn(
              'group relative bg-surface rounded-lg border border-line',
              'hover:shadow-md hover:border-line transition-all duration-200',
              'cursor-pointer overflow-hidden',
              selectedFile === file.path && 'ring-2 ring-blue-500',
            )}
            onClick={() => handleFileClick(file)}
            onDoubleClick={() => handleFileDoubleClick(file)}
          >
            {/* Preview/Icon Area */}
            <div className="aspect-square bg-surface-secondary flex items-center justify-center relative">
              {file.is_directory ? (
                <FolderIcon
                  className={cn(
                    'text-blue-500',
                    itemSize === 'small' && 'w-8 h-8',
                    itemSize === 'medium' && 'w-12 h-12',
                    itemSize === 'large' && 'w-16 h-16',
                  )}
                />
              ) : file.media_type &&
                (file.media_type.startsWith('image/') ||
                  file.media_type.startsWith('video/') ||
                  file.media_type.startsWith('audio/')) ? (
                <PreviewImage
                  fileId={String(file.id ?? file.path)}
                  fileName={file.name}
                  mediaType={file.media_type}
                  size={previewSize}
                  className="w-full h-full"
                  lazy={true}
                  showBlurUp={true}
                  onClick={() => handleFileClick(file)}
                />
              ) : (
                <FileIcon
                  className={cn(
                    'text-gray-400',
                    itemSize === 'small' && 'w-8 h-8',
                    itemSize === 'medium' && 'w-12 h-12',
                    itemSize === 'large' && 'w-16 h-16',
                  )}
                />
              )}

              {/* Actions overlay */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 bg-white/90 bg-surface/90 hover:bg-white hover:bg-surface-hover"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle more actions
                  }}
                >
                  <MoreHorizontalIcon className="w-3 h-3" />
                </Button>
              </div>

              {/* Download button for files */}
              {!file.is_directory && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 bg-white/90 bg-surface/90 hover:bg-white hover:bg-surface-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle download
                    }}
                  >
                    <DownloadIcon className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="p-3">
              <div className="truncate text-sm font-medium text-primary mb-1">
                {file.name}
              </div>

              <div className="flex items-center justify-between text-xs text-tertiary">
                <div className="flex flex-col space-y-1">
                  {!file.is_directory && (
                    <span>{formatFileSize(file.size ?? 0)}</span>
                  )}
                  <span>
                    {file.modified_time ? formatDate(file.modified_time) : '—'}
                  </span>
                </div>

                {file.extension && (
                  <Badge variant="outline" className="text-xs">
                    {file.extension.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
