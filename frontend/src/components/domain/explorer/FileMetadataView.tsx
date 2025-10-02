/**
 * FileMetadataView Component
 *
 * File metadata display component that shows detailed file information
 * including technical metadata, media properties, and file attributes.
 */

import { CalendarIcon, FileIcon, HardDriveIcon } from 'lucide-react';
import React from 'react';
import { formatBytes } from '@/utils';

interface FileMetadataViewProps {
  file: any;
  className?: string;
}

export const FileMetadataView: React.FC<FileMetadataViewProps> = ({
  file,
  className = '',
}) => {
  if (!file) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">
          Select a file to view metadata
        </div>
      </div>
    );
  }

  // formatBytes is now imported from @/utils

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`p-4 border rounded ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <FileIcon className="h-5 w-5" />
        <span className="font-medium">File Metadata Display</span>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <h4 className="font-medium text-sm mb-2">Basic Information</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span>{file.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Size:</span>
              <span>{formatBytes(file.sizeBytes || file.size_bytes || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Extension:</span>
              <span>{file.extension || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">MIME Type:</span>
              <span>{file.mime || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
            <CalendarIcon className="h-4 w-4" />
            Dates
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Modified:</span>
              <span>{formatDate(file.mtime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span>{formatDate(file.ctime)}</span>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
            <HardDriveIcon className="h-4 w-4" />
            Technical
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Media Kind:</span>
              <span>{file.mediaKind || file.media_kind || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Encoding:</span>
              <span>{file.encoding || 'N/A'}</span>
            </div>
            {file.hash && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Hash ({file.hashAlgo || file.hash_algo}):
                </span>
                <span className="font-mono text-xs">
                  {file.hash.substring(0, 16)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Path Info */}
        <div>
          <h4 className="font-medium text-sm mb-2">Location</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Path:</span>
              <span className="font-mono text-xs">{file.path}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t text-xs text-gray-500">
        File details and metadata display component integrated
      </div>
    </div>
  );
};

export default FileMetadataView;
