/**
 * FileDrawer Component
 *
 * Sliding drawer component that displays detailed file metadata
 * including normalized media fields and raw JSON data.
 */

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import {
  CalendarIcon,
  FileIcon,
  HardDriveIcon,
  InfoIcon,
  TagIcon,
  X,
} from 'lucide-react';
import React from 'react';

interface FileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  extension?: string;
  mediaType?: string;
  created: string;
  modified: string;
  accessed?: string;
  permissions?: string;
  owner?: string;
  group?: string;
  // Media-specific fields
  duration?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  codec?: string;
  // Raw metadata from backend
  rawMetadata?: Record<string, any>;
}

interface FileDrawerProps {
  file: FileMetadata | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
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
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const FileDrawer: React.FC<FileDrawerProps> = ({
  file,
  isOpen,
  onClose,
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-96 bg-surface shadow-xl z-50 transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center space-x-2">
            <FileIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-primary">
              File Details
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!file ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Select a file to view details</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                  <InfoIcon className="w-4 h-4 mr-2" />
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                      Name
                    </label>
                    <p className="text-sm text-primary break-all">
                      {file.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                      Path
                    </label>
                    <p className="text-sm text-primary break-all font-mono">
                      {file.path}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                        Size
                      </label>
                      <p className="text-sm text-primary">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                        Type
                      </label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {file.extension || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Timestamps
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                      Created
                    </label>
                    <p className="text-sm text-primary">
                      {formatDate(file.created)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                      Modified
                    </label>
                    <p className="text-sm text-primary">
                      {formatDate(file.modified)}
                    </p>
                  </div>
                  {file.accessed && (
                    <div>
                      <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                        Accessed
                      </label>
                      <p className="text-sm text-primary">
                        {formatDate(file.accessed)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Media Properties (if applicable) */}
              {(file.duration || file.width || file.height || file.bitrate) && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                    <TagIcon className="w-4 h-4 mr-2" />
                    Media Properties
                  </h3>
                  <div className="space-y-3">
                    {file.duration && (
                      <div>
                        <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Duration
                        </label>
                        <p className="text-sm text-primary">
                          {formatDuration(file.duration)}
                        </p>
                      </div>
                    )}
                    {file.width && file.height && (
                      <div>
                        <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Dimensions
                        </label>
                        <p className="text-sm text-primary">
                          {file.width} × {file.height}
                        </p>
                      </div>
                    )}
                    {file.bitrate && (
                      <div>
                        <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Bitrate
                        </label>
                        <p className="text-sm text-primary">
                          {(file.bitrate / 1000).toFixed(0)} kbps
                        </p>
                      </div>
                    )}
                    {file.codec && (
                      <div>
                        <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Codec
                        </label>
                        <div className="mt-1">
                          <Badge variant="secondary">{file.codec}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System Properties */}
              {(file.permissions || file.owner || file.group) && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                    <HardDriveIcon className="w-4 h-4 mr-2" />
                    System Properties
                  </h3>
                  <div className="space-y-3">
                    {file.permissions && (
                      <div>
                        <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Permissions
                        </label>
                        <p className="text-sm text-primary font-mono">
                          {file.permissions}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {file.owner && (
                        <div>
                          <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                            Owner
                          </label>
                          <p className="text-sm text-primary">
                            {file.owner}
                          </p>
                        </div>
                      )}
                      {file.group && (
                        <div>
                          <label className="text-xs font-medium text-tertiary uppercase tracking-wider">
                            Group
                          </label>
                          <p className="text-sm text-primary">
                            {file.group}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Metadata */}
              {file.rawMetadata && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Raw Metadata
                  </h3>
                  <div className="bg-surface-secondary rounded-lg p-3">
                    <pre className="text-xs text-secondary overflow-x-auto">
                      {JSON.stringify(file.rawMetadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
