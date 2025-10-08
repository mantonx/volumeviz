/**
 * FileMetadataDrawer Component
 * Displays detailed file metadata and preview in a slide-out drawer
 */

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FolderIcon,
  Calendar,
  HardDrive,
  Info,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { useGetFilesIdMetadata, useGetFilesFileIdPreview } from '@/api/orval-generated/api';
import type {
  FileMetadataDrawerProps,
  MediaTypeCategory,
} from './FileMetadataDrawer.types';
import {
  getMediaTypeCategory,
  isPreviewSupported,
} from './FileMetadataDrawer.types';

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format date to human-readable format
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get icon for file type
 */
function getFileIcon(category: MediaTypeCategory): React.ReactNode {
  const iconClass = 'h-5 w-5';

  switch (category) {
    case 'image':
      return <FileImage className={iconClass} />;
    case 'video':
      return <FileVideo className={iconClass} />;
    case 'audio':
      return <FileAudio className={iconClass} />;
    case 'document':
      return <File className={iconClass} />;
    case 'archive':
      return <FileArchive className={iconClass} />;
    case 'code':
      return <FileCode className={iconClass} />;
    default:
      return <File className={iconClass} />;
  }
}

/**
 * Preview component for images
 */
const ImagePreview: React.FC<{ fileId: number; fileName: string }> = ({
  fileId,
}) => {
  const {
    data: previewData,
    isLoading,
    isError,
  } = useGetFilesFileIdPreview(
    fileId,
    { type: 'thumbnail', size: 'large' },
    {
      query: {
        enabled: !!fileId,
      },
    },
  );

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Loading preview...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !previewData?.data) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">Preview not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      <img
        src={`/api/v1/files/${fileId}/preview?type=thumbnail&size=large`}
        alt="File preview"
        className="w-full h-auto object-contain max-h-96"
        loading="lazy"
      />
    </div>
  );
};

/**
 * Preview component for videos
 */
const VideoPreview: React.FC<{ fileId: number; fileName: string }> = ({
  fileId,
}) => {
  return (
    <div className="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      <video
        controls
        className="w-full h-auto max-h-96"
        preload="metadata"
      >
        <source
          src={`/api/v1/files/${fileId}/preview?type=video&size=medium`}
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

/**
 * Preview component for audio
 */
const AudioPreview: React.FC<{ fileId: number; fileName: string }> = ({
  fileId,
}) => {
  return (
    <div className="w-full p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
      <div className="flex items-center justify-center mb-4">
        <FileAudio className="h-16 w-16 text-gray-400 dark:text-gray-500" />
      </div>
      <audio controls className="w-full">
        <source
          src={`/api/v1/files/${fileId}/preview?type=audio`}
          type="audio/mpeg"
        />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
};

/**
 * Fallback preview for unsupported file types
 */
const FallbackPreview: React.FC<{ file: any; category: MediaTypeCategory }> = ({
  file,
  category,
}) => {
  return (
    <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="text-center text-gray-500 dark:text-gray-400">
        {getFileIcon(category)}
        <p className="mt-4 text-sm font-medium">
          {file.extension?.toUpperCase() || 'File'}
        </p>
        <p className="text-xs mt-1">Preview not available</p>
      </div>
    </div>
  );
};

/**
 * Metadata row component
 */
const MetadataRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => {
  return (
    <div className="flex items-start py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center gap-2 w-1/3 text-sm font-medium text-gray-600 dark:text-gray-400">
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
        {label}
      </div>
      <div className="w-2/3 text-sm text-gray-900 dark:text-gray-100 break-all">
        {value}
      </div>
    </div>
  );
};

/**
 * FileMetadataDrawer Component
 */
export function FileMetadataDrawer({
  open,
  file,
  onClose,
  className = '',
  testId = 'file-metadata-drawer',
}: FileMetadataDrawerProps) {
  // Get file metadata
  const {
    data: metadataResponse,
    isLoading: metadataLoading,
    isError: metadataError,
  } = useGetFilesIdMetadata(
    file?.id || 0,
    {},
    {
      query: {
        enabled: !!file?.id && open,
      },
    },
  );

  const metadata = metadataResponse?.data && 'metadata' in metadataResponse.data
    ? metadataResponse.data
    : null;
  const category = useMemo(() => (file ? getMediaTypeCategory(file) : 'other'), [file]);
  const showPreview = useMemo(
    () => file && !file.is_directory && isPreviewSupported(file),
    [file],
  );

  // Don't render if no file
  if (!file) {
    return null;
  }

  return (
    <Modal
      open={open}
      variant="drawer"
      position="right"
      size="lg"
      animation="slide"
      onClose={onClose}
      closeOnEscape
      closeOnOutsideClick
      className={className}
      testId={testId}
      header={{
        title: (
          <div className="flex items-center gap-2">
            {file.is_directory ? (
              <FolderIcon className="h-5 w-5 text-blue-600" />
            ) : (
              getFileIcon(category)
            )}
            <span className="truncate">{file.name}</span>
          </div>
        ),
        subtitle: file.is_directory ? 'Directory' : 'File Details',
        showClose: true,
      }}
    >
      <div className="space-y-6">
        {/* Preview Section */}
        {showPreview && file.id && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Preview
            </h3>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {category === 'image' && (
                <ImagePreview fileId={file.id} fileName={file.name || 'image'} />
              )}
              {category === 'video' && (
                <VideoPreview fileId={file.id} fileName={file.name || 'video'} />
              )}
              {category === 'audio' && (
                <AudioPreview fileId={file.id} fileName={file.name || 'audio'} />
              )}
            </div>
          </div>
        )}

        {/* No preview for directories or unsupported files */}
        {!showPreview && !file.is_directory && (
          <FallbackPreview file={file} category={category} />
        )}

        {/* Basic Information */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Information
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <MetadataRow
              label="Name"
              value={file.name}
              icon={<File className="h-4 w-4" />}
            />
            <MetadataRow
              label="Path"
              value={<code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{file.path}</code>}
            />
            {!file.is_directory && (
              <>
                <MetadataRow
                  label="Size"
                  value={formatBytes(file.size)}
                  icon={<HardDrive className="h-4 w-4" />}
                />
                {file.extension && (
                  <MetadataRow
                    label="Extension"
                    value={
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        .{file.extension}
                      </span>
                    }
                  />
                )}
                {file.media_type && (
                  <MetadataRow label="Media Type" value={file.media_type} />
                )}
              </>
            )}
            <MetadataRow
              label="Type"
              value={file.is_directory ? 'Directory' : 'File'}
            />
            {file.modified_time && (
              <MetadataRow
                label="Modified"
                value={formatDate(file.modified_time)}
                icon={<Calendar className="h-4 w-4" />}
              />
            )}
          </div>
        </div>

        {/* Extended Metadata */}
        {metadataLoading && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Metadata
            </h3>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        )}

        {!metadataLoading && metadata?.metadata && Object.keys(metadata.metadata).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Extended Metadata
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(metadata.metadata).map(([key, value]) => (
                <MetadataRow
                  key={key}
                  label={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  value={
                    typeof value === 'object'
                      ? JSON.stringify(value, null, 2)
                      : String(value)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {metadataError && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Extended metadata could not be loaded.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
