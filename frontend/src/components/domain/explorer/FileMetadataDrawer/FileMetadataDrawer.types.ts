/**
 * FileMetadataDrawer Types
 * Type definitions for the file metadata drawer component
 */

import type { FileItem } from '../VirtualizedFileTable/VirtualizedFileTable.types';

/**
 * Props for FileMetadataDrawer component
 */
export interface FileMetadataDrawerProps {
  /** Whether the drawer is open */
  open: boolean;

  /** File to display metadata for */
  file: FileItem | null;

  /** Volume ID for the file */
  volumeId: string;

  /** Callback when drawer is closed */
  onClose: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for testing */
  testId?: string;
}

/**
 * File metadata response from API
 */
export interface FileMetadata {
  file_id?: number;
  path?: string;
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Preview type for different media
 */
export type PreviewType = 'thumbnail' | 'image' | 'video' | 'audio' | 'document';

/**
 * Preview size options
 */
export type PreviewSize = 'small' | 'medium' | 'large';

/**
 * Media type categories
 */
export type MediaTypeCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';

/**
 * Helper function to get media type category from extension or media type
 */
export function getMediaTypeCategory(file: FileItem): MediaTypeCategory {
  const extension = file.extension?.toLowerCase() || '';
  const mediaType = file.media_type?.toLowerCase() || '';

  // Image types
  if (
    mediaType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)
  ) {
    return 'image';
  }

  // Video types
  if (
    mediaType.startsWith('video/') ||
    ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v'].includes(extension)
  ) {
    return 'video';
  }

  // Audio types
  if (
    mediaType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'].includes(extension)
  ) {
    return 'audio';
  }

  // Document types
  if (
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)
  ) {
    return 'document';
  }

  // Archive types
  if (
    ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'].includes(extension)
  ) {
    return 'archive';
  }

  // Code types
  if (
    ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'sh'].includes(extension)
  ) {
    return 'code';
  }

  return 'other';
}

/**
 * Helper function to check if preview is supported
 */
export function isPreviewSupported(file: FileItem): boolean {
  const category = getMediaTypeCategory(file);
  return ['image', 'video', 'audio'].includes(category);
}
